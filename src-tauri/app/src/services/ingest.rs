use crate::db::image_sources::{self, ImageSourceInput};
use crate::db::images;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

const MAX_PAYLOAD_BYTES: usize = 50 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct IngestRequest {
    pub bytes: Vec<u8>,
    pub content_type: String,
    pub filename_hint: Option<String>,
    pub library_path: PathBuf,
    pub folder_id: Option<String>,
    pub source: ImageSourceInput,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case", tag = "outcome")]
pub enum IngestOutcome {
    Saved {
        image_id: String,
        file_path: String,
    },
    Duplicate {
        image_id: String,
        source_appended: bool,
    },
    Rejected {
        reason: IngestRejection,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum IngestRejection {
    UnsupportedContentType,
    InvalidImageBytes,
    NoActiveLibrary,
    PayloadTooLarge,
    FilesystemError,
}

impl IngestRejection {
    pub fn code(self) -> &'static str {
        match self {
            Self::UnsupportedContentType => "unsupported_content_type",
            Self::InvalidImageBytes => "invalid_image_bytes",
            Self::NoActiveLibrary => "no_active_library",
            Self::PayloadTooLarge => "payload_too_large",
            Self::FilesystemError => "filesystem_error",
        }
    }
}

pub fn ingest(conn: &Connection, req: IngestRequest) -> Result<IngestOutcome, rusqlite::Error> {
    if req.bytes.len() > MAX_PAYLOAD_BYTES {
        return Ok(IngestOutcome::Rejected {
            reason: IngestRejection::PayloadTooLarge,
        });
    }

    let ext = match extension_for_content_type(&req.content_type) {
        Some(ext) => ext,
        None => {
            return Ok(IngestOutcome::Rejected {
                reason: IngestRejection::UnsupportedContentType,
            })
        }
    };

    let decoded_image = match image::load_from_memory(&req.bytes) {
        Ok(image) => image,
        Err(_) => {
            return Ok(IngestOutcome::Rejected {
                reason: IngestRejection::InvalidImageBytes,
            })
        }
    };

    let content_sha256 = sha256_hex(&req.bytes);
    if let Some(existing_id) = images::find_by_sha256(conn, &content_sha256)? {
        let before_count = image_sources::list_sources_for_image(conn, &existing_id)?.len();
        image_sources::append_source(conn, &existing_id, req.source)?;
        let after_count = image_sources::list_sources_for_image(conn, &existing_id)?.len();
        return Ok(IngestOutcome::Duplicate {
            image_id: existing_id,
            source_appended: after_count > before_count,
        });
    }

    if req.library_path.as_os_str().is_empty() {
        return Ok(IngestOutcome::Rejected {
            reason: IngestRejection::NoActiveLibrary,
        });
    }

    let images_dir = req.library_path.join("images");
    let thumbs_dir = req.library_path.join("thumbnails");
    if std::fs::create_dir_all(&images_dir).is_err()
        || std::fs::create_dir_all(&thumbs_dir).is_err()
    {
        return Ok(IngestOutcome::Rejected {
            reason: IngestRejection::FilesystemError,
        });
    }

    let id = uuid::Uuid::new_v4().to_string();
    let filename_hint = req
        .filename_hint
        .as_deref()
        .map(sanitize_filename)
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| generated_filename(&req.source, ext));
    let stored_filename = format!("{}_{}", &id[..8], ensure_extension(&filename_hint, ext));
    let dest = images_dir.join(&stored_filename);
    if std::fs::write(&dest, &req.bytes).is_err() {
        return Ok(IngestOutcome::Rejected {
            reason: IngestRejection::FilesystemError,
        });
    }

    let thumb_dest = thumbs_dir.join(format!("{id}.webp"));
    let source_url = req
        .source
        .source_url
        .as_deref()
        .or(req.source.page_url.as_deref());
    images::insert_image(
        conn,
        &id,
        &stored_filename,
        &dest.to_string_lossy(),
        Some(&thumb_dest.to_string_lossy()),
        decoded_image.width() as i32,
        decoded_image.height() as i32,
        req.bytes.len() as i64,
        ext,
        source_url,
        Some(&content_sha256),
    )?;
    image_sources::append_source(conn, &id, req.source)?;
    if let Some(folder_id) = req.folder_id {
        images::link_image_to_folder(conn, &id, &folder_id)?;
    }

    Ok(IngestOutcome::Saved {
        image_id: id,
        file_path: dest.to_string_lossy().to_string(),
    })
}

pub fn request_from_file(
    path: &Path,
    library_path: PathBuf,
    folder_id: Option<String>,
) -> Result<IngestRequest, String> {
    let bytes = std::fs::read(path).map_err(|error| format!("Read failed: {error}"))?;
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "Invalid filename".to_string())?
        .to_string();
    let content_type = content_type_from_extension(path);
    let captured_at = chrono::Utc::now().to_rfc3339();
    let metadata_json = serde_json::json!({
        "localPath": path.to_string_lossy()
    })
    .to_string();

    Ok(IngestRequest {
        bytes,
        content_type,
        filename_hint: Some(filename),
        library_path,
        folder_id,
        source: ImageSourceInput {
            capture_type: "image".to_string(),
            source_url: None,
            page_url: None,
            page_title: None,
            source_domain: None,
            captured_at,
            client_id: "desktop-import".to_string(),
            metadata_json: Some(metadata_json),
        },
    })
}

pub fn extension_for_content_type(content_type: &str) -> Option<&'static str> {
    match content_type
        .split(';')
        .next()
        .unwrap_or(content_type)
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "image/png" => Some("png"),
        "image/gif" => Some("gif"),
        "image/webp" => Some("webp"),
        "image/bmp" => Some("bmp"),
        "image/jpeg" | "image/jpg" => Some("jpg"),
        _ => None,
    }
}

pub fn content_type_from_extension(path: &Path) -> String {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        _ => "application/octet-stream",
    }
    .to_string()
}

pub fn sanitize_filename(input: &str) -> String {
    input
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

fn generated_filename(source: &ImageSourceInput, ext: &str) -> String {
    let domain = source
        .source_domain
        .as_deref()
        .map(sanitize_filename)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "web".to_string());
    let stamp = source
        .captured_at
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>();
    sanitize_filename(&format!(
        "snaplex-{domain}-{}-{stamp}.{ext}",
        source.capture_type
    ))
}

fn ensure_extension(filename: &str, ext: &str) -> String {
    let path = Path::new(filename);
    if path.extension().and_then(|value| value.to_str()).is_some() {
        filename.to_string()
    } else {
        format!("{filename}.{ext}")
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::{ingest, IngestOutcome, IngestRejection, IngestRequest};
    use crate::db::image_sources::{self, ImageSourceInput};
    use crate::db::{migrations, schema};
    use rusqlite::Connection;
    use std::path::PathBuf;

    fn png_bytes(color: [u8; 4]) -> Vec<u8> {
        let image = image::RgbaImage::from_pixel(1, 1, image::Rgba(color));
        let mut cursor = std::io::Cursor::new(Vec::new());
        image
            .write_to(&mut cursor, image::ImageFormat::Png)
            .expect("encode png");
        cursor.into_inner()
    }

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        schema::create_tables(&conn).unwrap();
        migrations::run_migrations(&conn).unwrap();
        conn
    }

    fn temp_library() -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("snaplex-ingest-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(dir.join("images")).unwrap();
        std::fs::create_dir_all(dir.join("thumbnails")).unwrap();
        dir
    }

    fn source(page_url: &str, captured_at: &str) -> ImageSourceInput {
        ImageSourceInput {
            capture_type: "image".to_string(),
            source_url: Some(format!("{page_url}/image.png")),
            page_url: Some(page_url.to_string()),
            page_title: Some("Example".to_string()),
            source_domain: Some("example.com".to_string()),
            captured_at: captured_at.to_string(),
            client_id: "browser-extension".to_string(),
            metadata_json: None,
        }
    }

    fn request(bytes: Vec<u8>, library_path: PathBuf, source: ImageSourceInput) -> IngestRequest {
        IngestRequest {
            bytes,
            content_type: "image/png".to_string(),
            filename_hint: Some("sample.png".to_string()),
            library_path,
            folder_id: None,
            source,
        }
    }

    #[test]
    fn duplicate_bytes_append_source_without_new_image() {
        let conn = test_conn();
        let library_path = temp_library();
        let bytes = png_bytes([255, 0, 0, 255]);

        let first = ingest(
            &conn,
            request(
                bytes.clone(),
                library_path.clone(),
                source("https://example.com/a", "2026-05-05T00:00:00Z"),
            ),
        )
        .unwrap();
        let first_id = match first {
            IngestOutcome::Saved { image_id, .. } => image_id,
            other => panic!("expected saved, got {other:?}"),
        };

        let second = ingest(
            &conn,
            request(
                bytes,
                library_path.clone(),
                source("https://example.com/b", "2026-05-05T00:01:00Z"),
            ),
        )
        .unwrap();

        assert_eq!(
            second,
            IngestOutcome::Duplicate {
                image_id: first_id.clone(),
                source_appended: true
            }
        );
        let image_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |row| row.get(0))
            .unwrap();
        let sources = image_sources::list_sources_for_image(&conn, &first_id).unwrap();
        assert_eq!(image_count, 1);
        assert_eq!(sources.len(), 2);

        let _ = std::fs::remove_dir_all(library_path);
    }

    #[test]
    fn different_bytes_create_different_images() {
        let conn = test_conn();
        let library_path = temp_library();

        ingest(
            &conn,
            request(
                png_bytes([255, 0, 0, 255]),
                library_path.clone(),
                source("https://example.com/a", "2026-05-05T00:00:00Z"),
            ),
        )
        .unwrap();
        ingest(
            &conn,
            request(
                png_bytes([0, 255, 0, 255]),
                library_path.clone(),
                source("https://example.com/b", "2026-05-05T00:01:00Z"),
            ),
        )
        .unwrap();

        let image_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |row| row.get(0))
            .unwrap();
        let sha_count: i64 = conn
            .query_row(
                "SELECT COUNT(DISTINCT content_sha256) FROM images",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(image_count, 2);
        assert_eq!(sha_count, 2);

        let _ = std::fs::remove_dir_all(library_path);
    }

    #[test]
    fn source_url_is_written_only_on_first_insert() {
        let conn = test_conn();
        let library_path = temp_library();
        let bytes = png_bytes([255, 0, 0, 255]);

        let first_url = "https://example.com/first";
        let second_url = "https://example.com/second";
        let first = ingest(
            &conn,
            request(
                bytes.clone(),
                library_path.clone(),
                source(first_url, "2026-05-05T00:00:00Z"),
            ),
        )
        .unwrap();
        let image_id = match first {
            IngestOutcome::Saved { image_id, .. } => image_id,
            other => panic!("expected saved, got {other:?}"),
        };
        ingest(
            &conn,
            request(
                bytes,
                library_path.clone(),
                source(second_url, "2026-05-05T00:01:00Z"),
            ),
        )
        .unwrap();

        let legacy_source_url: String = conn
            .query_row(
                "SELECT source_url FROM images WHERE id = ?1",
                rusqlite::params![image_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(legacy_source_url, format!("{first_url}/image.png"));

        let _ = std::fs::remove_dir_all(library_path);
    }

    #[test]
    fn invalid_content_type_is_rejected() {
        let conn = test_conn();
        let library_path = temp_library();
        let mut req = request(
            png_bytes([255, 0, 0, 255]),
            library_path.clone(),
            source("https://example.com/a", "2026-05-05T00:00:00Z"),
        );
        req.content_type = "text/plain".to_string();

        let outcome = ingest(&conn, req).unwrap();
        assert_eq!(
            outcome,
            IngestOutcome::Rejected {
                reason: IngestRejection::UnsupportedContentType
            }
        );

        let _ = std::fs::remove_dir_all(library_path);
    }
}
