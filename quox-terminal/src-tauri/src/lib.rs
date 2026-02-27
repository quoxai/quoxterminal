mod commands;
mod pty;
mod settings;
mod state;

// Phase 5: SSH + Collector Integration (stubs)
mod ssh;
mod collector;

// Phase 4: AI Chat Integration
mod ai;

// Phase 6: Native file operations
mod fs;

// Phase 8: Desktop-Native Features (stubs)
mod tray;
mod hotkey;
mod updater;
mod shell_integration;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::pty_spawn,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_kill,
            commands::pty_list,
            commands::pty_session_exists,
            commands::get_default_shell,
            commands::get_terminal_output,
            commands::list_fonts,
            commands::list_shells,
            commands::fs_read_file,
            commands::fs_write_file,
            commands::fs_delete_file,
            commands::fs_rename_file,
            commands::chat_send,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
