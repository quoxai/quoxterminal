mod commands;
mod pty;
mod settings;
mod state;

// Phase 5: SSH + Collector Integration (stubs)
mod ssh;
mod collector;

// Phase 4: AI Chat Integration
mod ai;

// Phase 3: Command Safety System
mod safety;

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
            commands::validate_command,
            commands::chat_send,
            // SSH commands
            commands::ssh_connect,
            commands::ssh_disconnect,
            commands::ssh_write,
            commands::ssh_resize,
            commands::ssh_list_keys,
            commands::ssh_session_exists,
            commands::ssh_get_output,
            // Bastion / Fleet API proxy commands
            commands::bastion_list_hosts,
            commands::bastion_fleet_summary,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
