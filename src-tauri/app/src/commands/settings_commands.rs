use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub struct SettingsState {
    current_locale: Mutex<String>,
}

impl Default for SettingsState {
    fn default() -> Self {
        Self {
            current_locale: Mutex::new(default_locale()),
        }
    }
}

#[tauri::command]
pub fn get_current_locale(state: State<SettingsState>) -> String {
    state.current_locale.lock().unwrap().clone()
}

#[tauri::command]
pub fn set_current_locale(state: State<SettingsState>, locale: String) {
    *state.current_locale.lock().unwrap() = normalize_locale(&locale);
}

pub fn current_locale(app: &AppHandle) -> String {
    app.state::<SettingsState>()
        .current_locale
        .lock()
        .unwrap()
        .clone()
}

fn default_locale() -> String {
    std::env::var("LC_ALL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| std::env::var("LC_MESSAGES").ok())
        .filter(|value| !value.trim().is_empty())
        .or_else(|| std::env::var("LANG").ok())
        .map(|value| normalize_locale(&value))
        .unwrap_or_else(|| "en".to_string())
}

fn normalize_locale(locale: &str) -> String {
    let value = locale.trim().to_lowercase();
    if value.is_empty() {
        return "en".to_string();
    }

    if value.starts_with("zh") || value.contains("chinese") || value.contains("中文") {
        "zh".to_string()
    } else if value.starts_with("ja") || value.contains("japanese") {
        "ja".to_string()
    } else if value.starts_with("es") || value.contains("spanish") {
        "es".to_string()
    } else if value.starts_with("fr") || value.contains("french") {
        "fr".to_string()
    } else if value.starts_with("de") || value.contains("german") {
        "de".to_string()
    } else if value.starts_with("ko") || value.contains("korean") {
        "ko".to_string()
    } else {
        "en".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_locale;

    #[test]
    fn normalizes_desktop_language_names() {
        assert_eq!(normalize_locale("Chinese"), "zh");
        assert_eq!(normalize_locale("Chinese (中文)"), "zh");
        assert_eq!(normalize_locale("Japanese"), "ja");
        assert_eq!(normalize_locale("English"), "en");
    }

    #[test]
    fn normalizes_os_locale_values() {
        assert_eq!(normalize_locale("zh_CN.UTF-8"), "zh");
        assert_eq!(normalize_locale("en_US.UTF-8"), "en");
        assert_eq!(normalize_locale("fr-FR"), "fr");
    }
}
