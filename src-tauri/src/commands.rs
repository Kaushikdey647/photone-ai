use crate::ai::engine::{self, ChatMessage};
use crate::config::{self, AppSettings};
use crate::db::queries;
use crate::edit_delta::EditorDelta;
use crate::image_io::processor;
use serde::Serialize;
use sqlx::SqlitePool;
use std::path::Path;
use tauri::State;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub http: reqwest::Client,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsDto {
    pub base_url: String,
    pub model: String,
    pub has_api_key: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageResponse {
    pub assistant_text: String,
    pub editor_delta: Option<EditorDelta>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PhotoRow {
    pub id: i64,
    pub file_path: String,
    pub thumbnail_path: Option<String>,
    pub date_imported: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPhotosResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

fn validate_scope(kind: &str) -> Result<(), String> {
    match kind {
        "workspace" | "photo" => Ok(()),
        _ => Err("scope_kind must be 'workspace' or 'photo'".into()),
    }
}

#[tauri::command]
pub async fn get_settings(_state: State<'_, AppState>) -> Result<AppSettingsDto, String> {
    let settings = config::load_settings();
    let has = config::get_api_key()?.is_some();
    Ok(AppSettingsDto {
        base_url: settings.base_url,
        model: settings.model,
        has_api_key: has,
    })
}

#[tauri::command]
pub async fn set_settings(
    base_url: String,
    model: String,
    api_key: Option<String>,
) -> Result<(), String> {
    let trimmed = base_url.trim().to_string();
    if trimmed.is_empty() {
        return Err("base_url cannot be empty".into());
    }
    let model = model.trim().to_string();
    if model.is_empty() {
        return Err("model cannot be empty".into());
    }
    let settings = AppSettings {
        base_url: trimmed,
        model,
    };
    config::save_settings(&settings)?;
    if let Some(k) = api_key {
        if k.trim().is_empty() {
            config::set_api_key(None)?;
        } else {
            config::set_api_key(Some(k.trim()))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn list_chat_messages(
    state: State<'_, AppState>,
    scope_kind: String,
    scope_key: String,
    limit: Option<i64>,
) -> Result<Vec<queries::MessageRow>, String> {
    validate_scope(&scope_kind)?;
    let limit = limit.unwrap_or(200).clamp(1, 500);
    let cid = queries::get_or_create_conversation(&state.db, &scope_kind, &scope_key)
        .await
        .map_err(|e| e.to_string())?;
    queries::list_recent_messages_tail(&state.db, cid, limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_chat_message(
    state: State<'_, AppState>,
    scope_kind: String,
    scope_key: String,
    user_text: String,
    editor_state_json: String,
    workspace_hint: Option<String>,
    photo_hint: Option<String>,
    history_limit: Option<i64>,
) -> Result<SendMessageResponse, String> {
    validate_scope(&scope_kind)?;
    let api_key = config::get_api_key()?.ok_or("API key is not configured")?;
    let settings = config::load_settings();

    let cid = queries::get_or_create_conversation(&state.db, &scope_kind, &scope_key)
        .await
        .map_err(|e| e.to_string())?;

    let hist_limit = history_limit.unwrap_or(40).clamp(1, 100);
    let prior = queries::list_recent_messages_tail(&state.db, cid, hist_limit)
        .await
        .map_err(|e| e.to_string())?;

    let history: Vec<ChatMessage> = prior
        .into_iter()
        .map(|m| ChatMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    let user_payload = engine::build_user_payload(
        &user_text,
        &editor_state_json,
        workspace_hint.as_deref(),
        photo_hint.as_deref(),
    );

    queries::insert_message(&state.db, cid, "user", &user_payload)
        .await
        .map_err(|e| e.to_string())?;

    let assistant_text = engine::complete_chat(
        &state.http,
        &settings,
        &api_key,
        history.clone(),
        user_payload.clone(),
    )
    .await?;

    queries::insert_message(&state.db, cid, "assistant", &assistant_text)
        .await
        .map_err(|e| e.to_string())?;
    queries::touch_conversation(&state.db, cid)
        .await
        .map_err(|e| e.to_string())?;

    let editor_delta = engine::try_parse_delta(&assistant_text);

    Ok(SendMessageResponse {
        assistant_text,
        editor_delta,
    })
}

#[tauri::command]
pub async fn list_photos(state: State<'_, AppState>) -> Result<Vec<PhotoRow>, String> {
    sqlx::query_as::<_, PhotoRow>("SELECT id, file_path, thumbnail_path, date_imported FROM photos ORDER BY datetime(date_imported) DESC LIMIT 200")
        .fetch_all(&state.db)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}

const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "tif", "tiff", "bmp", "gif", "heic", "heif", "raw", "cr2",
    "cr3", "nef", "arw", "dng", "orf", "rw2", "raf", "pef", "srw", "kdc", "3fr",
];

fn extension_allowed(ext: &str) -> bool {
    IMAGE_EXTENSIONS.iter().any(|e| *e == ext)
}

/// Import catalog entries for existing image files. Paths must be absolute and pass extension checks.
#[tauri::command]
pub async fn import_photos(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<ImportPhotosResult, String> {
    const MAX_FILES: usize = 200;
    const MAX_BYTES: u64 = 450 * 1024 * 1024;

    if paths.len() > MAX_FILES {
        return Err(format!(
            "Too many files at once (max {}). Split into batches.",
            MAX_FILES
        ));
    }

    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut errors = Vec::new();

    for raw in paths {
        let path = Path::new(&raw);
        if !path.is_absolute() {
            errors.push(format!("Rejected non-absolute path: {}", raw));
            continue;
        }
        let meta = match std::fs::metadata(path) {
            Ok(m) if m.is_file() => m,
            Ok(_) => {
                skipped += 1;
                continue;
            }
            Err(e) => {
                errors.push(format!("{}: {}", raw, e));
                continue;
            }
        };
        if meta.len() > MAX_BYTES {
            errors.push(format!(
                "{}: file too large (max {} MB)",
                raw,
                MAX_BYTES / 1024 / 1024
            ));
            continue;
        }

        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !extension_allowed(&ext) {
            skipped += 1;
            continue;
        }

        let canon = match path.canonicalize() {
            Ok(p) => p,
            Err(e) => {
                errors.push(format!("{}: {}", raw, e));
                continue;
            }
        };
        let store_path = canon.to_string_lossy().into_owned();

        let dup: Option<(i64,)> = match sqlx::query_as("SELECT id FROM photos WHERE file_path = ?1")
            .bind(&store_path)
            .fetch_optional(&state.db)
            .await
        {
            Ok(x) => x,
            Err(e) => {
                errors.push(format!("{}: {}", store_path, e));
                continue;
            }
        };
        if dup.is_some() {
            skipped += 1;
            continue;
        }

        let now = chrono::Utc::now().to_rfc3339();
        match sqlx::query(
            "INSERT INTO photos (file_path, thumbnail_path, date_imported, tags, ai_description, exif_text) VALUES (?1, NULL, ?2, '', '', '')",
        )
        .bind(&store_path)
        .bind(&now)
        .execute(&state.db)
        .await
        {
            Ok(_) => imported += 1,
            Err(e) => errors.push(format!("{}: {}", store_path, e)),
        }
    }

    Ok(ImportPhotosResult {
        imported,
        skipped,
        errors,
    })
}

#[tauri::command]
pub async fn save_snapshot(
    state: State<'_, AppState>,
    photo_id: i64,
    name: String,
    edit_state: String,
) -> Result<i64, String> {
    sqlx::query("INSERT INTO snapshots (photo_id, name, edit_state) VALUES (?1, ?2, ?3)")
        .bind(photo_id)
        .bind(name)
        .bind(edit_state)
        .execute(&state.db)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    let id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
        .fetch_one(&state.db)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub async fn export_batch(paths: Vec<String>) -> Result<String, String> {
    processor::batch_export_stub(paths).await
}
