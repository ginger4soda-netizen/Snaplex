use crate::db::search::{self, SearchResult};
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

/// §5.5 — search_images
#[tauri::command]
pub fn search_images(
    query: String,
    folder_id: Option<String>,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<Vec<SearchResult>, String> {
    with_db(&db_state, |conn| {
        search::search_fts(conn, &query, folder_id.as_deref())
    })
}

/// §5.5 — save_text_embedding (stub for Phase 0)
#[tauri::command]
pub fn save_text_embedding(
    image_id: String,
    vector: Vec<f64>,
    model: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    let _ = (&image_id, &vector, &model, &db_state);
    // Phase 0: stub — will implement in Phase 2
    Ok(())
}

/// §5.5 — visual_search (stub for Phase 0)
#[tauri::command]
pub fn visual_search(query: String, limit: i32) -> Result<Vec<SearchResult>, String> {
    let _ = (&query, &limit);
    // Phase 0: return empty — CLIP integration in Phase 2
    Ok(vec![])
}
