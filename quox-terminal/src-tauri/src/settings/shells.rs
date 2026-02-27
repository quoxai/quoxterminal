/// Detect available shell profiles on the system.
pub fn list_available_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();

    #[cfg(unix)]
    {
        let candidates = [
            ("/bin/zsh", "Zsh"),
            ("/bin/bash", "Bash"),
            ("/bin/sh", "POSIX Shell"),
            ("/usr/bin/fish", "Fish"),
            ("/usr/local/bin/fish", "Fish"),
            ("/opt/homebrew/bin/fish", "Fish"),
            ("/usr/local/bin/bash", "Bash (Homebrew)"),
            ("/opt/homebrew/bin/bash", "Bash (Homebrew)"),
            ("/usr/local/bin/zsh", "Zsh (Homebrew)"),
            ("/opt/homebrew/bin/zsh", "Zsh (Homebrew)"),
        ];

        for (path, name) in candidates {
            if std::path::Path::new(path).exists() {
                // Avoid duplicate names
                if !shells.iter().any(|s: &ShellInfo| s.path == path) {
                    shells.push(ShellInfo {
                        name: name.to_string(),
                        path: path.to_string(),
                    });
                }
            }
        }
    }

    #[cfg(windows)]
    {
        use std::env;

        // PowerShell 7+
        if let Ok(output) = std::process::Command::new("where").arg("pwsh.exe").output() {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let path = path.trim().lines().next().unwrap_or("").trim();
                    if !path.is_empty() {
                        shells.push(ShellInfo {
                            name: "PowerShell 7".to_string(),
                            path: path.to_string(),
                        });
                    }
                }
            }
        }

        // Windows PowerShell
        if let Ok(sys_root) = env::var("SystemRoot") {
            let ps_path = format!(
                "{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
                sys_root
            );
            if std::path::Path::new(&ps_path).exists() {
                shells.push(ShellInfo {
                    name: "Windows PowerShell".to_string(),
                    path: ps_path,
                });
            }
        }

        // cmd.exe
        if let Ok(comspec) = env::var("COMSPEC") {
            shells.push(ShellInfo {
                name: "Command Prompt".to_string(),
                path: comspec,
            });
        }

        // Git Bash
        let git_bash_paths = [
            "C:\\Program Files\\Git\\bin\\bash.exe",
            "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
        ];
        for path in git_bash_paths {
            if std::path::Path::new(path).exists() {
                shells.push(ShellInfo {
                    name: "Git Bash".to_string(),
                    path: path.to_string(),
                });
                break;
            }
        }
    }

    shells
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ShellInfo {
    pub name: String,
    pub path: String,
}
