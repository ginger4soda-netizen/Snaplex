use rusqlite::Connection;
use thiserror::Error;

use super::search::{self, SearchResult};
use super::text_embedder::TextEmbedder;
use super::vector_store::{self, VectorKind, VectorStoreError};

const DEFAULT_LIMIT: usize = 50;

#[derive(Debug, Error)]
pub enum SearchServiceError {
    #[error(transparent)]
    Sql(#[from] rusqlite::Error),
}

#[derive(Debug, Error)]
enum SemanticSearchError {
    #[error(transparent)]
    VectorStore(#[from] VectorStoreError),
    #[error(transparent)]
    Sql(#[from] rusqlite::Error),
}

pub type Result<T> = std::result::Result<T, SearchServiceError>;

#[derive(Debug, Clone, PartialEq)]
pub struct EncodedSemanticQuery {
    vector: Vec<f32>,
    model_version: String,
}

impl EncodedSemanticQuery {
    pub fn new(vector: Vec<f32>, model_version: impl Into<String>) -> Self {
        Self {
            vector,
            model_version: model_version.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct EncodedVisualQuery {
    vector: Vec<f32>,
    model_version: String,
}

impl EncodedVisualQuery {
    pub fn new(vector: Vec<f32>, model_version: impl Into<String>) -> Self {
        Self {
            vector,
            model_version: model_version.into(),
        }
    }
}

pub fn encode_semantic_query(
    query: &str,
    text_embedder: Option<&dyn TextEmbedder>,
) -> Option<EncodedSemanticQuery> {
    let query = query.trim();
    let embedder = text_embedder?;
    if query.is_empty() {
        return None;
    }

    match embedder.encode(query) {
        Ok(vector) => Some(EncodedSemanticQuery::new(vector, embedder.model_version())),
        Err(error) => {
            log::warn!("semantic search unavailable: {error}");
            None
        }
    }
}

/// Run the user-visible library search across the sources available in this
/// slice. FTS remains the required baseline; semantic failures are isolated so
/// a bad key, network outage, or stale vector table cannot break keyword search.
pub fn search_images(
    conn: &Connection,
    query: &str,
    folder_id: Option<&str>,
    semantic_query: Option<&EncodedSemanticQuery>,
) -> Result<Vec<SearchResult>> {
    let mut results = search::search_fts(conn, query, folder_id)?;

    if let Some(semantic_query) = semantic_query {
        match search_semantic(conn, folder_id, semantic_query, DEFAULT_LIMIT) {
            Ok(mut semantic_results) => results.append(&mut semantic_results),
            Err(error) => {
                log::warn!("semantic search unavailable: {error}");
            }
        }
    }

    Ok(results)
}

pub fn visual_search(
    conn: &Connection,
    visual_query: &EncodedVisualQuery,
    folder_id: Option<&str>,
    limit: usize,
) -> Result<Vec<SearchResult>> {
    if limit == 0 {
        return Ok(vec![]);
    }

    let nearest = vector_store::nearest(
        conn,
        VectorKind::Visual,
        &visual_query.vector,
        &visual_query.model_version,
        if folder_id.is_some() {
            usize::MAX
        } else {
            limit
        },
    )
    .map_err(|error| match error {
        VectorStoreError::Sql(sql) => SearchServiceError::Sql(sql),
        other => SearchServiceError::Sql(rusqlite::Error::ToSqlConversionFailure(Box::new(other))),
    })?;

    let mut results = Vec::with_capacity(limit);
    for result in nearest {
        if let Some(folder_id) = folder_id {
            if !image_in_folder(conn, &result.image_id, folder_id)? {
                continue;
            }
        }

        results.push(SearchResult {
            image_id: result.image_id,
            score: result.score,
            match_type: "clip".to_string(),
        });

        if results.len() == limit {
            break;
        }
    }

    Ok(results)
}

fn search_semantic(
    conn: &Connection,
    folder_id: Option<&str>,
    semantic_query: &EncodedSemanticQuery,
    limit: usize,
) -> std::result::Result<Vec<SearchResult>, SemanticSearchError> {
    if limit == 0 {
        return Ok(vec![]);
    }

    let nearest = vector_store::nearest(
        conn,
        VectorKind::Text,
        &semantic_query.vector,
        &semantic_query.model_version,
        usize::MAX,
    )?;

    let mut results = Vec::with_capacity(limit);
    for result in nearest {
        if let Some(folder_id) = folder_id {
            if !image_in_folder(conn, &result.image_id, folder_id)? {
                continue;
            }
        }

        results.push(SearchResult {
            image_id: result.image_id,
            score: result.score,
            match_type: "embedding".to_string(),
        });

        if results.len() == limit {
            break;
        }
    }

    Ok(results)
}

fn image_in_folder(
    conn: &Connection,
    image_id: &str,
    folder_id: &str,
) -> std::result::Result<bool, rusqlite::Error> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM image_folders WHERE image_id = ?1 AND folder_id = ?2",
        rusqlite::params![image_id, folder_id],
        |row| row.get(0),
    )?;

    Ok(count > 0)
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::{
        encode_semantic_query, search_images, visual_search, EncodedSemanticQuery,
        EncodedVisualQuery,
    };
    use crate::db::schema;
    use crate::db::search;
    use crate::db::text_embedder::{Result as TextEmbedderResult, TextEmbedder, TextEmbedderError};
    use crate::db::vector_store::{self, VectorKind};

    struct MockTextEmbedder {
        model_version: String,
        vector: Vec<f32>,
        fail: bool,
    }

    impl TextEmbedder for MockTextEmbedder {
        fn model_version(&self) -> &str {
            &self.model_version
        }

        fn encode(&self, _input: &str) -> TextEmbedderResult<Vec<f32>> {
            if self.fail {
                Err(TextEmbedderError::Api {
                    status: 429,
                    message: "rate limited".to_string(),
                })
            } else {
                Ok(self.vector.clone())
            }
        }
    }

    fn fresh_db() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::create_tables(&conn).expect("schema");
        conn
    }

    fn insert_image(conn: &Connection, id: &str, folder_id: Option<&str>) {
        conn.execute(
            "INSERT INTO images (id, filename, file_path) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, format!("{id}.jpg"), format!("/tmp/{id}.jpg")],
        )
        .unwrap();

        if let Some(folder_id) = folder_id {
            conn.execute(
                "INSERT OR IGNORE INTO folders (id, name) VALUES (?1, ?1)",
                rusqlite::params![folder_id],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO image_folders (image_id, folder_id) VALUES (?1, ?2)",
                rusqlite::params![id, folder_id],
            )
            .unwrap();
        }
    }

    #[test]
    fn returns_fts_and_semantic_results_with_match_types() {
        let conn = fresh_db();
        insert_image(&conn, "fts-hit", None);
        insert_image(&conn, "semantic-hit", None);
        search::update_search_index(&conn, "fts-hit", "literal harbor", "").unwrap();
        vector_store::insert(
            &conn,
            "semantic-hit",
            VectorKind::Text,
            &[1.0, 0.0],
            "text-v1",
        )
        .unwrap();
        let semantic_query = EncodedSemanticQuery::new(vec![1.0, 0.0], "text-v1");

        let results = search_images(&conn, "harbor", None, Some(&semantic_query)).unwrap();

        assert!(results
            .iter()
            .any(|result| result.image_id == "fts-hit" && result.match_type == "fts"));
        assert!(results
            .iter()
            .any(|result| result.image_id == "semantic-hit" && result.match_type == "embedding"));
    }

    #[test]
    fn semantic_search_respects_folder_filter() {
        let conn = fresh_db();
        insert_image(&conn, "in-folder", Some("folder-a"));
        insert_image(&conn, "out-folder", Some("folder-b"));
        vector_store::insert(&conn, "in-folder", VectorKind::Text, &[1.0, 0.0], "text-v1").unwrap();
        vector_store::insert(
            &conn,
            "out-folder",
            VectorKind::Text,
            &[0.99, 0.01],
            "text-v1",
        )
        .unwrap();
        let semantic_query = EncodedSemanticQuery::new(vec![1.0, 0.0], "text-v1");

        let results =
            search_images(&conn, "concept", Some("folder-a"), Some(&semantic_query)).unwrap();

        assert_eq!(
            results
                .iter()
                .filter(|result| result.match_type == "embedding")
                .map(|result| result.image_id.as_str())
                .collect::<Vec<_>>(),
            vec!["in-folder"]
        );
    }

    #[test]
    fn embedder_failure_degrades_to_fts_results() {
        let conn = fresh_db();
        insert_image(&conn, "fts-hit", None);
        search::update_search_index(&conn, "fts-hit", "literal harbor", "").unwrap();
        let embedder = MockTextEmbedder {
            model_version: "text-v1".to_string(),
            vector: vec![],
            fail: true,
        };

        let semantic_query = encode_semantic_query("harbor", Some(&embedder));
        let results = search_images(&conn, "harbor", None, semantic_query.as_ref()).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].image_id, "fts-hit");
        assert_eq!(results[0].match_type, "fts");
    }

    #[test]
    fn visual_search_returns_clip_results_from_visual_vectors() {
        let conn = fresh_db();
        insert_image(&conn, "best", None);
        insert_image(&conn, "other", None);
        vector_store::insert(&conn, "best", VectorKind::Visual, &[1.0, 0.0], "clip-v1").unwrap();
        vector_store::insert(&conn, "other", VectorKind::Visual, &[0.0, 1.0], "clip-v1").unwrap();
        let query = EncodedVisualQuery::new(vec![1.0, 0.0], "clip-v1");

        let results = visual_search(&conn, &query, None, 2).unwrap();

        assert_eq!(
            results
                .iter()
                .map(|result| (result.image_id.as_str(), result.match_type.as_str()))
                .collect::<Vec<_>>(),
            vec![("best", "clip"), ("other", "clip")]
        );
        assert!(results[0].score >= results[1].score);
    }

    #[test]
    fn visual_search_respects_folder_filter() {
        let conn = fresh_db();
        insert_image(&conn, "in-folder", Some("folder-a"));
        insert_image(&conn, "out-folder", Some("folder-b"));
        vector_store::insert(
            &conn,
            "in-folder",
            VectorKind::Visual,
            &[1.0, 0.0],
            "clip-v1",
        )
        .unwrap();
        vector_store::insert(
            &conn,
            "out-folder",
            VectorKind::Visual,
            &[0.99, 0.01],
            "clip-v1",
        )
        .unwrap();
        let query = EncodedVisualQuery::new(vec![1.0, 0.0], "clip-v1");

        let results = visual_search(&conn, &query, Some("folder-a"), 10).unwrap();

        assert_eq!(
            results
                .iter()
                .map(|result| result.image_id.as_str())
                .collect::<Vec<_>>(),
            vec!["in-folder"]
        );
    }
}
