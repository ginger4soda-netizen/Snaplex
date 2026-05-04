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
    let sanitized = sanitize_fts_query(query);

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
        let rows = stmt
            .query_map(rusqlite::params![&sanitized, fid], |row| {
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
        let rows = stmt
            .query_map(rusqlite::params![&sanitized], |row| {
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
    // Pre-process: space-separate CJK characters so that the unicode61
    // tokenizer indexes them individually rather than as one giant token.
    let content = space_separate_cjk(content);
    let memo = space_separate_cjk(memo);

    // Remove old entry
    conn.execute(
        "DELETE FROM search_index WHERE image_id = ?1",
        rusqlite::params![image_id],
    )?;
    // Insert new
    conn.execute(
        "INSERT INTO search_index (image_id, content, memo) VALUES (?1, ?2, ?3)",
        rusqlite::params![image_id, &content, &memo],
    )?;
    Ok(())
}

/// Remove a single image's row from the FTS index. FTS5 virtual tables
/// cannot participate in FK cascade, so callers that delete images must
/// invoke this explicitly to keep the index from accumulating orphans.
pub fn remove_from_search_index(conn: &Connection, image_id: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM search_index WHERE image_id = ?1",
        rusqlite::params![image_id],
    )?;
    Ok(())
}

const CJK_MIGRATION_KEY: &str = "search_index_cjk_migration_v1";

/// One-time migration: rebuild every row in the FTS search index so that CJK
/// text is space-separated for per-character tokenization. Idempotent — uses a
/// `library_meta` flag to skip on subsequent opens.
pub fn migrate_search_index_cjk(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Check if migration has already run
    let already_migrated: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM library_meta WHERE key = ?1",
            rusqlite::params![CJK_MIGRATION_KEY],
            |row| row.get::<_, i64>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if already_migrated {
        return Ok(());
    }

    // Collect all image IDs that have a search_index entry
    let image_ids: Vec<String> = {
        let mut stmt = conn.prepare("SELECT DISTINCT image_id FROM search_index")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.filter_map(|r| r.ok()).collect()
    };

    if !image_ids.is_empty() {
        log::info!(
            "migrating FTS search index for CJK support ({} entries)…",
            image_ids.len()
        );

        for image_id in &image_ids {
            rebuild_search_index_for_image(conn, image_id)?;
        }

        log::info!("FTS CJK migration complete");
    }

    // Mark migration as done
    conn.execute(
        "INSERT OR REPLACE INTO library_meta (key, value, updated_at)
         VALUES (?1, '1', CURRENT_TIMESTAMP)",
        rusqlite::params![CJK_MIGRATION_KEY],
    )?;

    Ok(())
}

/// Re-derive an image's search index row from the current `analysis` and
/// `images.memo` state. Safe to call when no analysis exists — in that case
/// only the memo (if any) is indexed. Idempotent.
pub fn rebuild_search_index_for_image(
    conn: &Connection,
    image_id: &str,
) -> Result<(), rusqlite::Error> {
    // Pull analysis fields (may be missing if image hasn't been analyzed yet).
    let analysis_row = conn.query_row(
        "SELECT COALESCE(description, ''),
                COALESCE(subject_en, ''),    COALESCE(subject_cn, ''),
                COALESCE(environment_en, ''),COALESCE(environment_cn, ''),
                COALESCE(composition_en, ''),COALESCE(composition_cn, ''),
                COALESCE(lighting_en, ''),   COALESCE(lighting_cn, ''),
                COALESCE(mood_en, ''),       COALESCE(mood_cn, ''),
                COALESCE(style_en, ''),      COALESCE(style_cn, '')
         FROM analysis WHERE image_id = ?1",
        rusqlite::params![image_id],
        |row| {
            let mut parts: Vec<String> = Vec::with_capacity(13);
            for i in 0..13 {
                parts.push(row.get::<_, String>(i)?);
            }
            Ok(parts)
        },
    );

    let content = match analysis_row {
        Ok(parts) => parts
            .into_iter()
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join(" "),
        Err(rusqlite::Error::QueryReturnedNoRows) => String::new(),
        Err(e) => return Err(e),
    };

    let memo: String = conn
        .query_row(
            "SELECT COALESCE(memo, '') FROM images WHERE id = ?1",
            rusqlite::params![image_id],
            |row| row.get(0),
        )
        .unwrap_or_default();

    update_search_index(conn, image_id, &content, &memo)
}

/// Insert spaces around CJK characters so that the `unicode61` FTS5 tokenizer
/// indexes each character as a separate token. Without this, consecutive CJK
/// characters are treated as a single opaque token and cannot be matched
/// individually.
///
/// Non-CJK text passes through unchanged. This is applied at index time in
/// [`update_search_index`] so that both index and query sides agree on
/// per-character tokenization.
fn space_separate_cjk(text: &str) -> String {
    if !text.chars().any(is_cjk) {
        return text.to_string();
    }

    let mut result = String::with_capacity(text.len() * 2);
    for ch in text.chars() {
        if is_cjk(ch) {
            if !result.is_empty() && !result.ends_with(' ') {
                result.push(' ');
            }
            result.push(ch);
            result.push(' ');
        } else {
            result.push(ch);
        }
    }

    // Collapse multiple spaces and trim
    result.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Build an FTS5 query string that works for both Latin and CJK text.
///
/// Strategy:
///   1. Strip FTS5 metacharacters (`*`, `^`, `"`, etc.) to prevent syntax
///      errors and injection.
///   2. Split Latin text on whitespace — each word becomes a quoted token.
///   3. Split CJK runs into individual characters — each character becomes
///      a separate quoted token, because the `unicode61` tokenizer indexes
///      CJK text one-character-at-a-time. Wrapping multiple CJK characters
///      in a single phrase query would require them to appear consecutively
///      in the indexed document, which almost never matches user intent.
///   4. All tokens are joined with spaces, which FTS5 interprets as implicit
///      AND — every token must appear somewhere in the document, but not
///      necessarily adjacent.
fn sanitize_fts_query(query: &str) -> String {
    let mut tokens: Vec<String> = Vec::new();

    for word in query.split_whitespace() {
        // Remove FTS5 syntax characters
        let cleaned: String = word
            .chars()
            .filter(|c| !is_fts5_metachar(*c))
            .collect();

        if cleaned.is_empty() {
            continue;
        }

        // Check if the word contains any CJK characters
        if cleaned.chars().any(is_cjk) {
            // Split CJK characters into individual tokens,
            // grouping consecutive non-CJK chars (e.g. digits) together.
            let mut latin_buf = String::new();
            for ch in cleaned.chars() {
                if is_cjk(ch) {
                    // Flush any accumulated Latin/digit buffer first
                    if !latin_buf.is_empty() {
                        tokens.push(format!("\"{}\"", latin_buf));
                        latin_buf.clear();
                    }
                    tokens.push(format!("\"{}\"", ch));
                } else {
                    latin_buf.push(ch);
                }
            }
            if !latin_buf.is_empty() {
                tokens.push(format!("\"{}\"", latin_buf));
            }
        } else {
            // Pure Latin/digit word — quote as a single token
            tokens.push(format!("\"{}\"", cleaned));
        }
    }

    tokens.join(" ")
}

/// Returns true for characters that are FTS5 query syntax and must be stripped.
fn is_fts5_metachar(c: char) -> bool {
    matches!(c, '"' | '*' | '^' | '(' | ')' | '+' | '{' | '}' | ':')
}

/// Returns true for CJK Unified Ideographs and common CJK-adjacent ranges
/// that the `unicode61` tokenizer splits on character boundaries.
fn is_cjk(c: char) -> bool {
    matches!(c,
        '\u{4E00}'..='\u{9FFF}'   // CJK Unified Ideographs
        | '\u{3400}'..='\u{4DBF}' // CJK Unified Ideographs Extension A
        | '\u{F900}'..='\u{FAFF}' // CJK Compatibility Ideographs
        | '\u{3000}'..='\u{303F}' // CJK Symbols and Punctuation
        | '\u{3040}'..='\u{309F}' // Hiragana
        | '\u{30A0}'..='\u{30FF}' // Katakana
        | '\u{AC00}'..='\u{D7AF}' // Hangul Syllables
    )
}

#[cfg(test)]
mod tests {
    use super::{sanitize_fts_query, space_separate_cjk};

    #[test]
    fn english_words_are_individually_quoted() {
        assert_eq!(sanitize_fts_query("sunset harbor"), "\"sunset\" \"harbor\"");
    }

    #[test]
    fn chinese_chars_are_split_into_individual_tokens() {
        assert_eq!(
            sanitize_fts_query("黄昏的海"),
            "\"黄\" \"昏\" \"的\" \"海\""
        );
    }

    #[test]
    fn mixed_chinese_english_works() {
        assert_eq!(
            sanitize_fts_query("黄昏 harbor"),
            "\"黄\" \"昏\" \"harbor\""
        );
    }

    #[test]
    fn fts5_metacharacters_are_stripped() {
        assert_eq!(
            sanitize_fts_query("test* OR \"bad\""),
            "\"test\" \"OR\" \"bad\""
        );
    }

    #[test]
    fn empty_query_produces_empty_string() {
        assert_eq!(sanitize_fts_query(""), "");
        assert_eq!(sanitize_fts_query("   "), "");
    }

    #[test]
    fn single_english_word() {
        assert_eq!(sanitize_fts_query("harbor"), "\"harbor\"");
    }

    #[test]
    fn single_chinese_char() {
        assert_eq!(sanitize_fts_query("海"), "\"海\"");
    }

    #[test]
    fn cjk_with_embedded_digits() {
        // e.g. "第3版" → "第" "3" "版"
        assert_eq!(
            sanitize_fts_query("第3版"),
            "\"第\" \"3\" \"版\""
        );
    }

    #[test]
    fn japanese_hiragana_split() {
        assert_eq!(
            sanitize_fts_query("さくら"),
            "\"さ\" \"く\" \"ら\""
        );
    }

    #[test]
    fn preserves_underscores_and_hyphens() {
        assert_eq!(
            sanitize_fts_query("dark-mode ui_test"),
            "\"dark-mode\" \"ui_test\""
        );
    }

    #[test]
    fn space_separate_cjk_splits_chinese() {
        assert_eq!(
            space_separate_cjk("黄昏时分的海边风景"),
            "黄 昏 时 分 的 海 边 风 景"
        );
    }

    #[test]
    fn space_separate_cjk_preserves_english() {
        assert_eq!(
            space_separate_cjk("sunset over harbor"),
            "sunset over harbor"
        );
    }

    #[test]
    fn space_separate_cjk_handles_mixed() {
        assert_eq!(
            space_separate_cjk("sunset 夕阳 harbor 港湾"),
            "sunset 夕 阳 harbor 港 湾"
        );
    }

    #[test]
    fn space_separate_cjk_handles_empty() {
        assert_eq!(space_separate_cjk(""), "");
    }
}
