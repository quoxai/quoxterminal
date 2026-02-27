/// SSH key manager.
/// TODO: Phase 5 full implementation.
///
/// Will support:
/// - Listing SSH keys from ~/.ssh/
/// - Key generation (RSA, Ed25519)
/// - Key passphrase handling
/// - SSH agent integration

use std::path::PathBuf;

/// Represents an SSH key found on disk.
#[derive(Debug, Clone)]
pub struct SshKeyInfo {
    /// Name of the key file (e.g., "id_ed25519")
    pub name: String,
    /// Full path to the private key
    pub path: PathBuf,
    /// Key type if determinable (e.g., "ed25519", "rsa")
    pub key_type: Option<String>,
    /// Whether a corresponding .pub file exists
    pub has_public_key: bool,
}

/// List SSH keys found in ~/.ssh/ directory.
///
/// Scans the user's SSH directory for private key files,
/// filtering out known non-key files (config, known_hosts, etc.).
pub fn list_ssh_keys() -> Result<Vec<SshKeyInfo>, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
    let ssh_dir = home.join(".ssh");

    if !ssh_dir.exists() {
        return Ok(Vec::new());
    }

    let mut keys = Vec::new();

    let entries = std::fs::read_dir(&ssh_dir)
        .map_err(|e| format!("Failed to read ~/.ssh: {}", e))?;

    // Files to skip (not key files)
    let skip_files = [
        "config",
        "known_hosts",
        "known_hosts.old",
        "authorized_keys",
        "environment",
    ];

    for entry in entries.flatten() {
        let path = entry.path();

        // Skip directories
        if path.is_dir() {
            continue;
        }

        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };

        // Skip .pub files (we track them via has_public_key)
        if file_name.ends_with(".pub") {
            continue;
        }

        // Skip known non-key files
        if skip_files.contains(&file_name.as_str()) {
            continue;
        }

        // Determine key type from filename
        let key_type = if file_name.contains("ed25519") {
            Some("ed25519".to_string())
        } else if file_name.contains("ecdsa") {
            Some("ecdsa".to_string())
        } else if file_name.contains("rsa") || file_name == "id_rsa" {
            Some("rsa".to_string())
        } else if file_name.contains("dsa") {
            Some("dsa".to_string())
        } else if file_name.starts_with("id_") {
            Some("unknown".to_string())
        } else {
            // Not a recognized key file pattern
            None
        };

        // Only include files that look like keys
        if key_type.is_none() && !file_name.starts_with("id_") {
            continue;
        }

        let pub_path = ssh_dir.join(format!("{}.pub", file_name));

        keys.push(SshKeyInfo {
            name: file_name,
            path: path.clone(),
            key_type,
            has_public_key: pub_path.exists(),
        });
    }

    Ok(keys)
}

/// Generate a new SSH key pair (stub).
///
/// TODO: Implement key generation using russh-keys or ssh-key crate.
pub fn generate_key(
    _key_type: &str,
    _comment: &str,
    _passphrase: Option<&str>,
) -> Result<PathBuf, String> {
    Err("SSH key generation not yet implemented".to_string())
}
