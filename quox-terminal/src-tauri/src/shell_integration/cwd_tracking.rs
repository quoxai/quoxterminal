/// Current working directory tracking for shell integration.
///
/// Tracks the CWD of each terminal session by:
/// 1. Detecting OSC 7 escape sequences (shell reports CWD)
/// 2. Parsing `cd` commands from terminal output (fallback)
///
/// TODO: Phase 8 full implementation.

use std::collections::HashMap;
use std::sync::LazyLock;
use std::sync::Mutex;

static CWD_MAP: LazyLock<Mutex<HashMap<String, String>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

/// Extract CWD from OSC 7 escape sequence.
/// Format: ESC ] 7 ; file://hostname/path ST
pub fn parse_osc7_cwd(data: &str) -> Option<String> {
    // Look for OSC 7 pattern
    let osc7_start = data.find("\x1b]7;")?;
    let after = &data[osc7_start + 4..];

    // Find the terminator (BEL or ST)
    let end = after.find('\x07')
        .or_else(|| after.find("\x1b\\"))?;

    let url = &after[..end];

    // Parse file:// URL
    if let Some(path_start) = url.find("//") {
        let after_slashes = &url[path_start + 2..];
        // Skip hostname
        if let Some(path_pos) = after_slashes.find('/') {
            return Some(after_slashes[path_pos..].to_string());
        }
    }

    None
}

/// Update the tracked CWD for a session.
pub fn update_cwd(session_id: &str, cwd: &str) {
    if let Ok(mut map) = CWD_MAP.lock() {
        map.insert(session_id.to_string(), cwd.to_string());
    }
}

/// Get the tracked CWD for a session.
pub fn get_cwd(session_id: &str) -> Option<String> {
    CWD_MAP.lock().ok()?.get(session_id).cloned()
}

/// Remove CWD tracking for a session.
pub fn remove_session(session_id: &str) {
    if let Ok(mut map) = CWD_MAP.lock() {
        map.remove(session_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_osc7() {
        let data = "\x1b]7;file://hostname/Users/user/projects\x07";
        let result = parse_osc7_cwd(data);
        assert_eq!(result, Some("/Users/user/projects".to_string()));
    }

    #[test]
    fn test_cwd_tracking() {
        update_cwd("test-session", "/home/user");
        assert_eq!(get_cwd("test-session"), Some("/home/user".to_string()));
        remove_session("test-session");
        assert_eq!(get_cwd("test-session"), None);
    }
}
