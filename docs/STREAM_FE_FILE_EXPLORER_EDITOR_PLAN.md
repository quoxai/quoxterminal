# Stream FE — File Explorer + Editor

**Goal:** Collapsible file tree sidebar with quick edit capability and Claude chat-assisted editing. Stay a terminal, not an IDE — let Claude be the intelligence layer.

**Estimated scope:** 8 phases, ~25 new files, 100+ tests
**Design spec:** `docs/FILE_EXPLORER_EDITOR_DESIGN_SPEC.md` (full token set, component specs, animation timings)

---

## Design Principles

1. **Terminal-first** — the file explorer is a sidebar tool, not the main event
2. **Claude is the editor brain** — no LSP, no autocomplete, no extensions. Users ask Claude to make edits
3. **Quick edits only** — for config tweaks, log viewing, Claude-suggested changes
4. **Chat-assisted editing** — select text in editor, "Ask Claude about this", one-click apply
5. **Premium feel** — Warp's depth-through-opacity, Linear's restraint, Zed's speed, Cursor's native AI UX

---

## Architecture

### Layout: Left Sidebar + Right Editor

```
┌──────────────────────────────────────────────────────────────────────┐
│  QuoxTerminal          [layouts] [sessions] [zoom]    [icons] [gear]│  Header
├───────────┬──────────────────────────────┬───────────────────────────┤
│ EXPLORER  │  ● Workspace 1 × │ Ws 2 × │ +                          │  Tab bar
├───────────┤──────────────────────────────┴───────────────────────────┤
│ ▾ src     │                                                         │
│   ▾ comp  │  Terminal pane(s)                                       │
│     App.tx│  (or editor pane when file is opened)                   │
│     index │                                                         │
│   ▸ hooks │                                                         │
│ package.js│                                                         │
│ tsconfig  │                                                         │
├───────────┤                                                         │
│           │                                                         │
│           │                                                         │
└───────────┴─────────────────────────────────────────────────────────┘
```

- File tree: **left sidebar**, resizable (240px default, 180-400px range)
- Follows existing sidebar toggle pattern (like FleetDashboard/TerminalChat/ToolPalette)
- When a file is opened: replaces terminal in focused pane OR opens in split
- Sidebar auto-closes on workspace switch (consistent with other sidebars)

### Backend (Rust)

One new Tauri command: `fs_list_dir`. Everything else exists:
- `fs_read_file` — reads UTF-8 content
- `fs_write_file` — writes with optional `.quox-backup`
- `fs_delete_file` — deletes with optional backup
- `fs_rename_file` — moves/renames with auto-mkdir
- Path validation (green/amber/red/blocked) — in `validation.rs`

### Editor: CodeMirror 6

- ~160KB total (vs Monaco's ~2MB)
- Lazy language loading via `@codemirror/language-data` (30+ languages, zero initial bundle cost)
- Custom Quox theme matching terminal palette
- `@codemirror/merge` for inline diff view (chat-assisted edits)
- `Compartment` API for live theme/language/readOnly swaps without editor recreation

---

## Phases

### Phase 1: Design Foundation + Rust Backend

**New CSS token system** — ship the design spec's custom properties as a foundation for all new components.

**New files:**
- `src/styles/tokens.css` — complete CSS custom property set from design spec
- `src-tauri/src/fs/operations.rs` — add `list_dir()` returning `Vec<DirEntry>`
- `src-tauri/src/commands.rs` — register `fs_list_dir` command
- `src/lib/tauri-fs.ts` — frontend wrappers for all fs commands
- `src/__tests__/tauriFs.test.ts`

**DirEntry struct:**
```rust
#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,      // unix timestamp
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub extension: String,  // for file type icon mapping
}
```

Sort: directories first, then alphabetical. Hidden files at bottom.

**Deliverables:** Rust command tested via Tauri invoke, frontend wrappers, CSS token file imported in App.css.

---

### Phase 2: File Tree Sidebar

The tree is the heart of the feature. Must feel fast, tactile, and beautiful.

**New files:**
- `src/components/files/FileExplorer.tsx` — sidebar container (header + search + tree + footer)
- `src/components/files/FileExplorer.css`
- `src/components/files/FileTree.tsx` — recursive tree with lazy-load on expand
- `src/components/files/FileTreeItem.tsx` — single row component (icon + label + badge)
- `src/components/files/fileIcons.ts` — extension-to-icon mapping (unicode + color)
- `src/pages/TerminalView.tsx` — add toggle state, header button, sidebar render
- `src/config/terminalConfig.ts` — add Cmd+Shift+E shortcut
- `src/__tests__/FileTree.test.tsx`, `src/__tests__/FileExplorer.test.tsx`

**Tree visual spec (from design spec):**
```
┌─────────────────────────────────┐
│ EXPLORER              ⟳  ⚙  ✕  │  11px caps, font-weight 600
│─────────────────────────────────│
│ 🔍 Filter files...             │  Search input, 28px height
│─────────────────────────────────│
│ ▾ 📁 src                       │  Bold folder name, colored icon
│ │ ▾ 📁 components              │  16px indent per level
│ │ │  TS App.tsx            M   │  File type icon colored, M = amber
│ │ │  TS index.ts               │  28px row height
│ │ └  JS utils.js           A   │  A = green (added)
│ ▸ 📁 tests                     │  Collapsed: chevron right
│   {} package.json               │  Root level: 12px left padding
│   ⚙ tsconfig.json              │
│                                 │
│─────────────────────────────────│
│  12 files, 3 folders            │  Footer: file count, total size
└─────────────────────────────────┘
```

**Interactions:**
- **Click file** → emits `onFileOpen(path)` to TerminalView
- **Click folder** → expand/collapse with 150ms height animation
- **Right-click** → context menu (Open, Copy Path, Rename, Delete, Send to Chat)
- **Arrow keys** → navigate tree, Enter to open/expand
- **Backspace** → navigate up one level
- **Filter input** → fuzzy match, highlights matching chars in filenames
- **Drag resize handle** → resize sidebar width (persisted in settings)

**Indent guides:**
- 1px vertical lines at each indent level
- Default: `rgba(255,255,255,0.06)` (barely visible)
- Active guide (ancestor of selected file): `rgba(255,255,255,0.10)` (slightly brighter)

**Hover state:** Full-width `rgba(255,255,255,0.05)` background, no border-radius (VS Code pattern — cleaner than rounded hovers in a tree).

**Selected state:** `rgba(34,211,238,0.10)` background with `border-left: 2px solid #22D3EE`.

**Loading:** Skeleton shimmer (8-12 rows, staggered 30ms) while `fs_list_dir` resolves. Children lazy-load on first expand only.

**File type icons** (unicode with explicit colors, never currentColor):
```
TypeScript:  TS  #3178C6       Rust:    🦀 #CE422B
JavaScript:  JS  #D4A017       Python:  Py  #3776AB
React/JSX:   ⚛   #61DAFB       Go:     Go  #00ADD8
JSON:        {}  #A8B1C2       YAML:    ⚙   #8B6914
Markdown:    M↓  #7B8794       HTML:    <>  #E44D26
CSS:         #   #264DE4       Shell:   $   #4EAA25
Config:      ⚙   #7B8794       Folder:  📁  #38bdf8
```

---

### Phase 3: Editor Pane Mode (Read-Only Viewer)

Files open inside the existing pane system as a new mode. No separate window — a pane switches from "terminal" to "editor" when you open a file.

**New files:**
- `src/components/files/FileEditor.tsx` — CodeMirror 6 React wrapper
- `src/components/files/FileEditor.css`
- `src/components/files/FileEditorTabs.tsx` — open file tab bar with dirty indicators
- `src/components/files/quoxEditorTheme.ts` — custom CM6 theme matching terminal palette
- `src/__tests__/FileEditor.test.tsx`

**Modify:**
- `src/components/terminal/TerminalPane.tsx` — add `"editor"` mode branch
- `src/hooks/useTerminalWorkspace.ts` — extend PaneState with `editorFiles` array

**CodeMirror theme (Quox Dark):**
```
Keywords:     #a78bfa (violet)
Functions:    #38bdf8 (cyan)
Strings:      #a5d6a7 (soft green)
Numbers:      #ffcc80 (warm amber)
Comments:     #5c6370 (gray, italic)
Types:        #38bdf8 (cyan)
Properties:   #7dd3fc (light cyan)
Operators:    #38bdf8 (cyan)
Punctuation:  #6a7380 (muted)
Tags (HTML):  #a78bfa (violet)
Attributes:   #7dd3fc (light cyan)
Invalid:      #ef5350 (red, strikethrough)

Background:   #0a0e14
Foreground:   #b3b1ad
Cursor:       #38bdf8
Selection:    #1a1f29
Active line:  #0d1117
Gutter fg:    #4a4a4a
Gutter active:#38bdf8
Match bracket:rgba(56,189,248,0.19)
```

**Tab bar spec:**
```
┌──────────────┬──────────────┬──────────────┬────────────────────────┐
│ TS App.tsx ● ✕│  {} pkg.json ✕│  ⚙ tsconfig ✕│                        │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│  src › components › App.tsx                                         │  Breadcrumbs
└─────────────────────────────────────────────────────────────────────┘
```
- Active tab: `border-top: 2px solid #22D3EE`, editor background
- Inactive tab: surface background, secondary text
- Modified indicator: 8px cyan dot replacing close icon until hover
- Tabs overflow: horizontal scroll with 24px edge fade gradient
- Breadcrumbs: `path › segments › current` — last segment bold, each clickable

**Viewer features:**
- Syntax highlighting (lazy-loaded per language)
- Line numbers (current line highlighted cyan)
- Bracket matching with subtle highlight
- Fold gutters (collapse code blocks)
- Active line highlight
- Word wrap toggle
- File size + line count in footer
- Path validation badge (green/amber/red) in tab

**npm dependencies (Phase 3):**
```
codemirror                    — core + basicSetup
@codemirror/language-data     — lazy language loading (30+ langs)
@codemirror/merge             — unified diff (Phase 5)
@uiw/codemirror-themes        — createTheme() utility
```

---

### Phase 4: Quick Edit Mode

Toggle from read-only to editable. This is where it becomes useful for real work.

**Modify:**
- `src/components/files/FileEditor.tsx` — add edit toggle, save, revert
- `src/components/files/UnsavedChangesModal.tsx` (new) — confirm discard
- `src/__tests__/FileEditorEdit.test.tsx`

**Edit features:**
- "Edit" toggle button in editor header (pencil icon → checkmark when editing)
- Cmd+S saves via `fs_write_file` with `backup: true` (creates `.quox-backup`)
- Dirty indicator: 8px cyan dot on tab
- Diff gutter: changed lines get green/red left border (3px)
- Revert button: re-reads from disk, replaces buffer
- Undo/redo: built into CodeMirror
- Unsaved changes warning on tab close, sidebar close, workspace switch
- Path severity check before save — block writes to Red/Blocked paths
- Cmd+Z undo, Cmd+Shift+Z redo (CM6 defaults)

**Save flow:**
1. User presses Cmd+S
2. Path validation check — if Red/Blocked, show warning modal and block
3. If Amber, show "Caution: editing system path" but allow
4. `fs_write_file(path, content, backup: true)` — creates `.quox-backup` first
5. On success: clear dirty flag, flash green checkmark in tab for 1.5s
6. On failure: show error toast with the Rust error message

---

### Phase 5: Chat-Assisted Editing

The killer feature. Select code, ask Claude, apply the suggestion with one click.

**New files:**
- `src/components/files/AskClaudeButton.tsx` — floating action button on text selection
- `src/components/files/AskClaudeButton.css`
- `src/__tests__/AskClaudeButton.test.tsx`

**Modify:**
- `src/components/files/FileEditor.tsx` — selection detection, context injection
- `src/components/terminal/TerminalChat.tsx` — accept file context, route edits back to editor

**The flow:**

```
1. User selects code in editor
   ↓
2. Floating "Ask Claude" button appears above selection (150ms fade-in)
   ↓
3. User clicks button → chat sidebar opens
   ↓
4. Chat pre-populates with file context:
   ┌──────────────────────────────────────┐
   │ I'm editing `src/components/App.tsx` │
   │ (lines 42-58).                       │
   │                                      │
   │ ```tsx                               │
   │ const handleSubmit = async () => {   │
   │   const result = await api.post(...) │
   │   ...                                │
   │ }                                    │
   │ ```                                  │
   │                                      │
   │ [cursor — user types their request]  │
   └──────────────────────────────────────┘
   ↓
5. Claude responds with FileChangeCard (existing component)
   ↓
6. User clicks "Apply" on the FileChangeCard
   ↓
7. Change applies to the editor BUFFER (not disk yet)
   Shows as inline diff: green = added, red = removed
   ↓
8. User reviews the diff in the editor
   ↓
9. Cmd+S to save (with backup), or Cmd+Z to undo
```

**Bidirectional integration:**
- **Editor → Chat:** selection context sent as structured message
- **Chat → Editor:** FileChangeCard "Apply" pushes changes into open editor buffer via `@codemirror/merge` unified diff view
- If file is already open in editor AND Claude suggests an edit to that file, show it as an inline diff automatically

**"Ask Claude" button spec:**
- Position: floats above the selection, centered horizontally
- Style: pill shape, `rgba(167,139,250,0.15)` background (violet), violet border
- Icon: ✦ (sparkle) + "Ask Claude" text, 12px
- Hover: `rgba(167,139,250,0.25)` background, slight scale(1.03)
- Dismiss: fades out 100ms on click elsewhere or selection change

---

### Phase 6: Context Menu

Right-click on tree items, tabs, and editor for actions.

**New files:**
- `src/components/files/ContextMenu.tsx` — shared context menu component
- `src/components/files/ContextMenu.css`
- `src/__tests__/ContextMenu.test.tsx`

**Tree context menu items:**
```
 Open                          Enter
 ─────────────────────────────────
 Copy Path                    ⌘C
 Copy Relative Path        ⌘⇧C
 ─────────────────────────────────
 Rename                         F2
 Delete                        ⌘⌫
 ─────────────────────────────────
 Send to Chat                  ⌘.
 ─────────────────────────────────
 Reveal in Finder              ⌘⇧R
```

**Tab context menu:**
```
 Close                         ⌘W
 Close Others
 Close All
 ─────────────────────────────────
 Copy Path
 ─────────────────────────────────
 Send to Chat                  ⌘.
```

**Editor context menu:**
```
 Ask Claude                    ⌘.
 ─────────────────────────────────
 Cut                           ⌘X
 Copy                          ⌘C
 Paste                         ⌘V
 ─────────────────────────────────
 Select All                    ⌘A
 ─────────────────────────────────
 Go to Line                    ⌘G
```

**Styling:** Backdrop blur, rounded corners (8px), subtle shadow. Entry animation: opacity + translateY(-4px) in 150ms.

---

### Phase 7: Search + Navigation

**New files:**
- `src/components/files/QuickOpen.tsx` — Cmd+P file picker (command palette style)
- `src/components/files/QuickOpen.css`
- `src/components/files/GoToLine.tsx` — Cmd+G line picker
- `src/__tests__/QuickOpen.test.tsx`

**Quick Open (Cmd+P):**
- Centered overlay modal (like VS Code's command palette)
- Input at top: fuzzy search across all files in CWD
- Results below: file name (bold match chars) + relative path (muted)
- Enter to open, Escape to dismiss
- Recent files at top when input is empty
- Max 20 results, virtual scrolled

**Go to Line (Cmd+G):**
- Small input modal: "Go to line: [___]"
- Enter to jump, Escape to cancel
- Shows current line / total lines

**In-file search (Cmd+F):**
- Built into CodeMirror via `@codemirror/search`
- Theme the search panel to match Quox aesthetic
- Match count display, next/prev navigation

---

### Phase 8: Polish + Performance

**New files:**
- `src/components/files/BinaryFileGuard.tsx` — "Binary file, cannot display" message
- `src/components/files/LargeFileGuard.tsx` — "File is X MB. Open anyway?" prompt

**Polish items:**
- Editor font size follows terminal zoom (Cmd+=/-)
- Remember open files per workspace (persist in PaneState)
- File watcher: detect external changes, show "File changed on disk. Reload?" banner
- Binary file detection (check first 8KB for null bytes) — show guard instead of garbage
- Large file guard: warn > 1MB, refuse > 10MB
- Smooth scroll in editor (`scroll-behavior: smooth` on `.cm-scroller`)
- Indent guides via ViewPlugin decoration (vendor the community gist, ~150 lines)
- Compact density mode option (reduce all spacing by ~20%)
- Keyboard shortcut cheat sheet update (add file explorer shortcuts)

**Performance targets:**
- File tree: < 200ms for directories with < 500 entries
- Editor open: < 100ms for files < 1MB
- Language detection + syntax load: < 300ms (lazy import)
- Skeleton shimmer during any load > 100ms

---

## File Layout

```
src/
  styles/
    tokens.css                      # Design token custom properties

  components/files/
    FileExplorer.tsx                # Sidebar container
    FileExplorer.css
    FileTree.tsx                    # Recursive directory tree
    FileTreeItem.tsx                # Single tree row
    FileEditor.tsx                  # CodeMirror 6 wrapper
    FileEditor.css
    FileEditorTabs.tsx              # Open file tab bar
    UnsavedChangesModal.tsx         # Confirm discard changes
    AskClaudeButton.tsx             # Floating "Ask Claude" on selection
    AskClaudeButton.css
    ContextMenu.tsx                 # Shared context menu
    ContextMenu.css
    QuickOpen.tsx                   # Cmd+P file picker
    QuickOpen.css
    GoToLine.tsx                    # Cmd+G line picker
    BinaryFileGuard.tsx             # Binary file message
    LargeFileGuard.tsx              # Large file warning
    fileIcons.ts                    # Extension → icon + color mapping
    quoxEditorTheme.ts              # Custom CM6 theme

  lib/
    tauri-fs.ts                     # Tauri invoke wrappers for fs commands

  __tests__/
    tauriFs.test.ts
    FileTree.test.tsx
    FileExplorer.test.tsx
    FileEditor.test.tsx
    FileEditorEdit.test.tsx
    AskClaudeButton.test.tsx
    ContextMenu.test.tsx
    QuickOpen.test.tsx
```

---

## npm Dependencies

| Package | Size (gzip) | Purpose |
|---------|-------------|---------|
| `codemirror` | ~45KB | Core + basicSetup |
| `@codemirror/language-data` | ~5KB loader | Lazy language loading (30+ langs) |
| `@codemirror/merge` | ~15KB | Unified + side-by-side diff |
| `@uiw/codemirror-themes` | ~3KB | `createTheme()` utility |
| `@lezer/highlight` | (bundled) | Syntax tag definitions |
| **Total initial** | **~70KB** | Languages load on demand |

---

## What We Are NOT Building

- LSP / language server integration
- Autocomplete / IntelliSense
- Extension marketplace for editor plugins
- Git integration in the file tree (use the terminal)
- Remote file editing over SSH (local files only, for now)
- Minimap (defer — evaluate after Phase 3)
- Multi-cursor editing advertising (CM6 supports it natively, we just don't highlight it)
- File search across directories (use grep in terminal)
- AI ghost text / tab completion (Cursor-style — defer to future stream)

---

## Success Criteria

- File tree loads in < 200ms for directories with < 500 entries
- Editor opens files < 1MB in < 100ms
- Zoom controls apply to editor (follows terminal font size setting)
- Chat-assisted edit round-trip: select → ask → apply → save in under 10 seconds
- No accidental writes: read-only by default, path validation on save, backup on write
- 100+ tests across 8 test files
- Premium feel: smooth animations, consistent token usage, pixel-perfect alignment on 4px grid

---

## Reference Documents

- `docs/FILE_EXPLORER_EDITOR_DESIGN_SPEC.md` — full visual spec (colors, typography, spacing, animations, component mockups)
- Design research: Warp, Zed, VS Code Dark Modern, Cursor, Linear, Vercel Geist
- CodeMirror 6 theming: custom `EditorView.theme()` + `HighlightStyle.define()` with Quox palette
- CodeMirror 6 React pattern: `Compartment` for live reconfiguration, mount once, never recreate
