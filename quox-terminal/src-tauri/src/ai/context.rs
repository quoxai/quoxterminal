//! Terminal Context for AI
//!
//! Provides ANSI stripping utilities for cleaning raw terminal output
//! before sending it to the AI model as context.

use regex::Regex;

/// Strip ANSI escape sequences and control characters from raw PTY output.
///
/// Raw terminal output contains:
/// - SGR (colors/styles): \x1B[32m ... \x1B[0m
/// - CSI sequences (cursor etc): \x1B[2A, \x1B[?2004h (bracketed paste)
/// - OSC (window title): \x1B]0;title\x07
/// - Character set / keypad: \x1B(B, \x1B>, \x1B=
/// - Backspace echoes: \x08 (BS) from readline editing
/// - Other control chars: \x00-\x1F except \n \r \t
///
/// Also simulates backspace: "ab\x08c" -> "ac" (character deletion).
pub fn strip_ansi(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }

    // 1. Strip all ESC sequences (CSI with optional ?>=! prefixes, OSC, charset, keypad)
    let esc_re = Regex::new(
        r"\x1B(?:\[[?>=!]?[0-9;]*[A-Za-z]|\][^\x07]*\x07|\([A-Z]|[>=])"
    ).unwrap();
    let mut clean = esc_re.replace_all(text, "").to_string();

    // 2. Simulate backspace: each \x08 deletes the preceding character
    let bs_pair_re = Regex::new(r"[^\x08\n]\x08").unwrap();
    while bs_pair_re.is_match(&clean) {
        clean = bs_pair_re.replace_all(&clean, "").to_string();
    }
    // Remove any remaining orphan backspaces
    clean = clean.replace('\x08', "");

    // 3. Strip remaining control chars except \n \r \t
    let ctrl_re = Regex::new(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]").unwrap();
    clean = ctrl_re.replace_all(&clean, "").to_string();

    clean
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi_empty() {
        assert_eq!(strip_ansi(""), "");
    }

    #[test]
    fn test_strip_ansi_no_codes() {
        assert_eq!(strip_ansi("hello world"), "hello world");
    }

    #[test]
    fn test_strip_ansi_sgr() {
        assert_eq!(strip_ansi("\x1B[32mhello\x1B[0m"), "hello");
    }

    #[test]
    fn test_strip_ansi_csi() {
        assert_eq!(strip_ansi("\x1B[?2004hhello\x1B[?2004l"), "hello");
    }

    #[test]
    fn test_strip_ansi_osc() {
        assert_eq!(strip_ansi("\x1B]0;my title\x07hello"), "hello");
    }

    #[test]
    fn test_strip_ansi_backspace() {
        assert_eq!(strip_ansi("ab\x08c"), "ac");
    }

    #[test]
    fn test_strip_ansi_preserves_newlines() {
        assert_eq!(strip_ansi("line1\nline2\n"), "line1\nline2\n");
    }
}
