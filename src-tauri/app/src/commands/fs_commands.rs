/// Simple file system commands for frontend use
use crate::services::capture_log::{bridge_log_path, CaptureLog};
use tauri::State;

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn debug_log(message: String) {
    eprintln!("[snaplex-debug] {}", message);
}

#[tauri::command]
pub fn write_clipboard_text(text: String) -> Result<(), String> {
    // Write straight to the OS pasteboard via the native API (arboard) instead
    // of shelling out to `pbcopy`/`Set-Clipboard`/`xclip`. The subprocess route
    // could exit 0 without ever populating the pasteboard in a packaged app
    // (e.g. macOS `pbcopy` reporting success but leaving the clipboard empty),
    // which silently broke "copy all" while reporting success to the frontend.
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("Failed to open clipboard: {}", e))?;
    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard text: {}", e))
}

#[tauri::command]
pub fn export_capture_diagnostics(
    path: String,
    capture_log: State<'_, CaptureLog>,
) -> Result<(), String> {
    let entries = capture_log.recent();
    let exported_at = chrono::Utc::now().to_rfc3339();
    let capture_log_json = serde_json::to_vec_pretty(&serde_json::json!({
        "exported_at": exported_at,
        "entry_count": entries.len(),
        "entries": entries
    }))
    .map_err(|error| format!("Failed to encode capture diagnostics: {error}"))?;

    let bridge_path = bridge_log_path();
    let bridge_log = std::fs::read(&bridge_path).unwrap_or_else(|_| {
        format!(
            "Bridge log was not found at {}.\n",
            bridge_path.to_string_lossy()
        )
        .into_bytes()
    });
    let manifest_json = serde_json::to_vec_pretty(&serde_json::json!({
        "exported_at": exported_at,
        "bridge_log_path": bridge_path,
        "files": ["capture-log.json", "bridge.log"]
    }))
    .map_err(|error| format!("Failed to encode diagnostics manifest: {error}"))?;

    let archive = make_zip(&[
        ("manifest.json", &manifest_json),
        ("capture-log.json", &capture_log_json),
        ("bridge.log", &bridge_log),
    ])
    .map_err(|error| format!("Failed to create diagnostics archive: {error}"))?;

    std::fs::write(&path, archive)
        .map_err(|error| format!("Failed to write diagnostics archive: {error}"))
}

fn make_zip(entries: &[(&str, &[u8])]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut central_directory = Vec::new();

    for (name, data) in entries {
        let offset = checked_u32(out.len(), "zip offset")?;
        let name_bytes = name.as_bytes();
        let crc = crc32(data);
        let size = checked_u32(data.len(), "zip entry size")?;
        let name_len = checked_u16(name_bytes.len(), "zip filename length")?;

        write_u32(&mut out, 0x0403_4b50);
        write_u16(&mut out, 20);
        write_u16(&mut out, 0);
        write_u16(&mut out, 0);
        write_u16(&mut out, 0);
        write_u16(&mut out, 0);
        write_u32(&mut out, crc);
        write_u32(&mut out, size);
        write_u32(&mut out, size);
        write_u16(&mut out, name_len);
        write_u16(&mut out, 0);
        out.extend_from_slice(name_bytes);
        out.extend_from_slice(data);

        write_u32(&mut central_directory, 0x0201_4b50);
        write_u16(&mut central_directory, 20);
        write_u16(&mut central_directory, 20);
        write_u16(&mut central_directory, 0);
        write_u16(&mut central_directory, 0);
        write_u16(&mut central_directory, 0);
        write_u16(&mut central_directory, 0);
        write_u32(&mut central_directory, crc);
        write_u32(&mut central_directory, size);
        write_u32(&mut central_directory, size);
        write_u16(&mut central_directory, name_len);
        write_u16(&mut central_directory, 0);
        write_u16(&mut central_directory, 0);
        write_u16(&mut central_directory, 0);
        write_u16(&mut central_directory, 0);
        write_u32(&mut central_directory, 0);
        write_u32(&mut central_directory, offset);
        central_directory.extend_from_slice(name_bytes);
    }

    let central_offset = checked_u32(out.len(), "central directory offset")?;
    let central_size = checked_u32(central_directory.len(), "central directory size")?;
    out.extend_from_slice(&central_directory);

    write_u32(&mut out, 0x0605_4b50);
    write_u16(&mut out, 0);
    write_u16(&mut out, 0);
    write_u16(&mut out, checked_u16(entries.len(), "zip entry count")?);
    write_u16(&mut out, checked_u16(entries.len(), "zip entry count")?);
    write_u32(&mut out, central_size);
    write_u32(&mut out, central_offset);
    write_u16(&mut out, 0);

    Ok(out)
}

fn checked_u16(value: usize, label: &str) -> Result<u16, String> {
    u16::try_from(value).map_err(|_| format!("{label} is too large"))
}

fn checked_u32(value: usize, label: &str) -> Result<u32, String> {
    u32::try_from(value).map_err(|_| format!("{label} is too large"))
}

fn write_u16(out: &mut Vec<u8>, value: u16) {
    out.extend_from_slice(&value.to_le_bytes());
}

fn write_u32(out: &mut Vec<u8>, value: u32) {
    out.extend_from_slice(&value.to_le_bytes());
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xffff_ffff_u32;
    for byte in bytes {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            let mask = if crc & 1 == 1 { 0xedb8_8320 } else { 0 };
            crc = (crc >> 1) ^ mask;
        }
    }
    !crc
}

#[cfg(test)]
mod tests {
    use super::{crc32, make_zip};

    #[test]
    fn crc32_matches_standard_check_value() {
        assert_eq!(crc32(b"123456789"), 0xcbf4_3926);
    }

    #[test]
    fn zip_archive_contains_entry_names() {
        let zip = make_zip(&[("capture-log.json", b"{}"), ("bridge.log", b"log")]).unwrap();
        let as_text = String::from_utf8_lossy(&zip);
        assert!(as_text.contains("capture-log.json"));
        assert!(as_text.contains("bridge.log"));
    }
}
