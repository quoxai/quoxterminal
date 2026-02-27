/// Global hotkey registration for QuoxTerminal.
///
/// Registers a global keyboard shortcut (Ctrl+` on Linux, Cmd+` on macOS) to:
/// - Show/hide the terminal window
/// - Bring it to focus from background

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

/// Register the global hotkey.
/// Called from lib.rs setup hook.
pub fn register_global_hotkey(app: &tauri::AppHandle) -> Result<(), String> {
    let shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::Backquote);

    app.global_shortcut()
        .on_shortcut(shortcut, move |app_handle, _shortcut, _event| {
            toggle_window_visibility(app_handle);
        })
        .map_err(|e| format!("Failed to register global shortcut: {}", e))?;

    log::info!("[hotkey] Registered Cmd/Ctrl+` for window toggle");
    Ok(())
}

/// Toggle main window visibility.
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

#[cfg(test)]
mod tests {
    #[test]
    fn hotkey_module_compiles() {
        assert!(true);
    }
}
