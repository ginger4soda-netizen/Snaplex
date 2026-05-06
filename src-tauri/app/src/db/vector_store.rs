#![allow(dead_code)] // Slice 1 lands persistence before later slices wire it into indexing/search.

use std::cmp::Ordering;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VectorKind {
    Text,
    Visual,
}

impl VectorKind {
    fn table_name(self) -> &'static str {
        match self {
            VectorKind::Text => "embeddings",
            VectorKind::Visual => "visual_embeddings",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VectorSearchResult {
    pub image_id: String,
    pub score: f64,
}

#[derive(Debug, Error)]
pub enum VectorStoreError {
    #[error("vector must not be empty")]
    EmptyVector,
    #[error("vector must not contain NaN or infinite values at index {index}")]
    NonFiniteVector { index: usize },
    #[error("vector norm must be greater than zero")]
    ZeroVector,
    #[error("vector dimension mismatch: expected {expected}, got {actual}")]
    DimensionMismatch { expected: usize, actual: usize },
    #[error("model version must not be empty")]
    EmptyModelVersion,
    #[error(
        "stored vector for image {image_id} is corrupt: {bytes} bytes for dimension {dimension}"
    )]
    CorruptVector {
        image_id: String,
        bytes: usize,
        dimension: i64,
    },
    #[error(transparent)]
    Sql(#[from] rusqlite::Error),
}

pub type Result<T> = std::result::Result<T, VectorStoreError>;

pub fn insert(
    conn: &Connection,
    image_id: &str,
    kind: VectorKind,
    vector: &[f32],
    model_version: &str,
) -> Result<()> {
    validate_vector(vector)?;
    validate_model_version(model_version)?;

    let table_name = kind.table_name();
    let dimension = vector.len();
    let existing_dimension = conn
        .query_row(
            &format!(
                "SELECT dimension FROM {table_name} WHERE image_id = ?1 AND model_version = ?2"
            ),
            rusqlite::params![image_id, model_version],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;

    if let Some(existing_dimension) = existing_dimension {
        if existing_dimension as usize != dimension {
            return Err(VectorStoreError::DimensionMismatch {
                expected: existing_dimension as usize,
                actual: dimension,
            });
        }
    }

    conn.execute(
        &format!(
            "INSERT OR REPLACE INTO {table_name}
             (image_id, vector, model_version, dimension, created_at)
             VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)"
        ),
        rusqlite::params![
            image_id,
            serialize_vector(vector),
            model_version,
            dimension as i64,
        ],
    )?;

    Ok(())
}

pub fn nearest(
    conn: &Connection,
    kind: VectorKind,
    query_vector: &[f32],
    model_version: &str,
    k: usize,
) -> Result<Vec<VectorSearchResult>> {
    if k == 0 {
        return Ok(vec![]);
    }
    validate_vector(query_vector)?;
    validate_model_version(model_version)?;

    let table_name = kind.table_name();
    let mut stmt = conn.prepare(&format!(
        "SELECT image_id, vector, dimension
         FROM {table_name}
         WHERE model_version = ?1"
    ))?;

    let rows = stmt.query_map(rusqlite::params![model_version], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Vec<u8>>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?;

    let mut results = Vec::new();
    for row in rows {
        let (image_id, bytes, dimension) = row?;
        if dimension as usize != query_vector.len() {
            return Err(VectorStoreError::DimensionMismatch {
                expected: query_vector.len(),
                actual: dimension as usize,
            });
        }
        let stored_vector = deserialize_vector(&image_id, &bytes, dimension)?;
        let score = cosine_similarity(query_vector, &stored_vector)?;
        results.push(VectorSearchResult { image_id, score });
    }

    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(Ordering::Equal)
            .then_with(|| a.image_id.cmp(&b.image_id))
    });
    results.truncate(k);

    Ok(results)
}

pub fn has_vector(
    conn: &Connection,
    image_id: &str,
    kind: VectorKind,
    model_version: &str,
) -> Result<bool> {
    validate_model_version(model_version)?;

    let table_name = kind.table_name();
    let count: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM {table_name} WHERE image_id = ?1 AND model_version = ?2"),
        rusqlite::params![image_id, model_version],
        |row| row.get(0),
    )?;

    Ok(count > 0)
}

fn validate_vector(vector: &[f32]) -> Result<()> {
    if vector.is_empty() {
        return Err(VectorStoreError::EmptyVector);
    }
    for (index, value) in vector.iter().enumerate() {
        if !value.is_finite() {
            return Err(VectorStoreError::NonFiniteVector { index });
        }
    }
    if vector_norm(vector) == 0.0 {
        return Err(VectorStoreError::ZeroVector);
    }

    Ok(())
}

fn validate_model_version(model_version: &str) -> Result<()> {
    if model_version.trim().is_empty() {
        return Err(VectorStoreError::EmptyModelVersion);
    }

    Ok(())
}

fn serialize_vector(vector: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(vector.len() * std::mem::size_of::<f32>());
    for value in vector {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    bytes
}

fn deserialize_vector(image_id: &str, bytes: &[u8], dimension: i64) -> Result<Vec<f32>> {
    let expected_bytes = dimension as usize * std::mem::size_of::<f32>();
    if dimension <= 0 || bytes.len() != expected_bytes {
        return Err(VectorStoreError::CorruptVector {
            image_id: image_id.to_string(),
            bytes: bytes.len(),
            dimension,
        });
    }

    Ok(bytes
        .chunks_exact(std::mem::size_of::<f32>())
        .map(|chunk| f32::from_le_bytes(chunk.try_into().expect("chunk size is fixed")))
        .collect())
}

fn cosine_similarity(left: &[f32], right: &[f32]) -> Result<f64> {
    if left.len() != right.len() {
        return Err(VectorStoreError::DimensionMismatch {
            expected: left.len(),
            actual: right.len(),
        });
    }

    let dot = left
        .iter()
        .zip(right)
        .map(|(a, b)| *a as f64 * *b as f64)
        .sum::<f64>();
    let left_norm = vector_norm(left);
    let right_norm = vector_norm(right);

    if left_norm == 0.0 || right_norm == 0.0 {
        return Err(VectorStoreError::ZeroVector);
    }

    Ok(dot / (left_norm * right_norm))
}

fn vector_norm(vector: &[f32]) -> f64 {
    vector
        .iter()
        .map(|value| {
            let value = *value as f64;
            value * value
        })
        .sum::<f64>()
        .sqrt()
}

trait OptionalRow<T> {
    fn optional(self) -> std::result::Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalRow<T> for std::result::Result<T, rusqlite::Error> {
    fn optional(self) -> std::result::Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::{has_vector, insert, nearest, VectorKind, VectorStoreError};
    use crate::db::schema;

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

    #[test]
    fn insert_and_nearest_roundtrip() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");

        insert(
            &conn,
            "img-1",
            VectorKind::Text,
            &[1.0, 0.0, 0.0],
            "text-v1",
        )
        .unwrap();

        let results = nearest(&conn, VectorKind::Text, &[1.0, 0.0, 0.0], "text-v1", 5).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].image_id, "img-1");
        assert!((results[0].score - 1.0).abs() < 1e-9);
    }

    #[test]
    fn rejects_reinsert_with_same_model_and_different_dimension() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");
        insert(&conn, "img-1", VectorKind::Text, &[1.0, 0.0], "text-v1").unwrap();

        let err = insert(
            &conn,
            "img-1",
            VectorKind::Text,
            &[1.0, 0.0, 0.0],
            "text-v1",
        )
        .unwrap_err();

        assert!(matches!(
            err,
            VectorStoreError::DimensionMismatch {
                expected: 2,
                actual: 3
            }
        ));
    }

    #[test]
    fn nearest_returns_top_k_descending_by_similarity() {
        let conn = fresh_db();
        for image_id in ["img-1", "img-2", "img-3"] {
            insert_image(&conn, image_id);
        }
        insert(&conn, "img-1", VectorKind::Text, &[1.0, 0.0], "text-v1").unwrap();
        insert(&conn, "img-2", VectorKind::Text, &[0.8, 0.2], "text-v1").unwrap();
        insert(&conn, "img-3", VectorKind::Text, &[0.0, 1.0], "text-v1").unwrap();

        let results = nearest(&conn, VectorKind::Text, &[1.0, 0.0], "text-v1", 2).unwrap();

        assert_eq!(
            results
                .iter()
                .map(|result| result.image_id.as_str())
                .collect::<Vec<_>>(),
            vec!["img-1", "img-2"]
        );
        assert!(results[0].score >= results[1].score);
    }

    #[test]
    fn nearest_excludes_other_kinds_and_model_versions() {
        let conn = fresh_db();
        for image_id in ["img-1", "img-2", "img-3"] {
            insert_image(&conn, image_id);
        }
        insert(&conn, "img-1", VectorKind::Text, &[1.0, 0.0], "text-v1").unwrap();
        insert(&conn, "img-2", VectorKind::Visual, &[1.0, 0.0], "clip-v1").unwrap();
        insert(&conn, "img-3", VectorKind::Text, &[1.0, 0.0], "text-v2").unwrap();

        let results = nearest(&conn, VectorKind::Text, &[1.0, 0.0], "text-v1", 10).unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].image_id, "img-1");
    }

    #[test]
    fn deleting_image_cascades_to_vectors() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");
        insert(&conn, "img-1", VectorKind::Text, &[1.0, 0.0], "text-v1").unwrap();
        insert(&conn, "img-1", VectorKind::Visual, &[0.0, 1.0], "clip-v1").unwrap();

        conn.execute("DELETE FROM images WHERE id = 'img-1'", [])
            .unwrap();

        assert!(!has_vector(&conn, "img-1", VectorKind::Text, "text-v1").unwrap());
        assert!(!has_vector(&conn, "img-1", VectorKind::Visual, "clip-v1").unwrap());
    }

    #[test]
    fn reinsert_with_new_model_version_overwrites_image_vector() {
        let conn = fresh_db();
        insert_image(&conn, "img-1");
        insert(&conn, "img-1", VectorKind::Text, &[1.0, 0.0], "text-v1").unwrap();
        insert(
            &conn,
            "img-1",
            VectorKind::Text,
            &[0.0, 1.0, 0.0],
            "text-v2",
        )
        .unwrap();

        assert!(!has_vector(&conn, "img-1", VectorKind::Text, "text-v1").unwrap());
        assert!(has_vector(&conn, "img-1", VectorKind::Text, "text-v2").unwrap());
        let results = nearest(&conn, VectorKind::Text, &[0.0, 1.0, 0.0], "text-v2", 1).unwrap();

        assert_eq!(results[0].image_id, "img-1");
    }
}
