use crate::commands::library_commands::CurrentLibrary;
use crate::commands::settings_commands;
use crate::db::image_sources::ImageSourceInput;
use crate::db::Database;
use crate::services::capture_log::{CaptureLog, CaptureLogEntry};
use crate::services::ingest::{self, IngestOutcome, IngestRejection, IngestRequest};
use base64::Engine;
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

const MAX_CAPTURE_BYTES: usize = 50 * 1024 * 1024;
static INSTANCE_ID: OnceLock<String> = OnceLock::new();

pub fn handle_message(app: &AppHandle, message: Value) -> Value {
    match message.get("kind").and_then(Value::as_str) {
        Some("ping") => handle_ping(),
        Some("hello_ack") => handle_hello_ack(app),
        Some("write_tempfile") => handle_write_tempfile(message),
        Some("write_tempfile_chunk") => handle_write_tempfile_chunk(message),
        Some("capture") => handle_capture(app, message),
        Some(other) => error("unknown_message", &format!("unknown message kind: {other}")),
        None => error("invalid_message", "message.kind is required"),
    }
}

fn handle_ping() -> Value {
    json!({
        "kind": "pong",
        "desktop_version": env!("CARGO_PKG_VERSION"),
        "instance_id": desktop_instance_id()
    })
}

fn handle_hello_ack(app: &AppHandle) -> Value {
    let current = app.state::<CurrentLibrary>();
    let library_name = current
        .info
        .lock()
        .unwrap()
        .as_ref()
        .map(|info| info.name.clone());

    json!({
        "kind": "ready",
        "desktop_version": env!("CARGO_PKG_VERSION"),
        "instance_id": desktop_instance_id(),
        "locale": settings_commands::current_locale(app),
        "library_name": library_name
    })
}

fn desktop_instance_id() -> &'static str {
    INSTANCE_ID
        .get_or_init(|| uuid::Uuid::new_v4().to_string())
        .as_str()
}

fn handle_write_tempfile(message: Value) -> Value {
    let content = match message
        .get("content_base64")
        .or_else(|| message.get("content"))
        .and_then(Value::as_str)
    {
        Some(content) => content,
        None => {
            return error(
                "invalid_message",
                "write_tempfile.content_base64 is required",
            )
        }
    };

    let bytes = match decode_base64(content) {
        Ok(bytes) => bytes,
        Err(message) => return error("invalid_base64", &message),
    };
    if bytes.len() > MAX_CAPTURE_BYTES {
        return error("payload_too_large", "capture payload exceeds 50 MB");
    }

    let path = std::env::temp_dir().join(format!("snaplex-capture-{}.bin", uuid::Uuid::new_v4()));
    match std::fs::write(&path, bytes) {
        Ok(()) => json!({
            "kind": "tempfile_path",
            "path": path.to_string_lossy()
        }),
        Err(io_error) => error("tempfile_write_failed", &io_error.to_string()),
    }
}

fn handle_write_tempfile_chunk(message: Value) -> Value {
    let tempfile_id = match message.get("tempfile_id").and_then(Value::as_str) {
        Some(value) if valid_tempfile_id(value) => value,
        _ => {
            return error(
                "invalid_message",
                "write_tempfile_chunk.tempfile_id is required",
            )
        }
    };
    let chunk = match message
        .get("chunk_base64")
        .or_else(|| message.get("content_base64"))
        .and_then(Value::as_str)
    {
        Some(chunk) => chunk,
        None => {
            return error(
                "invalid_message",
                "write_tempfile_chunk.chunk_base64 is required",
            )
        }
    };
    let reset = message
        .get("reset")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let done = message
        .get("done")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let bytes = match decode_base64(chunk) {
        Ok(bytes) => bytes,
        Err(message) => return error("invalid_base64", &message),
    };
    let path = std::env::temp_dir().join(format!("snaplex-capture-{tempfile_id}.bin"));

    if reset {
        match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(io_error) if io_error.kind() == std::io::ErrorKind::NotFound => {}
            Err(io_error) => return error("tempfile_write_failed", &io_error.to_string()),
        }
    }

    let mut file = match std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        Ok(file) => file,
        Err(io_error) => return error("tempfile_write_failed", &io_error.to_string()),
    };
    if let Err(io_error) = file.write_all(&bytes) {
        return error("tempfile_write_failed", &io_error.to_string());
    }

    let total_len = match file.metadata() {
        Ok(metadata) => metadata.len() as usize,
        Err(io_error) => return error("tempfile_write_failed", &io_error.to_string()),
    };
    if total_len > MAX_CAPTURE_BYTES {
        let _ = std::fs::remove_file(&path);
        return error("payload_too_large", "capture payload exceeds 50 MB");
    }

    if done {
        json!({
            "kind": "tempfile_path",
            "path": path.to_string_lossy()
        })
    } else {
        json!({
            "kind": "tempfile_chunk_written",
            "tempfile_id": tempfile_id,
            "bytes_written": total_len
        })
    }
}

fn handle_capture(app: &AppHandle, message: Value) -> Value {
    let envelope_value = message
        .get("envelope")
        .cloned()
        .unwrap_or_else(|| message.clone());
    let envelope: CaptureEnvelope = match serde_json::from_value(envelope_value) {
        Ok(envelope) => envelope,
        Err(parse_error) => return error("invalid_capture", &parse_error.to_string()),
    };

    let log_context = CaptureLogContext::from(&envelope);
    let started = Instant::now();
    let result = save_capture(app, envelope);
    let duration_ms = started.elapsed().as_millis();

    match result {
        Ok(outcome) => {
            record_capture_outcome(app, &log_context, &outcome, duration_ms);
            emit_capture_event(app, &log_context, &outcome);
            match outcome {
                IngestOutcome::Saved { image_id, .. } => json!({
                    "kind": "capture_result",
                    "outcome": "saved",
                    "image_id": image_id
                }),
                IngestOutcome::Duplicate {
                    image_id,
                    source_appended,
                } => json!({
                    "kind": "capture_result",
                    "outcome": "duplicate",
                    "image_id": image_id,
                    "source_appended": source_appended
                }),
                IngestOutcome::Rejected { reason } => {
                    error(reason.code(), rejection_message(reason))
                }
            }
        }
        Err(capture_error) => {
            record_capture_error(app, &log_context, capture_error.code, duration_ms);
            error(capture_error.code, &capture_error.message)
        }
    }
}

fn emit_capture_event(app: &AppHandle, context: &CaptureLogContext, outcome: &IngestOutcome) {
    let (outcome_name, image_id) = match outcome {
        IngestOutcome::Saved { image_id, .. } => ("saved", image_id.clone()),
        IngestOutcome::Duplicate { image_id, .. } => ("duplicate", image_id.clone()),
        IngestOutcome::Rejected { .. } => return,
    };

    let payload = json!({
        "outcome": outcome_name,
        "image_id": image_id,
        "capture_type": context.capture_type,
    });

    if let Err(error) = app.emit("snaplex://capture-saved", payload) {
        log::warn!("failed to emit snaplex://capture-saved: {error}");
    }
}

fn record_capture_outcome(
    app: &AppHandle,
    context: &CaptureLogContext,
    outcome: &IngestOutcome,
    duration_ms: u128,
) {
    let (outcome_name, image_id, code) = match outcome {
        IngestOutcome::Saved { image_id, .. } => ("saved", Some(image_id.clone()), None),
        IngestOutcome::Duplicate { image_id, .. } => ("duplicate", Some(image_id.clone()), None),
        IngestOutcome::Rejected { reason } => ("rejected", None, Some(reason.code().to_string())),
    };

    app.state::<CaptureLog>().record(CaptureLogEntry {
        captured_at: chrono::Utc::now().to_rfc3339(),
        capture_type: context.capture_type.clone(),
        outcome: outcome_name.to_string(),
        image_id,
        code,
        source_url: context.source_url.clone(),
        page_url: context.page_url.clone(),
        duration_ms,
    });
}

fn record_capture_error(
    app: &AppHandle,
    context: &CaptureLogContext,
    code: &'static str,
    duration_ms: u128,
) {
    app.state::<CaptureLog>().record(CaptureLogEntry {
        captured_at: chrono::Utc::now().to_rfc3339(),
        capture_type: context.capture_type.clone(),
        outcome: "error".to_string(),
        image_id: None,
        code: Some(code.to_string()),
        source_url: context.source_url.clone(),
        page_url: context.page_url.clone(),
        duration_ms,
    });
}

fn save_capture(app: &AppHandle, envelope: CaptureEnvelope) -> Result<IngestOutcome, CaptureError> {
    let current = app.state::<CurrentLibrary>();
    let library = current
        .info
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| CaptureError::new("no_active_library", "No Snaplex library is open"))?;
    let library_path = PathBuf::from(&library.path);
    let bytes = read_payload(&envelope.payload_ref)?;
    let metadata_json = envelope
        .metadata
        .type_specific
        .as_ref()
        .and_then(|value| serde_json::to_string(value).ok());
    let source_url = envelope.metadata.source_url.clone();
    let source_domain = source_url
        .as_deref()
        .or(Some(envelope.metadata.page_url.as_str()))
        .and_then(domain_from_url);
    let request = IngestRequest {
        bytes,
        content_type: envelope.payload_ref.content_type.clone(),
        filename_hint: envelope.metadata.filename_hint.clone(),
        library_path,
        folder_id: None,
        source: ImageSourceInput {
            capture_type: envelope.capture_type,
            source_url,
            page_url: Some(envelope.metadata.page_url),
            page_title: envelope.metadata.page_title,
            source_domain,
            captured_at: envelope.metadata.captured_at,
            client_id: "browser-extension".to_string(),
            metadata_json,
        },
    };

    let db_state = app.state::<Mutex<Option<Database>>>();
    let guard = db_state.lock().unwrap();
    let db = guard
        .as_ref()
        .ok_or_else(|| CaptureError::new("no_active_library", "No Snaplex database is open"))?;
    let conn = db.conn.lock().unwrap();
    let outcome = ingest::ingest(&conn, request)
        .map_err(|error| CaptureError::new("database_error", error.to_string()))?;

    if envelope.payload_ref.kind == "tempfile" {
        let _ = std::fs::remove_file(&envelope.payload_ref.value);
    }

    Ok(outcome)
}

fn read_payload(payload_ref: &PayloadRef) -> Result<Vec<u8>, CaptureError> {
    match payload_ref.kind.as_str() {
        "inline" => decode_base64(&payload_ref.value)
            .map_err(|message| CaptureError::new("invalid_base64", message)),
        "tempfile" => std::fs::read(Path::new(&payload_ref.value)).map_err(|error| {
            CaptureError::new(
                "tempfile_read_failed",
                format!("failed to read tempfile: {error}"),
            )
        }),
        other => Err(CaptureError::new(
            "invalid_payload_ref",
            format!("unsupported payload_ref.kind: {other}"),
        )),
    }
}

fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    let raw = input
        .split_once(',')
        .filter(|(prefix, _)| prefix.contains("base64"))
        .map(|(_, value)| value)
        .unwrap_or(input);
    base64::engine::general_purpose::STANDARD
        .decode(raw)
        .map_err(|error| error.to_string())
}

fn sanitize_filename(input: &str) -> String {
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

fn valid_tempfile_id(input: &str) -> bool {
    !input.is_empty()
        && input.len() <= 80
        && input
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
}

fn domain_from_url(url: &str) -> Option<String> {
    let without_scheme = url.split_once("://").map(|(_, rest)| rest).unwrap_or(url);
    without_scheme
        .split('/')
        .next()
        .map(|host| host.split('@').next_back().unwrap_or(host))
        .map(|host| host.split(':').next().unwrap_or(host))
        .filter(|host| !host.is_empty())
        .map(sanitize_filename)
}

fn error(code: &'static str, message: &str) -> Value {
    json!({
        "kind": "error",
        "code": code,
        "message": message
    })
}

fn rejection_message(reason: IngestRejection) -> &'static str {
    match reason {
        IngestRejection::UnsupportedContentType => "unsupported image content type",
        IngestRejection::InvalidImageBytes => "invalid image bytes",
        IngestRejection::NoActiveLibrary => "No Snaplex library is open",
        IngestRejection::PayloadTooLarge => "capture payload exceeds 50 MB",
        IngestRejection::FilesystemError => "failed to write capture",
    }
}

#[derive(Debug, Deserialize)]
struct CaptureEnvelope {
    #[serde(rename = "type")]
    capture_type: String,
    payload_ref: PayloadRef,
    metadata: CaptureMetadata,
}

#[derive(Debug, Deserialize)]
struct PayloadRef {
    kind: String,
    value: String,
    content_type: String,
}

#[derive(Debug, Deserialize)]
struct CaptureMetadata {
    source_url: Option<String>,
    page_url: String,
    filename_hint: Option<String>,
    captured_at: String,
    #[allow(dead_code)]
    page_title: Option<String>,
    #[allow(dead_code)]
    type_specific: Option<Value>,
}

struct CaptureLogContext {
    capture_type: String,
    source_url: Option<String>,
    page_url: Option<String>,
}

impl From<&CaptureEnvelope> for CaptureLogContext {
    fn from(envelope: &CaptureEnvelope) -> Self {
        Self {
            capture_type: envelope.capture_type.clone(),
            source_url: envelope.metadata.source_url.clone(),
            page_url: Some(envelope.metadata.page_url.clone()),
        }
    }
}

#[derive(Debug)]
struct CaptureError {
    code: &'static str,
    message: String,
}

impl CaptureError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}
