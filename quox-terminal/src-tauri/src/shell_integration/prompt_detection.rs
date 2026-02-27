/// Prompt detection for shell integration.
///
/// Detects command boundaries in terminal output by recognizing
/// common shell prompt patterns. This enables features like:
/// - Command timing (how long did a command take?)
/// - Long-running command notifications
/// - Command history tracking
///
/// TODO: Phase 8 full implementation with OSC escape sequences.

/// Common prompt patterns for different shells.
const PROMPT_PATTERNS: &[&str] = &[
    "$ ",       // bash/zsh default
    "% ",       // zsh
    "# ",       // root prompt
    "> ",       // PowerShell / fish
    ">>> ",     // Python REPL
    "... ",     // Python continuation
];

/// Represents a detected command boundary.
#[derive(Debug, Clone)]
pub struct CommandBoundary {
    /// The prompt text that was detected
    pub prompt: String,
    /// Position in the output where the prompt was found
    pub position: usize,
    /// Whether this appears to be a root prompt
    pub is_root: bool,
}

/// Detect if a line appears to end with a shell prompt.
///
/// This is a heuristic approach. For more reliable detection,
/// shell integration scripts (like those used by iTerm2/VSCode)
/// emit OSC escape sequences that explicitly mark prompt boundaries.
pub fn detect_prompt(line: &str) -> Option<CommandBoundary> {
    let trimmed = line.trim_end();

    for pattern in PROMPT_PATTERNS {
        if trimmed.ends_with(pattern.trim_end()) {
            return Some(CommandBoundary {
                prompt: pattern.to_string(),
                position: trimmed.len() - pattern.trim_end().len(),
                is_root: *pattern == "# ",
            });
        }
    }

    None
}

/// Check if a line contains an OSC 133 prompt marker.
/// OSC 133 ; A ST marks prompt start (used by iTerm2, VSCode terminal).
pub fn detect_osc_prompt(line: &str) -> bool {
    line.contains("\x1b]133;A\x07") || line.contains("\x1b]133;A\x1b\\")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bash_prompt() {
        let result = detect_prompt("user@host:~$ ");
        assert!(result.is_some());
        assert!(!result.unwrap().is_root);
    }

    #[test]
    fn test_root_prompt() {
        let result = detect_prompt("root@host:~# ");
        assert!(result.is_some());
        assert!(result.unwrap().is_root);
    }

    #[test]
    fn test_no_prompt() {
        let result = detect_prompt("hello world");
        assert!(result.is_none());
    }
}
