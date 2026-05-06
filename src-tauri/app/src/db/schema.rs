use std::collections::HashMap;

use rusqlite::Connection;

pub fn create_tables(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS images (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            thumb_path TEXT,
            width INTEGER,
            height INTEGER,
            file_size INTEGER,
            format TEXT,
            asset_type TEXT DEFAULT 'image',
            source_url TEXT,
            is_favorite BOOLEAN DEFAULT 0,
            memo TEXT,
            has_analysis BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS image_folders (
            image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
            folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
            PRIMARY KEY (image_id, folder_id)
        );

        CREATE TABLE IF NOT EXISTS analysis (
            id TEXT PRIMARY KEY,
            image_id TEXT UNIQUE NOT NULL REFERENCES images(id) ON DELETE CASCADE,
            description TEXT,
            subject_en TEXT, subject_cn TEXT,
            environment_en TEXT, environment_cn TEXT,
            composition_en TEXT, composition_cn TEXT,
            lighting_en TEXT, lighting_cn TEXT,
            mood_en TEXT, mood_cn TEXT,
            style_en TEXT, style_cn TEXT,
            provider TEXT, model TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
            image_id, content, memo, tokenize='unicode61'
        );

        CREATE TABLE IF NOT EXISTS color_palettes (
            id TEXT PRIMARY KEY,
            image_id TEXT UNIQUE NOT NULL REFERENCES images(id) ON DELETE CASCADE,
            colors TEXT NOT NULL,
            color_count INTEGER DEFAULT 8,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS embeddings (
            image_id TEXT PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
            vector BLOB NOT NULL,
            model_version TEXT NOT NULL,
            dimension INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS visual_embeddings (
            image_id TEXT PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
            vector BLOB NOT NULL,
            model_version TEXT NOT NULL,
            dimension INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS embedding_failures (
            image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
            kind TEXT NOT NULL CHECK (kind IN ('text', 'visual')),
            last_error TEXT NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (image_id, kind)
        );

        CREATE TABLE IF NOT EXISTS backfill_checkpoints (
            channel_id TEXT PRIMARY KEY,
            status TEXT NOT NULL CHECK (status IN ('running', 'done', 'cancelled', 'failed')),
            current_kind TEXT NOT NULL,
            last_image_id TEXT,
            processed INTEGER NOT NULL DEFAULT 0,
            total INTEGER NOT NULL DEFAULT 0,
            indexed INTEGER NOT NULL DEFAULT 0,
            failed INTEGER NOT NULL DEFAULT 0,
            cancelled BOOLEAN NOT NULL DEFAULT 0,
            last_error TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS library_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS dimension_history (
            id TEXT PRIMARY KEY,
            image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
            dimension TEXT NOT NULL,
            version INTEGER NOT NULL,
            original TEXT,
            translated TEXT,
            is_current BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        ",
    )?;

    migrate_vector_table(conn, "embeddings")?;
    migrate_vector_table(conn, "visual_embeddings")?;

    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_embeddings_model_version
            ON embeddings(model_version);
        CREATE INDEX IF NOT EXISTS idx_visual_embeddings_model_version
            ON visual_embeddings(model_version);
        CREATE INDEX IF NOT EXISTS idx_embedding_failures_kind
            ON embedding_failures(kind);
        CREATE INDEX IF NOT EXISTS idx_backfill_checkpoints_updated_at
            ON backfill_checkpoints(updated_at);
        ",
    )
}

#[derive(Debug)]
struct TableColumn {
    not_null: bool,
}

fn table_columns(
    conn: &Connection,
    table_name: &str,
) -> Result<HashMap<String, TableColumn>, rusqlite::Error> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table_name))?;
    let columns = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(1)?,
                TableColumn {
                    not_null: row.get::<_, i32>(3)? != 0,
                },
            ))
        })?
        .collect::<Result<HashMap<_, _>, _>>()?;

    Ok(columns)
}

fn migrate_vector_table(conn: &Connection, table_name: &str) -> Result<(), rusqlite::Error> {
    let columns = table_columns(conn, table_name)?;
    let needs_migration = columns.contains_key("model")
        || !columns
            .get("model_version")
            .map(|column| column.not_null)
            .unwrap_or(false)
        || !columns
            .get("dimension")
            .map(|column| column.not_null)
            .unwrap_or(false);

    if !needs_migration {
        return Ok(());
    }

    let old_table = format!("__snaplex_{}_migration_old", table_name);
    let model_version_expr = match (
        columns.contains_key("model_version"),
        columns.contains_key("model"),
    ) {
        (true, true) => {
            "COALESCE(NULLIF(model_version, ''), NULLIF(model, ''), 'unknown')".to_string()
        }
        (true, false) => "COALESCE(NULLIF(model_version, ''), 'unknown')".to_string(),
        (false, true) => "COALESCE(NULLIF(model, ''), 'unknown')".to_string(),
        (false, false) => "'unknown'".to_string(),
    };
    let dimension_expr = if columns.contains_key("dimension") {
        "COALESCE(dimension, length(vector) / 4)".to_string()
    } else {
        "length(vector) / 4".to_string()
    };
    let created_at_expr = if columns.contains_key("created_at") {
        "COALESCE(created_at, CURRENT_TIMESTAMP)".to_string()
    } else {
        "CURRENT_TIMESTAMP".to_string()
    };

    conn.execute_batch(&format!(
        "
        BEGIN;
        DROP TABLE IF EXISTS {old_table};
        ALTER TABLE {table_name} RENAME TO {old_table};
        CREATE TABLE {table_name} (
            image_id TEXT PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
            vector BLOB NOT NULL,
            model_version TEXT NOT NULL,
            dimension INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO {table_name} (image_id, vector, model_version, dimension, created_at)
        SELECT image_id,
               vector,
               {model_version_expr},
               {dimension_expr},
               {created_at_expr}
        FROM {old_table}
        WHERE vector IS NOT NULL
          AND {dimension_expr} > 0
          AND EXISTS (SELECT 1 FROM images WHERE images.id = {old_table}.image_id);
        DROP TABLE {old_table};
        COMMIT;
        ",
    ))
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::{create_tables, table_columns};

    fn vector_blob(vector: &[f32]) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(vector.len() * std::mem::size_of::<f32>());
        for value in vector {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
        bytes
    }

    #[test]
    fn migrates_legacy_vector_tables_to_model_version_schema() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "
            PRAGMA foreign_keys=ON;
            CREATE TABLE images (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL
            );
            INSERT INTO images (id, filename, file_path)
            VALUES ('img-1', 'a.jpg', '/tmp/a.jpg');

            CREATE TABLE embeddings (
                image_id TEXT PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
                vector BLOB NOT NULL,
                model TEXT,
                dimension INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE visual_embeddings (
                image_id TEXT PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
                vector BLOB NOT NULL,
                model TEXT,
                dimension INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            ",
        )
        .unwrap();
        conn.execute(
            "INSERT INTO embeddings (image_id, vector, model, dimension)
             VALUES ('img-1', ?1, 'text-v1', NULL)",
            rusqlite::params![vector_blob(&[1.0, 0.0, 0.0])],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO visual_embeddings (image_id, vector, model, dimension)
             VALUES ('img-1', ?1, 'clip-v1', 2)",
            rusqlite::params![vector_blob(&[0.0, 1.0])],
        )
        .unwrap();

        create_tables(&conn).unwrap();

        for table_name in ["embeddings", "visual_embeddings"] {
            let columns = table_columns(&conn, table_name).unwrap();
            assert!(!columns.contains_key("model"));
            assert!(columns.get("model_version").unwrap().not_null);
            assert!(columns.get("dimension").unwrap().not_null);
        }

        let text_row: (String, i64) = conn
            .query_row(
                "SELECT model_version, dimension FROM embeddings WHERE image_id = 'img-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        let visual_row: (String, i64) = conn
            .query_row(
                "SELECT model_version, dimension FROM visual_embeddings WHERE image_id = 'img-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(text_row, ("text-v1".to_string(), 3));
        assert_eq!(visual_row, ("clip-v1".to_string(), 2));
    }
}
