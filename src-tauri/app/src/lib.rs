mod commands;
mod db;
mod fs;
mod services;
mod transport;

use commands::library_commands::CurrentLibrary;
use commands::search_commands::BackfillControl;
use commands::settings_commands::SettingsState;
use db::cross_modal_embedder::ClipOnnxEmbedder;
use db::text_embedder::TextEmbeddingConfig;
use db::Database;
use services::capture_log::CaptureLog;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(None::<Database>))
        .manage(Mutex::new(None::<TextEmbeddingConfig>))
        .manage(Mutex::new(None::<ClipOnnxEmbedder>))
        .manage(Mutex::new(true))
        .manage(BackfillControl::default())
        .manage(SettingsState::default())
        .manage(CaptureLog::default())
        .manage(CurrentLibrary {
            info: Mutex::new(None),
        })
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            if let Err(error) = transport::local_socket::start(app.handle().clone()) {
                log::warn!("failed to start Snaplex local socket transport: {error}");
            }
            if !cfg!(debug_assertions) {
                match transport::manifest::install_native_messaging_manifests(app.handle()) {
                    Ok(paths) if !paths.is_empty() => {
                        log::info!(
                            "installed Snaplex Native Messaging manifests: {}",
                            paths
                                .iter()
                                .map(|path| path.display().to_string())
                                .collect::<Vec<_>>()
                                .join(", ")
                        );
                    }
                    Ok(_) => {}
                    Err(error) => {
                        log::warn!("failed to install Snaplex Native Messaging manifest: {error}");
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // §5.1 Library
            commands::library_commands::open_library,
            commands::library_commands::create_library,
            commands::library_commands::get_current_library,
            // §5.2 Folders
            commands::folder_commands::get_folder_tree,
            commands::folder_commands::create_folder,
            commands::folder_commands::rename_folder,
            commands::folder_commands::delete_folder,
            commands::folder_commands::move_folder,
            // §5.3 Images
            commands::image_commands::get_images,
            commands::image_commands::get_images_by_ids,
            commands::image_commands::count_images,
            commands::image_commands::import_images,
            commands::image_commands::delete_images,
            commands::image_commands::move_images,
            commands::image_commands::remove_images_from_folders,
            commands::image_commands::link_image_to_folder,
            commands::image_commands::get_image_detail,
            commands::image_commands::get_image_sources,
            commands::image_commands::update_image_memo,
            commands::image_commands::toggle_favorite,
            commands::image_commands::set_favorites,
            commands::image_commands::open_image_in_finder,
            commands::image_commands::export_images,
            // §5.4 Analysis
            commands::analysis_commands::get_analysis,
            commands::analysis_commands::save_analysis,
            commands::analysis_commands::get_dimension_history,
            commands::analysis_commands::save_dimension_version,
            // §5.5 Search
            commands::search_commands::search_images,
            commands::search_commands::visual_search,
            commands::search_commands::get_index_health,
            commands::search_commands::clip_model_status,
            commands::search_commands::start_backfill,
            commands::search_commands::cancel_backfill,
            commands::search_commands::set_clip_indexing_enabled,
            commands::search_commands::rebuild_text_index,
            commands::search_commands::set_text_embedding_config,
            // §5.6 Color
            commands::image_commands::read_image_base64,
            commands::image_commands::extract_color_palette,
            commands::image_commands::get_color_palette,
            commands::image_commands::save_color_palette,
            // Chat
            commands::chat_commands::get_chat_messages,
            commands::chat_commands::save_chat_message,
            commands::chat_commands::delete_chat_messages,
            // §5.7 File system
            commands::fs_commands::write_text_file,
            commands::fs_commands::debug_log,
            commands::fs_commands::write_clipboard_text,
            commands::fs_commands::export_capture_diagnostics,
            // §5.8 Settings
            commands::settings_commands::get_current_locale,
            commands::settings_commands::set_current_locale,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
