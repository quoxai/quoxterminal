//! Claude project detection.
//!
//! Scans a directory for CLAUDE.md, .claude/ directory, and related config
//! to determine if the cwd is a Claude Code project.

use serde::Serialize;
use std::path::Path;

/// Information about a detected Claude project.
#[derive(Debug, Clone, Serialize)]
pub struct ClaudeProjectInfo {
    /// Whether a CLAUDE.md file exists in the directory.
    pub has_claude_md: bool,
    /// Whether a .claude/ directory exists.
    pub has_claude_dir: bool,
    /// Whether .claude/settings.json exists.
    pub has_settings: bool,
    /// The path to CLAUDE.md if it exists.
    pub claude_md_path: Option<String>,
    /// Whether this is detected as a Claude project (any of the above).
    pub is_claude_project: bool,
}

/// Detect whether a directory is a Claude Code project.
pub fn detect_claude_project(cwd: &str) -> ClaudeProjectInfo {
    let base = Path::new(cwd);

    let claude_md = base.join("CLAUDE.md");
    let has_claude_md = claude_md.exists();

    let claude_dir = base.join(".claude");
    let has_claude_dir = claude_dir.is_dir();

    let settings = claude_dir.join("settings.json");
    let has_settings = settings.exists();

    let is_claude_project = has_claude_md || has_claude_dir;

    ClaudeProjectInfo {
        has_claude_md,
        has_claude_dir,
        has_settings,
        claude_md_path: if has_claude_md {
            Some(claude_md.to_string_lossy().to_string())
        } else {
            None
        },
        is_claude_project,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_detect_empty_dir() {
        let dir = std::env::temp_dir().join("claude_detect_test_empty");
        let _ = fs::create_dir_all(&dir);
        let info = detect_claude_project(dir.to_str().unwrap());
        assert!(!info.is_claude_project);
        assert!(!info.has_claude_md);
        assert!(!info.has_claude_dir);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_detect_with_claude_md() {
        let dir = std::env::temp_dir().join("claude_detect_test_md");
        let _ = fs::create_dir_all(&dir);
        fs::write(dir.join("CLAUDE.md"), "# Project").unwrap();

        let info = detect_claude_project(dir.to_str().unwrap());
        assert!(info.is_claude_project);
        assert!(info.has_claude_md);
        assert!(info.claude_md_path.is_some());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_detect_with_claude_dir() {
        let dir = std::env::temp_dir().join("claude_detect_test_dir");
        let _ = fs::create_dir_all(dir.join(".claude"));

        let info = detect_claude_project(dir.to_str().unwrap());
        assert!(info.is_claude_project);
        assert!(info.has_claude_dir);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_detect_with_settings() {
        let dir = std::env::temp_dir().join("claude_detect_test_settings");
        let _ = fs::create_dir_all(dir.join(".claude"));
        fs::write(dir.join(".claude/settings.json"), "{}").unwrap();

        let info = detect_claude_project(dir.to_str().unwrap());
        assert!(info.has_settings);

        let _ = fs::remove_dir_all(&dir);
    }
}
