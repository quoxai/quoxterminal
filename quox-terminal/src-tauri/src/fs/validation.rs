//! Path validation for QuoxTerminal file operations.
//!
//! Classifies file paths into severity levels:
//! - **Green**: safe paths (user home, tmp, etc.)
//! - **Amber**: sensitive paths (/etc, /opt, /var)
//! - **Red**: dangerous system paths (/dev, /proc, /sys, /boot)
//! - **Blocked**: paths with traversal attacks or null bytes

use serde::{Deserialize, Serialize};

/// Severity classification for a file path.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PathSeverity {
    Green,
    Amber,
    Red,
    Blocked,
}

/// Validate a file path and return its severity classification.
///
/// # Blocked
/// - Empty paths
/// - Non-absolute paths (not starting with `/`)
/// - Paths containing `..` (directory traversal)
/// - Paths containing null bytes
///
/// # Red (dangerous system paths)
/// - `/dev/`, `/proc/`, `/sys/`, `/boot/`
///
/// # Amber (sensitive paths)
/// - `/etc/`, `/opt/`, `/var/`
///
/// # Green
/// - Everything else
pub fn validate_path(path: &str) -> PathSeverity {
    // Empty or non-absolute
    if path.is_empty() || !path.starts_with('/') {
        return PathSeverity::Blocked;
    }

    // Null bytes
    if path.contains('\0') {
        return PathSeverity::Blocked;
    }

    // Directory traversal
    if path.contains("..") {
        return PathSeverity::Blocked;
    }

    // Red: dangerous system paths
    let red_prefixes = ["/dev/", "/proc/", "/sys/", "/boot/"];
    for prefix in &red_prefixes {
        if path.starts_with(prefix) || path == &prefix[..prefix.len() - 1] {
            return PathSeverity::Red;
        }
    }

    // Amber: sensitive paths
    let amber_prefixes = ["/etc/", "/opt/", "/var/"];
    for prefix in &amber_prefixes {
        if path.starts_with(prefix) || path == &prefix[..prefix.len() - 1] {
            return PathSeverity::Amber;
        }
    }

    PathSeverity::Green
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_blocked_paths() {
        assert_eq!(validate_path(""), PathSeverity::Blocked);
        assert_eq!(validate_path("relative/path"), PathSeverity::Blocked);
        assert_eq!(validate_path("/tmp/../etc/passwd"), PathSeverity::Blocked);
        assert_eq!(validate_path("/tmp/\0evil"), PathSeverity::Blocked);
    }

    #[test]
    fn test_red_paths() {
        assert_eq!(validate_path("/dev/sda"), PathSeverity::Red);
        assert_eq!(validate_path("/proc/1/status"), PathSeverity::Red);
        assert_eq!(validate_path("/sys/class/net"), PathSeverity::Red);
        assert_eq!(validate_path("/boot/vmlinuz"), PathSeverity::Red);
    }

    #[test]
    fn test_amber_paths() {
        assert_eq!(validate_path("/etc/nginx/nginx.conf"), PathSeverity::Amber);
        assert_eq!(validate_path("/opt/app/config"), PathSeverity::Amber);
        assert_eq!(validate_path("/var/log/syslog"), PathSeverity::Amber);
    }

    #[test]
    fn test_green_paths() {
        assert_eq!(validate_path("/home/user/code/main.rs"), PathSeverity::Green);
        assert_eq!(validate_path("/tmp/test.txt"), PathSeverity::Green);
        assert_eq!(validate_path("/Users/adam/project/index.ts"), PathSeverity::Green);
    }
}
