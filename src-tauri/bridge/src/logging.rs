use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::PathBuf;

const MAX_LOG_BYTES: u64 = 1024 * 1024;

pub fn info(message: impl AsRef<str>) {
    let _ = append("INFO", message.as_ref());
}

pub fn warn(message: impl AsRef<str>) {
    let _ = append("WARN", message.as_ref());
}

pub fn log_path() -> PathBuf {
    home_dir().join(".snaplex").join("logs").join("bridge.log")
}

fn append(level: &str, message: &str) -> io::Result<()> {
    let path = log_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    rotate_if_needed(&path)?;
    let mut file = OpenOptions::new().create(true).append(true).open(&path)?;
    writeln!(file, "{} [{level}] {message}", timestamp())
}

fn rotate_if_needed(path: &PathBuf) -> io::Result<()> {
    let Ok(metadata) = fs::metadata(path) else {
        return Ok(());
    };
    if metadata.len() < MAX_LOG_BYTES {
        return Ok(());
    }

    let rotated = path.with_extension("log.1");
    match fs::remove_file(&rotated) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(error) => return Err(error),
    }
    fs::rename(path, rotated)
}

fn timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    seconds.to_string()
}

fn home_dir() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(std::env::temp_dir)
}
