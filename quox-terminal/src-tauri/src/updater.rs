/// Auto-updater for QuoxTerminal.
///
/// Checks for updates on launch and periodically.
/// Downloads updates in the background and prompts user to install.
///
/// TODO: Phase 8 full implementation with tauri-plugin-updater.

/// Check for updates (stub).
pub async fn check_for_updates() -> Result<Option<UpdateInfo>, String> {
    // TODO: Implement with tauri_plugin_updater
    Ok(None)
}

/// Information about an available update.
#[derive(Debug, Clone, serde::Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub notes: String,
    pub date: String,
}
