/// System tray setup for QuoxTerminal.
///
/// Creates a system tray icon with right-click menu:
/// - New Window
/// - Settings
/// - Separator
/// - Quit
///
/// TODO: Phase 8 full implementation with tauri::tray API.

/// Initialize the system tray (stub).
/// Will be called from lib.rs setup hook.
pub fn setup_tray(_app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // TODO: Implement with tauri::tray::TrayIconBuilder
    // TrayIconBuilder::new()
    //     .icon(app.default_window_icon().unwrap().clone())
    //     .menu(&menu)
    //     .on_menu_event(|app, event| { ... })
    //     .build(app)?;
    Ok(())
}
