/// Global hotkey registration for QuoxTerminal.
///
/// Registers a global keyboard shortcut (default: Ctrl+`) to:
/// - Show/hide the terminal window
/// - Bring it to focus from background
///
/// TODO: Phase 8 full implementation with tauri-plugin-global-shortcut.

use tauri::Manager;

/// Register the global hotkey (stub).
/// Will be called from lib.rs setup hook.
pub fn register_global_hotkey(_app: &tauri::AppHandle) -> Result<(), String> {
    // TODO: Implement with tauri_plugin_global_shortcut
    // GlobalShortcutManager::register("CmdOrCtrl+`", move || {
    //     toggle_window_visibility(app_handle);
    // })
    Ok(())
}

/// Toggle main window visibility.
#[allow(dead_code)]
fn toggle_window_visibility(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
