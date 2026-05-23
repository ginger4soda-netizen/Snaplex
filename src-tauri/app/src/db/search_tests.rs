//! Integration-style tests for the search index lifecycle.
//!
//! Uses an in-memory SQLite with the real schema. Verifies that the FTS5 mirror
//! table stays consistent with `images` + `analysis` across the full set of
//! mutations a user can perform.

#![cfg(test)]

use rusqlite::Connection;
use std::path::Path;

use super::analysis;
use super::images::{self, AnalysisResult, PromptSegment, StructuredPrompts};
use super::schema;

fn fresh_db() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
    schema::create_tables(&conn).expect("schema");
    conn
}

fn insert_image(conn: &Connection, id: &str, filename: &str) {
    conn.execute(
        "INSERT INTO images (id, filename, file_path) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, filename, format!("/tmp/{}", filename)],
    )
    .unwrap();
}

fn insert_image_with_paths(
    conn: &Connection,
    id: &str,
    file_path: &Path,
    thumb_path: Option<&Path>,
) {
    conn.execute(
        "INSERT INTO images (id, filename, file_path, thumb_path) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            id,
            file_path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("image.png"),
            file_path.to_string_lossy(),
            thumb_path.map(|path| path.to_string_lossy().to_string()),
        ],
    )
    .unwrap();
}

fn make_analysis(text: &str) -> AnalysisResult {
    AnalysisResult {
        description: text.to_string(),
        structured_prompts: StructuredPrompts {
            subject: PromptSegment {
                original: String::new(),
                translated: String::new(),
            },
            environment: PromptSegment {
                original: String::new(),
                translated: String::new(),
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

fn count_search_index(conn: &Connection) -> i64 {
    conn.query_row("SELECT COUNT(*) FROM search_index", [], |r| r.get(0))
        .unwrap()
}

#[test]
fn delete_images_removes_associated_search_index_rows() {
    let conn = fresh_db();
    insert_image(&conn, "img-1", "a.jpg");
    analysis::save_analysis(
        &conn,
        "an-1",
        "img-1",
        &make_analysis("a sunset over the harbor"),
        "p",
        "m",
    )
    .unwrap();

    assert_eq!(
        count_search_index(&conn),
        1,
        "analysis save should populate search_index"
    );

    images::delete_images(&conn, &["img-1".to_string()]).unwrap();

    assert_eq!(
        count_search_index(&conn),
        0,
        "deleting an image must cascade to its search_index entry — FTS5 virtual tables don't support FK cascade so this requires explicit cleanup",
    );
}

#[test]
fn delete_images_removes_source_and_thumbnail_files() {
    let conn = fresh_db();
    let dir = std::env::temp_dir().join(format!("snaplex-delete-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let image_path = dir.join("image.png");
    let thumb_path = dir.join("thumb.webp");
    std::fs::write(&image_path, b"image").unwrap();
    std::fs::write(&thumb_path, b"thumb").unwrap();
    insert_image_with_paths(&conn, "img-file", &image_path, Some(&thumb_path));

    images::delete_images(&conn, &["img-file".to_string()]).unwrap();

    assert!(!image_path.exists(), "source image file should be removed");
    assert!(!thumb_path.exists(), "thumbnail file should be removed");
    let remaining: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM images WHERE id = 'img-file'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(remaining, 0);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn delete_images_treats_missing_files_as_already_deleted() {
    let conn = fresh_db();
    let dir = std::env::temp_dir().join(format!("snaplex-delete-missing-{}", uuid::Uuid::new_v4()));
    let image_path = dir.join("missing.png");
    let thumb_path = dir.join("missing.webp");
    insert_image_with_paths(&conn, "img-missing", &image_path, Some(&thumb_path));

    images::delete_images(&conn, &["img-missing".to_string()]).unwrap();

    let remaining: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM images WHERE id = 'img-missing'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(remaining, 0);
}

#[test]
fn updating_memo_makes_new_memo_text_searchable() {
    let conn = fresh_db();
    insert_image(&conn, "img-1", "a.jpg");
    analysis::save_analysis(
        &conn,
        "an-1",
        "img-1",
        &make_analysis("generic description"),
        "p",
        "m",
    )
    .unwrap();

    images::update_memo(&conn, "img-1", "neonpurple").unwrap();

    let hits: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM search_index WHERE search_index MATCH '\"neonpurple\"'",
            [],
            |r| r.get(0),
        )
        .unwrap();

    assert_eq!(hits, 1, "memo updates must propagate into the search index");
}

#[test]
fn chinese_text_is_searchable_via_fts() {
    let conn = fresh_db();
    insert_image(&conn, "img-cn", "cn.jpg");
    analysis::save_analysis(
        &conn,
        "an-cn",
        "img-cn",
        &make_analysis("黄昏时分的海边风景"),
        "p",
        "m",
    )
    .unwrap();

    // Should match: both 黄 and 海 appear in the indexed text
    let results = super::search::search_fts(&conn, "黄昏的海", None).unwrap();
    assert!(
        results.iter().any(|r| r.image_id == "img-cn"),
        "Chinese search should find images containing the queried characters"
    );
}

#[test]
fn chinese_single_char_search_finds_match() {
    let conn = fresh_db();
    insert_image(&conn, "img-cn2", "cn2.jpg");
    analysis::save_analysis(
        &conn,
        "an-cn2",
        "img-cn2",
        &make_analysis("夕阳下的港湾"),
        "p",
        "m",
    )
    .unwrap();

    let results = super::search::search_fts(&conn, "港", None).unwrap();
    assert!(
        results.iter().any(|r| r.image_id == "img-cn2"),
        "Single Chinese character search should match"
    );
}

#[test]
fn mixed_chinese_english_search() {
    let conn = fresh_db();
    insert_image(&conn, "img-mix", "mix.jpg");
    // Content has both English and Chinese analysis fields indexed
    conn.execute(
        "INSERT INTO analysis (id, image_id, description, subject_en, subject_cn,
         environment_en, environment_cn, composition_en, composition_cn,
         lighting_en, lighting_cn, mood_en, mood_cn, style_en, style_cn)
         VALUES ('an-mix', 'img-mix', 'sunset over harbor', 'boat', '船',
                 'ocean', '海洋', '', '', '', '', '', '', '', '')",
        [],
    )
    .unwrap();
    super::search::rebuild_search_index_for_image(&conn, "img-mix").unwrap();

    // Search with Chinese should find it
    let results = super::search::search_fts(&conn, "船", None).unwrap();
    assert!(
        results.iter().any(|r| r.image_id == "img-mix"),
        "Chinese search should match Chinese analysis fields"
    );

    // Search with English should still work
    let results = super::search::search_fts(&conn, "sunset", None).unwrap();
    assert!(
        results.iter().any(|r| r.image_id == "img-mix"),
        "English search should still work after the fix"
    );
}
