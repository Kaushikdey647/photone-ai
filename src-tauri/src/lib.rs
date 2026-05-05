mod ai;
mod commands;
mod config;
mod db;
mod edit_delta;
mod image_io;

use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state: AppState = tauri::async_runtime::block_on(async {
                let dir = config::app_data_dir()?;
                std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
                let db_path = dir.join("library.db");
                let pool = db::connect_pool(&db_path)
                    .await
                    .map_err(|e| e.to_string())?;
                let http = reqwest::Client::builder()
                    .use_rustls_tls()
                    .build()
                    .map_err(|e| e.to_string())?;
                Ok::<AppState, String>(AppState { db: pool, http })
            })
            .expect("failed to initialize database");
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::set_settings,
            commands::list_chat_messages,
            commands::send_chat_message,
            commands::list_photos,
            commands::import_photos,
            commands::save_snapshot,
            commands::export_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
