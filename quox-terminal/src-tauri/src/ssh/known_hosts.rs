/// SSH known hosts management.
///
/// Supports:
/// - Reading and parsing ~/.ssh/known_hosts
/// - Host key verification on connect
/// - Adding new host keys
/// - Removing stale host keys
///
/// Uses the standard OpenSSH known_hosts file format.

use base64::Engine;
use std::io::{BufRead, Write};
use std::path::PathBuf;

/// Represents an entry in the known_hosts file.
#[derive(Debug, Clone)]
pub struct KnownHostEntry {
    /// Hostname or IP (may include port in [host]:port format).
    pub host: String,
    /// Key type (e.g., "ssh-ed25519", "ssh-rsa").
    pub key_type: String,
    /// Base64-encoded public key.
    pub key_data: String,
}

/// Result of checking a host key against known_hosts.
#[derive(Debug)]
pub enum HostKeyStatus {
    /// Host key matches a known_hosts entry.
    Trusted,
    /// Host not found in known_hosts (first connection).
    Unknown,
    /// Host key differs from known_hosts entry (potential MITM attack).
    Changed,
}

/// Get the path to the known_hosts file.
pub fn known_hosts_path() -> Result<PathBuf, String> {
    let home =
        dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    Ok(home.join(".ssh").join("known_hosts"))
}

/// Check if a host key is trusted by reading ~/.ssh/known_hosts.
///
/// The host pattern in known_hosts uses "host" for port 22,
/// or "[host]:port" for non-standard ports.
pub fn check_host_key(
    host: &str,
    port: u16,
    key_type: &str,
    key_data: &[u8],
) -> Result<HostKeyStatus, String> {
    let path = known_hosts_path()?;
    if !path.exists() {
        return Ok(HostKeyStatus::Unknown);
    }

    let file = std::fs::File::open(&path)
        .map_err(|e| format!("Failed to read known_hosts: {}", e))?;
    let reader = std::io::BufReader::new(file);

    // Build the host pattern that matches OpenSSH conventions
    let host_pattern = if port == 22 {
        host.to_string()
    } else {
        format!("[{}]:{}", host, port)
    };

    let key_b64 = base64::engine::general_purpose::STANDARD.encode(key_data);

    for line in reader.lines().flatten() {
        let line = line.trim().to_string();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let parts: Vec<&str> = line.splitn(3, ' ').collect();
        if parts.len() < 3 {
            continue;
        }

        let hosts_field = parts[0];
        let entry_key_type = parts[1];
        let entry_key_data = parts[2].split_whitespace().next().unwrap_or("");

        // Check if any host in this entry (comma-separated) matches our target
        let host_matches = hosts_field
            .split(',')
            .any(|h| h.trim() == host_pattern);

        if host_matches {
            if entry_key_type == key_type && entry_key_data == key_b64 {
                return Ok(HostKeyStatus::Trusted);
            } else {
                // Same host but different key — possible MITM
                return Ok(HostKeyStatus::Changed);
            }
        }
    }

    Ok(HostKeyStatus::Unknown)
}

/// Add a host key to ~/.ssh/known_hosts.
///
/// Appends a new entry in OpenSSH format. Creates the file and
/// parent directory if they don't exist.
pub fn add_host_key(
    host: &str,
    port: u16,
    key_type: &str,
    key_data: &[u8],
) -> Result<(), String> {
    let path = known_hosts_path()?;

    // Ensure ~/.ssh directory exists with proper permissions
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create ~/.ssh: {}", e))?;
    }

    let host_pattern = if port == 22 {
        host.to_string()
    } else {
        format!("[{}]:{}", host, port)
    };

    let key_b64 = base64::engine::general_purpose::STANDARD.encode(key_data);
    let entry = format!("{} {} {}\n", host_pattern, key_type, key_b64);

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open known_hosts for writing: {}", e))?;

    file.write_all(entry.as_bytes())
        .map_err(|e| format!("Failed to write to known_hosts: {}", e))
}

/// Remove all entries for a host from ~/.ssh/known_hosts.
///
/// Removes entries matching the hostname regardless of port or key type.
/// This handles both "hostname" and "[hostname]:port" patterns.
pub fn remove_host(host: &str) -> Result<(), String> {
    let path = known_hosts_path()?;
    if !path.exists() {
        return Ok(());
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read known_hosts: {}", e))?;

    let filtered: Vec<&str> = content
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                // Preserve comments and blank lines
                return true;
            }
            // Check if any host in the hosts field matches the target
            let hosts_field = trimmed.split_whitespace().next().unwrap_or("");
            !hosts_field.split(',').any(|h| {
                let h = h.trim();
                h == host
                    || h.starts_with(&format!("[{}]:", host))
                    || h == &format!("[{}]", host)
            })
        })
        .collect();

    std::fs::write(&path, filtered.join("\n") + "\n")
        .map_err(|e| format!("Failed to write known_hosts: {}", e))
}
