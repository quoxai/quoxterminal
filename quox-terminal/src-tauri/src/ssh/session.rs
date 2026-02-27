/// SSH session management with PTY support.
///
/// Provides interactive shell sessions over SSH with:
/// - PTY allocation for remote terminals (xterm-256color)
/// - Streaming output to frontend via Tauri events
/// - Output ring buffer for AI context building
/// - Clean disconnect handling
/// - Bastion/jump host tunneling

use std::sync::{Arc, Mutex};

use russh::*;
use russh::client::Handle;
use tauri::{AppHandle, Emitter};

use crate::pty::session::OutputRingBuffer;
use super::client::ClientHandler;

/// Commands forwarded to the reader task (which owns the Channel).
enum ReaderCommand {
    Resize { cols: u32, rows: u32 },
}

/// Authentication method for SSH connections.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum AuthMethod {
    /// Authenticate using an SSH key pair, with an optional passphrase.
    Key {
        path: String,
        passphrase: Option<String>,
    },
    /// Authenticate using a password.
    Password {
        password: String,
    },
}

/// Bastion/jump host configuration for tunneled connections.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BastionConfig {
    /// Bastion hostname or IP address.
    pub host: String,
    /// Bastion SSH port.
    pub port: u16,
    /// Username on the bastion host.
    pub user: String,
    /// Path to the private key for bastion authentication.
    pub key_path: String,
    /// Optional passphrase for the bastion key.
    pub passphrase: Option<String>,
}

/// Represents an active SSH session with a remote PTY.
///
/// The session owns the SSH connection handle and runs a background task
/// that reads output and emits it to the Tauri frontend via events.
/// The Channel is owned by the reader task for receiving output.
/// Write operations go through the Handle (which has `data()` method).
pub struct SshSession {
    /// Unique session identifier (UUID v4).
    pub id: String,
    /// Remote host address.
    pub host: String,
    /// Remote SSH port.
    pub port: u16,
    /// Username on the remote host.
    pub username: String,
    /// Session type indicator: "ssh" or "ssh-bastion".
    pub session_type: String,
    /// Unix timestamp when the session was created.
    pub created_at: u64,
    /// Ring buffer capturing recent terminal output for AI context.
    pub output_buffer: Arc<Mutex<OutputRingBuffer>>,
    /// SSH connection handle for sending data and disconnect.
    handle: Option<Handle<ClientHandler>>,
    /// Channel ID for addressing the session's PTY channel.
    channel_id: Option<ChannelId>,
    /// Sender for forwarding commands (resize) to the reader task.
    command_tx: Option<tokio::sync::mpsc::UnboundedSender<ReaderCommand>>,
    /// Background task reading output from the remote shell.
    _reader_task: Option<tokio::task::JoinHandle<()>>,
}

impl SshSession {
    /// Create, connect, and start a new SSH session with a remote PTY.
    ///
    /// This performs the full connection flow:
    /// 1. Authenticate (directly or via bastion)
    /// 2. Open a session channel
    /// 3. Request a PTY with the specified dimensions
    /// 4. Start a shell
    /// 5. Launch a reader task that streams output to the frontend
    pub async fn connect(
        id: String,
        host: &str,
        port: u16,
        username: &str,
        auth: AuthMethod,
        bastion: Option<BastionConfig>,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<Self, String> {
        let client = super::client::SshClient::new();

        // Establish the SSH connection (direct or via bastion)
        let handle = if let Some(bastion_cfg) = &bastion {
            let bastion_key = super::key_manager::load_private_key(
                std::path::Path::new(&bastion_cfg.key_path),
                bastion_cfg.passphrase.as_deref(),
            )
            .await?;

            let target_key = match &auth {
                AuthMethod::Key { path, passphrase } => {
                    super::key_manager::load_private_key(
                        std::path::Path::new(path),
                        passphrase.as_deref(),
                    )
                    .await?
                }
                AuthMethod::Password { .. } => {
                    return Err(
                        "Password authentication is not supported through a bastion host"
                            .to_string(),
                    );
                }
            };

            client
                .connect_via_bastion(
                    &bastion_cfg.host,
                    bastion_cfg.port,
                    &bastion_cfg.user,
                    &bastion_key,
                    host,
                    port,
                    username,
                    &target_key,
                )
                .await?
        } else {
            match &auth {
                AuthMethod::Key { path, passphrase } => {
                    let key = super::key_manager::load_private_key(
                        std::path::Path::new(path),
                        passphrase.as_deref(),
                    )
                    .await?;
                    client.connect_with_key(host, port, username, &key).await?
                }
                AuthMethod::Password { password } => {
                    client
                        .connect_with_password(host, port, username, password)
                        .await?
                }
            }
        };

        // Open a session channel
        let mut channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open SSH session channel: {}", e))?;

        // Request a PTY on the remote host
        channel
            .request_pty(
                false,
                "xterm-256color",
                cols as u32,
                rows as u32,
                0,
                0,
                &[],
            )
            .await
            .map_err(|e| format!("Failed to request remote PTY: {}", e))?;

        // Start an interactive shell
        channel
            .request_shell(false)
            .await
            .map_err(|e| format!("Failed to start remote shell: {}", e))?;

        let channel_id = channel.id();

        // Create output ring buffer (1MB, same as local PTY sessions)
        let output_buffer = Arc::new(Mutex::new(OutputRingBuffer::new(1024 * 1024)));
        let buffer_clone = Arc::clone(&output_buffer);

        // Create mpsc channel for forwarding commands (resize) to the reader task.
        let (cmd_tx, mut cmd_rx) = tokio::sync::mpsc::unbounded_channel::<ReaderCommand>();

        // Spawn a reader task to stream output to the frontend.
        // The Channel is moved into this task — it owns the receiving side.
        // Write operations go through Handle::data() which doesn't need Channel.
        // Resize commands arrive via cmd_rx from SshSession::resize().
        let session_id = id.clone();
        let app = app_handle.clone();
        let reader_task = tokio::spawn(async move {
            loop {
                tokio::select! {
                    msg = channel.wait() => {
                        match msg {
                            Some(ChannelMsg::Data { data }) => {
                                let bytes = data.as_ref();
                                if let Ok(mut rb) = buffer_clone.lock() {
                                    rb.write(bytes);
                                }
                                let text = String::from_utf8_lossy(bytes).to_string();
                                let event_name = format!("pty-output-{}", session_id);
                                let _ = app.emit(&event_name, serde_json::json!({ "data": text }));
                            }
                            Some(ChannelMsg::ExtendedData { data, ext }) => {
                                if ext == 1 {
                                    let bytes = data.as_ref();
                                    if let Ok(mut rb) = buffer_clone.lock() {
                                        rb.write(bytes);
                                    }
                                    let text = String::from_utf8_lossy(bytes).to_string();
                                    let event_name = format!("pty-output-{}", session_id);
                                    let _ = app.emit(&event_name, serde_json::json!({ "data": text }));
                                }
                            }
                            Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                                let event_name = format!("pty-exit-{}", session_id);
                                let _ = app.emit(&event_name, serde_json::json!({ "code": 0 }));
                                break;
                            }
                            _ => {}
                        }
                    }
                    cmd = cmd_rx.recv() => {
                        match cmd {
                            Some(ReaderCommand::Resize { cols, rows }) => {
                                if let Err(e) = channel.window_change(cols, rows, 0, 0).await {
                                    log::warn!("SSH window_change failed: {:?}", e);
                                }
                            }
                            None => break, // SshSession dropped the sender
                        }
                    }
                }
            }
        });

        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let session_type = if bastion.is_some() {
            "ssh-bastion"
        } else {
            "ssh"
        }
        .to_string();

        Ok(Self {
            id,
            host: host.to_string(),
            port,
            username: username.to_string(),
            session_type,
            created_at,
            output_buffer,
            handle: Some(handle),
            channel_id: Some(channel_id),
            command_tx: Some(cmd_tx),
            _reader_task: Some(reader_task),
        })
    }

    /// Write data to the remote shell's stdin via Handle::data().
    pub async fn write(&self, data: &[u8]) -> Result<(), String> {
        match (&self.handle, &self.channel_id) {
            (Some(handle), Some(channel_id)) => {
                handle
                    .data(*channel_id, CryptoVec::from_slice(data))
                    .await
                    .map_err(|e| format!("SSH write failed: {:?}", e))
            }
            _ => Err("SSH session is not connected".to_string()),
        }
    }

    /// Resize the remote PTY.
    ///
    /// Sends a resize command to the reader task via mpsc channel.
    /// The reader task owns the Channel and calls window_change().
    pub async fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        if let Some(tx) = &self.command_tx {
            tx.send(ReaderCommand::Resize {
                cols: cols as u32,
                rows: rows as u32,
            })
            .map_err(|e| format!("Failed to send resize command: {}", e))
        } else {
            Err("SSH session is not connected".to_string())
        }
    }

    /// Read the last N characters from the output ring buffer.
    ///
    /// Used by the AI context builder to get recent terminal output.
    pub fn read_output(&self, chars: usize) -> String {
        if let Ok(rb) = self.output_buffer.lock() {
            rb.read_last(chars)
        } else {
            String::new()
        }
    }

    /// Disconnect the SSH session gracefully.
    pub async fn disconnect(&mut self) -> Result<(), String> {
        self.command_tx = None; // Signal reader task to stop
        if let Some(handle) = self.handle.take() {
            let _ = handle
                .disconnect(Disconnect::ByApplication, "User disconnected", "en")
                .await;
        }
        self.channel_id = None;
        Ok(())
    }
}
