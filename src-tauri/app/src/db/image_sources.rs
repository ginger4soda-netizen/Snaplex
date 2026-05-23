use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

pub type ImageSourceId = i64;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImageSource {
    pub id: ImageSourceId,
    pub image_id: String,
    pub capture_type: String,
    pub source_url: Option<String>,
    pub page_url: Option<String>,
    pub page_title: Option<String>,
    pub source_domain: Option<String>,
    pub captured_at: String,
    pub client_id: String,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImageSourceInput {
    pub capture_type: String,
    pub source_url: Option<String>,
    pub page_url: Option<String>,
    pub page_title: Option<String>,
    pub source_domain: Option<String>,
    pub captured_at: String,
    pub client_id: String,
    pub metadata_json: Option<String>,
}

pub fn append_source(
    conn: &Connection,
    image_id: &str,
    src: ImageSourceInput,
) -> Result<ImageSourceId> {
    let inserted = conn.execute(
        "
        INSERT OR IGNORE INTO image_sources (
            image_id,
            capture_type,
            source_url,
            page_url,
            page_title,
            source_domain,
            captured_at,
            client_id,
            metadata_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ",
        params![
            image_id,
            src.capture_type,
            src.source_url,
            src.page_url,
            src.page_title,
            src.source_domain,
            src.captured_at,
            src.client_id,
            src.metadata_json
        ],
    )?;

    if inserted > 0 {
        return Ok(conn.last_insert_rowid());
    }

    conn.query_row(
        "
        SELECT id FROM image_sources
        WHERE image_id = ?1
          AND ((page_url IS NULL AND ?2 IS NULL) OR page_url = ?2)
          AND captured_at = ?3
        ",
        params![image_id, src.page_url, src.captured_at],
        |row| row.get(0),
    )
}

pub fn list_sources_for_image(conn: &Connection, image_id: &str) -> Result<Vec<ImageSource>> {
    let mut stmt = conn.prepare(
        "
        SELECT
            id,
            image_id,
            capture_type,
            source_url,
            page_url,
            page_title,
            source_domain,
            captured_at,
            client_id,
            metadata_json
        FROM image_sources
        WHERE image_id = ?1
        ORDER BY captured_at ASC, id ASC
        ",
    )?;

    let sources = stmt
        .query_map(params![image_id], row_to_image_source)?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(sources)
}

fn row_to_image_source(row: &rusqlite::Row<'_>) -> Result<ImageSource> {
    Ok(ImageSource {
        id: row.get(0)?,
        image_id: row.get(1)?,
        capture_type: row.get(2)?,
        source_url: row.get(3)?,
        page_url: row.get(4)?,
        page_title: row.get(5)?,
        source_domain: row.get(6)?,
        captured_at: row.get(7)?,
        client_id: row.get(8)?,
        metadata_json: row.get(9)?,
    })
}

#[cfg(test)]
mod tests {
    use rusqlite::{params, Connection};

    use super::{append_source, list_sources_for_image, ImageSourceInput};
    use crate::db::{migrations, schema};

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::create_tables(&conn).unwrap();
        migrations::run_migrations(&conn).unwrap();
        conn.execute(
            "INSERT INTO images (id, filename, file_path) VALUES (?1, ?2, ?3)",
            params!["img-1", "sample.png", "/tmp/sample.png"],
        )
        .unwrap();
        conn
    }

    fn source(page_url: &str, captured_at: &str) -> ImageSourceInput {
        ImageSourceInput {
            capture_type: "image".to_string(),
            source_url: Some(format!("{page_url}/image.png")),
            page_url: Some(page_url.to_string()),
            page_title: Some("Example".to_string()),
            source_domain: Some("example.com".to_string()),
            captured_at: captured_at.to_string(),
            client_id: "browser-extension".to_string(),
            metadata_json: Some(
                r#"{"originalImageUrl":"https://example.com/image.png"}"#.to_string(),
            ),
        }
    }

    #[test]
    fn append_source_deduplicates_same_image_page_and_capture_time() {
        let conn = test_conn();
        let first_id = append_source(
            &conn,
            "img-1",
            source("https://example.com/page-a", "2026-05-05T00:00:00Z"),
        )
        .unwrap();
        let second_id = append_source(
            &conn,
            "img-1",
            source("https://example.com/page-a", "2026-05-05T00:00:00Z"),
        )
        .unwrap();

        let sources = list_sources_for_image(&conn, "img-1").unwrap();

        assert_eq!(first_id, second_id);
        assert_eq!(sources.len(), 1);
    }

    #[test]
    fn append_source_allows_different_pages_for_same_image() {
        let conn = test_conn();
        append_source(
            &conn,
            "img-1",
            source("https://example.com/page-a", "2026-05-05T00:00:00Z"),
        )
        .unwrap();
        append_source(
            &conn,
            "img-1",
            source("https://another.example/page-b", "2026-05-05T00:00:00Z"),
        )
        .unwrap();

        let sources = list_sources_for_image(&conn, "img-1").unwrap();

        assert_eq!(sources.len(), 2);
        assert_eq!(
            sources[0].page_url.as_deref(),
            Some("https://example.com/page-a")
        );
        assert_eq!(
            sources[1].page_url.as_deref(),
            Some("https://another.example/page-b")
        );
    }
}
