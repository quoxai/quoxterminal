/// SSH known hosts management.
/// TODO: Phase 5 full implementation.
///
/// Will support:
/// - Reading and parsing ~/.ssh/known_hosts
/// - Host key verification on connect
/// - Adding new host keys (with user confirmation via frontend)
/// - Removing stale host keys

use std::path::PathBuf;

/// Represents an entry in the known_hosts file.
#[derive(Debug, Clone)]
pub struct KnownHostEntry {
    /// Hostname or IP (may be hashed)
    pub host: String,
    /// Key type (e.g., "ssh-ed25519", "ssh-rsa")
    pub key_type: String,
    /// Base64-encoded public key
    pub key_data: String,
}

/// Result of checking a host key against known_hosts.
#[derive(Debug)]
pub enum HostKeyStatus {
    /// Host key matches known_hosts entry
    Trusted,
    /// Host not found in known_hosts (first connection)
    Unknown,
    /// Host key differs from known_hosts entry (potential MITM)
    Changed,
}

/// Get the path to the known_hosts file.
pub fn known_hosts_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    Ok(home.join(".ssh").join("known_hosts"))
}

/// Check if a host key is trusted (stub).
///
/// TODO: Implement actual known_hosts parsing and verification.
pub fn check_host_key(
    _host: &str,
    _port: u16,
    _key_type: &str,
    _key_data: &[u8],
) -> Result<HostKeyStatus, String> {
    // Stub: always return Unknown until implemented
    Ok(HostKeyStatus::Unknown)
}

/// Add a host key to known_hosts (stub).
///
/// TODO: Implement known_hosts file writing.
pub fn add_host_key(
    _host: &str,
    _port: u16,
    _key_type: &str,
    _key_data: &[u8],
) -> Result<(), String> {
    Err("Known hosts management not yet implemented".to_string())
}

/// Remove a host from known_hosts (stub).
///
/// TODO: Implement known_hosts entry removal.
pub fn remove_host(_host: &str) -> Result<(), String> {
    Err("Known hosts management not yet implemented".to_string())
}
