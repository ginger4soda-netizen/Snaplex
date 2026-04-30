/// Simple file system commands for frontend use
use std::io::Write;
use std::process::{Command, Stdio};

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
    #[cfg(target_os = "macos")]
    {
        let mut child = Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start pbcopy: {}", e))?;

        child
            .stdin
            .as_mut()
            .ok_or_else(|| "Failed to open pbcopy stdin".to_string())?
            .write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write clipboard text: {}", e))?;

        let status = child
            .wait()
            .map_err(|e| format!("Failed to finish pbcopy: {}", e))?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("pbcopy exited with status {}", status));
    }

    #[cfg(target_os = "windows")]
    {
        let mut child = Command::new("powershell")
            .args(["-NoProfile", "-Command", "Set-Clipboard"])
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start Set-Clipboard: {}", e))?;

        child
            .stdin
            .as_mut()
            .ok_or_else(|| "Failed to open Set-Clipboard stdin".to_string())?
            .write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write clipboard text: {}", e))?;

        let status = child
            .wait()
            .map_err(|e| format!("Failed to finish Set-Clipboard: {}", e))?;
        if status.success() {
            return Ok(());
        }
        return Err(format!("Set-Clipboard exited with status {}", status));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        for program in ["wl-copy", "xclip"] {
            let mut command = Command::new(program);
            if program == "xclip" {
                command.args(["-selection", "clipboard"]);
            }

            let Ok(mut child) = command.stdin(Stdio::piped()).spawn() else {
                continue;
            };

            child
                .stdin
                .as_mut()
                .ok_or_else(|| format!("Failed to open {} stdin", program))?
                .write_all(text.as_bytes())
                .map_err(|e| format!("Failed to write clipboard text: {}", e))?;

            let status = child
                .wait()
                .map_err(|e| format!("Failed to finish {}: {}", program, e))?;
            if status.success() {
                return Ok(());
            }
        }

        Err("No supported clipboard command found".to_string())
    }
}
