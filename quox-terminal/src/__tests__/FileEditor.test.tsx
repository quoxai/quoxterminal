/**
 * FileEditor.test.tsx — Tests for FileEditor, FileEditorTabs, and quoxEditorTheme.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FileEditorTabs, { type OpenFile } from "../components/files/FileEditorTabs";
import { getFileIcon } from "../components/files/fileIcons";

// Note: CodeMirror 6 requires a full DOM environment to mount.
// We test the tabs/breadcrumbs (pure React) and icon mapping here.
// The CM6 editor component is tested via integration/e2e on the Mac build.

const MOCK_FILES: OpenFile[] = [
  { path: "/project/src/App.tsx", name: "App.tsx", dirty: false },
  { path: "/project/src/index.ts", name: "index.ts", dirty: true },
  { path: "/project/package.json", name: "package.json", dirty: false },
];

describe("FileEditorTabs", () => {
  it("renders all open file tabs", () => {
    render(
      <FileEditorTabs
        files={MOCK_FILES}
        activeFilePath="/project/src/App.tsx"
        onSelectFile={vi.fn()}
        onCloseFile={vi.fn()}
      />,
    );
    const tabs = document.querySelectorAll(".fe-editor-tab");
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent).toContain("App.tsx");
    expect(tabs[1].textContent).toContain("index.ts");
    expect(tabs[2].textContent).toContain("package.json");
  });

  it("highlights the active tab", () => {
    render(
      <FileEditorTabs
        files={MOCK_FILES}
        activeFilePath="/project/src/App.tsx"
        onSelectFile={vi.fn()}
        onCloseFile={vi.fn()}
      />,
    );
    const tabs = document.querySelectorAll(".fe-editor-tab");
    expect(tabs[0].className).toContain("active");
    expect(tabs[1].className).not.toContain("active");
  });

  it("shows dirty indicator for modified files", () => {
    render(
      <FileEditorTabs
        files={MOCK_FILES}
        activeFilePath="/project/src/App.tsx"
        onSelectFile={vi.fn()}
        onCloseFile={vi.fn()}
      />,
    );
    // index.ts is dirty and not active — should show dot
    const dirtyDot = document.querySelector(".fe-editor-tab__dirty");
    expect(dirtyDot).not.toBeNull();
    expect(dirtyDot?.textContent).toBe("●");
  });

  it("calls onSelectFile when clicking a tab", () => {
    const onSelectFile = vi.fn();
    render(
      <FileEditorTabs
        files={MOCK_FILES}
        activeFilePath="/project/src/App.tsx"
        onSelectFile={onSelectFile}
        onCloseFile={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("package.json"));
    expect(onSelectFile).toHaveBeenCalledWith("/project/package.json");
  });

  it("calls onCloseFile when clicking close button", () => {
    const onCloseFile = vi.fn();
    render(
      <FileEditorTabs
        files={MOCK_FILES}
        activeFilePath="/project/src/App.tsx"
        onSelectFile={vi.fn()}
        onCloseFile={onCloseFile}
      />,
    );
    // Close buttons are on non-dirty tabs
    const closeButtons = document.querySelectorAll(".fe-editor-tab__close");
    // Click first close button (App.tsx — active tab)
    fireEvent.click(closeButtons[0]);
    expect(onCloseFile).toHaveBeenCalledWith("/project/src/App.tsx");
  });

  it("renders breadcrumb for active file", () => {
    render(
      <FileEditorTabs
        files={MOCK_FILES}
        activeFilePath="/project/src/App.tsx"
        onSelectFile={vi.fn()}
        onCloseFile={vi.fn()}
      />,
    );
    const breadcrumb = document.querySelector(".fe-editor-breadcrumb");
    expect(breadcrumb).not.toBeNull();
    // Should contain path segments
    expect(breadcrumb?.textContent).toContain("project");
    expect(breadcrumb?.textContent).toContain("src");
    expect(breadcrumb?.textContent).toContain("App.tsx");
  });

  it("renders breadcrumb separators", () => {
    render(
      <FileEditorTabs
        files={MOCK_FILES}
        activeFilePath="/project/src/App.tsx"
        onSelectFile={vi.fn()}
        onCloseFile={vi.fn()}
      />,
    );
    const seps = document.querySelectorAll(".fe-editor-breadcrumb__sep");
    // project > src > App.tsx = 2 separators
    expect(seps.length).toBe(2);
  });

  it("shows no breadcrumb when no file is active", () => {
    render(
      <FileEditorTabs
        files={MOCK_FILES}
        activeFilePath={null}
        onSelectFile={vi.fn()}
        onCloseFile={vi.fn()}
      />,
    );
    const breadcrumb = document.querySelector(".fe-editor-breadcrumb");
    expect(breadcrumb).toBeNull();
  });
});

describe("fileIcons", () => {
  it("returns TypeScript icon for .tsx files", () => {
    const icon = getFileIcon("App.tsx", false);
    expect(icon.icon).toBe("TS");
    expect(icon.color).toBe("#3178c6");
  });

  it("returns folder icon for directories", () => {
    const icon = getFileIcon("src", true, false);
    expect(icon.icon).toBe("▸");
  });

  it("returns open folder icon when expanded", () => {
    const icon = getFileIcon("src", true, true);
    expect(icon.icon).toBe("▾");
  });

  it("returns JSON icon for package.json", () => {
    const icon = getFileIcon("package.json", false);
    expect(icon.icon).toBe("📦");
    expect(icon.label).toBe("npm Package");
  });

  it("returns Rust icon for .rs files", () => {
    const icon = getFileIcon("main.rs", false);
    expect(icon.icon).toBe("Rs");
    expect(icon.color).toBe("#ce422b");
  });

  it("returns default icon for unknown extensions", () => {
    const icon = getFileIcon("mystery.xyz", false);
    expect(icon.icon).toBe("·");
  });

  it("matches Dockerfile by exact filename", () => {
    const icon = getFileIcon("Dockerfile", false);
    expect(icon.icon).toBe("🐳");
  });

  it("matches .gitignore by exact filename", () => {
    const icon = getFileIcon(".gitignore", false);
    expect(icon.icon).toBe("G");
    expect(icon.color).toBe("#f05032");
  });
});
