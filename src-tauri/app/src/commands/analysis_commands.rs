use crate::db::analysis::{self, DimensionVersion};
use crate::db::images::AnalysisResult;
use crate::db::indexer;
use crate::db::text_embedder::{OpenAiCompatibleTextEmbedder, TextEmbedder, TextEmbeddingConfig};
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

fn record_text_embedding_failure(
    db_state: &State<'_, Mutex<Option<Database>>>,
    image_id: &str,
    error: &str,
) {
    let _ = with_db(db_state, |conn| {
        indexer::record_text_embedding_failure(conn, image_id, error).map_err(|err| match err {
            indexer::IndexerError::Sql(sql) => sql,
            other => rusqlite::Error::ToSqlConversionFailure(Box::new(other)),
        })
    });
}

/// §5.4 — get_analysis
#[tauri::command]
pub fn get_analysis(
    image_id: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<Option<AnalysisResult>, String> {
    with_db(&db_state, |conn| analysis::get_analysis(conn, &image_id))
}

/// §5.4 — save_analysis
#[tauri::command]
pub fn save_analysis(
    image_id: String,
    analysis: AnalysisResult,
    provider: String,
    model: String,
    db_state: State<'_, Mutex<Option<Database>>>,
    embedding_config_state: State<'_, Mutex<Option<TextEmbeddingConfig>>>,
) -> Result<(), String> {
    let id = uuid::Uuid::new_v4().to_string();
    with_db(&db_state, |conn| {
        analysis::save_analysis(conn, &id, &image_id, &analysis, &provider, &model)
    })?;

    let config = embedding_config_state.lock().unwrap().clone();
    let Some(config) = config else {
        return Ok(());
    };

    let embedder = match OpenAiCompatibleTextEmbedder::new(config) {
        Ok(embedder) => embedder,
        Err(error) => {
            record_text_embedding_failure(&db_state, &image_id, &error.to_string());
            return Ok(());
        }
    };

    let text = indexer::normalize_analysis_text(&analysis);
    if text.is_empty() {
        return Ok(());
    }

    let vector = match embedder.encode(&text) {
        Ok(vector) => vector,
        Err(error) => {
            record_text_embedding_failure(&db_state, &image_id, &error.to_string());
            return Ok(());
        }
    };

    if let Err(error) = with_db(&db_state, |conn| {
        indexer::store_text_embedding(conn, &image_id, &vector, embedder.model_version()).map_err(
            |err| match err {
                indexer::IndexerError::Sql(sql) => sql,
                other => rusqlite::Error::ToSqlConversionFailure(Box::new(other)),
            },
        )
    }) {
        record_text_embedding_failure(&db_state, &image_id, &error);
    }

    Ok(())
}

/// §5.4 — get_dimension_history
#[tauri::command]
pub fn get_dimension_history(
    image_id: String,
    dimension: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<Vec<DimensionVersion>, String> {
    with_db(&db_state, |conn| {
        analysis::get_dimension_history(conn, &image_id, &dimension)
    })
}

/// §5.4 — save_dimension_version
#[tauri::command]
pub fn save_dimension_version(
    image_id: String,
    dimension: String,
    original: String,
    translated: String,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    let id = uuid::Uuid::new_v4().to_string();
    with_db(&db_state, |conn| {
        analysis::save_dimension_version(conn, &id, &image_id, &dimension, &original, &translated)
    })
}
