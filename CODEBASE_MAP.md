# QuoxTerminal — Codebase Map

<!-- Last verified: 2026-05-18T14:00:00Z by codebase-mirror skill -->
> **Generated:** 2026-05-18 (full rescan, verified)
> **Version:** 0.4.1
> **Stack:** Tauri 2 + React 19 + Rust + TypeScript
> **License:** BUSL-1.1

QuoxTerminal is a native desktop terminal application with AI integration, SSH support, and fleet management. Built on Tauri for the native shell, xterm.js for terminal emulation, and CodeMirror 6 for file editing.

---

## Metrics

| Metric | Count |
|--------|-------|
| React components (TSX) | 49 |
| Pages + App (TSX) | 3 |
| React hooks | 8 |
| Services | 15 |
| Config files | 5 |
| Tauri IPC bridges | 6 |
| Rust source files | 41 |
| Tauri commands | 42 |
| Test files | 40 |
| Tool registry entries | 59 |
| Utility modules | 4 |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         QuoxTerminal App                            │
├─────────────────────────────────────────────────────────────────────┤
│  React Frontend (quox-terminal/src/)                                │
│  ├── TerminalView (main workspace page)                             │
│  ├── TerminalPane[] (multi-pane grid, up to 4)                      │
│  ├── AI Chat sidebar (CommanderQ integration)                       │
│  ├── Claude Mode (Claude CLI streaming UI)                          │
│  ├── Agent Teams (multi-agent orchestration)                        │
│  ├── Fleet Dashboard / SSH connections                              │
│  └── Tool Palette / File Explorer / Settings                        │
├─────────────────────────────────────────────────────────────────────┤
│  Tauri IPC Layer (lib/tauri-*.ts)                                   │
│  ├── tauri-pty.ts    → invoke("pty_*")                              │
│  ├── tauri-ssh.ts    → invoke("ssh_*")                              │
│  ├── tauri-claude.ts → invoke("claude_*")                           │
│  ├── tauri-fs.ts     → invoke("fs_*")                               │
│  └── tauri-collector.ts → invoke("collector_*")                     │
├─────────────────────────────────────────────────────────────────────┤
│  Rust Backend (quox-terminal/src-tauri/src/)                        │
│  ├── pty/     — local PTY sessions (portable-pty)                   │
│  ├── ssh/     — SSH connections (russh + bastion support)           │
│  ├── claude/  — Claude CLI session management                       │
│  ├── ai/      — Anthropic API client (chat/streaming)               │
│  ├── fs/      — native filesystem operations                        │
│  ├── safety/  — command validator (deny dangerous commands)         │
│  ├── memory/  — local entity/session storage bridge                 │
│  ├── collector/ — WebSocket client to Quox Collector                │
│  ├── tray/    — system tray integration                             │
│  ├── hotkey/  — global hotkey (Cmd/Ctrl+`)                          │
│  └── updater/ — auto-update via tauri-plugin-updater                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
quoxterminal/
├── quox-terminal/               # Main Tauri + React app
│   ├── src/                     # React frontend
│   │   ├── main.tsx             # React entry point
│   │   ├── App.tsx              # Root component → TerminalView
│   │   ├── pages/
│   │   │   ├── TerminalView.tsx # Main workspace (tabs, panes, sidebars)
│   │   │   └── SettingsView.tsx # Settings page
│   │   ├── components/
│   │   │   ├── claude/          # Claude CLI UI (15 components)
│   │   │   ├── terminal/        # Terminal embeds, panes (16 components)
│   │   │   ├── files/           # File explorer + CodeMirror editor (5 TSX + 2 TS)
│   │   │   ├── hosts/           # Fleet dashboard, host picker (2 components)
│   │   │   ├── teams/           # Agent teams launcher + board (3 components)
│   │   │   ├── tools/           # Tool palette (2 components)
│   │   │   ├── settings/        # Preferences panels (4 components)
│   │   │   ├── safety/          # Command warnings (1 component)
│   │   │   └── ui/              # Generic modal (1 component)
│   │   ├── hooks/               # 8 React hooks
│   │   ├── services/            # 15 service modules
│   │   ├── config/              # 5 config files
│   │   ├── lib/                 # 6 Tauri IPC bridge modules
│   │   ├── utils/               # 4 utility modules
│   │   ├── types/               # Shared TypeScript types
│   │   └── __tests__/           # 40 test files
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── main.rs          # Tauri entry (calls lib::run)
│   │   │   ├── lib.rs           # App builder, plugin registration, command handlers
│   │   │   ├── commands.rs      # All 42 Tauri command implementations
│   │   │   ├── state.rs         # AppState (PTY, SSH, Claude, Collector managers)
│   │   │   ├── pty/             # Local PTY session management
│   │   │   ├── ssh/             # SSH client (russh, key manager, known_hosts)
│   │   │   ├── claude/          # Claude CLI streaming sessions
│   │   │   ├── ai/              # Anthropic Messages API client
│   │   │   ├── fs/              # Native filesystem operations
│   │   │   ├── safety/          # Command safety validator + denylist
│   │   │   ├── memory/          # Local entity/session storage
│   │   │   ├── collector/       # WebSocket client to Collector
│   │   │   ├── settings/        # Font + shell enumeration
│   │   │   ├── shell_integration/ # CWD tracking, prompt detection
│   │   │   ├── tray.rs          # System tray setup
│   │   │   ├── hotkey.rs        # Global hotkey registration
│   │   │   └── updater.rs       # Auto-update checker
│   │   ├── Cargo.toml           # Rust dependencies
│   │   └── tauri.conf.json      # Tauri configuration
│   ├── package.json             # Node dependencies (React 19, xterm.js, CodeMirror 6)
│   ├── vite.config.ts           # Vite bundler config
│   └── vitest.config.ts         # Test runner config
├── .github/workflows/ci.yml     # CI pipeline
├── README.md                    # Project overview
└── CODEBASE_MAP.md              # This file
```

---

## Key Entry Points

### Frontend

| File | Purpose |
|------|---------|
| `src/main.tsx` | React root render |
| `src/App.tsx` | Root component, renders TerminalView |
| `src/pages/TerminalView.tsx` | Main workspace: tabs, panes, sidebars, shortcuts |
| `src/pages/SettingsView.tsx` | Settings page (standalone route) |

### Backend (Rust)

| File | Purpose |
|------|---------|
| `src-tauri/src/main.rs` | Tauri entry, calls `lib::run()` |
| `src-tauri/src/lib.rs` | App builder, plugins, command handler registration |
| `src-tauri/src/commands.rs` | All Tauri command implementations |
| `src-tauri/src/state.rs` | AppState struct (PTY, SSH, Claude, Collector managers) |

---

## Tauri Commands (42 total)

### PTY Commands (7)
- `pty_spawn` — spawn local PTY session
- `pty_write` — write to PTY stdin
- `pty_resize` — resize PTY dimensions
- `pty_kill` — kill PTY session
- `pty_list` — list active sessions
- `pty_session_exists` — check if session exists
- `get_terminal_output` — read from ring buffer

### SSH Commands (7)
- `ssh_connect` — connect to remote host (key/password auth, bastion support)
- `ssh_disconnect` — disconnect SSH session
- `ssh_write` — write to remote shell
- `ssh_resize` — resize remote PTY
- `ssh_list_keys` — list ~/.ssh keys
- `ssh_session_exists` — check if SSH session exists
- `ssh_get_output` — read from SSH ring buffer

### Claude Mode Commands (4)
- `claude_spawn` — spawn Claude CLI session with `--output-format stream-json`
- `claude_write` — write to Claude stdin (user messages, approvals)
- `claude_kill` — kill Claude session
- `detect_claude_project` — detect Claude Code project info

### AI/Chat Commands (3)
- `chat_send` — one-shot chat to Anthropic API
- `chat_send_stream` — streaming chat (SSE events)
- `chat_auth_status` — get auth method and readiness

### Filesystem Commands (5)
- `fs_read_file` — read file contents
- `fs_write_file` — write file (optional backup)
- `fs_delete_file` — delete file (optional backup)
- `fs_rename_file` — rename/move file
- `fs_list_dir` — list directory entries

### Collector/Fleet Commands (5)
- `collector_connect` — connect to Collector WebSocket
- `collector_disconnect` — disconnect from Collector
- `collector_status` — get connection status
- `bastion_list_hosts` — fetch host list from Collector API
- `bastion_fleet_summary` — fetch fleet summary from Collector API

### Memory Bridge Commands (7)
- `collector_store_entity` — store entity in local memory
- `collector_touch_entity` — update entity timestamp
- `collector_extract_entities` — extract entities from text
- `collector_add_open_loop` — add open loop item
- `collector_add_learned_item` — add learned item
- `collector_record_decision` — record decision
- `collector_set_focus` — set current focus

### System Commands (4)
- `get_default_shell` — detect system default shell
- `list_fonts` — list monospace fonts
- `list_shells` — list available shells
- `validate_command` — check command against safety denylist

---

## React Hooks (8)

| Hook | File | Purpose |
|------|------|---------|
| `useTerminalWorkspace` | `hooks/useTerminalWorkspace.ts` | Multi-workspace state (tabs, panes, layouts) |
| `useClaudeSession` | `hooks/useClaudeSession.ts` | Claude CLI session management |
| `useTeamSession` | `hooks/useTeamSession.ts` | Agent team session state |
| `useSettings` | `hooks/useSettings.ts` | App settings (font, theme, shell) |
| `useVimMode` | `hooks/useVimMode.ts` | Vim keybinding overlay |
| `useCommandSafety` | `hooks/useCommandSafety.ts` | Command safety validation |
| `useFleetStatus` | `hooks/useFleetStatus.ts` | Fleet agent status polling |
| `useTerminalErrorDetection` | `hooks/useTerminalErrorDetection.ts` | Error pattern detection |

---

## Services (15)

| Service | File | Purpose |
|---------|------|---------|
| `terminalFileService` | `services/terminalFileService.ts` | File CRUD operations |
| `terminalContextBuilder` | `services/terminalContextBuilder.ts` | Build AI context from terminal state |
| `terminalExecService` | `services/terminalExecService.ts` | Execute commands in terminals |
| `terminalMemoryBridge` | `services/terminalMemoryBridge.ts` | Bridge to local memory store |
| `localMemoryStore` | `services/localMemoryStore.ts` | IndexedDB local storage |
| `bastionClient` | `services/bastionClient.ts` | Fleet/Bastion API client |
| `fleetService` | `services/fleetService.ts` | Fleet agent management |
| `agentDefinitionService` | `services/agentDefinitionService.ts` | Agent type definitions |
| `claudeOutputParser` | `services/claudeOutputParser.ts` | Parse Claude CLI stream-json |
| `claudeSessionTracker` | `services/claudeSessionTracker.ts` | Track Claude session state |
| `claudeTrustProfile` | `services/claudeTrustProfile.ts` | Trust level management |
| `toolRegistry` | `services/toolRegistry.ts` | 59 Quox CLI tool definitions |
| `teamStorageService` | `services/teamStorageService.ts` | Team session persistence |
| `teamHistoryService` | `services/teamHistoryService.ts` | Team history tracking |
| `teamOutputMonitor` | `services/teamOutputMonitor.ts` | Monitor team agent output |

---

## Configuration (5 files)

| File | Purpose |
|------|---------|
| `config/terminalConfig.ts` | Keyboard shortcuts, limits (MAX_PANES=4, MAX_WORKSPACES=8) |
| `config/terminalModes.ts` | Terminal mode definitions (local, ssh, claude) |
| `config/teamConfig.ts` | Agent team templates (Feature Build, Code Review, Bug Hunt, Refactor Sprint) |
| `config/claudeConfig.ts` | Tool card styles, model pricing, context window |
| `config/themes.ts` | Terminal color themes (7 themes: quox-dark, monokai, solarized-dark, dracula, nord, one-dark, catppuccin) |

---

## Tauri IPC Bridges (6)

| File | Purpose |
|------|---------|
| `lib/tauri-pty.ts` | PTY session management (`pty_spawn`, `pty_write`, etc.) |
| `lib/tauri-ssh.ts` | SSH session management (`ssh_connect`, `ssh_write`, etc.) |
| `lib/tauri-claude.ts` | Claude CLI session management (`claude_spawn`, `claude_write`, etc.) |
| `lib/tauri-fs.ts` | Filesystem operations (`fs_read_file`, `fs_write_file`, etc.) |
| `lib/tauri-collector.ts` | Collector WebSocket and API (`collector_connect`, `bastion_list_hosts`, etc.) |
| `lib/store.ts` | Tauri Store wrapper for persistent settings |

---

## Rust Modules

### Core Modules

| Module | Files | Purpose |
|--------|-------|---------|
| `pty/` | `mod.rs`, `manager.rs`, `session.rs`, `shell.rs` | Local PTY sessions via portable-pty |
| `ssh/` | `mod.rs`, `client.rs`, `session.rs`, `key_manager.rs`, `known_hosts.rs` | SSH via russh, bastion support |
| `claude/` | `mod.rs`, `session.rs`, `parser.rs`, `detect.rs` | Claude CLI integration |
| `ai/` | `mod.rs`, `client.rs`, `context.rs`, `streaming.rs` | Anthropic Messages API |
| `fs/` | `mod.rs`, `operations.rs`, `validation.rs` | File operations with path validation |
| `safety/` | `mod.rs`, `validator.rs`, `denylist.rs` | Command safety checking |
| `memory/` | `mod.rs`, `commands.rs` | Local entity storage bridge |
| `collector/` | `mod.rs`, `ws_client.rs`, `auth.rs` | Collector WebSocket client |
| `settings/` | `mod.rs`, `fonts.rs`, `shells.rs` | System font/shell enumeration |
| `shell_integration/` | `mod.rs`, `cwd_tracking.rs`, `prompt_detection.rs` | Shell integration helpers |

### Desktop Features

| File | Purpose |
|------|---------|
| `tray.rs` | System tray menu setup |
| `hotkey.rs` | Global hotkey (Cmd/Ctrl+\`) registration |
| `updater.rs` | Auto-update checker |

---

## Component Directory

### `components/claude/` (15 components)
Claude CLI UI for streaming output and tool calls.

| Component | Purpose |
|-----------|---------|
| `ClaudeConversation` | Main conversation view |
| `ClaudeInputBar` | User input bar |
| `ClaudeStatusBar` | Session status display |
| `ClaudeContextPanel` | Context/file panel |
| `ClaudePaneEmbed` | Claude mode pane wrapper |
| `ClaudeMdViewer` | Markdown viewer |
| `ClaudeProjectBadge` | Project detection badge |
| `ToolCallCard` | Generic tool call card |
| `BashOutputCard` | Bash output display |
| `ReadFileCard` | File read display |
| `EditDiffCard` | Edit diff viewer |
| `TokenBudgetGauge` | Token usage gauge |
| `CostTracker` | Cost tracking display |
| `FilesTracked` | Tracked files list |
| `ApprovalBatch` | Approval queue |

### `components/terminal/` (16 components)
Terminal pane and related UI.

| Component | Purpose |
|-----------|---------|
| `TerminalPane` | Main pane container (local/ssh/claude/editor mode) |
| `TerminalEmbed` | xterm.js embed for local PTY |
| `TerminalChat` | AI chat sidebar |
| `SshTerminalEmbed` | xterm.js embed for SSH |
| `SshConnectDialog` | SSH connection dialog |
| `DiffView` | File diff viewer |
| `FileChangeCard` | File change card |
| `FileChangeGroup` | Grouped file changes |
| `FileApplyConfirmModal` | Apply changes confirmation |
| `TerminalExecConfirmModal` | Exec confirmation modal |
| `SuggestionChips` | AI suggestion chips |
| `MemoryActivityFeed` | Memory activity display |
| `HostKnowledgeCard` | Host knowledge card |
| `ErrorNotificationBar` | Error notification bar |
| `RunnableCodeBlock` | Runnable code block |
| `SessionRestoreBanner` | Session restore banner |

### `components/files/` (5 TSX + 2 TS)
File explorer and CodeMirror editor.

| File | Purpose |
|------|---------|
| `FileExplorer.tsx` | File tree sidebar |
| `FileTree.tsx` | Tree component |
| `FileTreeItem.tsx` | Tree item |
| `FileEditor.tsx` | CodeMirror 6 editor |
| `FileEditorTabs.tsx` | Editor tab bar |
| `quoxEditorTheme.ts` | CodeMirror Quox theme |
| `fileIcons.ts` | File type icons |

### `components/hosts/` (2 components)

| Component | Purpose |
|-----------|---------|
| `FleetDashboard` | Fleet agent dashboard sidebar |
| `HostPicker` | Host selection picker |

### `components/teams/` (3 components)

| Component | Purpose |
|-----------|---------|
| `TeamLauncherModal` | Team template launcher |
| `TeamControlBar` | Active team control bar |
| `TaskBoard` | Task board sidebar |

### `components/tools/` (2 components)

| Component | Purpose |
|-----------|---------|
| `ToolPalette` | Quox CLI tool launcher |
| `ToolParamModal` | Tool parameter input modal |

### `components/settings/` (4 components)

| Component | Purpose |
|-----------|---------|
| `QuoxSettings` | Settings modal wrapper |
| `GeneralSettings` | General settings tab |
| `AppearanceSettings` | Appearance settings tab |
| `SettingsTerminal` | Terminal settings preview |

### `components/safety/` (1 component)

| Component | Purpose |
|-----------|---------|
| `CommandWarning` | Dangerous command warning overlay |

### `components/ui/` (1 component)

| Component | Purpose |
|-----------|---------|
| `Modal` | Generic modal component |

---

## Keyboard Shortcuts

| Category | Shortcut | Action |
|----------|----------|--------|
| Pane Focus | Cmd/Ctrl+1-4 | Focus pane 1-4 |
| Terminal | Cmd/Ctrl+\\ | Toggle AI chat |
| Terminal | Cmd/Ctrl+Shift+L | Clear terminal |
| Terminal | Cmd/Ctrl+Shift+T | Toggle tool palette |
| Terminal | Cmd/Ctrl+Shift+E | Toggle file explorer |
| Workspaces | Cmd/Ctrl+Shift+N | New workspace |
| Workspaces | Cmd/Ctrl+Shift+W | Close workspace |
| Agent Teams | Cmd/Ctrl+Shift+A | Toggle teams modal |
| Claude Mode | Cmd/Ctrl+Shift+K | Toggle Claude mode |
| Zoom | Cmd/Ctrl+= | Zoom in |
| Zoom | Cmd/Ctrl+- | Zoom out |
| Zoom | Cmd/Ctrl+0 | Reset zoom |
| Vim | Cmd/Ctrl+Shift+V | Toggle vim mode |
| Help | Cmd/Ctrl+? | Show shortcuts |

---

## Architecture Limits

| Limit | Value | Source |
|-------|-------|--------|
| MAX_PANES | 4 | `terminalConfig.ts` |
| MAX_WORKSPACES | 8 | `terminalConfig.ts` |
| MAX_SCROLLBACK | 5000 | `terminalConfig.ts` |
| MIN_FONT_SIZE | 8 | `terminalConfig.ts` |
| MAX_FONT_SIZE | 32 | `terminalConfig.ts` |
| DEFAULT_FONT_SIZE | 14 | `terminalConfig.ts` |
| FONT_SIZE_STEP | 1 | `terminalConfig.ts` |
| CONTEXT_WINDOW_TOKENS | 200,000 | `claudeConfig.ts` |
| AUTO_COLLAPSE_LINES | 20 | `claudeConfig.ts` |
| MAX_RAW_BUFFER | 1000 | `claudeConfig.ts` |

---

## Agent Team Templates

| Template | Layout | Agents | Use Case |
|----------|--------|--------|----------|
| Feature Build | quad | Architect (Opus), Builder A (Sonnet), Builder B (Sonnet), Tester (Sonnet) | Full-stack feature development |
| Code Review | main-side | Security Auditor (Opus), Quality Reviewer (Sonnet), Docs Writer (Haiku) | Security audit + quality review |
| Bug Hunt | split-h | Researcher (Opus), Fixer (Sonnet) | Bug investigation and fix |
| Refactor Sprint | quad | Planner (Opus), Refactorer A (Sonnet), Refactorer B (Sonnet), Reviewer (Sonnet) | Planned refactoring |

---

## Terminal Themes

| Theme | Background | Foreground |
|-------|------------|------------|
| quox-dark (default) | #0a0e14 | #b3b1ad |
| monokai | #272822 | #f8f8f2 |
| solarized-dark | #002b36 | #839496 |
| dracula | #282a36 | #f8f8f2 |
| nord | #2e3440 | #d8dee9 |
| one-dark | #282c34 | #abb2bf |
| catppuccin | #1e1e2e | #cdd6f4 |

---

## Dependencies

### Rust (Cargo.toml)
- `tauri` 2.x — desktop app framework
- `tauri-plugin-store` 2.x — persistent settings
- `tauri-plugin-clipboard-manager` 2.x — clipboard access
- `tauri-plugin-global-shortcut` 2.x — hotkey registration
- `tauri-plugin-updater` 2.x — auto-update
- `portable-pty` 0.8 — cross-platform PTY
- `russh` 0.46 — SSH client
- `russh-keys` 0.46 — SSH key handling
- `tokio` 1.x — async runtime
- `reqwest` 0.12 — HTTP client
- `tokio-tungstenite` 0.24 — WebSocket client
- `serde` + `serde_json` — serialization
- `uuid` 1.x — session IDs
- `regex` 1.x — pattern matching
- `dirs` 6.x — system directories
- `base64` 0.22 — encoding
- `futures-util` 0.3 — async utilities

### Node (package.json)
- `react` 19.x, `react-dom` 19.x — UI framework
- `@tauri-apps/api` 2.x — Tauri IPC
- `@tauri-apps/plugin-store` 2.x — settings persistence
- `@tauri-apps/plugin-clipboard-manager` 2.x — clipboard access
- `@xterm/xterm` 5.5 — terminal emulator
- `@xterm/addon-fit`, `addon-search`, `addon-unicode11`, `addon-web-links` — xterm addons
- `codemirror` 6.x — code editor
- `@codemirror/language-data`, `@codemirror/merge` — CodeMirror extensions
- `@lezer/highlight` — syntax highlighting
- `@uiw/codemirror-themes` — CodeMirror themes
- `react-markdown` 10.x, `remark-gfm` 4.x — markdown rendering
- `vite` 6.x — bundler
- `vitest` 3.x — test runner
- `typescript` 5.6 — type checking

---

## Test Coverage

40 test files in `src/__tests__/`:

| Category | Files |
|----------|-------|
| Services | `claudeOutputParser`, `claudeSessionTracker`, `claudeTrustProfile`, `terminalContextBuilder`, `terminalExecService`, `terminalMemoryBridge`, `toolRegistry`, `teamStorageService`, `localMemoryStore`, `agentDefinitionService`, `tauriFs`, `fleetService` |
| Hooks | `useClaudeSession`, `terminalErrorDetector` |
| Components | `ClaudeConversation`, `ClaudeModeSelector`, `ClaudeNativeMode`, `ClaudeProjectBadge`, `EditDiffCard`, `FileEditor`, `FileExplorer`, `FileTree`, `FleetDashboard`, `HostKnowledgeCard`, `SessionRestoreBanner`, `SuggestionChips`, `TaskBoard`, `TeamControlBar`, `TeamLauncherModal`, `TokenBudgetGauge`, `ToolCallCard`, `ToolPalette` |
| Config | `terminalConfig`, `terminalModes`, `teamConfig` |
| Utils | `fileBlockParser`, `entityExtractor`, `notificationBeep` |
| Integration | `TerminalChat.wiring` |
| CLI | `claudeCliArgs` |

---

## Build & Run

```bash
# Install dependencies
cd quox-terminal
npm install

# Development (Vite + Tauri)
npm run tauri dev

# Build production
npm run tauri build

# Run tests
npm test

# Type check
npm run build  # runs tsc && vite build
```

---

## Event System

### Tauri Events (Rust → Frontend)

| Event | Payload | Emitter |
|-------|---------|---------|
| `pty-output-{session_id}` | `{ data: string }` | PTY read loop |
| `pty-exit-{session_id}` | `{ code: number }` | PTY process exit |
| `ssh-output-{session_id}` | `{ data: string }` | SSH channel read |
| `ssh-exit-{session_id}` | `{ code: number }` | SSH channel close |
| `claude-event-{session_id}` | JSON line | Claude CLI stdout |
| `chat-stream-{stream_id}` | `{ delta: string }` | AI streaming response |
| `chat-stream-done-{stream_id}` | `{}` | AI stream complete |
| `collector-message` | JSON | Collector WebSocket |
| `collector-status` | `string` | Collector connection state |

### Custom DOM Events (Frontend)

| Event | Payload | Purpose |
|-------|---------|---------|
| `claude-waiting` | — | Claude is waiting for user input (triggers tab flash) |

---

## Security

### CSP (Content Security Policy)
```
default-src 'self';
style-src 'self' 'unsafe-inline';
script-src 'self';
connect-src 'self' https://api.anthropic.com https://github.com wss://localhost:* ws://localhost:*;
img-src 'self' data:;
font-src 'self' data:
```

### Command Safety
- `safety/denylist.rs` blocks dangerous commands (rm -rf /, format, etc.)
- `validate_command` Tauri command checks before execution
- Frontend `useCommandSafety` hook provides warnings

### Auth Priority (AI Chat)
1. Claude CLI OAuth token (`~/.claude/.credentials.json` from `claude login`)
2. Manual API key from Settings store
3. `ANTHROPIC_API_KEY` environment variable
