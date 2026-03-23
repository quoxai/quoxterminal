/**
 * tauri-fs.ts — Tauri invoke wrappers for native file system operations.
 *
 * Wraps the Rust fs commands (fs_read_file, fs_write_file, fs_delete_file,
 * fs_rename_file, fs_list_dir) with typed TypeScript interfaces.
 */

import { invoke } from "@tauri-apps/api/core";

/** A directory entry returned by fs_list_dir. */
export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  is_hidden: boolean;
  is_symlink: boolean;
  extension: string;
}

/** Read a file as UTF-8 text. */
export async function fsReadFile(path: string): Promise<string> {
  return invoke<string>("fs_read_file", { path });
}

/** Write content to a file. If backup is true, creates a .quox-backup first. */
export async function fsWriteFile(
  path: string,
  content: string,
  backup = true,
): Promise<void> {
  return invoke<void>("fs_write_file", { path, content, backup });
}

/** Delete a file. If backup is true, creates a .quox-backup first. */
export async function fsDeleteFile(
  path: string,
  backup = true,
): Promise<void> {
  return invoke<void>("fs_delete_file", { path, backup });
}

/** Rename/move a file. Parent directories for newPath are created automatically. */
export async function fsRenameFile(
  oldPath: string,
  newPath: string,
): Promise<void> {
  return invoke<void>("fs_rename_file", { oldPath, newPath });
}

/**
 * List directory entries.
 * Returns directories first, then files. Hidden entries sorted to bottom of each group.
 */
export async function fsListDir(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("fs_list_dir", { path });
}
