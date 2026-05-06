use crate::db::folders::{self, FolderNode};
use crate::db::Database;
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

/// §5.2 — get_folder_tree
#[tauri::command]
pub fn get_folder_tree(
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<Vec<FolderNode>, String> {
    with_db(&db_state, |conn| folders::get_folder_tree(conn))
}

/// §5.2 — create_folder
#[tauri::command]
pub fn create_folder(
    name: String,
    parent_id: Option<String>,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<FolderNode, String> {
    let id = uuid::Uuid::new_v4().to_string();
    with_db(&db_state, |conn| {
        folders::create_folder(conn, &id, &name, parent_id.as_deref())
    })
}

/// §5.2 — rename_folder
#[tauri::command]
pub fn rename_folder(
    id: String,
    name: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    with_db(&db_state, |conn| folders::rename_folder(conn, &id, &name))
}

/// §5.2 — delete_folder
#[tauri::command]
pub fn delete_folder(
    id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    with_db(&db_state, |conn| folders::delete_folder(conn, &id))
}

/// §5.2 — move_folder
#[tauri::command]
pub fn move_folder(
    id: String,
    new_parent_id: Option<String>,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    with_db(&db_state, |conn| {
        folders::move_folder(conn, &id, new_parent_id.as_deref())
    })
}
