use crate::commands::library_commands::CurrentLibrary;
use crate::db::cross_modal_embedder::{
    resolve_clip_model_path, ClipOnnxEmbedder, CrossModalEmbedder,
};
use crate::db::indexer;
use crate::db::search::SearchResult;
use crate::db::search_service::{self, EncodedVisualQuery};
use crate::db::text_embedder::{OpenAiCompatibleTextEmbedder, TextEmbedder, TextEmbeddingConfig};
use crate::db::Database;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{Emitter, State};

const BACKFILL_CHECKPOINT_BATCH_SIZE: usize = 8;

fn with_db<F, R>(db_state: &State<'_, Mutex<Option<Database>>>, f: F) -> Result<R, String>
where
    F: FnOnce(&rusqlite::Connection) -> Result<R, rusqlite::Error>,
{
    let guard = db_state.lock().unwrap();
    let db = guard.as_ref().ok_or("No library open")?;
    let conn = db.conn.lock().unwrap();
    f(&conn).map_err(|e| format!("Database error: {}", e))
}

fn ensure_library_open(db_state: &State<'_, Mutex<Option<Database>>>) -> Result<(), String> {
    let guard = db_state.lock().unwrap();
    guard
        .as_ref()
        .map(|_| ())
        .ok_or("No library open".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackfillSummary {
    pub channel_id: String,
    pub processed: usize,
    pub total: usize,
    pub indexed: usize,
    pub failed: usize,
    pub cancelled: bool,
    pub errors: Vec<String>,
}

impl BackfillSummary {
    fn new(channel_id: String, total: usize) -> Self {
        Self {
            channel_id,
            processed: 0,
            total,
            indexed: 0,
            failed: 0,
            cancelled: false,
            errors: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackfillProgress {
    pub channel_id: String,
    pub processed: usize,
    pub total: usize,
    pub indexed: usize,
    pub failed: usize,
    pub cancelled: bool,
    pub current_kind: String,
    pub current_file: Option<String>,
    pub eta_seconds: Option<u64>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackfillRun {
    pub channel_id: String,
    pub already_running: bool,
}

pub struct BackfillControl {
    cancel_requested: Arc<AtomicBool>,
    active_channel: Arc<Mutex<Option<String>>>,
}

impl Default for BackfillControl {
    fn default() -> Self {
        Self {
            cancel_requested: Arc::new(AtomicBool::new(false)),
            active_channel: Arc::new(Mutex::new(None)),
        }
    }
}

fn emit_backfill_progress(
    app: &tauri::AppHandle,
    summary: &BackfillSummary,
    started_at: Instant,
    current_kind: &str,
    current_file: Option<&str>,
    last_error: Option<&str>,
) {
    let eta_seconds = if summary.processed > 0 && summary.processed < summary.total {
        let elapsed = started_at.elapsed().as_secs_f64();
        let per_item = elapsed / summary.processed as f64;
        Some((per_item * (summary.total - summary.processed) as f64).ceil() as u64)
    } else {
        None
    };

    let _ = app.emit(
        "backfill-progress",
        BackfillProgress {
            channel_id: summary.channel_id.clone(),
            processed: summary.processed,
            total: summary.total,
            indexed: summary.indexed,
            failed: summary.failed,
            cancelled: summary.cancelled,
            current_kind: current_kind.to_string(),
            current_file: current_file.map(str::to_string),
            eta_seconds,
            last_error: last_error.map(str::to_string),
        },
    );
}

fn finish_if_backfill_cancelled(
    app: &tauri::AppHandle,
    cancel_requested: &AtomicBool,
    summary: &mut BackfillSummary,
    started_at: Instant,
) -> bool {
    if !cancel_requested.load(Ordering::Relaxed) {
        return false;
    }

    summary.cancelled = true;
    emit_backfill_progress(app, summary, started_at, "cancelled", None, None);
    true
}

/// §5.5 — search_images
#[tauri::command]
pub fn search_images(
    query: String,
    folder_id: Option<String>,
    db_state: State<'_, Mutex<Option<Database>>>,
    embedding_config_state: State<'_, Mutex<Option<TextEmbeddingConfig>>>,
) -> Result<Vec<SearchResult>, String> {
    ensure_library_open(&db_state)?;

    let embedder = embedding_config_state
        .lock()
        .unwrap()
        .clone()
        .and_then(|config| match OpenAiCompatibleTextEmbedder::new(config) {
            Ok(embedder) => Some(embedder),
            Err(error) => {
                log::warn!("semantic search disabled: {error}");
                None
            }
        });

    let semantic_query = search_service::encode_semantic_query(
        &query,
        embedder
            .as_ref()
            .map(|embedder| embedder as &dyn TextEmbedder),
    );

    with_db(&db_state, |conn| {
        search_service::search_images(conn, &query, folder_id.as_deref(), semantic_query.as_ref())
            .map_err(|error| match error {
                search_service::SearchServiceError::Sql(sql) => sql,
            })
    })
}

/// §5.5 — visual_search
#[tauri::command]
pub fn visual_search(
    query: String,
    limit: i32,
    folder_id: Option<String>,
    db_state: State<'_, Mutex<Option<Database>>>,
    clip_indexing_state: State<'_, Mutex<bool>>,
    clip_embedder_state: State<'_, Mutex<Option<ClipOnnxEmbedder>>>,
    app: tauri::AppHandle,
) -> Result<Vec<SearchResult>, String> {
    ensure_library_open(&db_state)?;

    if !*clip_indexing_state.lock().unwrap() {
        return Ok(vec![]);
    }

    let query = query.trim();
    if query.is_empty() || limit <= 0 {
        return Ok(vec![]);
    }

    let mut embedder_guard = clip_embedder_state.lock().unwrap();
    if embedder_guard.is_none() {
        let model_path = resolve_clip_model_path(&app);
        match ClipOnnxEmbedder::from_model_file(&model_path) {
            Ok(embedder) => *embedder_guard = Some(embedder),
            Err(error) => {
                log::warn!("visual search disabled: {error}");
                return Ok(vec![]);
            }
        }
    }

    let Some(embedder) = embedder_guard.as_ref() else {
        return Ok(vec![]);
    };

    let query_vector = match embedder.encode_text(query) {
        Ok(vector) => vector,
        Err(error) => {
            log::warn!("visual search unavailable: {error}");
            return Ok(vec![]);
        }
    };
    let visual_query = EncodedVisualQuery::new(query_vector, embedder.model_version());
    drop(embedder_guard);

    with_db(&db_state, |conn| {
        search_service::visual_search(conn, &visual_query, folder_id.as_deref(), limit as usize)
            .map_err(|error| match error {
                search_service::SearchServiceError::Sql(sql) => sql,
            })
    })
}

/// §5.5 / Slice 6 — index diagnostics for text and visual search.
#[tauri::command]
pub fn get_index_health(
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<indexer::IndexHealth, String> {
    with_db(&db_state, |conn| {
        indexer::get_index_health(conn, ClipOnnxEmbedder::MODEL_VERSION)
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipModelStatus {
    pub available: bool,
    pub expected_path: String,
    pub model_version: String,
    pub error: Option<String>,
}

/// Probes the CLIP ONNX weights so the frontend can warn the user when the
/// model is missing or unloadable. Visual search silently degrades to empty
/// results without this signal.
#[tauri::command]
pub fn clip_model_status(app: tauri::AppHandle) -> ClipModelStatus {
    let path = resolve_clip_model_path(&app);
    let expected_path = path.display().to_string();
    let model_version = ClipOnnxEmbedder::MODEL_VERSION.to_string();

    if !path.exists() {
        let error = format!("CLIP model file not found at {expected_path}");
        return ClipModelStatus {
            available: false,
            expected_path,
            model_version,
            error: Some(error),
        };
    }

    match ClipOnnxEmbedder::from_model_file(&path) {
        Ok(_) => ClipModelStatus {
            available: true,
            expected_path,
            model_version,
            error: None,
        },
        Err(error) => ClipModelStatus {
            available: false,
            expected_path,
            model_version,
            error: Some(error.to_string()),
        },
    }
}

/// §5.5 / Slice 6 — starts a background backfill run and returns its event channel id.
#[tauri::command]
pub fn start_backfill(
    db_state: State<'_, Mutex<Option<Database>>>,
    current: State<'_, CurrentLibrary>,
    embedding_config_state: State<'_, Mutex<Option<TextEmbeddingConfig>>>,
    clip_indexing_state: State<'_, Mutex<bool>>,
    backfill_control_state: State<'_, BackfillControl>,
    app: tauri::AppHandle,
) -> Result<BackfillRun, String> {
    ensure_library_open(&db_state)?;
    let Some(library) = current.info.lock().unwrap().clone() else {
        return Err("No library open".to_string());
    };
    let db_path = PathBuf::from(library.path).join("snaplex.db");
    let text_config = embedding_config_state.lock().unwrap().clone();
    let clip_indexing_enabled = *clip_indexing_state.lock().unwrap();

    let mut active_channel = backfill_control_state.active_channel.lock().unwrap();
    if let Some(channel_id) = active_channel.as_ref() {
        return Ok(BackfillRun {
            channel_id: channel_id.clone(),
            already_running: true,
        });
    }

    let channel_id = format!("backfill-{}", uuid::Uuid::new_v4());
    *active_channel = Some(channel_id.clone());
    drop(active_channel);

    backfill_control_state
        .cancel_requested
        .store(false, Ordering::Relaxed);

    let cancel_requested = Arc::clone(&backfill_control_state.cancel_requested);
    let active_channel = Arc::clone(&backfill_control_state.active_channel);
    let app_for_thread = app.clone();
    let channel_id_for_thread = channel_id.clone();

    std::thread::spawn(move || {
        run_backfill_job(
            db_path,
            text_config,
            clip_indexing_enabled,
            channel_id_for_thread.clone(),
            app_for_thread,
            cancel_requested,
        );

        let mut active = active_channel.lock().unwrap();
        if active.as_deref() == Some(channel_id_for_thread.as_str()) {
            *active = None;
        }
    });

    Ok(BackfillRun {
        channel_id,
        already_running: false,
    })
}

fn run_backfill_job(
    db_path: PathBuf,
    text_config: Option<TextEmbeddingConfig>,
    clip_indexing_enabled: bool,
    channel_id: String,
    app: tauri::AppHandle,
    cancel_requested: Arc<AtomicBool>,
) {
    let started_at = Instant::now();
    let db = match Database::new(&db_path) {
        Ok(db) => db,
        Err(error) => {
            let mut summary = BackfillSummary::new(channel_id, 0);
            let message = format!("Database error: {error}");
            summary.failed = 1;
            summary.errors.push(message.clone());
            emit_backfill_progress(&app, &summary, started_at, "failed", None, Some(&message));
            return;
        }
    };

    let text_embedder = text_config
        .and_then(TextEmbeddingConfig::normalized)
        .and_then(|config| match OpenAiCompatibleTextEmbedder::new(config) {
            Ok(embedder) => Some(embedder),
            Err(error) => {
                log::warn!("text embedding backfill disabled: {error}");
                None
            }
        });

    let (visual_candidates, text_candidates) = {
        let conn = db.conn.lock().unwrap();
        let visual = if clip_indexing_enabled {
            match indexer::images_missing_visual_embedding(&conn, ClipOnnxEmbedder::MODEL_VERSION) {
                Ok(candidates) => candidates,
                Err(error) => {
                    let mut summary = BackfillSummary::new(channel_id, 0);
                    let message = format!("Database error: {error}");
                    summary.failed = 1;
                    summary.errors.push(message.clone());
                    emit_backfill_progress(
                        &app,
                        &summary,
                        started_at,
                        "failed",
                        None,
                        Some(&message),
                    );
                    return;
                }
            }
        } else {
            vec![]
        };
        let text = match text_embedder.as_ref() {
            Some(embedder) => {
                match indexer::analyses_missing_text_embedding(&conn, embedder.model_version()) {
                    Ok(candidates) => candidates,
                    Err(error) => {
                        let mut summary = BackfillSummary::new(channel_id, visual.len());
                        let message = format!("Database error: {error}");
                        summary.failed = 1;
                        summary.errors.push(message.clone());
                        emit_backfill_progress(
                            &app,
                            &summary,
                            started_at,
                            "failed",
                            None,
                            Some(&message),
                        );
                        return;
                    }
                }
            }
            None => vec![],
        };
        (visual, text)
    };

    let mut summary =
        BackfillSummary::new(channel_id, visual_candidates.len() + text_candidates.len());
    emit_backfill_progress(&app, &summary, started_at, "start", None, None);
    persist_backfill_checkpoint(&db, &summary, "running", "start", None, None);

    let mut checkpoint_ticks = 0usize;
    let mut clip_embedder = if visual_candidates.is_empty() {
        None
    } else {
        let model_path = resolve_clip_model_path(&app);
        match ClipOnnxEmbedder::from_model_file(&model_path) {
            Ok(embedder) => Some(embedder),
            Err(error) => {
                let message = format!("CLIP model unavailable: {error}");
                log::warn!("{message}");
                summary.failed += visual_candidates.len();
                summary.processed += visual_candidates.len();
                summary.errors.push(message.clone());
                emit_backfill_progress(&app, &summary, started_at, "visual", None, Some(&message));
                persist_backfill_checkpoint(
                    &db,
                    &summary,
                    "running",
                    "visual",
                    None,
                    Some(&message),
                );
                None
            }
        }
    };

    if let Some(embedder) = clip_embedder.as_mut() {
        for candidate in visual_candidates {
            if finish_if_backfill_cancelled(&app, &cancel_requested, &mut summary, started_at) {
                persist_backfill_checkpoint(
                    &db,
                    &summary,
                    "cancelled",
                    "visual",
                    Some(&candidate.image_id),
                    None,
                );
                return;
            }

            let current_file = candidate.file_path.as_str();
            let result = embedder.encode_image(Path::new(current_file));
            let mut last_error = None;
            match result {
                Ok(vector) => {
                    let conn = db.conn.lock().unwrap();
                    if let Err(error) = indexer::store_visual_embedding(
                        &conn,
                        &candidate.image_id,
                        &vector,
                        embedder.model_version(),
                    ) {
                        let message = error.to_string();
                        summary.failed += 1;
                        summary.errors.push(format!("{current_file}: {message}"));
                        last_error = Some(message);
                    } else {
                        summary.indexed += 1;
                    }
                }
                Err(error) => {
                    let message = error.to_string();
                    let conn = db.conn.lock().unwrap();
                    let _ = indexer::record_visual_embedding_failure(
                        &conn,
                        &candidate.image_id,
                        &message,
                    );
                    summary.failed += 1;
                    summary.errors.push(format!("{current_file}: {message}"));
                    last_error = Some(message);
                }
            }
            summary.processed += 1;
            checkpoint_ticks += 1;
            emit_backfill_progress(
                &app,
                &summary,
                started_at,
                "visual",
                Some(current_file),
                last_error.as_deref(),
            );
            if checkpoint_ticks >= BACKFILL_CHECKPOINT_BATCH_SIZE {
                persist_backfill_checkpoint(
                    &db,
                    &summary,
                    "running",
                    "visual",
                    Some(&candidate.image_id),
                    last_error.as_deref(),
                );
                checkpoint_ticks = 0;
            }
        }
    }

    for (image_id, analysis) in text_candidates {
        if finish_if_backfill_cancelled(&app, &cancel_requested, &mut summary, started_at) {
            persist_backfill_checkpoint(&db, &summary, "cancelled", "text", Some(&image_id), None);
            return;
        }

        let text = indexer::normalize_analysis_text(&analysis);
        let current_file = image_id.as_str();
        let mut last_error = None;
        if !text.is_empty() {
            if let Some(embedder) = text_embedder.as_ref() {
                match embedder.encode(&text) {
                    Ok(vector) => {
                        let conn = db.conn.lock().unwrap();
                        if let Err(error) = indexer::store_text_embedding(
                            &conn,
                            &image_id,
                            &vector,
                            embedder.model_version(),
                        ) {
                            let message = error.to_string();
                            summary.failed += 1;
                            summary.errors.push(format!("{image_id}: {message}"));
                            last_error = Some(message);
                        } else {
                            summary.indexed += 1;
                        }
                    }
                    Err(error) => {
                        let message = error.to_string();
                        let conn = db.conn.lock().unwrap();
                        let _ = indexer::record_text_embedding_failure(&conn, &image_id, &message);
                        summary.failed += 1;
                        summary.errors.push(format!("{image_id}: {message}"));
                        last_error = Some(message);
                    }
                }
            }
        }

        summary.processed += 1;
        checkpoint_ticks += 1;
        emit_backfill_progress(
            &app,
            &summary,
            started_at,
            "text",
            Some(current_file),
            last_error.as_deref(),
        );
        if checkpoint_ticks >= BACKFILL_CHECKPOINT_BATCH_SIZE {
            persist_backfill_checkpoint(
                &db,
                &summary,
                "running",
                "text",
                Some(&image_id),
                last_error.as_deref(),
            );
            checkpoint_ticks = 0;
        }
    }

    persist_backfill_checkpoint(&db, &summary, "done", "done", None, None);
    emit_backfill_progress(&app, &summary, started_at, "done", None, None);
}

fn persist_backfill_checkpoint(
    db: &Database,
    summary: &BackfillSummary,
    status: &str,
    current_kind: &str,
    last_image_id: Option<&str>,
    last_error: Option<&str>,
) {
    let checkpoint = indexer::BackfillCheckpoint {
        channel_id: summary.channel_id.clone(),
        status: status.to_string(),
        current_kind: current_kind.to_string(),
        last_image_id: last_image_id.map(str::to_string),
        processed: summary.processed as i64,
        total: summary.total as i64,
        indexed: summary.indexed as i64,
        failed: summary.failed as i64,
        cancelled: summary.cancelled,
        last_error: last_error.map(str::to_string),
    };

    let conn = db.conn.lock().unwrap();
    if let Err(error) = indexer::save_backfill_checkpoint(&conn, &checkpoint) {
        log::warn!("failed to persist backfill checkpoint: {error}");
    }
}

#[tauri::command]
pub fn cancel_backfill(backfill_control_state: State<'_, BackfillControl>) {
    backfill_control_state
        .cancel_requested
        .store(true, Ordering::Relaxed);
}

#[tauri::command]
pub fn set_clip_indexing_enabled(
    enabled: bool,
    clip_indexing_state: State<'_, Mutex<bool>>,
) -> Result<(), String> {
    *clip_indexing_state.lock().unwrap() = enabled;
    Ok(())
}

#[tauri::command]
pub fn rebuild_text_index(
    db_state: State<'_, Mutex<Option<Database>>>,
    embedding_config_state: State<'_, Mutex<Option<TextEmbeddingConfig>>>,
) -> Result<(), String> {
    let model_version = embedding_config_state
        .lock()
        .unwrap()
        .clone()
        .and_then(TextEmbeddingConfig::normalized)
        .map(|config| config.model_version());

    with_db(&db_state, |conn| {
        indexer::clear_text_embedding_index(conn)?;
        indexer::save_text_embedding_model_meta(conn, model_version.as_deref())?;
        Ok(())
    })
}

/// Configure semantic text indexing for the current process. Empty or disabled
/// config means "semantic indexing off"; FTS remains available.
#[tauri::command]
pub fn set_text_embedding_config(
    config: Option<TextEmbeddingConfig>,
    embedding_config_state: State<'_, Mutex<Option<TextEmbeddingConfig>>>,
    db_state: State<'_, Mutex<Option<Database>>>,
) -> Result<(), String> {
    let normalized = config.and_then(TextEmbeddingConfig::normalized);
    let model_version = normalized.as_ref().map(TextEmbeddingConfig::model_version);

    {
        let mut guard = embedding_config_state.lock().unwrap();
        *guard = normalized;
    }

    let guard = db_state.lock().unwrap();
    if let Some(db) = guard.as_ref() {
        let conn = db.conn.lock().unwrap();
        indexer::save_text_embedding_model_meta(&conn, model_version.as_deref())
            .map_err(|e| format!("Database error: {}", e))?;
    }

    Ok(())
}
