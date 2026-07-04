use serde::Serialize;
use std::io;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const HOST_NAME: &str = "com.snaplex.host";
const HOST_DESCRIPTION: &str = "Snaplex Native Messaging Host";

// Placeholder until Chrome Web Store assigns the production extension ID.
const PRODUCTION_EXTENSION_ID: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DEV_EXTENSION_IDS: &[&str] = &[
    // Local unpacked Snaplex extension IDs used during browser-extension smoke tests.
    "bhaimaigbkoojgbnhoegefgplbmpmgjg",
    "plilihkbpoonppdlpclokjpoebdjifeb",
];

#[derive(Debug, Serialize)]
struct NativeMessagingManifest {
    name: &'static str,
    description: &'static str,
    path: String,
    #[serde(rename = "type")]
    manifest_type: &'static str,
    allowed_origins: Vec<String>,
}

pub fn install_native_messaging_manifests(app: &AppHandle) -> io::Result<Vec<PathBuf>> {
    let bridge_path = resolve_bridge_path(app)?;
    if !bridge_path.exists() {
        log::warn!(
            "snaplex-bridge binary not found at {}; skipping Native Messaging manifest install",
            bridge_path.display()
        );
        return Ok(Vec::new());
    }

    let manifest = NativeMessagingManifest {
        name: HOST_NAME,
        description: HOST_DESCRIPTION,
        path: bridge_path.to_string_lossy().to_string(),
        manifest_type: "stdio",
        allowed_origins: allowed_origins(),
    };
    let json = serde_json::to_string_pretty(&manifest)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;

    let mut installed = Vec::new();
    for target in native_manifest_targets() {
        match target {
            ManifestTarget::File(path) => {
                if !should_write_file_manifest(&path) {
                    continue;
                }
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::fs::write(&path, &json)?;
                installed.push(path);
            }
            #[cfg(windows)]
            ManifestTarget::WindowsRegistry { key, manifest_path } => {
                if let Some(parent) = manifest_path.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::fs::write(&manifest_path, &json)?;
                let status = std::process::Command::new("reg")
                    .args([
                        "add",
                        &key,
                        "/ve",
                        "/t",
                        "REG_SZ",
                        "/d",
                        &manifest_path.to_string_lossy(),
                        "/f",
                    ])
                    .status()?;
                if status.success() {
                    installed.push(manifest_path);
                } else {
                    log::warn!("failed to register Native Messaging host key {key}");
                }
            }
        }
    }

    Ok(installed)
}

fn resolve_bridge_path(app: &AppHandle) -> io::Result<PathBuf> {
    if let Some(path) = std::env::var_os("SNAPLEX_BRIDGE_PATH") {
        return Ok(PathBuf::from(path));
    }

    if cfg!(debug_assertions) {
        if let Some(path) = debug_bridge_path() {
            return Ok(path);
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(resource_dir) = app.path().resource_dir() {
            return Ok(resource_dir.join("snaplex-bridge"));
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                return Ok(dir.join("snaplex-bridge.exe"));
            }
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        for path in [
            PathBuf::from("/usr/lib/snaplex/snaplex-bridge"),
            PathBuf::from("/usr/bin/snaplex-bridge"),
        ] {
            if path.exists() {
                return Ok(path);
            }
        }
        if let Ok(resource_dir) = app.path().resource_dir() {
            return Ok(resource_dir.join("snaplex-bridge"));
        }
    }

    std::env::current_exe().map(|exe| {
        exe.parent()
            .unwrap_or_else(|| Path::new("."))
            .join(if cfg!(windows) {
                "snaplex-bridge.exe"
            } else {
                "snaplex-bridge"
            })
    })
}

fn debug_bridge_path() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    for ancestor in exe.ancestors() {
        if ancestor.file_name().and_then(|name| name.to_str()) == Some("target") {
            let profile = if cfg!(debug_assertions) {
                "debug"
            } else {
                "release"
            };
            return Some(ancestor.join(profile).join(if cfg!(windows) {
                "snaplex-bridge.exe"
            } else {
                "snaplex-bridge"
            }));
        }
    }
    None
}

fn allowed_origins() -> Vec<String> {
    std::iter::once(PRODUCTION_EXTENSION_ID)
        .chain(DEV_EXTENSION_IDS.iter().copied())
        .filter(|id| is_chrome_extension_id(id))
        .map(|id| format!("chrome-extension://{id}/"))
        .collect()
}

fn is_chrome_extension_id(id: &str) -> bool {
    id.len() == 32 && id.bytes().all(|byte| matches!(byte, b'a'..=b'p'))
}

fn should_write_file_manifest(path: &Path) -> bool {
    path.exists()
        || path
            .parent()
            .and_then(Path::parent)
            .map(Path::exists)
            .unwrap_or(false)
}

enum ManifestTarget {
    File(PathBuf),
    #[cfg(windows)]
    WindowsRegistry {
        key: String,
        manifest_path: PathBuf,
    },
}

fn native_manifest_targets() -> Vec<ManifestTarget> {
    let mut targets = Vec::new();

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            for base in [
                "Library/Application Support/Google/Chrome",
                "Library/Application Support/Microsoft Edge",
                "Library/Application Support/BraveSoftware/Brave-Browser",
                "Library/Application Support/Arc/User Data",
            ] {
                targets.push(ManifestTarget::File(
                    home.join(base)
                        .join("NativeMessagingHosts")
                        .join(format!("{HOST_NAME}.json")),
                ));
            }
        }
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(home) = dirs::home_dir() {
            for base in [
                ".config/google-chrome",
                ".config/microsoft-edge",
                ".config/BraveSoftware/Brave-Browser",
                ".config/chromium",
            ] {
                targets.push(ManifestTarget::File(
                    home.join(base)
                        .join("NativeMessagingHosts")
                        .join(format!("{HOST_NAME}.json")),
                ));
            }
        }
    }

    #[cfg(windows)]
    {
        let manifest_dir = dirs::data_local_dir()
            .unwrap_or_else(std::env::temp_dir)
            .join("Snaplex")
            .join("NativeMessagingHosts");
        let manifest_path = manifest_dir.join(format!("{HOST_NAME}.json"));
        for vendor_key in [
            "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts",
            "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts",
            "HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts",
        ] {
            targets.push(ManifestTarget::WindowsRegistry {
                key: format!("{vendor_key}\\{HOST_NAME}"),
                manifest_path: manifest_path.clone(),
            });
        }
    }

    targets
}

#[cfg(test)]
mod tests {
    use super::{allowed_origins, is_chrome_extension_id};

    #[test]
    fn validates_chrome_extension_ids() {
        assert!(is_chrome_extension_id("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
        assert!(is_chrome_extension_id("abcdefghijklmnopabcdefghijklmnop"));
        assert!(!is_chrome_extension_id("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
        assert!(!is_chrome_extension_id("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaq"));
    }

    #[test]
    fn allowed_origins_are_chrome_extension_urls() {
        assert_eq!(
            allowed_origins(),
            vec![
                "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/".to_string(),
                "chrome-extension://bhaimaigbkoojgbnhoegefgplbmpmgjg/".to_string(),
                "chrome-extension://plilihkbpoonppdlpclokjpoebdjifeb/".to_string(),
            ]
        );
    }
}
