//! Claude CLI session management.
//!
//! Spawns `claude` CLI as a PTY subprocess with `--output-format stream-json`,
//! reads NDJSON lines from stdout, parses them, and emits typed Tauri events.

use portable_pty::{CommandBuilder, MasterPty, PtySize};
use std::io::{BufRead, BufReader, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

use super::parser::{parse_stream_json_line, ClaudeEvent};

/// A running Claude CLI session.
pub struct ClaudeSession {
    pub id: String,
    pub cwd: String,
    pub created_at: u64,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    /// Raw output ring buffer for debugging
    pub raw_buffer: Arc<Mutex<Vec<String>>>,
    _reader_handle: Option<thread::JoinHandle<()>>,
}

impl ClaudeSession {
    /// Spawn a new Claude CLI session.
    ///
    /// Runs: `claude -p --output-format stream-json [extra_args...]`
    /// The `-p` flag enables prompt mode (reads from stdin).
    pub fn spawn(
        id: String,
        cwd: &str,
        extra_args: Option<Vec<String>>,
        app_handle: AppHandle,
    ) -> Result<Self, String> {
        let pty_system = portable_pty::native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 200, // wide for JSON lines
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY for Claude: {}", e))?;

        let mut cmd = CommandBuilder::new("claude");
        cmd.arg("-p");
        cmd.arg("--output-format");
        cmd.arg("stream-json");

        // Add any extra CLI args (e.g. --model, --dangerously-skip-permissions)
        if let Some(args) = extra_args {
            for arg in args {
                cmd.arg(arg);
            }
        }

        cmd.cwd(cwd);
        cmd.env("TERM", "dumb"); // no ANSI escape codes in JSON
        cmd.env("NO_COLOR", "1");
        cmd.env_remove("CLAUDECODE"); // prevent nesting detection

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn Claude CLI: {}", e))?;

        let _pid = child.process_id().unwrap_or(0);

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get Claude PTY writer: {}", e))?;

        let raw_buffer = Arc::new(Mutex::new(Vec::<String>::new()));

        // Start reader thread — parses NDJSON and emits Tauri events
        let session_id = id.clone();
        let buffer_clone = Arc::clone(&raw_buffer);
        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone Claude PTY reader: {}", e))?;

        let reader_handle = thread::spawn(move || {
            let session_id_for_exit = session_id.clone();
            let app_handle_for_exit = app_handle.clone();

            log::debug!("[claude] Reader thread started for session {}", session_id);

            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let buf_reader = BufReader::new(reader);

                for line_result in buf_reader.lines() {
                    match line_result {
                        Ok(line) => {
                            let trimmed = line.trim().to_string();
                            if trimmed.is_empty() {
                                continue;
                            }

                            // Store raw line in debug buffer (cap at 1000 lines)
                            if let Ok(mut buf) = buffer_clone.lock() {
                                if buf.len() >= 1000 {
                                    buf.remove(0);
                                }
                                buf.push(trimmed.clone());
                            }

                            // Parse and emit
                            match parse_stream_json_line(&trimmed) {
                                Ok(event) => {
                                    let event_name = format!("claude-event-{}", session_id);
                                    let _ = app_handle.emit(&event_name, &event);
                                }
                                Err(_) => {
                                    // Non-JSON line — emit as raw text (Claude CLI
                                    // sometimes outputs non-JSON status messages)
                                    let event_name = format!("claude-event-{}", session_id);
                                    let raw_event = ClaudeEvent::System(
                                        super::parser::SystemEvent {
                                            subtype: "raw_output".to_string(),
                                            message: trimmed,
                                            data: serde_json::Value::Null,
                                        }
                                    );
                                    let _ = app_handle.emit(&event_name, &raw_event);
                                }
                            }
                        }
                        Err(_) => break, // EOF or read error
                    }
                }
            }));

            let code = if result.is_ok() {
                log::debug!("[claude] Reader thread EOF for session {}", session_id_for_exit);
                0
            } else {
                log::error!("[claude] Reader thread panicked for session {}", session_id_for_exit);
                -1
            };

            let event_name = format!("claude-exit-{}", session_id_for_exit);
            let _ = app_handle_for_exit.emit(&event_name, serde_json::json!({ "code": code }));
        });

        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Ok(Self {
            id,
            cwd: cwd.to_string(),
            created_at,
            master: pair.master,
            writer,
            raw_buffer,
            _reader_handle: Some(reader_handle),
        })
    }

    /// Write data to the Claude CLI stdin (user messages, approval responses).
    pub fn write(&mut self, data: &[u8]) -> Result<(), String> {
        self.writer
            .write_all(data)
            .map_err(|e| format!("Failed to write to Claude: {}", e))?;
        self.writer
            .flush()
            .map_err(|e| format!("Failed to flush Claude stdin: {}", e))?;
        Ok(())
    }

    /// Resize the PTY (generally not needed for Claude, but available).
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize Claude PTY: {}", e))?;
        Ok(())
    }

    /// Get last N raw output lines (for debugging).
    pub fn get_raw_output(&self, n: usize) -> Vec<String> {
        if let Ok(buf) = self.raw_buffer.lock() {
            let start = buf.len().saturating_sub(n);
            buf[start..].to_vec()
        } else {
            vec![]
        }
    }
}
