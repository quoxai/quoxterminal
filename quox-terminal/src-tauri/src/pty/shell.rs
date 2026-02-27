use std::env;

/// Detect the user's default login shell.
///
/// On macOS: uses `dscl` to read the user's shell from Directory Services (avoids
/// inheriting a parent process's $SHELL which may be wrong, e.g. inside Claude Code).
/// On Linux: reads $SHELL, falls back to /bin/bash or /bin/sh.
/// On Windows: tries pwsh.exe, falls back to cmd.exe.
pub fn detect_default_shell() -> String {
    #[cfg(unix)]
    {
        // On macOS, query Directory Services for the real login shell.
        // This avoids inheriting a wrong $SHELL from parent processes.
        #[cfg(target_os = "macos")]
        {
            if let Ok(user) = env::var("USER") {
                if let Ok(output) = std::process::Command::new("dscl")
                    .args([".", "-read", &format!("/Users/{}", user), "UserShell"])
                    .output()
                {
                    if output.status.success() {
                        if let Ok(stdout) = String::from_utf8(output.stdout) {
                            // Output format: "UserShell: /bin/zsh"
                            if let Some(shell) = stdout.trim().split_whitespace().last() {
                                if std::path::Path::new(shell).exists() {
                                    return shell.to_string();
                                }
                            }
                        }
                    }
                }
            }
        }

        if let Ok(shell) = env::var("SHELL") {
            if !shell.is_empty() {
                return shell;
            }
        }
        // Fallback: try common shells
        for candidate in &["/bin/zsh", "/bin/bash", "/bin/sh"] {
            if std::path::Path::new(candidate).exists() {
                return candidate.to_string();
            }
        }
        "/bin/sh".to_string()
    }

    #[cfg(windows)]
    {
        // Prefer PowerShell 7+, then Windows PowerShell, then cmd
        if let Ok(output) = std::process::Command::new("where").arg("pwsh.exe").output() {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let path = path.trim().lines().next().unwrap_or("").trim();
                    if !path.is_empty() {
                        return path.to_string();
                    }
                }
            }
        }
        if let Ok(sys_root) = env::var("SystemRoot") {
            let ps_path = format!(
                "{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                sys_root
            );
            if std::path::Path::new(&ps_path).exists() {
                return ps_path;
            }
        }
        env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_default_shell_returns_non_empty() {
        let shell = detect_default_shell();
        assert!(!shell.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn test_detect_default_shell_is_absolute_path() {
        let shell = detect_default_shell();
        assert!(shell.starts_with('/'));
    }
}
