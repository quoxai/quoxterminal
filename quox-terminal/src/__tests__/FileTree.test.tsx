/**
 * FileTree.test.tsx — Tests for the FileTree and FileTreeItem components.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FileTree from "../components/files/FileTree";
import FileTreeItem from "../components/files/FileTreeItem";
import type { DirEntry } from "../lib/tauri-fs";

// Mock fsListDir
const mockFsListDir = vi.fn();
vi.mock("../lib/tauri-fs", () => ({
  fsListDir: (...args: unknown[]) => mockFsListDir(...args),
}));

const MOCK_ENTRIES: DirEntry[] = [
  { name: "src", path: "/project/src", is_dir: true, size: 0, modified: 1711152000, is_hidden: false, is_symlink: false, extension: "" },
  { name: "tests", path: "/project/tests", is_dir: true, size: 0, modified: 1711152000, is_hidden: false, is_symlink: false, extension: "" },
  { name: "package.json", path: "/project/package.json", is_dir: false, size: 1234, modified: 1711152000, is_hidden: false, is_symlink: false, extension: "json" },
  { name: "tsconfig.json", path: "/project/tsconfig.json", is_dir: false, size: 567, modified: 1711152000, is_hidden: false, is_symlink: false, extension: "json" },
  { name: ".gitignore", path: "/project/.gitignore", is_dir: false, size: 45, modified: 1711152000, is_hidden: true, is_symlink: false, extension: "" },
];

const MOCK_SRC_CHILDREN: DirEntry[] = [
  { name: "App.tsx", path: "/project/src/App.tsx", is_dir: false, size: 2048, modified: 1711152000, is_hidden: false, is_symlink: false, extension: "tsx" },
  { name: "index.ts", path: "/project/src/index.ts", is_dir: false, size: 128, modified: 1711152000, is_hidden: false, is_symlink: false, extension: "ts" },
];

describe("FileTreeItem", () => {
  it("renders a file with name and size", () => {
    const onClick = vi.fn();
    render(
      <FileTreeItem
        name="package.json"
        path="/project/package.json"
        isDir={false}
        size={1234}
        isHidden={false}
        isSymlink={false}
        extension="json"
        depth={0}
        isExpanded={false}
        isSelected={false}
        onClick={onClick}
      />,
    );
    expect(screen.getByText("package.json")).toBeDefined();
    expect(screen.getByText("1 KB")).toBeDefined();
  });

  it("renders a folder with bold name", () => {
    render(
      <FileTreeItem
        name="src"
        path="/project/src"
        isDir={true}
        size={0}
        isHidden={false}
        isSymlink={false}
        extension=""
        depth={0}
        isExpanded={false}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    const nameEl = screen.getByText("src");
    expect(nameEl.className).toContain("dir");
  });

  it("calls onClick with path and isDir", () => {
    const onClick = vi.fn();
    render(
      <FileTreeItem
        name="src"
        path="/project/src"
        isDir={true}
        size={0}
        isHidden={false}
        isSymlink={false}
        extension=""
        depth={0}
        isExpanded={false}
        isSelected={false}
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByText("src"));
    expect(onClick).toHaveBeenCalledWith("/project/src", true);
  });

  it("applies selected class when isSelected=true", () => {
    render(
      <FileTreeItem
        name="file.ts"
        path="/file.ts"
        isDir={false}
        size={100}
        isHidden={false}
        isSymlink={false}
        extension="ts"
        depth={0}
        isExpanded={false}
        isSelected={true}
        onClick={vi.fn()}
      />,
    );
    const item = screen.getByRole("treeitem");
    expect(item.className).toContain("selected");
  });

  it("shows symlink indicator", () => {
    render(
      <FileTreeItem
        name="link"
        path="/link"
        isDir={false}
        size={0}
        isHidden={false}
        isSymlink={true}
        extension=""
        depth={0}
        isExpanded={false}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText("→")).toBeDefined();
  });

  it("applies hidden class for dotfiles", () => {
    render(
      <FileTreeItem
        name=".env"
        path="/.env"
        isDir={false}
        size={10}
        isHidden={true}
        isSymlink={false}
        extension="env"
        depth={0}
        isExpanded={false}
        isSelected={false}
        onClick={vi.fn()}
      />,
    );
    const item = screen.getByRole("treeitem");
    expect(item.className).toContain("hidden");
  });
});

describe("FileTree", () => {
  beforeEach(() => {
    mockFsListDir.mockReset();
  });

  it("shows loading skeleton initially", () => {
    mockFsListDir.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <FileTree
        rootPath="/project"
        selectedPath={null}
        onFileOpen={vi.fn()}
      />,
    );
    const skeletons = document.querySelectorAll(".fe-tree__skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders root entries after loading", async () => {
    mockFsListDir.mockResolvedValue(MOCK_ENTRIES);
    render(
      <FileTree
        rootPath="/project"
        selectedPath={null}
        onFileOpen={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("src")).toBeDefined();
      expect(screen.getByText("package.json")).toBeDefined();
      expect(screen.getByText(".gitignore")).toBeDefined();
    });
  });

  it("shows error state on failure", async () => {
    mockFsListDir.mockRejectedValue(new Error("Permission denied"));
    render(
      <FileTree
        rootPath="/project"
        selectedPath={null}
        onFileOpen={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeDefined();
    });
  });

  it("shows empty state for empty directory", async () => {
    mockFsListDir.mockResolvedValue([]);
    render(
      <FileTree
        rootPath="/empty"
        selectedPath={null}
        onFileOpen={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("This folder is empty")).toBeDefined();
    });
  });

  it("calls onFileOpen when a file is clicked", async () => {
    mockFsListDir.mockResolvedValue(MOCK_ENTRIES);
    const onFileOpen = vi.fn();
    render(
      <FileTree
        rootPath="/project"
        selectedPath={null}
        onFileOpen={onFileOpen}
      />,
    );
    await waitFor(() => screen.getByText("package.json"));
    fireEvent.click(screen.getByText("package.json"));
    expect(onFileOpen).toHaveBeenCalledWith("/project/package.json");
  });

  it("expands a directory and loads children on click", async () => {
    mockFsListDir
      .mockResolvedValueOnce(MOCK_ENTRIES) // root
      .mockResolvedValueOnce(MOCK_SRC_CHILDREN); // src children

    render(
      <FileTree
        rootPath="/project"
        selectedPath={null}
        onFileOpen={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByText("src"));

    fireEvent.click(screen.getByText("src"));

    await waitFor(() => {
      expect(screen.getByText("App.tsx")).toBeDefined();
      expect(screen.getByText("index.ts")).toBeDefined();
    });

    expect(mockFsListDir).toHaveBeenCalledWith("/project/src");
  });

  it("filters files by name", async () => {
    mockFsListDir.mockResolvedValue(MOCK_ENTRIES);
    render(
      <FileTree
        rootPath="/project"
        selectedPath={null}
        onFileOpen={vi.fn()}
        filterText="package"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("package.json")).toBeDefined();
    });
    // Directories always show, files that don't match are hidden
    expect(screen.getByText("src")).toBeDefined(); // dirs always visible
    expect(screen.queryByText("tsconfig.json")).toBeNull(); // filtered out
  });

  it("navigates with arrow keys", async () => {
    mockFsListDir.mockResolvedValue(MOCK_ENTRIES);
    const onSelectChange = vi.fn();
    render(
      <FileTree
        rootPath="/project"
        selectedPath="/project/src"
        onFileOpen={vi.fn()}
        onSelectChange={onSelectChange}
      />,
    );
    await waitFor(() => screen.getByText("src"));

    const tree = screen.getByRole("tree");
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    expect(onSelectChange).toHaveBeenCalledWith("/project/tests");
  });
});
