use serde::Serialize;
use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::Mutex;

const MAX_ENTRIES: usize = 200;

#[derive(Debug, Clone, Serialize)]
pub struct CaptureLogEntry {
    pub captured_at: String,
    pub capture_type: String,
    pub outcome: String,
    pub image_id: Option<String>,
    pub code: Option<String>,
    pub source_url: Option<String>,
    pub page_url: Option<String>,
    pub duration_ms: u128,
}

#[derive(Default)]
pub struct CaptureLog {
    entries: Mutex<VecDeque<CaptureLogEntry>>,
}

impl CaptureLog {
    pub fn record(&self, entry: CaptureLogEntry) {
        let mut entries = self.entries.lock().unwrap();
        if entries.len() >= MAX_ENTRIES {
            entries.pop_front();
        }
        entries.push_back(entry);
    }

    pub fn recent(&self) -> Vec<CaptureLogEntry> {
        self.entries.lock().unwrap().iter().cloned().collect()
    }
}

pub fn bridge_log_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join(".snaplex")
        .join("logs")
        .join("bridge.log")
}

#[cfg(test)]
mod tests {
    use super::{CaptureLog, CaptureLogEntry};

    #[test]
    fn retains_last_200_entries() {
        let log = CaptureLog::default();
        for index in 0..205 {
            log.record(CaptureLogEntry {
                captured_at: index.to_string(),
                capture_type: "image".to_string(),
                outcome: "saved".to_string(),
                image_id: Some(index.to_string()),
                code: None,
                source_url: None,
                page_url: None,
                duration_ms: 1,
            });
        }

        let entries = log.recent();
        assert_eq!(entries.len(), 200);
        assert_eq!(entries.first().unwrap().captured_at, "5");
        assert_eq!(entries.last().unwrap().captured_at, "204");
    }
}
