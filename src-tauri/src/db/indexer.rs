use std::path::Path;

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::cross_modal_embedder::{CrossModalEmbedder, CrossModalEmbedderError};
use super::images::AnalysisResult;
use super::text_embedder::{TextEmbedder, TextEmbedderError};
use super::vector_store::{self, VectorKind, VectorStoreError};

#[derive(Debug, Error)]
pub enum IndexerError {
    #[error(transparent)]
    Embedder(#[from] TextEmbedderError),
    #[error(transparent)]
    CrossModalEmbedder(#[from] CrossModalEmbedderError),
    #[error(transparent)]
    VectorStore(#[from] VectorStoreError),
    #[error(transparent)]
    Sql(#[from] rusqlite::Error),
}

pub type Result<T> = std::result::Result<T, IndexerError>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexKindHealth {
    pub indexed: i64,
    pub failed: i64,
    pub model_version: Option<String>,
    pub last_failure: Option<IndexFailureInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexHealth {
    pub total_images: i64,
    pub text: IndexKindHealth,
    pub visual: IndexKindHealth,
    pub latest_backfill: Option<BackfillCheckpoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IndexFailureInfo {
    pub image_id: String,
    pub last_error: String,
    pub retry_count: i64,
    pub last_attempt_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImageIndexCandidate {
    pub image_id: String,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackfillCheckpoint {
    pub channel_id: String,
    pub status: String,
    pub current_kind: String,
    pub last_image_id: Option<String>,
    pub processed: i64,
    pub total: i64,
    pub indexed: i64,
    pub failed: i64,
    pub cancelled: bool,
    pub last_error: Option<String>,
}

#[allow(dead_code)] // Public trait-level entry point; command path encodes outside the DB lock.
pub fn index_analysis_saved(
    conn: &Connection,
    image_id: &str,
    analysis: &AnalysisResult,
    embedder: &dyn TextEmbedder,
) -> Result<()> {
    let text = normalize_analysis_text(analysis);
    if text.is_empty() {
        return Ok(());
    }

    let vector = embedder.encode(&text)?;
    store_text_embedding(conn, image_id, &vector, embedder.model_version())?;

    Ok(())
}

pub fn store_text_embedding(
    conn: &Connection,
    image_id: &str,
    vector: &[f32],
    model_version: &str,
) -> Result<()> {
    vector_store::insert(conn, image_id, VectorKind::Text, vector, model_version)?;
    clear_embedding_failure(conn, image_id, "text")?;

    Ok(())
}

#[allow(dead_code)] // Trait-level event entry point; import command keeps image decode outside the DB lock.
pub fn index_image_imported(
    conn: &Connection,
    image_id: &str,
    image_path: &Path,
    embedder: &dyn CrossModalEmbedder,
) -> Result<()> {
    if vector_store::has_vector(conn, image_id, VectorKind::Visual, embedder.model_version())? {
        return Ok(());
    }

    let vector = embedder.encode_image(image_path)?;
    store_visual_embedding(conn, image_id, &vector, embedder.model_version())?;

    Ok(())
}

pub fn store_visual_embedding(
    conn: &Connection,
    image_id: &str,
    vector: &[f32],
    model_version: &str,
) -> Result<()> {
    vector_store::insert(conn, image_id, VectorKind::Visual, vector, model_version)?;
    clear_embedding_failure(conn, image_id, "visual")?;

    Ok(())
}

pub fn record_text_embedding_failure(conn: &Connection, image_id: &str, error: &str) -> Result<()> {
    record_embedding_failure(conn, image_id, "text", error)
}

pub fn record_visual_embedding_failure(
    conn: &Connection,
    image_id: &str,
    error: &str,
) -> Result<()> {
    record_embedding_failure(conn, image_id, "visual", error)
}

fn record_embedding_failure(
    conn: &Connection,
    image_id: &str,
    kind: &str,
    error: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO embedding_failures
         (image_id, kind, last_error, retry_count, last_attempt_at)
         VALUES (?1, ?2, ?3, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(image_id, kind) DO UPDATE SET
            last_error = excluded.last_error,
            retry_count = embedding_failures.retry_count + 1,
            last_attempt_at = CURRENT_TIMESTAMP",
        rusqlite::params![image_id, kind, error],
    )?;

    Ok(())
}

pub fn save_text_embedding_model_meta(
    conn: &Connection,
    model_version: Option<&str>,
) -> std::result::Result<(), rusqlite::Error> {
    match model_version {
        Some(model_version) => conn.execute(
            "INSERT INTO library_meta (key, value, updated_at)
             VALUES ('active_text_embedding_model_version', ?1, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP",
            rusqlite::params![model_version],
        )?,
        None => conn.execute(
            "DELETE FROM library_meta WHERE key = 'active_text_embedding_model_version'",
            [],
        )?,
    };

    Ok(())
}

pub fn clear_text_embedding_index(conn: &Connection) -> std::result::Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM embeddings", [])?;
    conn.execute("DELETE FROM embedding_failures WHERE kind = 'text'", [])?;

    Ok(())
}

pub fn get_index_health(
    conn: &Connection,
    active_visual_model_version: &str,
) -> std::result::Result<IndexHealth, rusqlite::Error> {
    let total_images = conn.query_row("SELECT COUNT(*) FROM images", [], |row| row.get(0))?;
    let text_model_version = active_text_embedding_model_version(conn)?;

    Ok(IndexHealth {
        total_images,
        text: IndexKindHealth {
            indexed: count_vectors(conn, "embeddings", text_model_version.as_deref())?,
            failed: count_failures(conn, "text")?,
            model_version: text_model_version,
            last_failure: last_failure(conn, "text")?,
        },
        visual: IndexKindHealth {
            indexed: count_vectors(conn, "visual_embeddings", Some(active_visual_model_version))?,
            failed: count_failures(conn, "visual")?,
            model_version: Some(active_visual_model_version.to_string()),
            last_failure: last_failure(conn, "visual")?,
        },
        latest_backfill: latest_backfill_checkpoint(conn)?,
    })
}

pub fn save_backfill_checkpoint(
    conn: &Connection,
    checkpoint: &BackfillCheckpoint,
) -> std::result::Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO backfill_checkpoints (
            channel_id, status, current_kind, last_image_id, processed, total,
            indexed, failed, cancelled, last_error, updated_at
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CURRENT_TIMESTAMP)
         ON CONFLICT(channel_id) DO UPDATE SET
            status = excluded.status,
            current_kind = excluded.current_kind,
            last_image_id = excluded.last_image_id,
            processed = excluded.processed,
            total = excluded.total,
            indexed = excluded.indexed,
            failed = excluded.failed,
            cancelled = excluded.cancelled,
            last_error = excluded.last_error,
            updated_at = CURRENT_TIMESTAMP",
        rusqlite::params![
            checkpoint.channel_id,
            checkpoint.status,
            checkpoint.current_kind,
            checkpoint.last_image_id,
            checkpoint.processed,
            checkpoint.total,
            checkpoint.indexed,
            checkpoint.failed,
            checkpoint.cancelled,
            checkpoint.last_error,
        ],
    )?;

    Ok(())
}

pub fn latest_backfill_checkpoint(
    conn: &Connection,
) -> std::result::Result<Option<BackfillCheckpoint>, rusqlite::Error> {
    conn.query_row(
        "SELECT channel_id, status, current_kind, last_image_id, processed, total,
                indexed, failed, cancelled, last_error
         FROM backfill_checkpoints
         ORDER BY updated_at DESC
         LIMIT 1",
        [],
        |row| {
            Ok(BackfillCheckpoint {
                channel_id: row.get(0)?,
                status: row.get(1)?,
                current_kind: row.get(2)?,
                last_image_id: row.get(3)?,
                processed: row.get(4)?,
                total: row.get(5)?,
                indexed: row.get(6)?,
                failed: row.get(7)?,
                cancelled: row.get(8)?,
                last_error: row.get(9)?,
            })
        },
    )
    .optional()
}

pub fn images_missing_visual_embedding(
    conn: &Connection,
    model_version: &str,
) -> std::result::Result<Vec<ImageIndexCandidate>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT i.id, i.file_path
         FROM images i
         WHERE NOT EXISTS (
            SELECT 1 FROM visual_embeddings ve
            WHERE ve.image_id = i.id AND ve.model_version = ?1
         )
         ORDER BY i.created_at ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![model_version], |row| {
        Ok(ImageIndexCandidate {
            image_id: row.get(0)?,
            file_path: row.get(1)?,
        })
    })?;

    rows.collect()
}

pub fn analyses_missing_text_embedding(
    conn: &Connection,
    model_version: &str,
) -> std::result::Result<Vec<(String, AnalysisResult)>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT a.image_id,
                COALESCE(a.description, ''),
                COALESCE(a.subject_en, ''), COALESCE(a.subject_cn, ''),
                COALESCE(a.environment_en, ''), COALESCE(a.environment_cn, ''),
                COALESCE(a.composition_en, ''), COALESCE(a.composition_cn, ''),
                COALESCE(a.lighting_en, ''), COALESCE(a.lighting_cn, ''),
                COALESCE(a.mood_en, ''), COALESCE(a.mood_cn, ''),
                COALESCE(a.style_en, ''), COALESCE(a.style_cn, '')
         FROM analysis a
         WHERE NOT EXISTS (
            SELECT 1 FROM embeddings e
            WHERE e.image_id = a.image_id AND e.model_version = ?1
         )
         ORDER BY a.created_at ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![model_version], |row| {
        Ok((
            row.get::<_, String>(0)?,
            AnalysisResult {
                description: row.get(1)?,
                structured_prompts: super::images::StructuredPrompts {
                    subject: super::images::PromptSegment {
                        original: row.get(2)?,
                        translated: row.get(3)?,
                    },
                    environment: super::images::PromptSegment {
                        original: row.get(4)?,
                        translated: row.get(5)?,
                    },
                    composition: super::images::PromptSegment {
                        original: row.get(6)?,
                        translated: row.get(7)?,
                    },
                    lighting: super::images::PromptSegment {
                        original: row.get(8)?,
                        translated: row.get(9)?,
                    },
                    mood: super::images::PromptSegment {
                        original: row.get(10)?,
                        translated: row.get(11)?,
                    },
                    style: super::images::PromptSegment {
                        original: row.get(12)?,
                        translated: row.get(13)?,
                    },
                },
            },
        ))
    })?;

    rows.collect()
}

fn active_text_embedding_model_version(
    conn: &Connection,
) -> std::result::Result<Option<String>, rusqlite::Error> {
    conn.query_row(
        "SELECT value FROM library_meta WHERE key = 'active_text_embedding_model_version'",
        [],
        |row| row.get(0),
    )
    .optional()
}

fn count_vectors(
    conn: &Connection,
    table_name: &str,
    model_version: Option<&str>,
) -> std::result::Result<i64, rusqlite::Error> {
    match model_version {
        Some(model_version) => conn.query_row(
            &format!("SELECT COUNT(*) FROM {table_name} WHERE model_version = ?1"),
            rusqlite::params![model_version],
            |row| row.get(0),
        ),
        None => conn.query_row(&format!("SELECT COUNT(*) FROM {table_name}"), [], |row| {
            row.get(0)
        }),
    }
}

fn count_failures(conn: &Connection, kind: &str) -> std::result::Result<i64, rusqlite::Error> {
    conn.query_row(
        "SELECT COUNT(*) FROM embedding_failures WHERE kind = ?1",
        rusqlite::params![kind],
        |row| row.get(0),
    )
}

fn last_failure(
    conn: &Connection,
    kind: &str,
) -> std::result::Result<Option<IndexFailureInfo>, rusqlite::Error> {
    conn.query_row(
        "SELECT image_id, last_error, retry_count, last_attempt_at
         FROM embedding_failures
         WHERE kind = ?1
         ORDER BY last_attempt_at DESC
         LIMIT 1",
        rusqlite::params![kind],
        |row| {
            Ok(IndexFailureInfo {
                image_id: row.get(0)?,
                last_error: row.get(1)?,
                retry_count: row.get(2)?,
                last_attempt_at: row.get(3)?,
            })
        },
    )
    .optional()
}

fn clear_embedding_failure(
    conn: &Connection,
    image_id: &str,
    kind: &str,
) -> std::result::Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM embedding_failures WHERE image_id = ?1 AND kind = ?2",
        rusqlite::params![image_id, kind],
    )?;

    Ok(())
}

pub fn normalize_analysis_text(analysis: &AnalysisResult) -> String {
    let p = &analysis.structured_prompts;
    [
        analysis.description.as_str(),
        p.subject.original.as_str(),
        p.subject.translated.as_str(),
        p.environment.original.as_str(),
        p.environment.translated.as_str(),
        p.composition.original.as_str(),
        p.composition.translated.as_str(),
        p.lighting.original.as_str(),
        p.lighting.translated.as_str(),
        p.mood.original.as_str(),
        p.mood.translated.as_str(),
        p.style.original.as_str(),
        p.style.translated.as_str(),
    ]
    .into_iter()
    .map(str::trim)
    .filter(|part| !part.is_empty())
    .collect::<Vec<_>>()
    .join(" ")
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::path::{Path, PathBuf};

    use rusqlite::Connection;

    use super::{
        analyses_missing_text_embedding, clear_text_embedding_index, get_index_health,
        images_missing_visual_embedding, index_analysis_saved, latest_backfill_checkpoint,
        normalize_analysis_text, record_text_embedding_failure, save_backfill_checkpoint,
        save_text_embedding_model_meta, BackfillCheckpoint,
    };
    use crate::db::cross_modal_embedder::{
        CrossModalEmbedder, CrossModalEmbedderError, Result as CrossModalEmbedderResult,
    };
    use crate::db::images::{AnalysisResult, PromptSegment, StructuredPrompts};
    use crate::db::schema;
    use crate::db::text_embedder::{Result as TextEmbedderResult, TextEmbedder};
    use crate::db::vector_store::{self, nearest, VectorKind};

    struct MockTextEmbedder {
        model_version: String,
        vector: Vec<f32>,
        seen_input: RefCell<Vec<String>>,
    }

    struct MockCrossModalEmbedder {
        model_version: String,
        vector: Vec<f32>,
        seen_paths: RefCell<Vec<PathBuf>>,
    }

    impl TextEmbedder for MockTextEmbedder {
        fn model_version(&self) -> &str {
            &self.model_version
        }

        fn encode(&self, input: &str) -> TextEmbedderResult<Vec<f32>> {
            self.seen_input.borrow_mut().push(input.to_string());
            Ok(self.vector.clone())
        }
    }

    impl CrossModalEmbedder for MockCrossModalEmbedder {
        fn model_version(&self) -> &str {
            &self.model_version
        }

        fn encode_text(&self, _input: &str) -> CrossModalEmbedderResult<Vec<f32>> {
            Err(CrossModalEmbedderError::EmptyTextInput)
        }

        fn encode_image(&self, path: &Path) -> CrossModalEmbedderResult<Vec<f32>> {
            self.seen_paths.borrow_mut().push(path.to_path_buf());
            Ok(self.vector.clone())
        }
    }

    fn fresh_db() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::create_tables(&conn).expect("schema");
        conn
    }

    fn insert_image(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO images (id, filename, file_path) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, format!("{id}.jpg"), format!("/tmp/{id}.jpg")],
        )
        .unwrap();
    }

    fn make_analysis(description: &str) -> AnalysisResult {
        AnalysisResult {
            description: description.to_string(),
            structured_prompts: StructuredPrompts {
                subject: PromptSegment {
                    original: "sunset".to_string(),
                    translated: "夕阳".to_string(),
                },
                environment: PromptSegment {
                    original: "harbor".to_string(),
                    translated: "港湾".to_string(),
                },
                composition: PromptSegment {
                    original: String::new(),
                    translated: String::new(),
                },
                lighting: PromptSegment {
                    original: String::new(),
                    translated: String::new(),
                },
                mood: PromptSegment {
                    original: String::new(),
                    translated: String::new(),
                },
                style: PromptSegment {
                    original: String::new(),
                    translated: String::new(),
                },
            },
        }
    }

    #[test]
    fn normalize_analysis_text_combines_non_empty_fields() {
        let text = normalize_analysis_text(&make_analysis("golden hour"));

        assert_eq!(text, "golden hour sunset 夕阳 harbor 港湾");
    }

    #[test]
    fn index_analysis_saved_writes_text_vector() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");
        let embedder = MockTextEmbedder {
            model_version: "text-v1".to_string(),
            vector: vec![1.0, 0.0, 0.0],
            seen_input: RefCell::new(vec![]),
        };

        index_analysis_saved(&conn, "img-1", &make_analysis("golden hour"), &embedder).unwrap();

        assert_eq!(
            embedder.seen_input.into_inner(),
            vec!["golden hour sunset 夕阳 harbor 港湾"]
        );
        let results = nearest(&conn, VectorKind::Text, &[1.0, 0.0, 0.0], "text-v1", 1).unwrap();
        assert_eq!(results[0].image_id, "img-1");
    }

    #[test]
    fn successful_indexing_clears_prior_failure() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");
        record_text_embedding_failure(&conn, "img-1", "rate limited").unwrap();
        let embedder = MockTextEmbedder {
            model_version: "text-v1".to_string(),
            vector: vec![1.0, 0.0],
            seen_input: RefCell::new(vec![]),
        };

        index_analysis_saved(&conn, "img-1", &make_analysis("golden hour"), &embedder).unwrap();

        let failures: i64 = conn
            .query_row("SELECT COUNT(*) FROM embedding_failures", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(failures, 0);
    }

    #[test]
    fn index_image_imported_writes_visual_vector() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");
        let image_path = PathBuf::from("/tmp/img-1.jpg");
        let embedder = MockCrossModalEmbedder {
            model_version: "clip-v1".to_string(),
            vector: vec![0.0, 1.0],
            seen_paths: RefCell::new(vec![]),
        };

        super::index_image_imported(&conn, "img-1", &image_path, &embedder).unwrap();

        assert_eq!(embedder.seen_paths.into_inner(), vec![image_path]);
        let results = nearest(&conn, VectorKind::Visual, &[0.0, 1.0], "clip-v1", 1).unwrap();
        assert_eq!(results[0].image_id, "img-1");
    }

    #[test]
    fn index_image_imported_skips_current_model_vector() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");
        vector_store::insert(&conn, "img-1", VectorKind::Visual, &[1.0, 0.0], "clip-v1").unwrap();
        let embedder = MockCrossModalEmbedder {
            model_version: "clip-v1".to_string(),
            vector: vec![0.0, 1.0],
            seen_paths: RefCell::new(vec![]),
        };

        super::index_image_imported(&conn, "img-1", Path::new("/tmp/img-1.jpg"), &embedder)
            .unwrap();

        assert!(embedder.seen_paths.into_inner().is_empty());
        let results = nearest(&conn, VectorKind::Visual, &[1.0, 0.0], "clip-v1", 1).unwrap();
        assert_eq!(results[0].image_id, "img-1");
        assert!((results[0].score - 1.0).abs() < 1e-9);
    }

    #[test]
    fn index_health_counts_current_model_vectors_and_failures() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");
        insert_image(&conn, "img-2");
        save_text_embedding_model_meta(&conn, Some("text-v1")).unwrap();
        vector_store::insert(&conn, "img-1", VectorKind::Text, &[1.0, 0.0], "text-v1").unwrap();
        vector_store::insert(&conn, "img-2", VectorKind::Text, &[0.0, 1.0], "text-v2").unwrap();
        vector_store::insert(&conn, "img-1", VectorKind::Visual, &[1.0, 0.0], "clip-v1").unwrap();
        record_text_embedding_failure(&conn, "img-2", "rate limited").unwrap();
        super::record_visual_embedding_failure(&conn, "img-2", "decode failed").unwrap();

        let health = get_index_health(&conn, "clip-v1").unwrap();

        assert_eq!(health.total_images, 2);
        assert_eq!(health.text.indexed, 1);
        assert_eq!(health.text.failed, 1);
        assert_eq!(health.text.model_version.as_deref(), Some("text-v1"));
        assert_eq!(
            health
                .text
                .last_failure
                .as_ref()
                .map(|failure| failure.image_id.as_str()),
            Some("img-2")
        );
        assert_eq!(
            health
                .text
                .last_failure
                .as_ref()
                .map(|failure| failure.last_error.as_str()),
            Some("rate limited")
        );
        assert_eq!(health.visual.indexed, 1);
        assert_eq!(health.visual.failed, 1);
        assert_eq!(health.visual.model_version.as_deref(), Some("clip-v1"));
        assert_eq!(
            health
                .visual
                .last_failure
                .as_ref()
                .map(|failure| failure.image_id.as_str()),
            Some("img-2")
        );
        assert!(health.latest_backfill.is_none());
    }

    #[test]
    fn backfill_checkpoint_upserts_latest_run_state() {
        let conn = fresh_db();
        let checkpoint = BackfillCheckpoint {
            channel_id: "backfill-1".to_string(),
            status: "running".to_string(),
            current_kind: "visual".to_string(),
            last_image_id: Some("img-1".to_string()),
            processed: 8,
            total: 10,
            indexed: 7,
            failed: 1,
            cancelled: false,
            last_error: Some("decode failed".to_string()),
        };

        save_backfill_checkpoint(&conn, &checkpoint).unwrap();
        save_backfill_checkpoint(
            &conn,
            &BackfillCheckpoint {
                status: "done".to_string(),
                processed: 10,
                indexed: 9,
                ..checkpoint
            },
        )
        .unwrap();

        let saved = latest_backfill_checkpoint(&conn).unwrap().unwrap();

        assert_eq!(saved.channel_id, "backfill-1");
        assert_eq!(saved.status, "done");
        assert_eq!(saved.processed, 10);
        assert_eq!(saved.indexed, 9);
        assert_eq!(saved.last_error.as_deref(), Some("decode failed"));
    }

    #[test]
    fn clear_text_embedding_index_removes_text_vectors_and_failures_only() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");
        vector_store::insert(&conn, "img-1", VectorKind::Text, &[1.0, 0.0], "text-v1").unwrap();
        vector_store::insert(&conn, "img-1", VectorKind::Visual, &[0.0, 1.0], "clip-v1").unwrap();
        record_text_embedding_failure(&conn, "img-1", "rate limited").unwrap();
        super::record_visual_embedding_failure(&conn, "img-1", "decode failed").unwrap();

        clear_text_embedding_index(&conn).unwrap();

        let text_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM embeddings", [], |row| row.get(0))
            .unwrap();
        let visual_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM visual_embeddings", [], |row| {
                row.get(0)
            })
            .unwrap();
        let text_failures: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM embedding_failures WHERE kind = 'text'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let visual_failures: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM embedding_failures WHERE kind = 'visual'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(text_count, 0);
        assert_eq!(visual_count, 1);
        assert_eq!(text_failures, 0);
        assert_eq!(visual_failures, 1);
    }

    #[test]
    fn missing_index_candidates_skip_current_model_vectors() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");
        insert_image(&conn, "img-2");
        vector_store::insert(&conn, "img-1", VectorKind::Visual, &[1.0, 0.0], "clip-v1").unwrap();
        vector_store::insert(&conn, "img-2", VectorKind::Visual, &[1.0, 0.0], "clip-old").unwrap();
        conn.execute(
            "INSERT INTO analysis (
                id, image_id, description,
                subject_en, subject_cn, environment_en, environment_cn,
                composition_en, composition_cn, lighting_en, lighting_cn,
                mood_en, mood_cn, style_en, style_cn
             ) VALUES (
                'a-1', 'img-1', 'red neon',
                '', '', '', '', '', '', '', '', '', '', '', ''
             )",
            [],
        )
        .unwrap();
        vector_store::insert(&conn, "img-1", VectorKind::Text, &[1.0, 0.0], "text-old").unwrap();

        let visual = images_missing_visual_embedding(&conn, "clip-v1").unwrap();
        let text = analyses_missing_text_embedding(&conn, "text-v1").unwrap();

        assert_eq!(
            visual
                .iter()
                .map(|item| item.image_id.as_str())
                .collect::<Vec<_>>(),
            vec!["img-2"]
        );
        assert_eq!(
            text.iter()
                .map(|(image_id, _)| image_id.as_str())
                .collect::<Vec<_>>(),
            vec!["img-1"]
        );
    }
}
