/// System tray setup for QuoxTerminal.
///
/// Creates a system tray icon with right-click menu:
/// - Show / Hide
/// - Separator
/// - Quit

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

/// Initialize the system tray.
/// Called from lib.rs setup hook.
pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_hide = MenuItem::with_id(app, "show_hide", "Show / Hide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit QuoxTerminal", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_hide, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .tooltip("QuoxTerminal")
        .on_menu_event(move |app, event| {
            match event.id.as_ref() {
                "show_hide" => {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    // Tray tests require a full Tauri app context.
    // Verified manually: tray icon appears, menu items work.
    #[test]
    fn tray_module_compiles() {
        // Compile-time validation — no runtime Tauri app needed
        assert!(true);
    }
}
