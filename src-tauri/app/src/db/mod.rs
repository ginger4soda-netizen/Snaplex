pub mod analysis;
pub mod chat;
pub mod cross_modal_embedder;
pub mod folders;
#[allow(dead_code)]
pub mod image_sources;
pub mod images;
pub mod indexer;
pub mod migrations;
pub mod schema;
pub mod search;
pub mod search_service;
pub mod text_embedder;
pub mod vector_store;

#[cfg(test)]
mod search_tests;

use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }

    fn initialize(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        schema::create_tables(&conn)?;
        migrations::run_migrations(&conn)?;
        search::migrate_search_index_cjk(&conn)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::Database;

    #[test]
    fn database_initialization_runs_migrations() {
        let db_path = std::env::temp_dir().join(format!(
            "snaplex-migration-test-{}.db",
            uuid::Uuid::new_v4()
        ));

        let db = Database::new(&db_path).unwrap();
        let conn = db.conn.lock().unwrap();
        let applied: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version IN (1, 2)",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let image_sources_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'image_sources'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let has_sha_column: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('images') WHERE name = 'content_sha256'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        drop(conn);
        drop(db);

        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
        let _ = std::fs::remove_file(db_path.with_extension("db-shm"));

        assert_eq!(applied, 2);
        assert_eq!(image_sources_exists, 1);
        assert_eq!(has_sha_column, 1);
    }
}
