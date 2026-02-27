use std::sync::Mutex;

use crate::pty::manager::PtyManager;

/// Application state managed by Tauri.
pub struct AppState {
    pub pty_manager: Mutex<PtyManager>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            pty_manager: Mutex::new(PtyManager::new()),
        }
    }
}
