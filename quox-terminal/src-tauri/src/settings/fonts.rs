/// Enumerate available monospace fonts on the system.
///
/// Currently returns a static list of known good monospace fonts.
/// Future: use platform APIs (CoreText on macOS, DirectWrite on Windows, fontconfig on Linux).
pub fn list_monospace_fonts() -> Vec<String> {
    let mut fonts = vec![
        "JetBrains Mono".to_string(),
        "Fira Code".to_string(),
        "Cascadia Code".to_string(),
        "SF Mono".to_string(),
        "Menlo".to_string(),
        "Monaco".to_string(),
        "Source Code Pro".to_string(),
        "Inconsolata".to_string(),
        "Hack".to_string(),
        "IBM Plex Mono".to_string(),
        "Ubuntu Mono".to_string(),
        "Consolas".to_string(),
        "Courier New".to_string(),
    ];

    // Platform-specific defaults
    #[cfg(target_os = "macos")]
    {
        if !fonts.contains(&"SF Mono".to_string()) {
            fonts.insert(0, "SF Mono".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        if !fonts.contains(&"Cascadia Code".to_string()) {
            fonts.insert(0, "Cascadia Code".to_string());
        }
    }

    fonts
}
