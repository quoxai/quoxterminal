/**
 * tauriFs.test.ts — Tests for the Tauri file system wrapper module.
 *
 * Mocks the @tauri-apps/api/core invoke function and verifies that
 * each wrapper calls the correct Rust command with the right arguments.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import {
  fsReadFile,
  fsWriteFile,
  fsDeleteFile,
  fsRenameFile,
  fsListDir,
  type DirEntry,
} from "../lib/tauri-fs";

describe("tauri-fs", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("fsReadFile calls fs_read_file with correct args", async () => {
    mockInvoke.mockResolvedValue("file content");
    const result = await fsReadFile("/home/user/test.txt");
    expect(mockInvoke).toHaveBeenCalledWith("fs_read_file", {
      path: "/home/user/test.txt",
    });
    expect(result).toBe("file content");
  });

  it("fsWriteFile calls fs_write_file with backup=true by default", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await fsWriteFile("/home/user/test.txt", "new content");
    expect(mockInvoke).toHaveBeenCalledWith("fs_write_file", {
      path: "/home/user/test.txt",
      content: "new content",
      backup: true,
    });
  });

  it("fsWriteFile passes backup=false when specified", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await fsWriteFile("/home/user/test.txt", "new content", false);
    expect(mockInvoke).toHaveBeenCalledWith("fs_write_file", {
      path: "/home/user/test.txt",
      content: "new content",
      backup: false,
    });
  });

  it("fsDeleteFile calls fs_delete_file with backup=true by default", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await fsDeleteFile("/home/user/test.txt");
    expect(mockInvoke).toHaveBeenCalledWith("fs_delete_file", {
      path: "/home/user/test.txt",
      backup: true,
    });
  });

  it("fsRenameFile calls fs_rename_file with correct args", async () => {
    mockInvoke.mockResolvedValue(undefined);
    await fsRenameFile("/home/user/old.txt", "/home/user/new.txt");
    expect(mockInvoke).toHaveBeenCalledWith("fs_rename_file", {
      oldPath: "/home/user/old.txt",
      newPath: "/home/user/new.txt",
    });
  });

  it("fsListDir calls fs_list_dir and returns typed entries", async () => {
    const entries: DirEntry[] = [
      {
        name: "src",
        path: "/home/user/project/src",
        is_dir: true,
        size: 0,
        modified: 1711152000,
        is_hidden: false,
        is_symlink: false,
        extension: "",
      },
      {
        name: "package.json",
        path: "/home/user/project/package.json",
        is_dir: false,
        size: 1234,
        modified: 1711152000,
        is_hidden: false,
        is_symlink: false,
        extension: "json",
      },
      {
        name: ".gitignore",
        path: "/home/user/project/.gitignore",
        is_dir: false,
        size: 45,
        modified: 1711152000,
        is_hidden: true,
        is_symlink: false,
        extension: "",
      },
    ];
    mockInvoke.mockResolvedValue(entries);

    const result = await fsListDir("/home/user/project");
    expect(mockInvoke).toHaveBeenCalledWith("fs_list_dir", {
      path: "/home/user/project",
    });
    expect(result).toHaveLength(3);
    expect(result[0].is_dir).toBe(true);
    expect(result[0].name).toBe("src");
    expect(result[1].extension).toBe("json");
    expect(result[2].is_hidden).toBe(true);
  });

  it("fsReadFile propagates errors from Rust", async () => {
    mockInvoke.mockRejectedValue(new Error("File not found: /nope"));
    await expect(fsReadFile("/nope")).rejects.toThrow("File not found");
  });

  it("fsListDir propagates errors from Rust", async () => {
    mockInvoke.mockRejectedValue(new Error("Not a directory: /file.txt"));
    await expect(fsListDir("/file.txt")).rejects.toThrow("Not a directory");
  });
});
