use super::denylist::{build_denylist, DenylistEntry, Severity};
use serde::Serialize;
use std::sync::OnceLock;

static DENYLIST: OnceLock<Vec<DenylistEntry>> = OnceLock::new();

fn get_denylist() -> &'static Vec<DenylistEntry> {
    DENYLIST.get_or_init(build_denylist)
}

/// Result of command validation.
#[derive(Debug, Clone, Serialize)]
pub struct ValidationResult {
    pub action: String,     // "BLOCK", "REQUIRE_APPROVAL", "REQUIRE_OVERRIDE", "WARN", "ALLOW"
    pub severity: String,   // "RED", "ORANGE", "AMBER", "GREEN"
    pub description: Option<String>,
    pub pattern: Option<String>,
    pub blocked: bool,
    pub requires_auth: bool,
}

/// Validate a command against the denylist.
pub fn validate_command(command: &str) -> ValidationResult {
    if command.is_empty() {
        return ValidationResult {
            action: "ALLOW".to_string(),
            severity: "GREEN".to_string(),
            description: None,
            pattern: None,
            blocked: false,
            requires_auth: false,
        };
    }

    let denylist = get_denylist();

    for entry in denylist {
        if entry.pattern.is_match(command) {
            let action = if entry.severity == Severity::Red {
                if entry.blocked {
                    "BLOCK"
                } else if entry.requires_auth {
                    "REQUIRE_OVERRIDE"
                } else {
                    "BLOCK"
                }
            } else if entry.severity == Severity::Orange {
                "REQUIRE_APPROVAL"
            } else if entry.severity == Severity::Amber {
                "WARN"
            } else {
                "ALLOW"
            };

            return ValidationResult {
                action: action.to_string(),
                severity: match entry.severity {
                    Severity::Red => "RED",
                    Severity::Orange => "ORANGE",
                    Severity::Amber => "AMBER",
                    Severity::Green => "GREEN",
                }
                .to_string(),
                description: Some(entry.description.to_string()),
                pattern: Some(entry.pattern.to_string()),
                blocked: entry.blocked,
                requires_auth: entry.requires_auth,
            };
        }
    }

    ValidationResult {
        action: "ALLOW".to_string(),
        severity: "GREEN".to_string(),
        description: None,
        pattern: None,
        blocked: false,
        requires_auth: false,
    }
}

/// Validate a multi-line command (checks each line, returns worst result).
pub fn validate_multiline_command(command: &str) -> ValidationResult {
    let severity_order = ["GREEN", "AMBER", "ORANGE", "RED"];
    let mut worst = validate_command("");

    for line in command.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let result = validate_command(line);
        let result_idx = severity_order
            .iter()
            .position(|s| *s == result.severity)
            .unwrap_or(0);
        let worst_idx = severity_order
            .iter()
            .position(|s| *s == worst.severity)
            .unwrap_or(0);
        if result_idx > worst_idx {
            worst = result;
        }
    }

    worst
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_red_block() {
        let r = validate_command("rm -rf /");
        assert_eq!(r.action, "BLOCK");
        assert_eq!(r.severity, "RED");
        assert!(r.blocked);
    }

    #[test]
    fn test_red_block_home() {
        let r = validate_command("rm -rf ~/");
        assert_eq!(r.action, "BLOCK");
        assert_eq!(r.severity, "RED");
    }

    #[test]
    fn test_red_require_override() {
        let r = validate_command("qm destroy 100");
        assert_eq!(r.action, "REQUIRE_OVERRIDE");
        assert_eq!(r.severity, "RED");
        assert!(r.requires_auth);
    }

    #[test]
    fn test_orange_approval() {
        let r = validate_command("reboot");
        assert_eq!(r.action, "REQUIRE_APPROVAL");
        assert_eq!(r.severity, "ORANGE");
    }

    #[test]
    fn test_amber_warn() {
        let r = validate_command("systemctl stop nginx");
        assert_eq!(r.action, "WARN");
        assert_eq!(r.severity, "AMBER");
    }

    #[test]
    fn test_green_allow() {
        let r = validate_command("ls -la");
        assert_eq!(r.action, "ALLOW");
        assert_eq!(r.severity, "GREEN");
    }

    #[test]
    fn test_empty_allow() {
        let r = validate_command("");
        assert_eq!(r.action, "ALLOW");
    }

    #[test]
    fn test_fork_bomb() {
        let r = validate_command(":(){ :|:& };:");
        assert_eq!(r.action, "BLOCK");
        assert_eq!(r.severity, "RED");
    }

    #[test]
    fn test_dd_disk_write() {
        let r = validate_command("dd if=/dev/zero of=/dev/sda");
        assert_eq!(r.action, "BLOCK");
        assert_eq!(r.severity, "RED");
    }

    #[test]
    fn test_docker_stop() {
        let r = validate_command("docker stop mycontainer");
        assert_eq!(r.action, "WARN");
        assert_eq!(r.severity, "AMBER");
    }

    #[test]
    fn test_multiline_worst() {
        let r = validate_multiline_command("ls -la\nrm -rf /\necho hello");
        assert_eq!(r.action, "BLOCK");
        assert_eq!(r.severity, "RED");
    }
}
