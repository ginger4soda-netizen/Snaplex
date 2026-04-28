use crate::db::chat;
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

#[tauri::command]
pub fn get_chat_messages(
    image_id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<Vec<chat::ChatMessageRow>, String> {
    with_db(&db_state, |conn| {
        chat::get_chat_messages(conn, &image_id)
    })
}

#[tauri::command]
pub fn save_chat_message(
    id: String,
    image_id: String,
    role: String,
    text: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    with_db(&db_state, |conn| {
        chat::save_chat_message(conn, &id, &image_id, &role, &text)
    })
}

#[tauri::command]
pub fn delete_chat_messages(
    image_id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    with_db(&db_state, |conn| {
        chat::delete_chat_messages(conn, &image_id)
    })
}
