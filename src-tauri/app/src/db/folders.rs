use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FolderNode {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub children: Vec<FolderNode>,
    pub image_count: i64,
}

pub fn get_folder_tree(conn: &Connection) -> Result<Vec<FolderNode>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.name, f.parent_id,
                (
                    WITH RECURSIVE folder_scope(id) AS (
                        SELECT f.id
                        UNION ALL
                        SELECT child.id FROM folders child JOIN folder_scope fs ON child.parent_id = fs.id
                    )
                    SELECT COUNT(DISTINCT image_id) FROM image_folders
                    WHERE folder_id IN (SELECT id FROM folder_scope)
                ) as image_count
         FROM folders f ORDER BY f.sort_order, f.name",
    )?;

    let flat: Vec<FolderNode> = stmt
        .query_map([], |row| {
            Ok(FolderNode {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                children: vec![],
                image_count: row.get(3)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(build_tree(flat, None))
}

fn build_tree(flat: Vec<FolderNode>, parent_id: Option<&str>) -> Vec<FolderNode> {
    flat.iter()
        .filter(|f| f.parent_id.as_deref() == parent_id)
        .map(|f| {
            let children = build_tree(flat.clone(), Some(&f.id));
            FolderNode {
                children,
                ..f.clone()
            }
        })
        .collect()
}

pub fn create_folder(
    conn: &Connection,
    id: &str,
    name: &str,
    parent_id: Option<&str>,
) -> Result<FolderNode, rusqlite::Error> {
    conn.execute(
        "INSERT INTO folders (id, name, parent_id) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, name, parent_id],
    )?;
    Ok(FolderNode {
        id: id.to_string(),
        name: name.to_string(),
        parent_id: parent_id.map(|s| s.to_string()),
        children: vec![],
        image_count: 0,
    })
}

pub fn rename_folder(conn: &Connection, id: &str, name: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE folders SET name = ?1 WHERE id = ?2",
        rusqlite::params![name, id],
    )?;
    Ok(())
}

pub fn delete_folder(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM folders WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}

pub fn move_folder(
    conn: &Connection,
    id: &str,
    new_parent_id: Option<&str>,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE folders SET parent_id = ?1 WHERE id = ?2",
        rusqlite::params![new_parent_id, id],
    )?;
    Ok(())
}
