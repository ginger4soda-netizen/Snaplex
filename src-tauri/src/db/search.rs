use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub image_id: String,
    pub score: f64,
    pub match_type: String, // "fts" | "embedding" | "clip"
}

pub fn search_fts(
    conn: &Connection,
    query: &str,
    folder_id: Option<&str>,
) -> Result<Vec<SearchResult>, rusqlite::Error> {
    // Sanitize query: quote each word to prevent FTS5 syntax errors
    let sanitized: String = query
        .split_whitespace()
        .map(|word| {
            let cleaned: String = word
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                .collect();
            if cleaned.is_empty() {
                String::new()
            } else {
                format!("\"{}\"", cleaned)
            }
        })
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ");

    if sanitized.is_empty() {
        return Ok(vec![]);
    }

    let results: Vec<SearchResult> = if let Some(fid) = folder_id {
        let mut stmt = conn.prepare(
            "SELECT si.image_id, si.rank
             FROM search_index si
             JOIN image_folders if2 ON si.image_id = if2.image_id
             WHERE search_index MATCH ?1 AND if2.folder_id = ?2
             ORDER BY si.rank LIMIT 50",
        )?;
        let rows = stmt.query_map(rusqlite::params![&sanitized, fid], |row| {
            Ok(SearchResult {
                image_id: row.get(0)?,
                score: row.get::<_, f64>(1)?.abs(),
                match_type: "fts".to_string(),
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
        rows
    } else {
        let mut stmt = conn.prepare(
            "SELECT image_id, rank FROM search_index WHERE search_index MATCH ?1 ORDER BY rank LIMIT 50",
        )?;
        let rows = stmt.query_map(rusqlite::params![&sanitized], |row| {
            Ok(SearchResult {
                image_id: row.get(0)?,
                score: row.get::<_, f64>(1)?.abs(),
                match_type: "fts".to_string(),
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
        rows
    };

    Ok(results)
}

pub fn update_search_index(
    conn: &Connection,
    image_id: &str,
    content: &str,
    memo: &str,
) -> Result<(), rusqlite::Error> {
    // Remove old entry
    conn.execute(
        "DELETE FROM search_index WHERE image_id = ?1",
        rusqlite::params![image_id],
    )?;
    // Insert new
    conn.execute(
        "INSERT INTO search_index (image_id, content, memo) VALUES (?1, ?2, ?3)",
        rusqlite::params![image_id, content, memo],
    )?;
    Ok(())
}
