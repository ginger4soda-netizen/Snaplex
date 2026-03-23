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
            model TEXT,
            dimension INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS visual_embeddings (
            image_id TEXT PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
            vector BLOB NOT NULL,
            model TEXT,
            dimension INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    )
}
