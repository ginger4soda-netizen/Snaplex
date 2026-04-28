use crate::db::images::{self, ColorInfo, ImageDetail, ImageItem, ImportResult};
use crate::db::Database;
use rusqlite::OptionalExtension;
use std::sync::Mutex;
use tauri::State;

fn with_db<F, R>(db_state: &State<'_, Mutex<Option<Database>>>, f: F) -> Result<R, String>
where
    F: FnOnce(&rusqlite::Connection) -> Result<R, rusqlite::Error>,
{
    let guard = db_state.lock().unwrap();
    let db = guard.as_ref().ok_or("No library open")?;
    let conn = db.conn.lock().unwrap();
    f(&conn).map_err(|e| format!("Database error: {}", e))
}

/// §5.3 — get_images
#[tauri::command]
pub fn get_images(
    folder_id: Option<String>,
    offset: i64,
    limit: i64,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<Vec<ImageItem>, String> {
    with_db(&db_state, |conn| {
        images::get_images(conn, folder_id.as_deref(), offset, limit)
    })
}

/// §5.3 — get_images_by_ids (batch fetch for search results)
#[tauri::command]
pub fn get_images_by_ids(
    ids: Vec<String>,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<Vec<ImageItem>, String> {
    with_db(&db_state, |conn| images::get_images_by_ids(conn, &ids))
}

/// §5.3 — count_images (for pagination total)
#[tauri::command]
pub fn count_images(
    folder_id: Option<String>,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<i64, String> {
    with_db(&db_state, |conn| {
        images::count_images(conn, folder_id.as_deref())
    })
}

/// §5.3 — import_images
/// Phase 0: basic import — copies files into library, creates DB records
#[tauri::command]
pub fn import_images(
    file_paths: Vec<String>,
    folder_id: Option<String>,
    db_state: State<'_, Mutex<Option<Database>>>,
    current: State<'_, crate::commands::library_commands::CurrentLibrary>,
) -> Result<ImportResult, String> {
    let lib_info = current.info.lock().unwrap();
    let lib_path = lib_info
        .as_ref()
        .ok_or("No library open")?
        .path
        .clone();
    drop(lib_info);

    let images_dir = std::path::Path::new(&lib_path).join("images");
    let thumbs_dir = std::path::Path::new(&lib_path).join("thumbnails");

    let mut imported = 0;
    let mut failed = 0;
    let mut errors = Vec::new();

    for src_path in &file_paths {
        let src = std::path::Path::new(src_path);
        let filename = match src.file_name().and_then(|f| f.to_str()) {
            Some(f) => f.to_string(),
            None => {
                failed += 1;
                errors.push(format!("Invalid filename: {}", src_path));
                continue;
            }
        };

        // Deduplicate: skip if same filename + file_size already in library
        let src_size = std::fs::metadata(src).map(|m| m.len() as i64).unwrap_or(0);
        let already_exists = with_db(&db_state, |conn| {
            images::image_exists_by_name_size(conn, &filename, src_size)
        }).unwrap_or(false);
        if already_exists {
            // Skip silently — not an error, just a duplicate
            continue;
        }

        let id = uuid::Uuid::new_v4().to_string();
        // Use UUID prefix to avoid filename collisions
        let _ext = src.extension().and_then(|e| e.to_str()).unwrap_or("jpg");
        let stored_filename = format!("{}_{}", &id[..8], filename);
        let dest = images_dir.join(&stored_filename);
        let thumb_dest = thumbs_dir.join(format!("{}.webp", id));

        // Copy file
        if let Err(e) = std::fs::copy(src, &dest) {
            failed += 1;
            errors.push(format!("Copy failed {}: {}", filename, e));
            continue;
        }

        let file_size = std::fs::metadata(&dest).map(|m| m.len() as i64).unwrap_or(0);
        let (width, height) = image::image_dimensions(&dest).unwrap_or((0, 0));
        let format = src
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Insert into DB
        let result = with_db(&db_state, |conn| {
            images::insert_image(
                conn,
                &id,
                &filename,
                dest.to_str().unwrap_or(""),
                thumb_dest.to_str(),
                width as i32,
                height as i32,
                file_size,
                &format,
            )?;
            // Link to folder if specified
            if let Some(ref fid) = folder_id {
                images::link_image_to_folder(conn, &id, fid)?;
            }
            Ok(())
        });

        match result {
            Ok(()) => imported += 1,
            Err(e) => {
                failed += 1;
                errors.push(format!("DB insert failed {}: {}", filename, e));
            }
        }
    }

    Ok(ImportResult {
        imported,
        failed,
        errors,
    })
}

/// §5.3 — delete_images
#[tauri::command]
pub fn delete_images(
    ids: Vec<String>,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    with_db(&db_state, |conn| images::delete_images(conn, &ids))
}

/// §5.3 — move_images
#[tauri::command]
pub fn move_images(
    ids: Vec<String>,
    target_folder_id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    with_db(&db_state, |conn| {
        images::move_images(conn, &ids, &target_folder_id)
    })
}

/// §5.3 — link_image_to_folder
#[tauri::command]
pub fn link_image_to_folder(
    image_id: String,
    folder_id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    with_db(&db_state, |conn| {
        images::link_image_to_folder(conn, &image_id, &folder_id)
    })
}

/// §5.3 — get_image_detail
#[tauri::command]
pub fn get_image_detail(
    id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<ImageDetail, String> {
    with_db(&db_state, |conn| images::get_image_detail(conn, &id))
}

/// §5.3 — update_image_memo
#[tauri::command]
pub fn update_image_memo(
    id: String,
    memo: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    with_db(&db_state, |conn| images::update_memo(conn, &id, &memo))
}

/// §5.3 — toggle_favorite
#[tauri::command]
pub fn toggle_favorite(
    id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<bool, String> {
    with_db(&db_state, |conn| images::toggle_favorite(conn, &id))
}

/// §5.3 — open_image_in_finder
#[tauri::command]
pub fn open_image_in_finder(
    id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    let file_path = with_db(&db_state, |conn| {
        conn.query_row(
            "SELECT file_path FROM images WHERE id = ?1",
            rusqlite::params![&id],
            |row| row.get::<_, String>(0),
        )
    })?;

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(std::path::Path::new(&file_path).parent().unwrap_or(std::path::Path::new("/")))
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

/// §5.3 — export_images
#[tauri::command]
pub fn export_images(
    ids: Vec<String>,
    format: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<String, String> {
    let _ = &format;
    let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let export_dir = dirs::download_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .join(format!("snaplex-export-{}", timestamp));
    std::fs::create_dir_all(&export_dir)
        .map_err(|e| format!("Failed to create export dir: {}", e))?;

    for id in &ids {
        let file_path = with_db(&db_state, |conn| {
            conn.query_row(
                "SELECT file_path FROM images WHERE id = ?1",
                rusqlite::params![id],
                |row| row.get::<_, String>(0),
            )
        })?;

        let src = std::path::Path::new(&file_path);
        let filename = src
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("image");
        let dest = export_dir.join(filename);

        std::fs::copy(src, &dest)
            .map_err(|e| format!("Failed to copy {}: {}", filename, e))?;
    }

    Ok(export_dir.to_string_lossy().to_string())
}

/// Read image file as base64 for AI analysis
/// Frontend fetch() on asset:// URLs can fail depending on protocol config.
/// This command reads the file directly via the filesystem and returns base64.
#[tauri::command]
pub fn read_image_base64(
    id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<String, String> {
    let file_path = with_db(&db_state, |conn| {
        conn.query_row(
            "SELECT file_path FROM images WHERE id = ?1",
            rusqlite::params![&id],
            |row| row.get::<_, String>(0),
        )
    })?;

    let bytes = std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read image file: {}", e))?;

    // Detect MIME type from extension
    let ext = std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    };

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// §5.6 — extract_color_palette (mock for Phase 0)
#[tauri::command]
pub fn extract_color_palette(
    image_id: String,
    color_count: Option<i32>,
) -> Result<Vec<ColorInfo>, String> {
    let count = color_count.unwrap_or(8);
    // Mock palette for Phase 0
    let mock_colors: Vec<ColorInfo> = (0..count)
        .map(|i| {
            let hue = (i as f64 / count as f64 * 360.0) as u8;
            ColorInfo {
                hex: format!("#{:02x}{:02x}{:02x}", 100 + i * 15, 80 + i * 10, 60 + i * 20),
                rgb: (100 + (i * 15) as u8, 80 + (i * 10) as u8, 60 + (i * 20) as u8),
                hsl: (hue as f64, 50.0, 50.0),
                percentage: 100.0 / count as f64,
                name: format!("Color {}", i + 1),
            }
        })
        .collect();
    let _ = image_id;
    Ok(mock_colors)
}

/// §5.6 — get_color_palette
#[tauri::command]
pub fn get_color_palette(
    image_id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<Option<Vec<ColorInfo>>, String> {
    with_db(&db_state, |conn| {
        let result: Option<String> = conn
            .query_row(
                "SELECT colors FROM color_palettes WHERE image_id = ?1",
                rusqlite::params![&image_id],
                |row| row.get(0),
            )
            .optional()?;

        match result {
            Some(json_str) => {
                let colors: Vec<ColorInfo> = serde_json::from_str(&json_str).unwrap_or_default();
                Ok(Some(colors))
            }
            None => Ok(None),
        }
    })
}

/// §5.6 — save_color_palette
#[tauri::command]
pub fn save_color_palette(
    image_id: String,
    colors: Vec<ColorInfo>,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    let json_str =
        serde_json::to_string(&colors).map_err(|e| format!("JSON serialize error: {}", e))?;
    let id = uuid::Uuid::new_v4().to_string();
    let count = colors.len() as i32;
    with_db(&db_state, |conn| {
        conn.execute(
            "INSERT OR REPLACE INTO color_palettes (id, image_id, colors, color_count) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![&id, &image_id, &json_str, count],
        )?;
        Ok(())
    })
}
