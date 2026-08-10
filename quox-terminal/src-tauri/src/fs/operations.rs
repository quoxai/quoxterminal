//! Native file operations for QuoxTerminal Desktop.
//!
//! Provides read, write (with optional backup), delete, and rename operations
//! that the TypeScript frontend invokes via Tauri commands.

use std::fs;
use std::path::Path;

use super::validation::{validate_path, PathSeverity};

/// Enforce a path's severity classification for a destructive operation
/// (write, delete, rename). Mirrors the safety/denylist.rs BLOCK behaviour:
/// - `Blocked` and `Red` are never allowed (Red has no override, same as a
///   RED+blocked denylist entry).
/// - `Amber` requires the caller to have obtained user confirmation first
///   (`confirmed == true`); otherwise the operation is refused.
/// - `Green` always proceeds.
fn enforce_severity(path: &str, severity: PathSeverity, confirmed: bool, verb: &str) -> Result<(), String> {
    match severity {
        PathSeverity::Blocked => Err(format!("Path blocked by security policy: {}", path)),
        PathSeverity::Red => Err(format!(
            "Path blocked by security policy (RED - dangerous system path, cannot {}): {}",
            verb, path
        )),
        PathSeverity::Amber if !confirmed => Err(format!(
            "Confirmation required before {} sensitive path (AMBER): {}",
            verb, path
        )),
        PathSeverity::Amber | PathSeverity::Green => Ok(()),
    }
}

/// A directory entry returned by `list_dir`.
#[derive(Debug, serde::Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub extension: String,
}

/// Read a file's contents as a UTF-8 string.
///
/// Returns an error if the path is blocked, if the file does not exist,
/// is not a regular file, or is not valid UTF-8.
pub fn read_file(path: &str) -> Result<String, String> {
    let severity = validate_path(path);
    if severity == PathSeverity::Blocked {
        return Err(format!("Path blocked by security policy: {}", path));
    }

    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    if !p.is_file() {
        return Err(format!("Not a regular file: {}", path));
    }

    fs::read_to_string(p).map_err(|e| format!("Failed to read {}: {}", path, e))
}

/// Write content to a file. Optionally creates a `.quox-backup` before overwriting.
///
/// If `backup` is true and the file already exists, the existing file is copied
/// to `{path}.quox-backup` before the new content is written.
/// Parent directories are created automatically.
pub fn write_file(path: &str, content: &str, backup: bool, confirmed: bool) -> Result<(), String> {
    let severity = validate_path(path);
    enforce_severity(path, severity, confirmed, "write to")?;

    let p = Path::new(path);

    // Create parent directories if they don't exist
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
        }
    }

    // Create backup if requested and file exists
    if backup && p.exists() && p.is_file() {
        let backup_path = format!("{}.quox-backup", path);
        fs::copy(p, &backup_path)
            .map_err(|e| format!("Failed to create backup {}: {}", backup_path, e))?;
    }

    fs::write(p, content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

/// Delete a file. Optionally creates a `.quox-backup` before removal.
///
/// If `backup` is true and the file exists, it is copied to `{path}.quox-backup`
/// before deletion.
pub fn delete_file(path: &str, backup: bool, confirmed: bool) -> Result<(), String> {
    let severity = validate_path(path);
    enforce_severity(path, severity, confirmed, "delete")?;

    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    if !p.is_file() {
        return Err(format!("Not a regular file: {}", path));
    }

    // Create backup before deletion
    if backup {
        let backup_path = format!("{}.quox-backup", path);
        fs::copy(p, &backup_path)
            .map_err(|e| format!("Failed to create backup {}: {}", backup_path, e))?;
    }

    fs::remove_file(p).map_err(|e| format!("Failed to delete {}: {}", path, e))
}

/// Rename (move) a file from `old_path` to `new_path`.
///
/// Parent directories for `new_path` are created automatically.
pub fn rename_file(old_path: &str, new_path: &str, confirmed: bool) -> Result<(), String> {
    let old_severity = validate_path(old_path);
    let new_severity = validate_path(new_path);

    enforce_severity(old_path, old_severity, confirmed, "rename/move")
        .map_err(|e| format!("Source: {}", e))?;
    enforce_severity(new_path, new_severity, confirmed, "rename/move")
        .map_err(|e| format!("Destination: {}", e))?;

    let old_p = Path::new(old_path);
    if !old_p.exists() {
        return Err(format!("Source file not found: {}", old_path));
    }
    if !old_p.is_file() {
        return Err(format!("Source is not a regular file: {}", old_path));
    }

    let new_p = Path::new(new_path);

    // Create parent directories for destination if needed
    if let Some(parent) = new_p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                format!("Failed to create directory {}: {}", parent.display(), e)
            })?;
        }
    }

    fs::rename(old_p, new_p).map_err(|e| {
        format!("Failed to rename {} -> {}: {}", old_path, new_path, e)
    })
}

/// List entries in a directory.
///
/// Returns directories first (alphabetical), then files (alphabetical).
/// Hidden files (starting with `.`) are sorted to the bottom of each group.
pub fn list_dir(path: &str) -> Result<Vec<DirEntry>, String> {
    let severity = validate_path(path);
    if severity == PathSeverity::Blocked {
        return Err(format!("Path blocked by security policy: {}", path));
    }

    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("Directory not found: {}", path));
    }
    if !p.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries: Vec<DirEntry> = Vec::new();

    let read_dir =
        fs::read_dir(p).map_err(|e| format!("Failed to read directory {}: {}", path, e))?;

    for entry_result in read_dir {
        let entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let file_name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let is_hidden = file_name.starts_with('.');
        let is_symlink = entry
            .file_type()
            .map(|ft| ft.is_symlink())
            .unwrap_or(false);
        let is_dir = metadata.is_dir();
        let size = if is_dir { 0 } else { metadata.len() };
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let extension = entry_path
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();

        entries.push(DirEntry {
            name: file_name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            size,
            modified,
            is_hidden,
            is_symlink,
            extension,
        });
    }

    // Sort: directories first, then files. Within each group: non-hidden first,
    // then hidden. Alphabetical (case-insensitive) within each subgroup.
    entries.sort_by(|a, b| {
        // Directories before files
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| {
                // Non-hidden before hidden
                a.is_hidden.cmp(&b.is_hidden)
            })
            .then_with(|| {
                // Alphabetical, case-insensitive
                a.name.to_lowercase().cmp(&b.name.to_lowercase())
            })
    });

    Ok(entries)
}

#[cfg(test)]
mod severity_tests {
    use super::*;

    #[test]
    fn test_green_always_allowed() {
        assert!(enforce_severity("/tmp/test.txt", PathSeverity::Green, false, "write to").is_ok());
        assert!(enforce_severity("/tmp/test.txt", PathSeverity::Green, true, "write to").is_ok());
    }

    #[test]
    fn test_blocked_always_denied() {
        assert!(
            enforce_severity("/tmp/../etc/passwd", PathSeverity::Blocked, true, "write to")
                .is_err()
        );
    }

    #[test]
    fn test_red_denied_even_when_confirmed() {
        let err_unconfirmed =
            enforce_severity("/dev/sda", PathSeverity::Red, false, "write to").unwrap_err();
        assert!(err_unconfirmed.contains("RED"));

        // Red has no override -- unlike Amber, passing confirmed=true must not help.
        let err_confirmed =
            enforce_severity("/dev/sda", PathSeverity::Red, true, "write to").unwrap_err();
        assert!(err_confirmed.contains("RED"));
    }

    #[test]
    fn test_amber_denied_without_confirmation() {
        let err =
            enforce_severity("/etc/hosts", PathSeverity::Amber, false, "write to").unwrap_err();
        assert!(err.contains("Confirmation required"));
    }

    #[test]
    fn test_amber_allowed_with_confirmation() {
        assert!(enforce_severity("/etc/hosts", PathSeverity::Amber, true, "write to").is_ok());
    }
}

#[cfg(test)]
mod operation_tests {
    use super::*;
    use std::fs;

    /// Unique path under the OS temp dir for tests that need to touch real disk.
    /// Never resolves to a Red/Amber/Blocked path.
    fn unique_tmp_path(name: &str) -> String {
        format!(
            "{}/quoxterm-test-{}-{}",
            std::env::temp_dir().display(),
            std::process::id(),
            name
        )
    }

    #[test]
    fn test_write_file_red_path_blocked_no_io() {
        // Enforcement happens before any filesystem write, so this is safe to run
        // even as root: no bytes are ever written to /proc.
        let result = write_file("/proc/quoxterm-safety-test", "data", false, false);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("RED"));
    }

    #[test]
    fn test_write_file_red_path_blocked_even_when_confirmed() {
        let result = write_file("/proc/quoxterm-safety-test", "data", false, true);
        assert!(result.is_err());
    }

    #[test]
    fn test_write_file_amber_path_requires_confirmation() {
        let result = write_file(
            "/etc/quoxterm-safety-test-unconfirmed",
            "data",
            false,
            false,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Confirmation required"));
    }

    #[test]
    fn test_write_file_green_path_succeeds() {
        let path = unique_tmp_path("write-green.txt");
        let result = write_file(&path, "hello", false, false);
        assert!(result.is_ok());
        assert_eq!(fs::read_to_string(&path).unwrap(), "hello");
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn test_delete_file_red_path_blocked() {
        let result = delete_file("/dev/quoxterm-safety-test", false, true);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("RED"));
    }

    #[test]
    fn test_delete_file_amber_path_requires_confirmation() {
        let result = delete_file("/etc/quoxterm-safety-test-delete", false, false);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Confirmation required"));
    }

    #[test]
    fn test_rename_file_amber_destination_requires_confirmation() {
        let src = unique_tmp_path("rename-src.txt");
        fs::write(&src, "x").unwrap();

        let result = rename_file(&src, "/etc/quoxterm-safety-test-rename-target", false);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Confirmation required"));

        let _ = fs::remove_file(&src);
    }

    #[test]
    fn test_rename_file_green_to_green_succeeds() {
        let src = unique_tmp_path("rename-src2.txt");
        let dst = unique_tmp_path("rename-dst2.txt");
        fs::write(&src, "x").unwrap();

        let result = rename_file(&src, &dst, false);
        assert!(result.is_ok());
        assert!(fs::metadata(&dst).is_ok());

        let _ = fs::remove_file(&dst);
    }
}
