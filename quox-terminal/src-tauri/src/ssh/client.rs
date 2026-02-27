/// SSH client using the russh crate.
///
/// Supports:
/// - Direct SSH connections to remote hosts
/// - Key-based authentication (Ed25519, RSA, etc.)
/// - Password authentication
/// - Bastion/jump host tunneling via direct-tcpip channels

use async_trait::async_trait;
use russh::client;
use russh_keys::key::PublicKey;
use std::sync::Arc;

use super::known_hosts;

/// Handler for SSH client callbacks.
///
/// Implements the russh client::Handler trait to process server events
/// such as host key verification. Stores target host/port for known_hosts lookup.
pub struct ClientHandler {
    /// Target host for known_hosts lookup.
    host: String,
    /// Target port for known_hosts lookup.
    port: u16,
}

impl ClientHandler {
    pub fn new(host: &str, port: u16) -> Self {
        Self {
            host: host.to_string(),
            port,
        }
    }
}

#[async_trait]
impl client::Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        // Determine key type string
        let key_type = match server_public_key {
            PublicKey::Ed25519(_) => "ssh-ed25519",
            _ => "ssh-rsa",
        };

        // Encode the public key to wire-format bytes for known_hosts comparison.
        let mut key_bytes = Vec::new();
        let type_bytes = key_type.as_bytes();
        key_bytes.extend_from_slice(&(type_bytes.len() as u32).to_be_bytes());
        key_bytes.extend_from_slice(type_bytes);
        match server_public_key {
            PublicKey::Ed25519(key) => {
                let raw = key.as_bytes();
                key_bytes.extend_from_slice(&(raw.len() as u32).to_be_bytes());
                key_bytes.extend_from_slice(raw);
            }
            _ => {
                // For non-Ed25519 key types, accept with TOFU warning
                log::warn!("SSH host key type {} — cannot verify, accepting (TOFU)", key_type);
                return Ok(true);
            }
        }

        match known_hosts::check_host_key(&self.host, self.port, key_type, &key_bytes) {
            Ok(known_hosts::HostKeyStatus::Trusted) => {
                log::info!("SSH host key verified for {}:{}", self.host, self.port);
                Ok(true)
            }
            Ok(known_hosts::HostKeyStatus::Unknown) => {
                log::info!(
                    "SSH host key unknown for {}:{} — accepting and saving (TOFU)",
                    self.host, self.port
                );
                if let Err(e) = known_hosts::add_host_key(&self.host, self.port, key_type, &key_bytes) {
                    log::warn!("Failed to save host key: {}", e);
                }
                Ok(true)
            }
            Ok(known_hosts::HostKeyStatus::Changed) => {
                log::error!(
                    "SSH HOST KEY CHANGED for {}:{}! Possible MITM attack. Connection rejected.",
                    self.host, self.port
                );
                Ok(false)
            }
            Err(e) => {
                log::warn!("Failed to check known_hosts: {} — accepting", e);
                Ok(true)
            }
        }
    }
}

/// SSH client for establishing connections to remote hosts.
///
/// Wraps russh's client module with a convenient API for direct connections,
/// password/key authentication, and bastion host tunneling.
pub struct SshClient {
    config: Arc<client::Config>,
}

impl SshClient {
    /// Create a new SSH client with sensible default configuration.
    pub fn new() -> Self {
        let config = client::Config {
            inactivity_timeout: Some(std::time::Duration::from_secs(30)),
            keepalive_interval: Some(std::time::Duration::from_secs(15)),
            keepalive_max: 3,
            ..Default::default()
        };
        Self {
            config: Arc::new(config),
        }
    }

    /// Connect directly to a remote host with public key authentication.
    ///
    /// Establishes a TCP connection, performs SSH handshake, and authenticates
    /// using the provided key pair.
    pub async fn connect_with_key(
        &self,
        host: &str,
        port: u16,
        user: &str,
        key: &russh_keys::key::KeyPair,
    ) -> Result<client::Handle<ClientHandler>, String> {
        let addr = format!("{}:{}", host, port);
        let handler = ClientHandler::new(host, port);

        let mut handle = client::connect(self.config.clone(), &*addr, handler)
            .await
            .map_err(|e| format!("SSH connection failed: {}", e))?;

        let auth_ok = handle
            .authenticate_publickey(user, Arc::new(key.clone()))
            .await
            .map_err(|e| format!("SSH auth failed: {}", e))?;

        if !auth_ok {
            return Err("SSH public key authentication rejected by server".to_string());
        }

        Ok(handle)
    }

    /// Connect directly to a remote host with password authentication.
    ///
    /// Establishes a TCP connection, performs SSH handshake, and authenticates
    /// using the provided username/password.
    pub async fn connect_with_password(
        &self,
        host: &str,
        port: u16,
        user: &str,
        password: &str,
    ) -> Result<client::Handle<ClientHandler>, String> {
        let addr = format!("{}:{}", host, port);
        let handler = ClientHandler::new(host, port);

        let mut handle = client::connect(self.config.clone(), &*addr, handler)
            .await
            .map_err(|e| format!("SSH connection failed: {}", e))?;

        let auth_ok = handle
            .authenticate_password(user, password)
            .await
            .map_err(|e| format!("SSH auth failed: {}", e))?;

        if !auth_ok {
            return Err("SSH password authentication rejected by server".to_string());
        }

        Ok(handle)
    }

    /// Connect to a target host through a bastion/jump host.
    ///
    /// 1. Connects to the bastion host and authenticates with the bastion key
    /// 2. Opens a direct-tcpip channel through the bastion to the target host
    /// 3. Establishes an SSH session over that tunneled channel to the target
    ///
    /// This is equivalent to `ssh -J bastion target`.
    pub async fn connect_via_bastion(
        &self,
        bastion_host: &str,
        bastion_port: u16,
        bastion_user: &str,
        bastion_key: &russh_keys::key::KeyPair,
        target_host: &str,
        target_port: u16,
        target_user: &str,
        target_key: &russh_keys::key::KeyPair,
    ) -> Result<client::Handle<ClientHandler>, String> {
        // Step 1: Connect to the bastion host
        let bastion_handle = self
            .connect_with_key(bastion_host, bastion_port, bastion_user, bastion_key)
            .await?;

        // Step 2: Open direct-tcpip channel through the bastion to the target
        let channel = bastion_handle
            .channel_open_direct_tcpip(
                target_host,
                target_port as u32,
                bastion_host,
                bastion_port as u32,
            )
            .await
            .map_err(|e| format!("Failed to open tunnel through bastion: {}", e))?;

        // Step 3: Establish SSH session over the tunneled channel
        let handler = ClientHandler::new(target_host, target_port);
        let mut target_handle =
            client::connect_stream(self.config.clone(), channel.into_stream(), handler)
                .await
                .map_err(|e| format!("Failed to establish SSH through tunnel: {}", e))?;

        let auth_ok = target_handle
            .authenticate_publickey(target_user, Arc::new(target_key.clone()))
            .await
            .map_err(|e| format!("Target auth through bastion failed: {}", e))?;

        if !auth_ok {
            return Err(
                "Target host authentication through bastion was rejected".to_string(),
            );
        }

        Ok(target_handle)
    }
}
