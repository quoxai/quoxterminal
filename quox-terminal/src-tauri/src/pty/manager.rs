use std::collections::HashMap;

use super::session::PtySession;
use super::shell::detect_default_shell;
use serde::Serialize;
use tauri::AppHandle;

/// Serializable session info for the frontend.
#[derive(Debug, Serialize, Clone)]
pub struct SessionInfo {
    pub id: String,
    pub shell: String,
    pub cwd: String,
    pub pid: u32,
    pub created_at: u64,
}

/// Manages all active PTY sessions.
pub struct PtyManager {
    sessions: HashMap<String, PtySession>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    /// Spawn a new PTY session.
    pub fn spawn(
        &mut self,
        shell: Option<String>,
        cwd: Option<String>,
        env: Option<Vec<(String, String)>>,
        args: Option<Vec<String>>,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let shell = shell.unwrap_or_else(|| detect_default_shell());
        let cwd = cwd.unwrap_or_else(|| {
            dirs::home_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| "/".to_string())
        });

        let session = PtySession::spawn(id.clone(), &shell, &cwd, env, args, app_handle)?;
        self.sessions.insert(id.clone(), session);
        log::info!("PTY session spawned: {}", id);
        Ok(id)
    }

    /// Write to a session's PTY.
    pub fn write(&mut self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;
        session.write(data)
    }

    /// Resize a session's PTY.
    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;
        session.resize(cols, rows)
    }

    /// Kill a session and remove it.
    pub fn kill(&mut self, session_id: &str) -> Result<(), String> {
        log::info!("PTY session killed: {}", session_id);
        self.sessions
            .remove(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;
        // Drop cleans up the PTY
        Ok(())
    }

    /// List all active sessions.
    pub fn list(&self) -> Vec<SessionInfo> {
        self.sessions
            .values()
            .map(|s| SessionInfo {
                id: s.id.clone(),
                shell: s.shell.clone(),
                cwd: s.cwd.clone(),
                pid: s.pid,
                created_at: s.created_at,
            })
            .collect()
    }

    /// Read output from a session's ring buffer.
    pub fn read_output(&self, session_id: &str, chars: usize) -> Result<String, String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?;
        Ok(session.read_output(chars))
    }

    /// Check if a session exists and is still alive.
    pub fn session_exists(&self, session_id: &str) -> bool {
        self.sessions.contains_key(session_id)
    }
}

impl Drop for PtyManager {
    fn drop(&mut self) {
        // Kill all sessions on shutdown
        let ids: Vec<String> = self.sessions.keys().cloned().collect();
        for id in ids {
            let _ = self.kill(&id);
        }
    }
}
