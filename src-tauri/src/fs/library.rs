use super::LibraryInfo;
use serde_json::json;
use std::fs;
use std::path::Path;

/// Create a new .snpx library at the given path
pub fn create_library(path: &str, name: &str) -> Result<LibraryInfo, String> {
    let lib_path = Path::new(path);

    // Create directory structure
    fs::create_dir_all(lib_path.join("images"))
        .map_err(|e| format!("Failed to create images dir: {}", e))?;
    fs::create_dir_all(lib_path.join("thumbnails"))
        .map_err(|e| format!("Failed to create thumbnails dir: {}", e))?;

    // Write metadata.json
    let now = chrono::Utc::now().to_rfc3339();
    let metadata = json!({
        "name": name,
        "createdAt": now,
        "version": "0.1.0"
    });
    fs::write(
        lib_path.join("metadata.json"),
        serde_json::to_string_pretty(&metadata).unwrap(),
    )
    .map_err(|e| format!("Failed to write metadata: {}", e))?;

    Ok(LibraryInfo {
        path: path.to_string(),
        name: name.to_string(),
        image_count: 0,
        created_at: now,
    })
}

/// Open an existing .snpx library
pub fn open_library(path: &str) -> Result<LibraryInfo, String> {
    let lib_path = Path::new(path);
    let metadata_path = lib_path.join("metadata.json");

    if !metadata_path.exists() {
        return Err(format!("Not a valid .snpx library: {}", path));
    }

    let content =
        fs::read_to_string(&metadata_path).map_err(|e| format!("Failed to read metadata: {}", e))?;
    let metadata: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Invalid metadata: {}", e))?;

    let name = metadata["name"]
        .as_str()
        .unwrap_or("Unnamed")
        .to_string();
    let created_at = metadata["createdAt"]
        .as_str()
        .unwrap_or("")
        .to_string();

    // Count images in images/ directory
    let images_dir = lib_path.join("images");
    let image_count = if images_dir.exists() {
        count_images_recursive(&images_dir)
    } else {
        0
    };

    Ok(LibraryInfo {
        path: path.to_string(),
        name,
        image_count,
        created_at,
    })
}

/// Check if a path is a valid .snpx library
pub fn is_library(path: &str) -> bool {
    let lib_path = Path::new(path);
    lib_path.join("metadata.json").exists() && lib_path.join("images").is_dir()
}

fn count_images_recursive(dir: &Path) -> i64 {
    let mut count = 0i64;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                count += count_images_recursive(&path);
            } else if is_image_file(&path) {
                count += 1;
            }
        }
    }
    count
}

fn is_image_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .as_deref(),
        Some("jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "tiff" | "svg")
    )
}
