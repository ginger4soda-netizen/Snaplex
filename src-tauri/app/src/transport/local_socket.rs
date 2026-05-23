use serde::Serialize;
use serde_json::Value;
use std::io::{self, ErrorKind, Read, Write};
use std::thread;
use tauri::AppHandle;

const MAX_DESKTOP_MESSAGE_BYTES: u32 = 64 * 1024 * 1024;

pub fn start(app: AppHandle) -> io::Result<()> {
    #[cfg(unix)]
    {
        let path = socket_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }

        let listener = std::os::unix::net::UnixListener::bind(&path)?;
        thread::Builder::new()
            .name("snaplex-local-socket".to_string())
            .spawn(move || {
                for incoming in listener.incoming() {
                    match incoming {
                        Ok(stream) => {
                            let app = app.clone();
                            let _ = thread::Builder::new()
                                .name("snaplex-local-socket-client".to_string())
                                .spawn(move || handle_client(stream, app));
                        }
                        Err(error) => {
                            log::warn!("local socket accept failed: {error}");
                        }
                    }
                }
            })
            .map(|_| ())
    }

    #[cfg(windows)]
    {
        let _ = app;
        Ok(())
    }
}

#[cfg(unix)]
fn handle_client(mut stream: std::os::unix::net::UnixStream, app: AppHandle) {
    loop {
        let message = match read_json_message(&mut stream) {
            Ok(Some(message)) => message,
            Ok(None) => return,
            Err(error) => {
                let _ = write_json_message(
                    &mut stream,
                    &serde_json::json!({
                        "kind": "error",
                        "code": "invalid_message",
                        "message": error.to_string()
                    }),
                );
                return;
            }
        };

        let reply = crate::transport::handlers::handle_message(&app, message);
        if write_json_message(&mut stream, &reply).is_err() {
            return;
        }
    }
}

fn read_json_message<R: Read>(reader: &mut R) -> io::Result<Option<Value>> {
    let mut len_buf = [0_u8; 4];
    match reader.read_exact(&mut len_buf) {
        Ok(()) => {}
        Err(error) if error.kind() == ErrorKind::UnexpectedEof => return Ok(None),
        Err(error) => return Err(error),
    }

    let len = u32::from_le_bytes(len_buf);
    if len > MAX_DESKTOP_MESSAGE_BYTES {
        let mut limited = reader.take(len as u64);
        io::copy(&mut limited, &mut io::sink())?;
        return Err(io::Error::new(
            ErrorKind::InvalidData,
            "message exceeds Desktop socket limit",
        ));
    }

    let mut payload = vec![0_u8; len as usize];
    reader.read_exact(&mut payload)?;
    serde_json::from_slice(&payload).map(Some).map_err(|error| {
        io::Error::new(
            ErrorKind::InvalidData,
            format!("invalid JSON message: {error}"),
        )
    })
}

fn write_json_message<W: Write, T: Serialize>(writer: &mut W, value: &T) -> io::Result<()> {
    let payload = serde_json::to_vec(value).map_err(|error| {
        io::Error::new(
            ErrorKind::InvalidData,
            format!("failed to encode JSON message: {error}"),
        )
    })?;
    writer.write_all(&(payload.len() as u32).to_le_bytes())?;
    writer.write_all(&payload)?;
    writer.flush()
}

#[cfg(unix)]
pub fn socket_path() -> std::path::PathBuf {
    if let Some(runtime_dir) = std::env::var_os("XDG_RUNTIME_DIR") {
        return std::path::PathBuf::from(runtime_dir).join("snaplex.sock");
    }

    let uid = current_uid();
    std::env::var_os("TMPDIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join(format!("snaplex-{uid}.sock"))
}

#[cfg(unix)]
fn current_uid() -> String {
    std::process::Command::new("id")
        .arg("-u")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|uid| uid.trim().to_string())
        .filter(|uid| !uid.is_empty())
        .or_else(|| std::env::var("UID").ok())
        .unwrap_or_else(|| "user".to_string())
}
