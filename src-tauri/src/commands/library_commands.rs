use crate::db::Database;
use crate::fs::library;
use crate::fs::LibraryInfo;
use std::sync::Mutex;
use tauri::State;

pub struct CurrentLibrary {
    pub info: Mutex<Option<LibraryInfo>>,
}

/// §5.1 — open_library
#[tauri::command]
pub fn open_library(
    path: String,
    db_state: State<'_, Mutex<Option<Database>>>,
    current: State<'_, CurrentLibrary>,
) -> Result<LibraryInfo, String> {
    let info = library::open_library(&path)?;

    // Initialize database for this library
    let db_path = std::path::Path::new(&path).join("snaplex.db");
    let db = Database::new(&db_path).map_err(|e| format!("Database error: {}", e))?;
    *db_state.lock().unwrap() = Some(db);
    *current.info.lock().unwrap() = Some(info.clone());

    Ok(info)
}

/// §5.1 — create_library
#[tauri::command]
pub fn create_library(
    path: String,
    name: String,
    db_state: State<'_, Mutex<Option<Database>>>,
    current: State<'_, CurrentLibrary>,
) -> Result<LibraryInfo, String> {
    let info = library::create_library(&path, &name)?;

    // Initialize database
    let db_path = std::path::Path::new(&path).join("snaplex.db");
    let db = Database::new(&db_path).map_err(|e| format!("Database error: {}", e))?;
    *db_state.lock().unwrap() = Some(db);
    *current.info.lock().unwrap() = Some(info.clone());

    Ok(info)
}

/// §5.1 — get_current_library
#[tauri::command]
pub fn get_current_library(
    current: State<'_, CurrentLibrary>,
) -> Result<Option<LibraryInfo>, String> {
    Ok(current.info.lock().unwrap().clone())
}
