//! Claude CLI session management.
//!
//! Spawns `claude` CLI as a subprocess with `--output-format stream-json
//! --input-format stream-json --verbose`, reads NDJSON lines from stdout,
//! parses them, and emits typed Tauri events.
//!
//! ## Why plain OS pipes, not a PTY
//!
//! `claude -p` (print/headless mode) refuses to treat a TTY-backed stdin as
//! valid programmatic input: it performs an `isatty()`-style check and, when
//! stdin is a terminal (which a `portable_pty` slave always is, by
//! definition), it exits immediately with
//! `Error: Input must be provided either through stdin or as a prompt
//! argument when using --print` — regardless of `--verbose`, regardless of
//! `--input-format`, and regardless of what has been written. This was
//! confirmed against the real `claude` CLI binary using the real
//! `portable-pty` crate: a PTY-backed spawn-then-write sequence (matching
//! this module's previous implementation exactly) reproduces the error on
//! every run; the identical spawn-then-write sequence over a plain
//! `std::process::Command` pipe does not, and supports genuine multi-turn
//! conversations (the process stays alive across multiple stdin writes and
//! only exits on stdin EOF).
//!
//! `claude -p --output-format stream-json` alone (single "text" input,
//! prompt supplied as a CLI argument) is single-shot: the process exits
//! after the first response, so it cannot serve a long-lived
//! spawn-then-write-many-times session. `--input-format stream-json` is the
//! documented mechanism for a persistent, multi-turn, stdin-driven session,
//! and it requires non-TTY stdin — i.e. pipes, not a PTY.
use serde_json::json;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

use super::parser::{parse_stream_json_line, ClaudeEvent};

/// A running Claude CLI session.
pub struct ClaudeSession {
    pub id: String,
    pub cwd: String,
    pub created_at: u64,
    child: Child,
    stdin: ChildStdin,
    /// Raw output ring buffer for debugging
    pub raw_buffer: Arc<Mutex<Vec<String>>>,
    _stdout_handle: Option<thread::JoinHandle<()>>,
    _stderr_handle: Option<thread::JoinHandle<()>>,
}

impl ClaudeSession {
    /// Spawn a new Claude CLI session.
    ///
    /// Runs: `claude -p --output-format stream-json --input-format stream-json
    /// --verbose [extra_args...]` over plain OS pipes (stdin/stdout/stderr).
    /// The `-p` flag enables print/headless mode; `--input-format stream-json`
    /// keeps the process alive to accept further turns via `write()` until
    /// stdin is closed. See the module doc comment for why this is a pipe,
    /// not a PTY.
    pub fn spawn(
        id: String,
        cwd: &str,
        extra_args: Option<Vec<String>>,
        app_handle: AppHandle,
    ) -> Result<Self, String> {
        let mut cmd = Command::new("claude");
        cmd.arg("-p");
        cmd.arg("--output-format");
        cmd.arg("stream-json");
        cmd.arg("--input-format");
        cmd.arg("stream-json");
        cmd.arg("--verbose");

        // Add any extra CLI args (e.g. --model, --dangerously-skip-permissions)
        if let Some(args) = extra_args {
            for arg in args {
                cmd.arg(arg);
            }
        }

        cmd.current_dir(cwd);
        cmd.env("NO_COLOR", "1");
        cmd.env_remove("CLAUDECODE"); // prevent nesting detection
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn Claude CLI: {}", e))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to get Claude stdin handle".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to get Claude stdout handle".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Failed to get Claude stderr handle".to_string())?;

        let raw_buffer = Arc::new(Mutex::new(Vec::<String>::new()));

        // Start stdout reader thread — parses NDJSON and emits Tauri events.
        let session_id = id.clone();
        let buffer_clone = Arc::clone(&raw_buffer);
        let app_handle_stdout = app_handle.clone();
        let stdout_handle = thread::spawn(move || {
            let session_id_for_exit = session_id.clone();
            let app_handle_for_exit = app_handle_stdout.clone();

            log::debug!("[claude] Reader thread started for session {}", session_id);

            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let buf_reader = BufReader::new(stdout);

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
                                    let _ = app_handle_stdout.emit(&event_name, &event);
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
                                    let _ = app_handle_stdout.emit(&event_name, &raw_event);
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

        // Start stderr reader thread — Claude's own top-level errors (e.g.
        // CLI usage errors, crashes) go to stderr, not stdout, over a plain
        // pipe (unlike the previous PTY setup, where stdout/stderr were
        // merged into a single stream). Surface these as raw_output System
        // events so they remain visible to the UI/debug buffer.
        let session_id_err = id.clone();
        let buffer_clone_err = Arc::clone(&raw_buffer);
        let app_handle_stderr = app_handle;
        let stderr_handle = thread::spawn(move || {
            let buf_reader = BufReader::new(stderr);
            for line_result in buf_reader.lines() {
                match line_result {
                    Ok(line) => {
                        let trimmed = line.trim().to_string();
                        if trimmed.is_empty() {
                            continue;
                        }
                        if let Ok(mut buf) = buffer_clone_err.lock() {
                            if buf.len() >= 1000 {
                                buf.remove(0);
                            }
                            buf.push(format!("[stderr] {}", trimmed));
                        }
                        let event_name = format!("claude-event-{}", session_id_err);
                        let raw_event = ClaudeEvent::System(super::parser::SystemEvent {
                            subtype: "raw_output".to_string(),
                            message: trimmed,
                            data: serde_json::Value::Null,
                        });
                        let _ = app_handle_stderr.emit(&event_name, &raw_event);
                    }
                    Err(_) => break,
                }
            }
        });

        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Ok(Self {
            id,
            cwd: cwd.to_string(),
            created_at,
            child,
            stdin,
            raw_buffer,
            _stdout_handle: Some(stdout_handle),
            _stderr_handle: Some(stderr_handle),
        })
    }

    /// Send a user message to the Claude CLI over stdin.
    ///
    /// Wraps `text` in the `--input-format stream-json` envelope
    /// (`{"type":"user","message":{"role":"user","content":"..."}}`) that
    /// the running `claude -p` process expects one-per-line on stdin, and
    /// writes it followed by a newline.
    ///
    /// This is confirmed to work for the FIRST message and for SECOND and
    /// subsequent messages in the same session — `--input-format
    /// stream-json` keeps the CLI process alive across turns, reading one
    /// JSON object per line until stdin is closed. It does NOT relay tool
    /// permission/approval responses: no native mechanism exists for
    /// answering a tool-permission prompt via this stdin stream in `-p`
    /// mode (the SDK's `canUseTool` callback is SDK-only, not available to
    /// a bare CLI subprocess). Tool calls made by the CLI in this mode are
    /// auto-denied in-band with no interactive approval window; any
    /// caller relying on `write()` to approve/deny a tool call is not
    /// actually doing so.
    pub fn write(&mut self, text: &str) -> Result<(), String> {
        let line = encode_stream_json_line(text)?;

        self.stdin
            .write_all(line.as_bytes())
            .map_err(|e| format!("Failed to write to Claude: {}", e))?;
        self.stdin
            .flush()
            .map_err(|e| format!("Failed to flush Claude stdin: {}", e))?;
        Ok(())
    }

    /// Kill the underlying Claude CLI process.
    pub fn kill(&mut self) -> Result<(), String> {
        self.child
            .kill()
            .map_err(|e| format!("Failed to kill Claude process: {}", e))
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

impl Drop for ClaudeSession {
    fn drop(&mut self) {
        // Best-effort: closing stdin (EOF) lets a well-behaved `claude -p
        // --input-format stream-json` process exit on its own; kill() is a
        // backstop for anything still running.
        let _ = self.child.kill();
    }
}

/// Build one `--input-format stream-json` NDJSON line for a user message.
///
/// Extracted as a pure function so the wire format can be unit tested
/// without spawning a real `claude` process. The trailing `\n` the caller
/// appends (matching `useClaudeSession.ts`'s `claudeWrite(id, text + "\n")`)
/// is stripped before encoding, then a single `\n` is appended after the
/// JSON so the CLI reads exactly one object per line.
fn encode_stream_json_line(text: &str) -> Result<String, String> {
    let content = text.strip_suffix('\n').unwrap_or(text);
    let payload = json!({
        "type": "user",
        "message": {
            "role": "user",
            "content": content,
        }
    });
    let mut line = serde_json::to_string(&payload)
        .map_err(|e| format!("Failed to encode stream-json message: {}", e))?;
    line.push('\n');
    Ok(line)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The exact envelope shape confirmed against the real `claude` CLI
    /// (2.1.220) over a plain OS pipe: `claude -p --output-format
    /// stream-json --input-format stream-json --verbose` accepts one
    /// `{"type":"user","message":{"role":"user","content":"..."}}` object
    /// per stdin line, for the first message and every message after it.
    #[test]
    fn encodes_user_message_envelope() {
        let line = encode_stream_json_line("say the word PONG and nothing else").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(line.trim_end()).unwrap();
        assert_eq!(parsed["type"], "user");
        assert_eq!(parsed["message"]["role"], "user");
        assert_eq!(
            parsed["message"]["content"],
            "say the word PONG and nothing else"
        );
        assert!(line.ends_with('\n'), "must be newline-terminated NDJSON");
        // Exactly one line — the CLI's stream-json reader is line-delimited.
        assert_eq!(line.matches('\n').count(), 1);
    }

    /// `useClaudeSession.ts` sends `text + "\n"` (see `sendMessage` /
    /// `approveToolCall`); the trailing newline must not leak into the
    /// JSON `content` field or become a second blank NDJSON line.
    #[test]
    fn strips_trailing_newline_from_caller() {
        let with_newline = encode_stream_json_line("Fix the bug\n").unwrap();
        let without_newline = encode_stream_json_line("Fix the bug").unwrap();
        assert_eq!(with_newline, without_newline);
        let parsed: serde_json::Value =
            serde_json::from_str(with_newline.trim_end()).unwrap();
        assert_eq!(parsed["message"]["content"], "Fix the bug");
    }

    /// Content containing quotes/backslashes/newlines must be valid JSON
    /// (this is why the payload is built with serde_json rather than
    /// hand-formatted strings).
    #[test]
    fn escapes_special_characters_in_content() {
        let line = encode_stream_json_line("say \"hi\" and use a \\ backslash").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(line.trim_end()).unwrap();
        assert_eq!(
            parsed["message"]["content"],
            "say \"hi\" and use a \\ backslash"
        );
    }

    /// `approveToolCall` currently sends a bare `"y\n"` over `write()`.
    /// Document (via a passing assertion) that this is encoded as an
    /// ordinary user-message turn like any other text — NOT as a native
    /// tool-approval response, because no such mechanism exists in this
    /// mode. See `ClaudeSession::write`'s doc comment.
    #[test]
    fn approval_shortcut_is_encoded_as_a_plain_user_message() {
        let line = encode_stream_json_line("y\n").unwrap();
        let parsed: serde_json::Value = serde_json::from_str(line.trim_end()).unwrap();
        assert_eq!(parsed["type"], "user");
        assert_eq!(parsed["message"]["content"], "y");
    }
}
