/**
 * FileExplorer.test.tsx — Tests for the FileExplorer sidebar container.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FileExplorer from "../components/files/FileExplorer";

// Mock fsListDir
const mockFsListDir = vi.fn();
vi.mock("../lib/tauri-fs", () => ({
  fsListDir: (...args: unknown[]) => mockFsListDir(...args),
}));

const MOCK_ENTRIES = [
  { name: "src", path: "/project/src", is_dir: true, size: 0, modified: 1711152000, is_hidden: false, is_symlink: false, extension: "" },
  { name: "package.json", path: "/project/package.json", is_dir: false, size: 1234, modified: 1711152000, is_hidden: false, is_symlink: false, extension: "json" },
];

describe("FileExplorer", () => {
  beforeEach(() => {
    mockFsListDir.mockReset();
    mockFsListDir.mockResolvedValue(MOCK_ENTRIES);
  });

  it("renders header with EXPLORER title", async () => {
    render(
      <FileExplorer
        rootPath="/project"
        onFileOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("EXPLORER")).toBeDefined();
  });

  it("renders filter input", async () => {
    render(
      <FileExplorer
        rootPath="/project"
        onFileOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Filter files...");
    expect(input).toBeDefined();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <FileExplorer
        rootPath="/project"
        onFileOpen={onClose}
        onClose={onClose}
      />,
    );
    // Close button is the ✕
    const buttons = screen.getAllByTitle(/Close/i);
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows tree entries after loading", async () => {
    render(
      <FileExplorer
        rootPath="/project"
        onFileOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("src")).toBeDefined();
      expect(screen.getByText("package.json")).toBeDefined();
    });
  });

  it("filters tree entries when typing in filter", async () => {
    render(
      <FileExplorer
        rootPath="/project"
        onFileOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByText("package.json"));

    const input = screen.getByPlaceholderText("Filter files...");
    fireEvent.change(input, { target: { value: "package" } });

    // Directories always show, non-matching files hidden
    await waitFor(() => {
      expect(screen.getByText("package.json")).toBeDefined();
      expect(screen.getByText("src")).toBeDefined(); // dirs always visible
    });
  });

  it("shows clear button when filter has text", async () => {
    render(
      <FileExplorer
        rootPath="/project"
        onFileOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Filter files...");
    fireEvent.change(input, { target: { value: "test" } });

    const clearBtn = screen.getByTitle("Clear filter");
    expect(clearBtn).toBeDefined();

    fireEvent.click(clearBtn);
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("refreshes tree when refresh button is clicked", async () => {
    render(
      <FileExplorer
        rootPath="/project"
        onFileOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByText("src"));

    expect(mockFsListDir).toHaveBeenCalledTimes(1);

    const refreshBtn = screen.getByTitle("Refresh");
    fireEvent.click(refreshBtn);

    // Should re-fetch
    await waitFor(() => {
      expect(mockFsListDir).toHaveBeenCalledTimes(2);
    });
  });

  it("calls onFileOpen when a file is clicked", async () => {
    const onFileOpen = vi.fn();
    render(
      <FileExplorer
        rootPath="/project"
        onFileOpen={onFileOpen}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => screen.getByText("package.json"));

    fireEvent.click(screen.getByText("package.json"));
    expect(onFileOpen).toHaveBeenCalledWith("/project/package.json");
  });

  it("shows shortened breadcrumb for deep paths", () => {
    render(
      <FileExplorer
        rootPath="/home/user/projects/quoxterminal/quox-terminal"
        onFileOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    // Should show shortened path (last 2 segments)
    const breadcrumb = document.querySelector(".fe-explorer__breadcrumb");
    expect(breadcrumb?.textContent).toContain("quoxterminal/quox-terminal");
  });
});
