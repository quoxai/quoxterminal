/// Auto-updater for QuoxTerminal.
///
/// Checks GitHub releases for new versions on launch.
/// Emits a frontend event when an update is available so the UI
/// can show a notification banner.

use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

/// Information about an available update.
#[derive(Debug, Clone, serde::Serialize)]
pub struct UpdateInfo {
    pub version: String,
    pub body: String,
    pub date: String,
}

/// Check for updates in the background.
/// Called from lib.rs setup hook after app is ready.
pub fn check_for_updates(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        match do_check(&app).await {
            Ok(Some(info)) => {
                log::info!("[updater] Update available: v{}", info.version);
                let _ = app.emit("update-available", info);
            }
            Ok(None) => {
                log::debug!("[updater] Already up to date");
            }
            Err(e) => {
                log::warn!("[updater] Check failed: {}", e);
            }
        }
    });
}

async fn do_check(app: &tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    let updater = app
        .updater()
        .map_err(|e| format!("Updater not configured: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Update check failed: {}", e))?;

    match update {
        Some(u) => Ok(Some(UpdateInfo {
            version: u.version.clone(),
            body: u.body.clone().unwrap_or_default(),
            date: u.date.map(|d| d.to_string()).unwrap_or_default(),
        })),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_info_serializes() {
        let info = UpdateInfo {
            version: "0.2.0".to_string(),
            body: "Bug fixes".to_string(),
            date: "2026-02-27".to_string(),
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("0.2.0"));
        assert!(json.contains("Bug fixes"));
    }
}
