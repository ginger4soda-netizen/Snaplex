use crate::native_messaging::{read_json_message, write_json_message, DESKTOP_TO_BRIDGE_MAX_BYTES};
use serde_json::{json, Value};
use std::io;
use std::thread;
use std::time::{Duration, Instant};

pub struct DesktopClient {
    inner: PlatformStream,
    handshake: DesktopHandshake,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct DesktopHandshake {
    desktop_version: String,
    instance_id: String,
}

impl DesktopClient {
    pub fn connect_or_launch() -> io::Result<Self> {
        match connect_verified() {
            Ok(client) => Ok(client),
            Err(first_error) => {
                if is_handshake_error(&first_error) {
                    crate::logging::warn(format!(
                        "Snaplex Desktop socket rejected during instance handshake: {first_error}"
                    ));
                    return Err(first_error);
                }
                crate::logging::info(format!(
                    "Desktop socket unavailable; launching Snaplex Desktop: {first_error}"
                ));
                crate::launch_desktop::launch_desktop()?;
                let deadline = Instant::now() + Duration::from_secs(5);
                let mut last_error = first_error;

                while Instant::now() < deadline {
                    match connect_verified() {
                        Ok(client) => return Ok(client),
                        Err(error) => {
                            if is_handshake_error(&error) {
                                crate::logging::warn(format!(
                                    "Snaplex Desktop socket rejected during instance handshake after launch: {error}"
                                ));
                                return Err(error);
                            }
                            last_error = error;
                            thread::sleep(Duration::from_millis(200));
                        }
                    }
                }

                Err(last_error)
            }
        }
    }

    pub fn request(&mut self, message: &Value) -> io::Result<Option<Value>> {
        write_json_message(&mut self.inner, message)?;
        read_json_message(&mut self.inner, DESKTOP_TO_BRIDGE_MAX_BYTES)
    }

    pub fn desktop_version(&self) -> &str {
        &self.handshake.desktop_version
    }

    pub fn instance_id(&self) -> &str {
        &self.handshake.instance_id
    }
}

#[cfg(unix)]
type PlatformStream = std::os::unix::net::UnixStream;

#[cfg(windows)]
struct PlatformStream;

#[cfg(windows)]
impl std::io::Read for PlatformStream {
    fn read(&mut self, _buf: &mut [u8]) -> io::Result<usize> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "Windows named pipe transport is not implemented in this build",
        ))
    }
}

#[cfg(windows)]
impl std::io::Write for PlatformStream {
    fn write(&mut self, _buf: &[u8]) -> io::Result<usize> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "Windows named pipe transport is not implemented in this build",
        ))
    }

    fn flush(&mut self) -> io::Result<()> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "Windows named pipe transport is not implemented in this build",
        ))
    }
}

#[cfg(unix)]
fn connect() -> io::Result<PlatformStream> {
    std::os::unix::net::UnixStream::connect(socket_path())
}

#[cfg(windows)]
fn connect() -> io::Result<PlatformStream> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "Windows named pipe transport is not implemented in this build",
    ))
}

fn connect_verified() -> io::Result<DesktopClient> {
    let mut inner = connect()?;
    let handshake = verify_desktop(&mut inner)?;
    crate::logging::info(format!(
        "found Snaplex Desktop instance via socket; instance_id={}, desktop_version={}",
        handshake.instance_id, handshake.desktop_version
    ));
    Ok(DesktopClient { inner, handshake })
}

fn verify_desktop(stream: &mut PlatformStream) -> io::Result<DesktopHandshake> {
    write_json_message(
        stream,
        &json!({
            "kind": "ping",
            "client": "snaplex-bridge",
            "bridge_version": env!("CARGO_PKG_VERSION")
        }),
    )?;
    let reply = read_json_message(stream, DESKTOP_TO_BRIDGE_MAX_BYTES)?.ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "Snaplex Desktop socket closed before handshake ack",
        )
    })?;
    parse_desktop_handshake(reply)
}

fn parse_desktop_handshake(reply: Value) -> io::Result<DesktopHandshake> {
    if reply.get("kind").and_then(Value::as_str) != Some("pong") {
        return Err(handshake_error(format!(
            "expected pong handshake ack, got {}",
            reply
                .get("kind")
                .and_then(Value::as_str)
                .unwrap_or("<missing>")
        )));
    }

    let desktop_version = required_handshake_string(&reply, "desktop_version")?;
    if !is_plausible_version(&desktop_version) {
        return Err(handshake_error(format!(
            "invalid desktop_version in handshake ack: {desktop_version}"
        )));
    }

    let instance_id = required_handshake_string(&reply, "instance_id")?;
    Ok(DesktopHandshake {
        desktop_version,
        instance_id,
    })
}

fn required_handshake_string(reply: &Value, field: &str) -> io::Result<String> {
    reply
        .get(field)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| handshake_error(format!("missing {field} in handshake ack")))
}

fn is_plausible_version(version: &str) -> bool {
    version
        .bytes()
        .next()
        .is_some_and(|byte| byte.is_ascii_digit())
        && version
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_'))
}

fn handshake_error(message: String) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

fn is_handshake_error(error: &io::Error) -> bool {
    error.kind() == io::ErrorKind::InvalidData
}

#[cfg(unix)]
fn socket_path() -> std::path::PathBuf {
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

#[cfg(test)]
mod tests {
    use super::parse_desktop_handshake;
    use serde_json::json;
    use std::io::ErrorKind;

    #[test]
    fn accepts_valid_desktop_handshake() {
        let handshake = parse_desktop_handshake(json!({
            "kind": "pong",
            "desktop_version": "0.1.0",
            "instance_id": "2f8fdd65-0698-4383-91d2-8919bc963c0a"
        }))
        .unwrap();

        assert_eq!(handshake.desktop_version, "0.1.0");
        assert_eq!(
            handshake.instance_id,
            "2f8fdd65-0698-4383-91d2-8919bc963c0a"
        );
    }

    #[test]
    fn rejects_old_desktop_without_pong_handshake() {
        let error = parse_desktop_handshake(json!({
            "kind": "error",
            "code": "unknown_message"
        }))
        .unwrap_err();

        assert_eq!(error.kind(), ErrorKind::InvalidData);
    }

    #[test]
    fn rejects_handshake_without_instance_id() {
        let error = parse_desktop_handshake(json!({
            "kind": "pong",
            "desktop_version": "0.1.0"
        }))
        .unwrap_err();

        assert_eq!(error.kind(), ErrorKind::InvalidData);
    }
}
