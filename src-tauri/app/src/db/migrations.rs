use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Result};

pub struct Migration {
    pub version: u32,
    pub name: &'static str,
    pub up: fn(&Connection) -> Result<()>,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "create_image_sources",
        up: create_image_sources,
    },
    Migration {
        version: 2,
        name: "add_image_content_sha256",
        up: add_image_content_sha256,
    },
];

pub fn run_migrations(conn: &Connection) -> Result<()> {
    create_migrations_table(conn)?;

    for migration in MIGRATIONS {
        if migration_applied(conn, migration.version)? {
            continue;
        }

        (migration.up)(conn)?;
        record_migration(conn, migration)?;
    }

    Ok(())
}

fn create_migrations_table(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
        ",
    )
}

fn migration_applied(conn: &Connection, version: u32) -> Result<bool> {
    let applied = conn
        .query_row(
            "SELECT 1 FROM schema_migrations WHERE version = ?1",
            params![version],
            |_| Ok(()),
        )
        .optional()?
        .is_some();
    Ok(applied)
}

fn record_migration(conn: &Connection, migration: &Migration) -> Result<()> {
    log::info!(
        "applied database migration v{}: {}",
        migration.version,
        migration.name
    );
    conn.execute(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
        params![migration.version, Utc::now().to_rfc3339()],
    )?;
    Ok(())
}

fn create_image_sources(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS image_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
            capture_type TEXT NOT NULL,
            source_url TEXT,
            page_url TEXT,
            page_title TEXT,
            source_domain TEXT,
            captured_at TEXT NOT NULL,
            client_id TEXT NOT NULL,
            metadata_json TEXT,
            UNIQUE(image_id, page_url, captured_at)
        );
        CREATE INDEX IF NOT EXISTS idx_image_sources_image_id ON image_sources(image_id);
        CREATE INDEX IF NOT EXISTS idx_image_sources_source_domain ON image_sources(source_domain);
        ",
    )
}

fn add_image_content_sha256(conn: &Connection) -> Result<()> {
    if !column_exists(conn, "images", "content_sha256")? {
        conn.execute_batch("ALTER TABLE images ADD COLUMN content_sha256 TEXT;")?;
    }
    conn.execute_batch(
        "
        CREATE UNIQUE INDEX IF NOT EXISTS idx_images_content_sha256
            ON images(content_sha256)
            WHERE content_sha256 IS NOT NULL;
        ",
    )
}

fn column_exists(conn: &Connection, table_name: &str, column_name: &str) -> Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table_name})"))?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let current: String = row.get(1)?;
        if current == column_name {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use rusqlite::{params, Connection};

    use super::run_migrations;
    use crate::db::schema;

    fn migrated_connection() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::create_tables(&conn).unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn runs_all_migrations_on_fresh_database() {
        let conn = migrated_connection();

        let image_sources_sql: String = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'image_sources'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(image_sources_sql.contains("capture_type TEXT NOT NULL"));

        let version_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations WHERE version IN (1, 2)",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let has_sha_column = super::column_exists(&conn, "images", "content_sha256").unwrap();
        assert_eq!(version_count, 2);
        assert!(has_sha_column);
    }

    #[test]
    fn rerunning_migrations_is_idempotent() {
        let conn = migrated_connection();

        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();

        let migration_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .unwrap();
        let image_sources_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'image_sources'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(migration_count, 2);
        assert_eq!(image_sources_count, 1);
    }

    #[test]
    fn image_sources_table_cascades_with_image_delete() {
        let conn = migrated_connection();
        conn.execute(
            "INSERT INTO images (id, filename, file_path) VALUES (?1, ?2, ?3)",
            params!["img-1", "sample.png", "/tmp/sample.png"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO image_sources (
                image_id, capture_type, source_url, page_url, captured_at, client_id
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                "img-1",
                "image",
                "https://example.com/image.png",
                "https://example.com",
                "2026-05-05T00:00:00Z",
                "browser-extension"
            ],
        )
        .unwrap();

        conn.execute("DELETE FROM images WHERE id = ?1", params!["img-1"])
            .unwrap();

        let remaining_sources: i64 = conn
            .query_row("SELECT COUNT(*) FROM image_sources", [], |row| row.get(0))
            .unwrap();
        assert_eq!(remaining_sources, 0);
    }

    #[test]
    fn content_sha256_is_unique_when_present() {
        let conn = migrated_connection();
        conn.execute(
            "INSERT INTO images (id, filename, file_path, content_sha256)
             VALUES (?1, ?2, ?3, ?4)",
            params!["img-1", "sample-a.png", "/tmp/sample-a.png", "abc123"],
        )
        .unwrap();

        let duplicate = conn.execute(
            "INSERT INTO images (id, filename, file_path, content_sha256)
             VALUES (?1, ?2, ?3, ?4)",
            params!["img-2", "sample-b.png", "/tmp/sample-b.png", "abc123"],
        );
        assert!(duplicate.is_err());

        conn.execute(
            "INSERT INTO images (id, filename, file_path, content_sha256)
             VALUES (?1, ?2, ?3, NULL)",
            params!["img-3", "sample-c.png", "/tmp/sample-c.png"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO images (id, filename, file_path, content_sha256)
             VALUES (?1, ?2, ?3, NULL)",
            params!["img-4", "sample-d.png", "/tmp/sample-d.png"],
        )
        .unwrap();
    }
}
