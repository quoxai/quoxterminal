use std::collections::HashMap;
use std::sync::Mutex;

use crate::collector::ws_client::CollectorWsClient;
use crate::pty::manager::PtyManager;
use crate::ssh::session::SshSession;

/// Application state managed by Tauri.
///
/// Contains the local PTY session manager, SSH session store, and
/// the collector WebSocket client.
/// PTY manager uses std::sync::Mutex (synchronous operations).
/// SSH sessions and collector client use tokio::sync::Mutex
/// (async operations need Send guards).
pub struct AppState {
    /// Manager for local PTY sessions.
    pub pty_manager: Mutex<PtyManager>,
    /// Active SSH sessions, keyed by session ID (UUID v4).
    /// Uses tokio::sync::Mutex because SSH operations are async and
    /// MutexGuard must be Send to hold across .await points.
    pub ssh_sessions: tokio::sync::Mutex<HashMap<String, SshSession>>,
    /// Collector WebSocket client for real-time communication.
    pub collector_client: tokio::sync::Mutex<Option<CollectorWsClient>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            pty_manager: Mutex::new(PtyManager::new()),
            ssh_sessions: tokio::sync::Mutex::new(HashMap::new()),
            collector_client: tokio::sync::Mutex::new(None),
        }
    }
}
