//! Integration-style tests for the search index lifecycle.
//!
//! Uses an in-memory SQLite with the real schema. Verifies that the FTS5 mirror
//! table stays consistent with `images` + `analysis` across the full set of
//! mutations a user can perform.

#![cfg(test)]

use rusqlite::Connection;

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
