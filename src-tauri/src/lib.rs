mod commands;
mod db;
mod fs;

use commands::library_commands::CurrentLibrary;
use db::Database;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(None::<Database>))
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
            commands::image_commands::import_images,
            commands::image_commands::delete_images,
            commands::image_commands::move_images,
            commands::image_commands::link_image_to_folder,
            commands::image_commands::get_image_detail,
            commands::image_commands::update_image_memo,
            commands::image_commands::toggle_favorite,
            commands::image_commands::open_image_in_finder,
            commands::image_commands::export_images,
            // §5.4 Analysis
            commands::analysis_commands::get_analysis,
            commands::analysis_commands::save_analysis,
            commands::analysis_commands::get_dimension_history,
            commands::analysis_commands::save_dimension_version,
            // §5.5 Search
            commands::search_commands::search_images,
            commands::search_commands::save_text_embedding,
            commands::search_commands::visual_search,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
