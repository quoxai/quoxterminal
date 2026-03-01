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

// Desktop-Native Features
mod tray;
mod hotkey;
mod updater;
mod shell_integration;

// Memory bridge — local-only entity/session/error storage
mod memory;

// Claude Mode — structured Claude CLI integration
mod claude;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::new())
        .setup(|app| {
            // System tray
            if let Err(e) = tray::setup_tray(app) {
                log::warn!("[tray] Setup failed: {}", e);
            }

            // Global hotkey (Cmd/Ctrl+`)
            if let Err(e) = hotkey::register_global_hotkey(app.handle()) {
                log::warn!("[hotkey] Registration failed: {}", e);
            }

            // Auto-updater (background check)
            updater::check_for_updates(app.handle().clone());

            Ok(())
        })
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
            commands::chat_send_stream,
            commands::chat_auth_status,
            // SSH commands
            commands::ssh_connect,
            commands::ssh_disconnect,
            commands::ssh_write,
            commands::ssh_resize,
            commands::ssh_list_keys,
            commands::ssh_session_exists,
            commands::ssh_get_output,
            // Collector WebSocket commands
            commands::collector_connect,
            commands::collector_disconnect,
            commands::collector_status,
            // Bastion / Fleet API proxy commands
            commands::bastion_list_hosts,
            commands::bastion_fleet_summary,
            // Memory bridge commands (local-only storage)
            memory::commands::collector_store_entity,
            memory::commands::collector_touch_entity,
            memory::commands::collector_extract_entities,
            memory::commands::collector_add_open_loop,
            memory::commands::collector_add_learned_item,
            memory::commands::collector_record_decision,
            memory::commands::collector_set_focus,
            // Claude Mode commands
            commands::claude_spawn,
            commands::claude_write,
            commands::claude_kill,
            commands::detect_claude_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
