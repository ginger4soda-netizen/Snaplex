use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageItem {
    pub id: String,
    pub filename: String,
    pub thumb_url: String,
    pub width: i32,
    pub height: i32,
    pub is_favorite: bool,
    pub has_analysis: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ColorInfo {
    pub hex: String,
    pub rgb: (u8, u8, u8),
    pub hsl: (f64, f64, f64),
    pub percentage: f64,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageDetail {
    pub id: String,
    pub filename: String,
    pub thumb_url: String,
    pub width: i32,
    pub height: i32,
    pub is_favorite: bool,
    pub has_analysis: bool,
    pub created_at: String,
    pub full_url: String,
    pub memo: String,
    pub source_url: Option<String>,
    pub analysis: Option<AnalysisResult>,
    pub color_palette: Option<Vec<ColorInfo>>,
    pub folder_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    #[serde(default)]
    pub description: String,
    pub structured_prompts: StructuredPrompts,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StructuredPrompts {
    pub subject: PromptSegment,
    pub environment: PromptSegment,
    pub composition: PromptSegment,
    pub lighting: PromptSegment,
    pub style: PromptSegment,
    pub mood: PromptSegment,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PromptSegment {
    pub original: String,
    pub translated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportResult {
    pub imported: i32,
    pub failed: i32,
    pub errors: Vec<String>,
}

pub fn get_images(
    conn: &Connection,
    folder_id: Option<&str>,
    offset: i64,
    limit: i64,
) -> Result<Vec<ImageItem>, rusqlite::Error> {
    if let Some(fid) = folder_id {
        let mut stmt = conn.prepare(
            "SELECT i.id, i.filename, i.file_path, i.thumb_path, i.width, i.height, i.is_favorite, i.has_analysis, i.created_at
             FROM images i
             JOIN image_folders if2 ON i.id = if2.image_id
             WHERE if2.folder_id = ?1
             ORDER BY i.created_at DESC
             LIMIT ?2 OFFSET ?3",
        )?;
        let items = stmt
            .query_map(rusqlite::params![fid, limit, offset], row_to_image_item)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(items)
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, filename, file_path, thumb_path, width, height, is_favorite, has_analysis, created_at
             FROM images ORDER BY created_at DESC LIMIT ?1 OFFSET ?2",
        )?;
        let items = stmt
            .query_map(rusqlite::params![limit, offset], row_to_image_item)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(items)
    }
}

fn row_to_image_item(row: &rusqlite::Row) -> Result<ImageItem, rusqlite::Error> {
    // Columns: 0=id, 1=filename, 2=file_path, 3=thumb_path, 4=width, 5=height, 6=is_favorite, 7=has_analysis, 8=created_at
    let file_path: String = row.get(2)?;
    let thumb_path: Option<String> = row.get(3)?;

    // Use thumb_path if the file exists, otherwise fall back to file_path (the original image)
    let thumb_url = if let Some(ref tp) = thumb_path {
        if std::path::Path::new(tp).exists() {
            format!("file://{}", tp)
        } else {
            format!("file://{}", file_path)
        }
    } else {
        format!("file://{}", file_path)
    };

    Ok(ImageItem {
        id: row.get(0)?,
        filename: row.get(1)?,
        thumb_url,
        width: row.get::<_, Option<i32>>(4)?.unwrap_or(0),
        height: row.get::<_, Option<i32>>(5)?.unwrap_or(0),
        is_favorite: row.get::<_, bool>(6)?,
        has_analysis: row.get::<_, bool>(7)?,
        created_at: row.get(8)?,
    })
}

pub fn get_image_detail(conn: &Connection, id: &str) -> Result<ImageDetail, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, file_path, thumb_path, width, height, is_favorite, has_analysis,
                created_at, memo, source_url
         FROM images WHERE id = ?1",
    )?;

    let detail = stmt.query_row(rusqlite::params![id], |row| {
        let file_path: String = row.get(2)?;
        let thumb_path: Option<String> = row.get(3)?;
        // Use thumbnail if it exists on disk, otherwise use the original file
        let thumb_url = if let Some(ref tp) = thumb_path {
            if std::path::Path::new(tp).exists() {
                format!("file://{}", tp)
            } else {
                format!("file://{}", file_path)
            }
        } else {
            format!("file://{}", file_path)
        };
        Ok(ImageDetail {
            id: row.get(0)?,
            filename: row.get(1)?,
            full_url: format!("file://{}", file_path),
            thumb_url,
            width: row.get::<_, Option<i32>>(4)?.unwrap_or(0),
            height: row.get::<_, Option<i32>>(5)?.unwrap_or(0),
            is_favorite: row.get::<_, bool>(6)?,
            has_analysis: row.get::<_, bool>(7)?,
            created_at: row.get(8)?,
            memo: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
            source_url: row.get(10)?,
            analysis: None,
            color_palette: None,
            folder_ids: vec![],
        })
    })?;

    // Load analysis if it exists
    let analysis = super::analysis::get_analysis(conn, id)?;

    // Load folder_ids
    let mut folder_stmt =
        conn.prepare("SELECT folder_id FROM image_folders WHERE image_id = ?1")?;
    let folder_ids: Vec<String> = folder_stmt
        .query_map(rusqlite::params![id], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ImageDetail {
        analysis,
        folder_ids,
        ..detail
    })
}

pub fn insert_image(
    conn: &Connection,
    id: &str,
    filename: &str,
    file_path: &str,
    thumb_path: Option<&str>,
    width: i32,
    height: i32,
    file_size: i64,
    format: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO images (id, filename, file_path, thumb_path, width, height, file_size, format)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![id, filename, file_path, thumb_path, width, height, file_size, format],
    )?;
    Ok(())
}

pub fn delete_images(conn: &Connection, ids: &[String]) -> Result<(), rusqlite::Error> {
    for id in ids {
        conn.execute("DELETE FROM images WHERE id = ?1", rusqlite::params![id])?;
    }
    Ok(())
}

pub fn move_images(
    conn: &Connection,
    ids: &[String],
    target_folder_id: &str,
) -> Result<(), rusqlite::Error> {
    for id in ids {
        conn.execute(
            "DELETE FROM image_folders WHERE image_id = ?1",
            rusqlite::params![id],
        )?;
        conn.execute(
            "INSERT OR IGNORE INTO image_folders (image_id, folder_id) VALUES (?1, ?2)",
            rusqlite::params![id, target_folder_id],
        )?;
    }
    Ok(())
}

pub fn link_image_to_folder(
    conn: &Connection,
    image_id: &str,
    folder_id: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO image_folders (image_id, folder_id) VALUES (?1, ?2)",
        rusqlite::params![image_id, folder_id],
    )?;
    Ok(())
}

pub fn update_memo(conn: &Connection, id: &str, memo: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE images SET memo = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        rusqlite::params![memo, id],
    )?;
    Ok(())
}

pub fn toggle_favorite(conn: &Connection, id: &str) -> Result<bool, rusqlite::Error> {
    let current: bool = conn.query_row(
        "SELECT is_favorite FROM images WHERE id = ?1",
        rusqlite::params![id],
        |row| row.get(0),
    )?;
    let new_val = !current;
    conn.execute(
        "UPDATE images SET is_favorite = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        rusqlite::params![new_val, id],
    )?;
    Ok(new_val)
}
