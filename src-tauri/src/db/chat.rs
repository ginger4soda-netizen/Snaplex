use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageRow {
    pub id: String,
    pub role: String,
    pub text: String,
    pub timestamp: i64,
}

pub fn get_chat_messages(
    conn: &Connection,
    image_id: &str,
) -> Result<Vec<ChatMessageRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, role, text, CAST(strftime('%s', created_at) AS INTEGER) * 1000 as timestamp
         FROM chat_messages WHERE image_id = ?1 ORDER BY created_at ASC",
    )?;
    let msgs = stmt
        .query_map(rusqlite::params![image_id], |row| {
            Ok(ChatMessageRow {
                id: row.get(0)?,
                role: row.get(1)?,
                text: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
    Ok(msgs)
}

pub fn save_chat_message(
    conn: &Connection,
    id: &str,
    image_id: &str,
    role: &str,
    text: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO chat_messages (id, image_id, role, text) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, image_id, role, text],
    )?;
    Ok(())
}

pub fn delete_chat_messages(
    conn: &Connection,
    image_id: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "DELETE FROM chat_messages WHERE image_id = ?1",
        rusqlite::params![image_id],
    )?;
    Ok(())
}
