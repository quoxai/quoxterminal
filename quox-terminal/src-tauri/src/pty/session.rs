use portable_pty::{CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

// ── Shell integration scripts ────────────────────────────────────────────────
//
// These create a colourful, informative prompt that shows:
//   quox ~/current/path (git-branch) ❯
//
// - "quox" in bold green (app identity)
// - working directory in blue
// - git branch in yellow (when inside a repo)
// - ❯ arrow: green on success, red on error
//
// Users can opt out by setting QUOX_NO_PROMPT=1 in their environment.

/// Zsh integration — loaded via ZDOTDIR
const ZSH_INTEGRATION: &str = r#"# QuoxTerminal — zsh prompt integration
# Restore ZDOTDIR and source user's original config
ZDOTDIR="$HOME"
[[ -f "$HOME/.zshenv" ]] && source "$HOME/.zshenv"
[[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc"

# Skip custom prompt if user opts out
[[ -n "$QUOX_NO_PROMPT" ]] && return

# ── QuoxTerminal prompt ──
_quox_git_info() {
  local ref
  ref=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
  [[ -n "$ref" ]] && echo " %F{yellow}($ref)%f"
}

setopt PROMPT_SUBST
PROMPT='%B%F{green}quox%f%b %F{blue}%~%f$(_quox_git_info) %F{%(?.green.red)}❯%f '
RPROMPT=''
"#;

/// Bash integration — loaded via --rcfile
const BASH_INTEGRATION: &str = r#"# QuoxTerminal — bash prompt integration
# Source user's original config
[[ -f "$HOME/.bashrc" ]] && source "$HOME/.bashrc"

# Skip custom prompt if user opts out
[[ -n "$QUOX_NO_PROMPT" ]] && return 2>/dev/null || true

# ── QuoxTerminal prompt ──
__quox_prompt() {
  local ec=$?
  local green='\[\e[1;32m\]'
  local blue='\[\e[0;34m\]'
  local yellow='\[\e[0;33m\]'
  local red='\[\e[0;31m\]'
  local reset='\[\e[0m\]'

  local gb
  gb=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
  local gp=""
  [[ -n "$gb" ]] && gp=" ${yellow}(${gb})${reset}"

  local ac=${green}
  [[ $ec -ne 0 ]] && ac=${red}

  PS1="${green}quox${reset} ${blue}\w${reset}${gp} ${ac}❯${reset} "
}
PROMPT_COMMAND='__quox_prompt'
"#;

/// Create shell integration scripts in a temp directory.
/// Returns the base directory path.
fn ensure_shell_integration() -> Result<PathBuf, String> {
    let mut dir = std::env::temp_dir();
    dir.push("quox-terminal-shell");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create shell integration dir: {}", e))?;

    // Zsh needs its own ZDOTDIR with a .zshrc
    let zsh_dir = dir.join("zsh");
    std::fs::create_dir_all(&zsh_dir)
        .map_err(|e| format!("Failed to create zsh dir: {}", e))?;
    std::fs::write(zsh_dir.join(".zshrc"), ZSH_INTEGRATION)
        .map_err(|e| format!("Failed to write zsh integration: {}", e))?;

    // Bash uses --rcfile pointing to a single file
    std::fs::write(dir.join("bashrc"), BASH_INTEGRATION)
        .map_err(|e| format!("Failed to write bash integration: {}", e))?;

    Ok(dir)
}

/// Ring buffer for terminal output, used by AI context builder
pub struct OutputRingBuffer {
    buffer: Vec<u8>,
    capacity: usize,
    write_pos: usize,
    len: usize,
}

impl OutputRingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: vec![0u8; capacity],
            capacity,
            write_pos: 0,
            len: 0,
        }
    }

    pub fn write(&mut self, data: &[u8]) {
        for &byte in data {
            self.buffer[self.write_pos] = byte;
            self.write_pos = (self.write_pos + 1) % self.capacity;
            if self.len < self.capacity {
                self.len += 1;
            }
        }
    }

    /// Read the last `n` characters from the ring buffer.
    pub fn read_last(&self, n: usize) -> String {
        let n = n.min(self.len);
        if n == 0 {
            return String::new();
        }
        let start = if self.len < self.capacity {
            self.len - n
        } else {
            (self.write_pos + self.capacity - n) % self.capacity
        };

        let mut result = Vec::with_capacity(n);
        for i in 0..n {
            let idx = (start + i) % self.capacity;
            result.push(self.buffer[idx]);
        }
        String::from_utf8_lossy(&result).to_string()
    }
}

/// A single PTY session — owns the master PTY, a reader thread, and an output ring buffer.
pub struct PtySession {
    pub id: String,
    pub shell: String,
    pub cwd: String,
    pub pid: u32,
    pub created_at: u64,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    pub output_buffer: Arc<Mutex<OutputRingBuffer>>,
    _reader_handle: Option<thread::JoinHandle<()>>,
}

impl PtySession {
    /// Spawn a new PTY session.
    pub fn spawn(
        id: String,
        shell: &str,
        cwd: &str,
        env: Option<Vec<(String, String)>>,
        app_handle: AppHandle,
    ) -> Result<Self, String> {
        let pty_system = portable_pty::native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(cwd);

        // Add any extra environment variables
        if let Some(env_vars) = env {
            for (key, val) in env_vars {
                cmd.env(key, val);
            }
        }

        // Set TERM for proper color support
        cmd.env("TERM", "xterm-256color");
        cmd.env("TERM_PROGRAM", "QuoxTerminal");
        cmd.env("QUOX_TERMINAL", "1");

        // Remove env vars from parent that could confuse child shells
        cmd.env_remove("CLAUDECODE");

        // Load custom prompt integration (colourful prompt with git info)
        if let Ok(integration_dir) = ensure_shell_integration() {
            if shell.contains("zsh") {
                cmd.env(
                    "ZDOTDIR",
                    integration_dir
                        .join("zsh")
                        .to_string_lossy()
                        .as_ref(),
                );
            } else if shell.contains("bash") {
                cmd.arg("--rcfile");
                cmd.arg(
                    integration_dir
                        .join("bashrc")
                        .to_string_lossy()
                        .as_ref(),
                );
            }
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        let pid = child.process_id().unwrap_or(0);

        // Get writer for stdin
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

        // Create output ring buffer (1MB)
        let output_buffer = Arc::new(Mutex::new(OutputRingBuffer::new(1024 * 1024)));

        // Start reader thread
        let session_id = id.clone();
        let buffer_clone = Arc::clone(&output_buffer);
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

        let reader_handle = thread::spawn(move || {
            let session_id_for_exit = session_id.clone();
            let app_handle_for_exit = app_handle.clone();

            log::debug!("PTY reader thread started for session {}", session_id);

            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => break, // EOF
                        Ok(n) => {
                            let data = &buf[..n];

                            // Write to ring buffer
                            if let Ok(mut rb) = buffer_clone.lock() {
                                rb.write(data);
                            }

                            // Emit to frontend
                            let text = String::from_utf8_lossy(data).to_string();
                            let event_name = format!("pty-output-{}", session_id);
                            let _ = app_handle.emit(&event_name, serde_json::json!({ "data": text }));
                        }
                        Err(_) => break,
                    }
                }
            }));

            let code = if result.is_ok() {
                log::debug!("PTY reader thread EOF for session {}", session_id_for_exit);
                0
            } else {
                log::error!("PTY reader thread panicked for session {}", session_id_for_exit);
                -1
            };
            let event_name = format!("pty-exit-{}", session_id_for_exit);
            let _ = app_handle_for_exit.emit(&event_name, serde_json::json!({ "code": code }));
        });

        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Ok(Self {
            id,
            shell: shell.to_string(),
            cwd: cwd.to_string(),
            pid,
            created_at,
            master: pair.master,
            writer,
            output_buffer,
            _reader_handle: Some(reader_handle),
        })
    }

    /// Write data to the PTY stdin.
    pub fn write(&mut self, data: &[u8]) -> Result<(), String> {
        self.writer
            .write_all(data)
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        self.writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    }

    /// Resize the PTY.
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
        Ok(())
    }

    /// Read last N characters from the output ring buffer.
    pub fn read_output(&self, chars: usize) -> String {
        if let Ok(rb) = self.output_buffer.lock() {
            rb.read_last(chars)
        } else {
            String::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_basic() {
        let mut rb = OutputRingBuffer::new(10);
        rb.write(b"hello");
        assert_eq!(rb.read_last(5), "hello");
        assert_eq!(rb.read_last(3), "llo");
        assert_eq!(rb.read_last(100), "hello");
    }

    #[test]
    fn test_ring_buffer_wrap() {
        let mut rb = OutputRingBuffer::new(5);
        rb.write(b"abcdefgh"); // wraps around
        assert_eq!(rb.read_last(5), "defgh");
        assert_eq!(rb.read_last(3), "fgh");
    }

    #[test]
    fn test_ring_buffer_empty() {
        let rb = OutputRingBuffer::new(10);
        assert_eq!(rb.read_last(5), "");
    }
}
