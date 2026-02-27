use serde::Serialize;

/// Severity level for a matched pattern.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum Severity {
    Red,
    Orange,
    Amber,
    Green,
}

/// Action to take when a pattern matches.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum Action {
    Block,
    RequireApproval,
    Warn,
    Allow,
}

/// A single denylist entry.
pub struct DenylistEntry {
    pub pattern: regex::Regex,
    pub severity: Severity,
    pub description: &'static str,
    pub blocked: bool,
    pub requires_auth: bool,
}

/// Build the denylist. Called once and cached.
pub fn build_denylist() -> Vec<DenylistEntry> {
    vec![
        // === CRITICAL - Always blocked (RED) ===
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)rm\s+-rf\s+[/~]").unwrap(),
            severity: Severity::Red,
            description: "Recursive delete from root or home",
            blocked: true,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)rm\s+-rf\s+/\*").unwrap(),
            severity: Severity::Red,
            description: "Delete all files from root",
            blocked: true,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)dd\s+if=.*of=/dev/[sh]d").unwrap(),
            severity: Severity::Red,
            description: "Direct disk write operation",
            blocked: true,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)mkfs\.").unwrap(),
            severity: Severity::Red,
            description: "Filesystem format operation",
            blocked: true,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)>\s*/dev/[sh]d").unwrap(),
            severity: Severity::Red,
            description: "Overwrite disk device",
            blocked: true,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r":\(\)\{.*:\|:.*\}").unwrap(),
            severity: Severity::Red,
            description: "Fork bomb detected",
            blocked: true,
            requires_auth: false,
        },

        // === VM/Container Destruction (RED - requires auth) ===
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)qm\s+destroy\s+\d+").unwrap(),
            severity: Severity::Red,
            description: "VM destruction command",
            blocked: false,
            requires_auth: true,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)pct\s+destroy\s+\d+").unwrap(),
            severity: Severity::Red,
            description: "Container destruction command",
            blocked: false,
            requires_auth: true,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)pvesh\s+delete").unwrap(),
            severity: Severity::Red,
            description: "Proxmox resource deletion via API",
            blocked: false,
            requires_auth: true,
        },

        // === Firewall/Network (RED - requires auth) ===
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)iptables\s+-F").unwrap(),
            severity: Severity::Red,
            description: "Firewall flush - will drop all rules",
            blocked: false,
            requires_auth: true,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)iptables\s+--flush").unwrap(),
            severity: Severity::Red,
            description: "Firewall flush - will drop all rules",
            blocked: false,
            requires_auth: true,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)ufw\s+disable").unwrap(),
            severity: Severity::Red,
            description: "Disable firewall completely",
            blocked: false,
            requires_auth: true,
        },

        // === System Power (ORANGE - requires confirmation) ===
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)shutdown\s").unwrap(),
            severity: Severity::Orange,
            description: "System shutdown command",
            blocked: false,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)\breboot\b").unwrap(),
            severity: Severity::Orange,
            description: "System reboot command",
            blocked: false,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)\bpoweroff\b").unwrap(),
            severity: Severity::Orange,
            description: "System power off command",
            blocked: false,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)init\s+0").unwrap(),
            severity: Severity::Orange,
            description: "System halt via init",
            blocked: false,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)init\s+6").unwrap(),
            severity: Severity::Orange,
            description: "System reboot via init",
            blocked: false,
            requires_auth: false,
        },

        // === Dangerous Permissions (ORANGE) ===
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)chmod\s+-R\s+777").unwrap(),
            severity: Severity::Orange,
            description: "Recursive world-writable permissions",
            blocked: false,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)chown\s+-R\s+.*:").unwrap(),
            severity: Severity::Orange,
            description: "Recursive ownership change",
            blocked: false,
            requires_auth: false,
        },

        // === Service Destruction (AMBER) ===
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)systemctl\s+stop\s+").unwrap(),
            severity: Severity::Amber,
            description: "Service stop command",
            blocked: false,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)systemctl\s+disable\s+").unwrap(),
            severity: Severity::Amber,
            description: "Service disable command",
            blocked: false,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)docker\s+rm\s+-f").unwrap(),
            severity: Severity::Amber,
            description: "Force remove Docker container",
            blocked: false,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)docker\s+stop").unwrap(),
            severity: Severity::Amber,
            description: "Docker container stop",
            blocked: false,
            requires_auth: false,
        },

        // === Package Management (AMBER) ===
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)apt\s+(remove|purge)\s+").unwrap(),
            severity: Severity::Amber,
            description: "Package removal",
            blocked: false,
            requires_auth: false,
        },
        DenylistEntry {
            pattern: regex::Regex::new(r"(?i)yum\s+(remove|erase)\s+").unwrap(),
            severity: Severity::Amber,
            description: "Package removal",
            blocked: false,
            requires_auth: false,
        },
    ]
}
