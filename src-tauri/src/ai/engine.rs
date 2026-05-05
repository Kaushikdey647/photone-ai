use crate::config::AppSettings;
use crate::edit_delta::{parse_editor_delta_from_assistant, EditorDelta};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const SYSTEM_PROMPT: &str = r#"You are Photone AI, an assistant inside a non-destructive photo editor.

When the user asks for edits, respond with a single JSON object ONLY (no prose) matching this TypeScript shape:
{"version":1,"adjustments":{"exposure":number,"contrast":number,"highlights":number,"shadows":number,"temperature":number,"tint":number},"lutId":string|null}

All adjustment numbers are deltas added on top of the current values the user already has (small steps, typically -0.2..0.2 except temperature/tint maybe -20..20 if you use Kelvin-style — here they are abstract units, keep small).
If the user is chatting without requesting edits, reply with normal concise prose (no JSON)."#;

#[derive(Debug, Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    content: String,
}

pub async fn complete_chat(
    client: &reqwest::Client,
    settings: &AppSettings,
    api_key: &str,
    history: Vec<ChatMessage>,
    user_message: String,
) -> Result<String, String> {
    let url = chat_completions_url(&settings.base_url)?;
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", api_key))
            .map_err(|e| e.to_string())?,
    );
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let mut messages = vec![ChatMessage {
        role: "system".to_string(),
        content: SYSTEM_PROMPT.to_string(),
    }];
    for m in history {
        if m.role == "system" {
            continue;
        }
        messages.push(m);
    }
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: user_message,
    });

    let body = ChatCompletionRequest {
        model: settings.model.as_str(),
        messages,
        temperature: 0.2,
    };

    let res = client
        .post(&url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(format!("OpenAI-compatible API error: {}", text));
    }

    let parsed: ChatCompletionResponse = res.json().await.map_err(|e| e.to_string())?;
    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| "Empty completion response".to_string())
}

fn chat_completions_url(base: &str) -> Result<String, String> {
    let trimmed = base.trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        Ok(trimmed.to_string())
    } else {
        Ok(format!("{}/chat/completions", trimmed))
    }
}

pub fn build_user_payload(
    user_text: &str,
    editor_state_json: &str,
    workspace_hint: Option<&str>,
    photo_hint: Option<&str>,
) -> String {
    let mut ctx = json!({
        "user_request": user_text,
        "editor_state": serde_json::from_str::<Value>(editor_state_json).unwrap_or(Value::String(editor_state_json.to_string())),
    });
    if let Some(w) = workspace_hint {
        ctx["workspace"] = json!(w);
    }
    if let Some(p) = photo_hint {
        ctx["active_photo"] = json!(p);
    }
    format!(
        "{}\n\nUse the JSON context below when reasoning about edits.\n```json\n{}\n```",
        user_text,
        serde_json::to_string_pretty(&ctx).unwrap_or_else(|_| "{}".into())
    )
}

pub fn try_parse_delta(assistant: &str) -> Option<EditorDelta> {
    parse_editor_delta_from_assistant(assistant)
}
