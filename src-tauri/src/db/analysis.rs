use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use super::images::{AnalysisResult, PromptSegment, StructuredPrompts};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DimensionVersion {
    pub version: i32,
    pub original: String,
    pub translated: String,
    pub is_current: bool,
    pub created_at: String,
}

pub fn get_analysis(
    conn: &Connection,
    image_id: &str,
) -> Result<Option<AnalysisResult>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT description,
                subject_en, subject_cn, environment_en, environment_cn,
                composition_en, composition_cn, lighting_en, lighting_cn,
                mood_en, mood_cn, style_en, style_cn
         FROM analysis WHERE image_id = ?1",
    )?;

    let result = stmt.query_row(rusqlite::params![image_id], |row| {
        Ok(AnalysisResult {
            description: row.get::<_, Option<String>>(0)?.unwrap_or_default(),
            structured_prompts: StructuredPrompts {
                subject: PromptSegment {
                    original: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    translated: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                },
                environment: PromptSegment {
                    original: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    translated: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                },
                composition: PromptSegment {
                    original: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                    translated: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                },
                lighting: PromptSegment {
                    original: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                    translated: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
                },
                mood: PromptSegment {
                    original: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
                    translated: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                },
                style: PromptSegment {
                    original: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
                    translated: row.get::<_, Option<String>>(12)?.unwrap_or_default(),
                },
            },
        })
    });

    match result {
        Ok(a) => Ok(Some(a)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn save_analysis(
    conn: &Connection,
    id: &str,
    image_id: &str,
    analysis: &AnalysisResult,
    provider: &str,
    model: &str,
) -> Result<(), rusqlite::Error> {
    let p = &analysis.structured_prompts;
    conn.execute(
        "INSERT OR REPLACE INTO analysis
         (id, image_id, description, subject_en, subject_cn, environment_en, environment_cn,
          composition_en, composition_cn, lighting_en, lighting_cn,
          mood_en, mood_cn, style_en, style_cn, provider, model)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
        rusqlite::params![
            id,
            image_id,
            analysis.description,
            p.subject.original,
            p.subject.translated,
            p.environment.original,
            p.environment.translated,
            p.composition.original,
            p.composition.translated,
            p.lighting.original,
            p.lighting.translated,
            p.mood.original,
            p.mood.translated,
            p.style.original,
            p.style.translated,
            provider,
            model,
        ],
    )?;
    conn.execute(
        "UPDATE images SET has_analysis = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        rusqlite::params![image_id],
    )?;

    // Populate FTS5 search index with all analysis text
    let search_parts: Vec<&str> = [
        analysis.description.as_str(),
        p.subject.original.as_str(), p.subject.translated.as_str(),
        p.environment.original.as_str(), p.environment.translated.as_str(),
        p.composition.original.as_str(), p.composition.translated.as_str(),
        p.lighting.original.as_str(), p.lighting.translated.as_str(),
        p.mood.original.as_str(), p.mood.translated.as_str(),
        p.style.original.as_str(), p.style.translated.as_str(),
    ].into_iter().filter(|s| !s.is_empty()).collect();
    let search_content = search_parts.join(" ");

    let memo: String = conn.query_row(
        "SELECT COALESCE(memo, '') FROM images WHERE id = ?1",
        rusqlite::params![image_id],
        |row| row.get(0),
    ).unwrap_or_default();

    super::search::update_search_index(conn, image_id, &search_content, &memo)?;

    Ok(())
}

pub fn get_dimension_history(
    conn: &Connection,
    image_id: &str,
    dimension: &str,
) -> Result<Vec<DimensionVersion>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT version, original, translated, is_current, created_at
         FROM dimension_history
         WHERE image_id = ?1 AND dimension = ?2
         ORDER BY version DESC",
    )?;

    let versions = stmt
        .query_map(rusqlite::params![image_id, dimension], |row| {
            Ok(DimensionVersion {
                version: row.get(0)?,
                original: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                translated: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                is_current: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(versions)
}

pub fn save_dimension_version(
    conn: &Connection,
    id: &str,
    image_id: &str,
    dimension: &str,
    original: &str,
    translated: &str,
) -> Result<(), rusqlite::Error> {
    // Set all existing versions to non-current
    conn.execute(
        "UPDATE dimension_history SET is_current = 0 WHERE image_id = ?1 AND dimension = ?2",
        rusqlite::params![image_id, dimension],
    )?;

    // Get next version number
    let next_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) + 1 FROM dimension_history WHERE image_id = ?1 AND dimension = ?2",
            rusqlite::params![image_id, dimension],
            |row| row.get(0),
        )?;

    conn.execute(
        "INSERT INTO dimension_history (id, image_id, dimension, version, original, translated, is_current)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)",
        rusqlite::params![id, image_id, dimension, next_version, original, translated],
    )?;

    Ok(())
}
