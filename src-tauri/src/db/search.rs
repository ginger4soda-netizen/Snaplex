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
    _folder_id: Option<&str>,
) -> Result<Vec<SearchResult>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT image_id, rank FROM search_index WHERE search_index MATCH ?1 ORDER BY rank LIMIT 50",
    )?;

    let results = stmt
        .query_map(rusqlite::params![query], |row| {
            Ok(SearchResult {
                image_id: row.get(0)?,
                score: row.get::<_, f64>(1)?.abs(),
                match_type: "fts".to_string(),
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

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
