# File Explorer + Editor Design Spec

Premium dark-theme design reference for QuoxTerminal's file explorer sidebar and code editor. Derived from analysis of Warp, Zed, VS Code, Cursor, Ghostty, Fig/Amazon Q, Linear, and Vercel Geist.

---

## 1. Color System

### Base Palette (Dark Theme)

Drawn from VS Code Dark Modern, Warp dark surfaces, Linear dark mode, and Vercel Geist.

```
/* Backgrounds — layered from darkest to lightest */
--bg-base:          #0F0F11;    /* App chrome, deepest layer */
--bg-surface:       #151518;    /* Sidebar background */
--bg-elevated:      #1A1A1E;    /* Panels, dropdowns, context menus */
--bg-overlay:       #1F1F24;    /* Modals, command palette */
--bg-editor:        #18181B;    /* Editor pane background */

/* Brand accents — cyan/violet */
--accent-cyan:      #22D3EE;    /* Primary accent (cyan-400) */
--accent-cyan-dim:  #0891B2;    /* Cyan-600, muted usage */
--accent-violet:    #A78BFA;    /* Secondary accent (violet-400) */
--accent-violet-dim:#7C3AED;    /* Violet-600, muted usage */

/* Text hierarchy */
--text-primary:     rgba(255, 255, 255, 0.92);   /* File names, headings */
--text-secondary:   rgba(255, 255, 255, 0.68);   /* Descriptions, metadata */
--text-tertiary:    rgba(255, 255, 255, 0.45);   /* Placeholders, disabled */
--text-ghost:       rgba(255, 255, 255, 0.28);   /* Ghost text, AI suggestions */

/* Borders */
--border-subtle:    rgba(255, 255, 255, 0.06);   /* Dividers between sections */
--border-default:   rgba(255, 255, 255, 0.10);   /* Panel borders, separators */
--border-strong:    rgba(255, 255, 255, 0.16);   /* Focus rings, active borders */
--border-accent:    rgba(34, 211, 238, 0.40);    /* Focused input, active tab top */

/* Interactive states */
--hover-bg:         rgba(255, 255, 255, 0.05);   /* List item hover */
--active-bg:        rgba(255, 255, 255, 0.08);   /* Pressed/active state */
--selected-bg:      rgba(34, 211, 238, 0.10);    /* Selected file in tree */
--selected-bg-inactive: rgba(255, 255, 255, 0.06); /* Selection when sidebar unfocused */

/* Semantic */
--success:          #2EA043;    /* Git added, success indicators */
--warning:          #D29922;    /* Modified, caution */
--error:            #F85149;    /* Deleted, error states */
--info:             #58A6FF;    /* Info badges */

/* Diff colors (Cursor-style) */
--diff-added-bg:    rgba(46, 160, 67, 0.15);
--diff-added-border:rgba(46, 160, 67, 0.40);
--diff-removed-bg:  rgba(248, 81, 73, 0.15);
--diff-removed-border:rgba(248, 81, 73, 0.40);
```

### Contrast Rules

- Primary text on `--bg-surface`: minimum 7:1 ratio (WCAG AAA).
- Secondary text on `--bg-surface`: minimum 4.5:1 ratio (WCAG AA).
- Accent colors on dark backgrounds: always at 400 weight or lighter (never 700+ on dark bg).
- NEVER use `currentColor` for SVG icons — always explicit `rgba(255,255,255,0.8)` minimum.

---

## 2. Typography

### Font Stack

```css
/* UI text — sidebar labels, tabs, breadcrumbs */
--font-ui: 'Geist Sans', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;

/* Code / editor text */
--font-mono: 'Geist Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
```

### Type Scale (Vercel Geist + Zed patterns)

| Token              | Size   | Weight | Line Height | Letter Spacing | Usage                          |
|--------------------|--------|--------|-------------|----------------|--------------------------------|
| `--type-sidebar-header` | 11px | 600  | 16px        | 0.5px (caps)   | Section headers ("EXPLORER")   |
| `--type-tree-item`      | 13px | 400  | 22px        | 0               | File/folder names in tree      |
| `--type-tree-item-bold` | 13px | 600  | 22px        | 0               | Folder names (Zed bold_folder) |
| `--type-tab-label`      | 13px | 400  | 20px        | 0               | Tab file names                 |
| `--type-tab-label-active`| 13px| 500  | 20px        | 0               | Active tab                     |
| `--type-breadcrumb`     | 12px | 400  | 18px        | 0               | Path breadcrumbs               |
| `--type-breadcrumb-last`| 12px | 500  | 18px        | 0               | Current file in breadcrumb     |
| `--type-badge`          | 10px | 600  | 14px        | 0.2px           | Status badges, counts          |
| `--type-editor`         | 14px | 400  | 22px        | 0               | Code editor body (Zed default) |
| `--type-editor-line-no` | 12px | 400  | 22px        | 0               | Line numbers (match editor lh) |
| `--type-context-menu`   | 13px | 400  | 20px        | 0               | Context menu items             |
| `--type-tooltip`        | 12px | 400  | 16px        | 0               | Tooltips                       |
| `--type-empty-title`    | 14px | 500  | 20px        | 0               | Empty state headline           |
| `--type-empty-body`     | 13px | 400  | 20px        | 0               | Empty state description        |

---

## 3. Spacing & Layout

### Sidebar Dimensions

```css
--sidebar-width-default: 240px;   /* Zed default */
--sidebar-width-min:     180px;   /* Minimum resize */
--sidebar-width-max:     400px;   /* Maximum resize */
--sidebar-resize-handle: 4px;     /* Drag handle hit area: 4px visible, 8px clickable */
```

### Tree Item Spacing

```css
--tree-item-height:      28px;    /* Comfortable row height */
--tree-item-padding-x:   12px;    /* Left/right padding */
--tree-item-indent:      16px;    /* Per-level indent (Zed uses 20px, VS Code 16px) */
--tree-icon-size:        16px;    /* File/folder icons */
--tree-icon-gap:         6px;     /* Gap between icon and label */
--tree-chevron-size:     12px;    /* Expand/collapse arrow */
--tree-indent-guide-width: 1px;   /* Indent guide line width */
--tree-indent-guide-offset: 8px;  /* Centered within indent column */
```

### Section Spacing

```css
--section-header-height: 28px;    /* "EXPLORER", "OPEN EDITORS" headers */
--section-header-px:     12px;    /* Header horizontal padding */
--section-gap:           0px;     /* No gap — borders separate sections */
```

### Editor Layout

```css
--tab-bar-height:        36px;    /* Tab strip height */
--tab-padding-x:         12px;    /* Padding inside each tab */
--tab-gap:               0px;     /* Tabs touch — borders separate */
--tab-close-size:        16px;    /* Close button hit area */
--breadcrumb-height:     26px;    /* Breadcrumb bar below tabs */
--breadcrumb-padding-x:  12px;
--breadcrumb-separator:  "›";     /* Or chevron icon */
--editor-padding-left:   56px;    /* Gutter width (line numbers) */
--editor-padding-right:  16px;
--minimap-width:         60px;    /* Minimap rail width */
```

---

## 4. Animations & Transitions

### Core Timing (from Warp + Linear patterns)

```css
/* Micro-interactions: hover states, opacity changes */
--transition-fast:     100ms ease-out;

/* State changes: selection, expand/collapse */
--transition-normal:   150ms ease-out;

/* Layout changes: sidebar resize, panel open */
--transition-smooth:   200ms cubic-bezier(0.16, 1, 0.3, 1);

/* Entrance/exit: modals, overlays, context menus */
--transition-enter:    200ms cubic-bezier(0.16, 1, 0.3, 1);
--transition-exit:     150ms cubic-bezier(0.4, 0, 1, 1);

/* Spring-like for drag operations */
--transition-spring:   300ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Specific Animations

| Interaction              | Property               | Duration | Easing                          |
|--------------------------|------------------------|----------|---------------------------------|
| Tree item hover          | background-color       | 100ms    | ease-out                        |
| Tree expand/collapse     | height, opacity        | 150ms    | ease-out                        |
| Chevron rotation         | transform (rotate)     | 150ms    | ease-out                        |
| Tab switch               | opacity                | 100ms    | ease-out                        |
| Tab close (slide out)    | width, opacity, margin | 200ms    | cubic-bezier(0.4, 0, 1, 1)     |
| Context menu appear      | opacity, transform(Y)  | 150ms    | cubic-bezier(0.16, 1, 0.3, 1)  |
| Context menu dismiss     | opacity                | 100ms    | ease-out                        |
| Sidebar resize           | width                  | 0ms      | (real-time, no transition)      |
| Drag & drop indicator    | opacity, height        | 150ms    | ease-out                        |
| Skeleton shimmer         | background-position    | 1500ms   | linear (infinite)               |
| Command palette open     | opacity, transform(Y)  | 200ms    | cubic-bezier(0.16, 1, 0.3, 1)  |
| Tooltip appear           | opacity, transform(Y)  | 150ms    | ease-out (with 400ms delay)     |
| AI ghost text fade in    | opacity                | 300ms    | ease-in                         |
| Diff highlight pulse     | opacity (0.15→0.25→0.15)| 2000ms  | ease-in-out (once on appear)    |

---

## 5. Icon System

### Style (derived from VS Code + Zed + Vercel Geist)

- **Type**: Outlined, 1.5px stroke weight for UI icons; filled for file-type icons.
- **Size**: 16x16 grid, rendered at 16px in tree, 14px in tabs, 18px in section headers.
- **Color**: `var(--text-secondary)` default, `var(--text-primary)` on hover/active.
- **File type icons**: Use colored fills matching language associations (e.g. blue for TypeScript, green for Vue, orange for Rust, yellow for JavaScript).
- **Folder icons**: Monochrome at rest, accent tint when expanded.
- **Chevrons**: 10px, `var(--text-tertiary)`, rotate 90deg on expand.
- **Never** use `stroke="currentColor"` or `fill="currentColor"`. Always inline explicit colors.

### File Type Icon Color Palette

```
TypeScript:  #3178C6
JavaScript:  #F7DF1E (use #D4A017 on dark for contrast)
Rust:        #CE422B
React/JSX:   #61DAFB
Vue:         #42B883
Python:      #3776AB
Go:          #00ADD8
JSON:        #A8B1C2
Markdown:    #7B8794
YAML/TOML:   #8B6914
HTML:        #E44D26
CSS:         #264DE4
Shell:       #4EAA25
Git:         #F05032
```

---

## 6. Component Specifications

### 6.1 File Tree Sidebar

```
┌─────────────────────────────┐
│ ▾ EXPLORER            ⋯ ▪  │  Section header: 11px, 600, caps, --text-tertiary
│─────────────────────────────│  Border: --border-subtle
│ ▾ 📁 src                   │  Folder: bold, --text-primary, colored icon
│ │ ▾ 📁 components          │  Indent guide: 1px --border-subtle
│ │ │  📄 App.tsx        M   │  File: regular, --text-secondary; M = --warning
│ │ │  📄 index.ts           │  28px row height, 16px indent per level
│ │ └  📄 utils.ts       A   │  A = --success
│ ▸ 📁 tests                 │  Collapsed folder: chevron right
│   📄 package.json          │  Root level: 12px left padding
│   📄 tsconfig.json         │
│                             │
│                             │
│  (empty space = droppable)  │
└─────────────────────────────┘
```

**Hover state**: `background: var(--hover-bg)` full-width, no border-radius (VS Code pattern).

**Selected state**: `background: var(--selected-bg)` with `border-left: 2px solid var(--accent-cyan)`.

**Focused+selected**: Add `box-shadow: inset 0 0 0 1px var(--border-accent)`.

**Indent guides**: Vertical 1px lines, `var(--border-subtle)`, positioned at `indent * level + 8px`. Active guide (ancestor of selected) brightens to `var(--border-default)`.

**Git status decorations**:
- Modified: filename in `var(--warning)`, "M" badge right-aligned
- Added: filename in `var(--success)`, "A" badge
- Deleted: filename in `var(--error)` with strikethrough, "D" badge
- Untracked: filename in `var(--success)`, "U" badge
- Conflicted: filename in `var(--error)`, "!" badge

**Drag and drop**:
- Drag handle appears on hover (6-dot grip icon, left of the file icon).
- While dragging: source item gets `opacity: 0.4`.
- Drop target folder: `background: var(--selected-bg)`, `border: 1px dashed var(--accent-cyan)`.
- Drop position indicator: 2px horizontal line in `var(--accent-cyan)` between items.
- Invalid drop zone: cursor changes to `not-allowed`, no highlight.

### 6.2 Tab Bar

```
┌──────────────┬──────────────┬──────────────┬────────────────────────┐
│  App.tsx  ●✕ │  index.ts ✕  │  utils.ts ✕  │                        │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│  src › components › App.tsx                                         │  Breadcrumb bar
└─────────────────────────────────────────────────────────────────────┘
```

**Tab anatomy**:
- Height: 36px.
- Active tab: `background: var(--bg-editor)`, `border-top: 2px solid var(--accent-cyan)`, `color: var(--text-primary)`.
- Inactive tab: `background: var(--bg-surface)`, `color: var(--text-secondary)`.
- Hover (inactive): `background: var(--hover-bg)`.
- Modified indicator: 8px filled circle in `var(--accent-cyan)` replacing the close icon until hover.
- Close icon: 16px `x`, `var(--text-tertiary)`, appears on tab hover, `var(--text-primary)` on icon hover.
- Tab border: `border-right: 1px solid var(--border-subtle)`.
- Tab overflow: horizontal scroll, no wrapping. Fades at edges with 24px gradient mask.
- Drag reorder: tab lifts with `box-shadow: 0 4px 12px rgba(0,0,0,0.4)` and `transform: scale(1.02)`.
- Drop indicator: 2px vertical line between tabs in `var(--accent-cyan)`.

**Breadcrumb bar**:
- Height: 26px, `background: var(--bg-editor)`.
- Segments: `var(--text-tertiary)`, separator `›` in `var(--text-ghost)`.
- Last segment (current file): `var(--text-secondary)`, weight 500.
- Hover on any segment: `var(--text-primary)`, underline.
- Click on segment: dropdown with sibling files/folders, same styling as context menu.

### 6.3 Context Menu

```css
.context-menu {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4),
              0 2px 8px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(16px) saturate(180%);
  min-width: 180px;
  max-width: 280px;
}

.context-menu-item {
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: default;
}

.context-menu-item:hover {
  background: var(--hover-bg);
}

.context-menu-item-icon {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
}

.context-menu-shortcut {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.context-menu-separator {
  height: 1px;
  background: var(--border-subtle);
  margin: 4px 8px;
}

.context-menu-item-danger {
  color: var(--error);
}

.context-menu-item-danger:hover {
  background: rgba(248, 81, 73, 0.10);
}
```

**Entrance**: `opacity: 0 → 1`, `translateY(-4px) → translateY(0)`, 150ms ease-out.

**Submenu**: appears 4px overlapping parent, same entrance animation.

### 6.4 Scrollbar

```css
/* Thin overlay scrollbar — VS Code + Warp pattern */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.10);
  border-radius: 4px;
  border: 2px solid transparent;     /* Creates visual 4px thumb */
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.20);
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:active {
  background: rgba(255, 255, 255, 0.30);
  background-clip: content-box;
}

/* Auto-hide: scrollbar fades when not scrolling */
::-webkit-scrollbar-thumb {
  transition: background 200ms ease-out;
}
```

Scrollbar only visible on scroll or hover. Use `overflow: overlay` where supported, falling back to `overflow: auto`.

### 6.5 Editor Pane (with AI Features)

**Minimap**:
- Width: 60px, right edge of editor.
- Renders as scaled-down color blocks (not text), `opacity: 0.6`.
- Viewport indicator: `background: rgba(255, 255, 255, 0.08)`, border-left: `1px solid var(--border-default)`.
- Hover: viewport indicator brightens to `rgba(255, 255, 255, 0.12)`.

**AI Ghost Text (Cursor-style Tab completion)**:
- Color: `var(--text-ghost)` — `rgba(255, 255, 255, 0.28)`.
- Font style: italic.
- Appears with 300ms fade-in after 500ms debounce from last keystroke.
- Accept: Tab key. Partial accept: Cmd+Right (word-by-word).
- Dismiss: Escape or continue typing different characters.

**AI Inline Diff (Cmd+K edit result)**:
- Added lines: `background: var(--diff-added-bg)`, left border `3px solid var(--diff-added-border)`.
- Removed lines: `background: var(--diff-removed-bg)`, left border `3px solid var(--diff-removed-border)`, text with `opacity: 0.6` and strikethrough.
- Accept/Reject buttons float above the diff region: small pill buttons, 24px height.
- Accept: filled `var(--success)` background, white text. Reject: outline style, `var(--text-secondary)`.

**Line numbers**:
- Default: `var(--text-tertiary)`.
- Current line: `var(--text-primary)`.
- Gutter width: 56px (accommodates 5-digit line numbers).

---

## 7. Loading & Empty States

### Skeleton Loading (File Tree)

```css
.skeleton-tree-item {
  height: 28px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 6px;
}

.skeleton-icon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: var(--hover-bg);
}

.skeleton-label {
  height: 10px;
  border-radius: 3px;
  background: var(--hover-bg);
  /* Randomize widths: 60%, 75%, 50%, 85%, 45% for natural look */
}

/* Shimmer animation */
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,0.04) 50%,
    rgba(255,255,255,0) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1500ms linear infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Show 8-12 skeleton rows while loading. Stagger appearance by 30ms per row for a cascade effect.

### Empty States

**No files open**:
- Centered in editor pane.
- Muted icon (folder or document outline, 48px, `var(--text-ghost)`).
- Headline: "No file open" — `var(--text-secondary)`, 14px, weight 500.
- Description: "Open a file from the explorer or use Cmd+P" — `var(--text-tertiary)`, 13px.
- Optional keyboard shortcut hint rendered as inline `<kbd>` badges.

**Empty folder**:
- Inline within tree, indented to folder level.
- Text: "This folder is empty" — `var(--text-ghost)`, 12px, italic.

**Search no results**:
- Icon: magnifying glass with "x", 32px, `var(--text-ghost)`.
- Headline: "No results for '{query}'" — `var(--text-secondary)`.
- Suggestion: "Check your spelling or try a broader search" — `var(--text-tertiary)`.

**Connection lost (remote/SSH files)**:
- Warning icon in `var(--warning)`, 32px.
- Headline: "Connection lost" — `var(--text-secondary)`.
- CTA button: "Reconnect" — pill button with `var(--accent-cyan)`.

---

## 8. What Makes It Feel Premium

### Lessons from each product

**Warp**: UI surface overlay system — don't just darken, layer white overlays at 5-10% on dark backgrounds to create depth. Backdrop blur (40px) on floating panels. Gradient support for accent areas.

**Zed**: Speed as a design feature. GPU-accelerated rendering means zero frame drops on tree expand/collapse. `rem`-based scaling from a single `ui_font_size` root. Compact density option (reduce all spacing by ~20%).

**VS Code Dark Modern**: Minimal color palette — only 5 grays (#181818, #1F1F1F, #2B2B2B, #313131, #3C3C3C) create the entire hierarchy. Accent color (#0078D4) used sparingly — only active borders, badges, focus rings. Everything else is grayscale.

**Cursor**: AI suggestions feel native, not bolted on. Ghost text uses the same font as editor text, just dimmed. Diff view is inline, not a separate panel. Accept/reject is keyboard-first (Tab/Escape), buttons are secondary.

**Ghostty**: Platform-native components for chrome (tabs, title bar). The terminal content is GPU-rendered but the frame is macOS-native. Quick Terminal (slide-down) with smooth spring animation. Minimal config surface — good defaults matter more than options.

**Fig/Amazon Q**: Autocomplete overlay positions with pixel precision using Accessibility API. The popup follows the cursor position exactly. Descriptions appear inline, not in a separate tooltip. Uses Rust+tao/wry for the overlay — same stack as Tauri.

**Linear**: LCH color space for perceptually uniform theme generation. Contrast slider (30-100) as a single knob for accessibility. Meticulous vertical alignment of icons, labels, and badges on a 4px grid. Reduce chrome color — neutral grays with a single accent is more premium than multi-color.

**Vercel Geist**: 10-step gray scale with alpha variants. Label-13 as the workhorse size (13px for secondary text everywhere). Monospace variants at every text size for mixed content. Heading-14 for in-app headings — larger is not always better.

### The Five Principles of Premium Feel

1. **Restraint**: Fewer colors, fewer font sizes, fewer border radii. VS Code Dark Modern uses exactly 5 background shades. Linear limits accent color to navigation highlights only.

2. **Depth through opacity**: Never use 3+ solid background colors. Instead, use one base color and layer `rgba(255,255,255, 0.03-0.10)` for elevation. This is Warp's "opposite overlay" technique and it is the single highest-impact pattern.

3. **Micro-animation budget**: Fast transitions (100-200ms) with ease-out. Never ease-in for UI responses (it feels sluggish). Reserve spring curves for drag operations only. No animation should exceed 300ms except skeleton shimmer.

4. **Pixel-perfect alignment**: Every icon, label, and badge sits on a 4px vertical grid. Tree items are exactly 28px. Tabs are exactly 36px. Consistency in height creates visual rhythm.

5. **Keyboard-first, mouse-enhanced**: Command palette (Cmd+P) is the fastest path. Context menus are discoverable but not required. Tab/Escape for AI accept/reject. Shortcuts shown in context menus as `var(--text-tertiary)` mono text.

---

## 9. CSS Custom Properties — Complete Token Set

```css
:root {
  /* === Backgrounds === */
  --bg-base: #0F0F11;
  --bg-surface: #151518;
  --bg-elevated: #1A1A1E;
  --bg-overlay: #1F1F24;
  --bg-editor: #18181B;

  /* === Accent === */
  --accent-primary: #22D3EE;
  --accent-primary-dim: #0891B2;
  --accent-secondary: #A78BFA;
  --accent-secondary-dim: #7C3AED;

  /* === Text === */
  --text-primary: rgba(255, 255, 255, 0.92);
  --text-secondary: rgba(255, 255, 255, 0.68);
  --text-tertiary: rgba(255, 255, 255, 0.45);
  --text-ghost: rgba(255, 255, 255, 0.28);
  --text-inverse: #0F0F11;

  /* === Borders === */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-strong: rgba(255, 255, 255, 0.16);
  --border-accent: rgba(34, 211, 238, 0.40);

  /* === Interactive === */
  --hover-bg: rgba(255, 255, 255, 0.05);
  --active-bg: rgba(255, 255, 255, 0.08);
  --selected-bg: rgba(34, 211, 238, 0.10);
  --selected-bg-inactive: rgba(255, 255, 255, 0.06);
  --focus-ring: 0 0 0 2px rgba(34, 211, 238, 0.40);

  /* === Semantic === */
  --color-success: #2EA043;
  --color-warning: #D29922;
  --color-error: #F85149;
  --color-info: #58A6FF;

  /* === Diff === */
  --diff-added-bg: rgba(46, 160, 67, 0.15);
  --diff-added-border: rgba(46, 160, 67, 0.40);
  --diff-removed-bg: rgba(248, 81, 73, 0.15);
  --diff-removed-border: rgba(248, 81, 73, 0.40);

  /* === Typography === */
  --font-ui: 'Geist Sans', 'Inter', -apple-system, system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace;
  --font-size-xs: 10px;
  --font-size-sm: 12px;
  --font-size-md: 13px;
  --font-size-base: 14px;
  --font-size-lg: 16px;

  /* === Spacing === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* === Radii === */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* === Shadows === */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3);

  /* === Transitions === */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-smooth: 200ms;
  --duration-slow: 300ms;

  /* === Layout === */
  --sidebar-width: 240px;
  --tab-height: 36px;
  --breadcrumb-height: 26px;
  --tree-item-height: 28px;
  --tree-indent: 16px;
  --scrollbar-width: 8px;
  --minimap-width: 60px;
}
```

---

## 10. Implementation Priority for QuoxTerminal

Build order based on visual impact and dependency chain:

1. **CSS token foundation** — ship the custom properties above first, reference everywhere.
2. **File tree sidebar** — core navigation; highest interaction frequency.
3. **Tab bar + breadcrumbs** — needed once files can be opened.
4. **Context menus** — right-click on tree items and tabs.
5. **Editor pane chrome** — line numbers, gutter, minimap rail.
6. **Scrollbar styling** — global, applies to all scrollable areas.
7. **Skeleton loading** — perceivable during SSH/remote file listing.
8. **Empty states** — polish pass.
9. **Drag and drop** — reorder tabs, move files in tree.
10. **AI inline features** — ghost text, diff view (requires AI integration).
