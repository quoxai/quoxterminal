use std::collections::HashMap;

use crate::ai::client::{self, ChatMessage};
use crate::pty::manager::SessionInfo;
use crate::pty::shell::detect_default_shell;
use crate::settings::fonts::list_monospace_fonts;
use crate::settings::shells::{list_available_shells, ShellInfo};
use crate::ssh::session::{AuthMethod, BastionConfig, SshSession};
use crate::state::AppState;
use tauri::{AppHandle, State};

/// Serializable SSH key info for the frontend.
#[derive(Debug, serde::Serialize)]
pub struct SshKeyInfoJson {
    pub name: String,
    pub path: String,
    pub key_type: Option<String>,
    pub has_public_key: bool,
}

/// Spawn a new PTY session. Returns the session ID.
#[tauri::command]
pub fn pty_spawn(
    shell: Option<String>,
    cwd: Option<String>,
    env: Option<HashMap<String, String>>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let env_vec = env.map(|m| m.into_iter().collect::<Vec<_>>());
    let mut manager = state
        .pty_manager
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    manager.spawn(shell, cwd, env_vec, app_handle)
}

/// Write data to a PTY session's stdin.
#[tauri::command]
pub fn pty_write(session_id: String, data: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut manager = state
        .pty_manager
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    manager.write(&session_id, data.as_bytes())
}

/// Resize a PTY session.
#[tauri::command]
pub fn pty_resize(
    session_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state
        .pty_manager
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    manager.resize(&session_id, cols, rows)
}

/// Kill a PTY session.
#[tauri::command]
pub fn pty_kill(session_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut manager = state
        .pty_manager
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    manager.kill(&session_id)
}

/// List all active PTY sessions.
#[tauri::command]
pub fn pty_list(state: State<'_, AppState>) -> Result<Vec<SessionInfo>, String> {
    let manager = state
        .pty_manager
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.list())
}

/// Check if a PTY session exists.
#[tauri::command]
pub fn pty_session_exists(session_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let manager = state
        .pty_manager
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.session_exists(&session_id))
}

/// Get the detected default shell for this system.
#[tauri::command]
pub fn get_default_shell() -> String {
    detect_default_shell()
}

/// Read the last N characters of terminal output from a session's ring buffer.
#[tauri::command]
pub fn get_terminal_output(
    session_id: String,
    chars: usize,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let manager = state
        .pty_manager
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    manager.read_output(&session_id, chars)
}

/// List available monospace fonts.
#[tauri::command]
pub fn list_fonts() -> Vec<String> {
    list_monospace_fonts()
}

/// List available shell profiles.
#[tauri::command]
pub fn list_shells() -> Vec<ShellInfo> {
    list_available_shells()
}

/// Read a file's contents.
#[tauri::command]
pub fn fs_read_file(path: String) -> Result<String, String> {
    crate::fs::operations::read_file(&path)
}

/// Write content to a file, optionally creating a backup.
#[tauri::command]
pub fn fs_write_file(path: String, content: String, backup: bool) -> Result<(), String> {
    crate::fs::operations::write_file(&path, &content, backup)
}

/// Delete a file, optionally creating a backup.
#[tauri::command]
pub fn fs_delete_file(path: String, backup: bool) -> Result<(), String> {
    crate::fs::operations::delete_file(&path, backup)
}

/// Rename/move a file.
#[tauri::command]
pub fn fs_rename_file(old_path: String, new_path: String) -> Result<(), String> {
    crate::fs::operations::rename_file(&old_path, &new_path)
}

/// Validate a command against the safety denylist.
#[tauri::command]
pub fn validate_command(command: String) -> crate::safety::validator::ValidationResult {
    crate::safety::validator::validate_command(&command)
}

/// Send a chat message to the AI (Anthropic Messages API).
///
/// Reads the API key from the Tauri store file on disk. The frontend provides:
/// - messages: conversation history
/// - model: model identifier
/// - system_prompt: composed system prompt with mode policy + terminal context
#[tauri::command]
pub async fn chat_send(
    messages: Vec<ChatMessage>,
    model: String,
    system_prompt: String,
    app_handle: AppHandle,
) -> Result<String, String> {
    use tauri::Manager;

    // Read API key from the Tauri store file or environment variable.
    // The store file is written by tauri-plugin-store at:
    //   {app_data_dir}/quox-terminal-settings.json
    let api_key = {
        let store_path = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?
            .join("quox-terminal-settings.json");

        if store_path.exists() {
            let content = std::fs::read_to_string(&store_path)
                .map_err(|e| format!("Failed to read store: {}", e))?;
            let parsed: serde_json::Value = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse store: {}", e))?;
            parsed
                .get("anthropic-api-key")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_default()
        } else {
            // Check environment variable as fallback
            std::env::var("ANTHROPIC_API_KEY").unwrap_or_default()
        }
    };

    client::chat_send(messages, &model, &api_key, &system_prompt).await
}

// ── SSH Commands ─────────────────────────────────────────────────────────────

/// Connect to a remote host via SSH. Returns a session ID.
///
/// Supports key-based and password authentication, with optional
/// bastion/jump host tunneling.
#[tauri::command]
pub async fn ssh_connect(
    host: String,
    port: Option<u16>,
    user: String,
    auth_method: String, // "key" or "password"
    key_path: Option<String>,
    key_passphrase: Option<String>,
    password: Option<String>,
    bastion_host: Option<String>,
    bastion_port: Option<u16>,
    bastion_user: Option<String>,
    bastion_key_path: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let port = port.unwrap_or(22);
    let cols = cols.unwrap_or(80);
    let rows = rows.unwrap_or(24);

    let auth = match auth_method.as_str() {
        "key" => {
            let path = key_path.unwrap_or_else(|| {
                dirs::home_dir()
                    .map(|h| h.join(".ssh").join("id_ed25519").to_string_lossy().to_string())
                    .unwrap_or_default()
            });
            AuthMethod::Key {
                path,
                passphrase: key_passphrase,
            }
        }
        "password" => AuthMethod::Password {
            password: password.ok_or("Password is required for password auth")?,
        },
        _ => return Err(format!("Unknown auth method: {}", auth_method)),
    };

    let bastion = if let Some(bhost) = bastion_host {
        Some(BastionConfig {
            host: bhost,
            port: bastion_port.unwrap_or(22),
            user: bastion_user.unwrap_or_else(|| "control".to_string()),
            key_path: bastion_key_path.unwrap_or_else(|| {
                dirs::home_dir()
                    .map(|h| h.join(".ssh").join("id_ed25519").to_string_lossy().to_string())
                    .unwrap_or_default()
            }),
            passphrase: None,
        })
    } else {
        None
    };

    let session = SshSession::connect(
        session_id.clone(),
        &host,
        port,
        &user,
        auth,
        bastion,
        cols,
        rows,
        app_handle,
    )
    .await?;

    // Store in SSH session manager (tokio::sync::Mutex)
    let mut manager = state.ssh_sessions.lock().await;
    manager.insert(session_id.clone(), session);

    log::info!(
        "SSH session connected: {} -> {}@{}:{}",
        session_id,
        user,
        host,
        port
    );
    Ok(session_id)
}

/// Disconnect an SSH session.
#[tauri::command]
pub async fn ssh_disconnect(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut session = {
        let mut manager = state.ssh_sessions.lock().await;
        manager
            .remove(&session_id)
            .ok_or_else(|| format!("SSH session not found: {}", session_id))?
    };
    session.disconnect().await?;
    log::info!("SSH session disconnected: {}", session_id);
    Ok(())
}

/// Write data to an SSH session's remote shell.
#[tauri::command]
pub async fn ssh_write(
    session_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_sessions.lock().await;
    let session = manager
        .get(&session_id)
        .ok_or_else(|| format!("SSH session not found: {}", session_id))?;
    session.write(data.as_bytes()).await
}

/// Resize an SSH session's remote PTY.
#[tauri::command]
pub async fn ssh_resize(
    session_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_sessions.lock().await;
    let session = manager
        .get(&session_id)
        .ok_or_else(|| format!("SSH session not found: {}", session_id))?;
    session.resize(cols, rows).await
}

/// List SSH keys from ~/.ssh/.
#[tauri::command]
pub fn ssh_list_keys() -> Result<Vec<SshKeyInfoJson>, String> {
    use crate::ssh::key_manager;
    let keys = key_manager::list_ssh_keys()?;
    Ok(keys
        .into_iter()
        .map(|k| SshKeyInfoJson {
            name: k.name,
            path: k.path.to_string_lossy().to_string(),
            key_type: k.key_type,
            has_public_key: k.has_public_key,
        })
        .collect())
}

/// Check if an SSH session exists and is tracked by the backend.
#[tauri::command]
pub async fn ssh_session_exists(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let manager = state.ssh_sessions.lock().await;
    Ok(manager.contains_key(&session_id))
}

/// Get terminal output from an SSH session's ring buffer.
#[tauri::command]
pub async fn ssh_get_output(
    session_id: String,
    chars: usize,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let manager = state.ssh_sessions.lock().await;
    let session = manager
        .get(&session_id)
        .ok_or_else(|| format!("SSH session not found: {}", session_id))?;
    Ok(session.read_output(chars))
}
