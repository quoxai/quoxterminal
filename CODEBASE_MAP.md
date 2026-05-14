# QuoxTerminal — Codebase Map

<!-- Last verified: 2026-05-14T18:30:00Z by codebase-mirror skill -->
> **Generated:** 2026-05-14 (full rescan, verified)
> **Version:** 0.4.1
> **Stack:** Tauri 2 + React 19 + Rust + TypeScript
> **License:** BUSL-1.1

QuoxTerminal is a native desktop terminal application with AI integration, SSH support, and fleet management. Built on Tauri for the native shell, xterm.js for terminal emulation, and CodeMirror 6 for file editing.

---

## Metrics

| Metric | Count |
|--------|-------|
| React components (TSX) | 49 |
| Component helpers (TS) | 2 |
| React hooks | 8 |
| Services | 15 |
| Config files | 5 |
| Tauri IPC bridges | 6 |
| Rust source files | 41 |
| Tauri commands | 42 |
| Test files | 40 |
| Tool registry entries | 61 |

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
│   │   │   ├── terminal/        # Terminal embeds, panes (17 components)
│   │   │   ├── files/           # File explorer + CodeMirror editor (5 + 2 helpers)
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
│   │   └── __tests__/           # 39 test files
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── main.rs          # Tauri entry (calls lib::run)
│   │   │   ├── lib.rs           # Plugin setup, command registration
│   │   │   ├── commands.rs      # Main Tauri IPC commands (35)
│   │   │   ├── state.rs         # AppState (PTY/SSH/Claude managers)
│   │   │   ├── pty/             # PTY session manager (4 files)
│   │   │   ├── ssh/             # SSH session + key manager (5 files)
│   │   │   ├── claude/          # Claude CLI wrapper + parser (4 files)
│   │   │   ├── ai/              # Anthropic API client (4 files)
│   │   │   ├── fs/              # Filesystem operations (3 files)
│   │   │   ├── safety/          # Command validator (3 files)
│   │   │   ├── memory/          # Local memory bridge (2 files)
│   │   │   ├── collector/       # WebSocket client (3 files)
│   │   │   ├── settings/        # Font/shell detection (3 files)
│   │   │   ├── shell_integration/ # Shell init scripts (3 files)
│   │   │   ├── tray.rs          # System tray
│   │   │   ├── hotkey.rs        # Global shortcut
│   │   │   └── updater.rs       # Auto-update check
│   │   ├── Cargo.toml           # Rust dependencies
│   │   └── tauri.conf.json      # Tauri app config
│   ├── package.json             # Frontend dependencies
│   └── vite.config.ts           # Vite bundler config
├── docs/                        # Documentation
├── README.md                    # Project overview
└── CODEBASE_MAP.md              # This file
```

---

## Entry Points

### Frontend (React)
| File | Purpose |
|------|---------|
| `src/main.tsx` | React DOM render entry |
| `src/App.tsx:3` | Root component, renders `<TerminalView />` |
| `src/pages/TerminalView.tsx` | Main page — workspaces, panes, sidebars |
| `src/pages/SettingsView.tsx` | Settings page |

### Backend (Rust)
| File | Purpose |
|------|---------|
| `src-tauri/src/main.rs` | Tauri entry (calls `lib::run()`) |
| `src-tauri/src/lib.rs:34` | Plugin registration, setup, command handlers |
| `src-tauri/src/commands.rs` | Main Tauri IPC commands (35) |
| `src-tauri/src/memory/commands.rs` | Memory bridge commands (7) |
| `src-tauri/src/state.rs` | `AppState` — PTY, SSH, Claude, Collector managers |

---

## Rust Modules

### Core Modules
| Module | Path | Files | Purpose |
|--------|------|-------|---------|
| `pty` | `src/pty/` | `mod.rs`, `manager.rs`, `session.rs`, `shell.rs` | Local PTY sessions via `portable-pty` |
| `ssh` | `src/ssh/` | `mod.rs`, `client.rs`, `session.rs`, `key_manager.rs`, `known_hosts.rs` | SSH connections via `russh` (bastion support) |
| `claude` | `src/claude/` | `mod.rs`, `session.rs`, `parser.rs`, `detect.rs` | Claude CLI session, parser, project detection |
| `ai` | `src/ai/` | `mod.rs`, `client.rs`, `streaming.rs`, `context.rs` | Anthropic Messages API client |
| `fs` | `src/fs/` | `mod.rs`, `operations.rs`, `validation.rs` | Native filesystem operations |
| `safety` | `src/safety/` | `mod.rs`, `validator.rs`, `denylist.rs` | Command validator (deny dangerous ops) |
| `memory` | `src/memory/` | `mod.rs`, `commands.rs` | Local entity/session storage |
| `collector` | `src/collector/` | `mod.rs`, `ws_client.rs`, `auth.rs` | WebSocket client to Quox Collector |
| `settings` | `src/settings/` | `mod.rs`, `shells.rs`, `fonts.rs` | Shell + font detection |
| `shell_integration` | `src/shell_integration/` | `mod.rs`, `cwd_tracking.rs`, `prompt_detection.rs` | Shell init scripts |

### Desktop Features
| Module | File | Purpose |
|--------|------|---------|
| `tray` | `src/tray.rs` | System tray icon + menu |
| `hotkey` | `src/hotkey.rs` | Global shortcut registration (Cmd/Ctrl+`) |
| `updater` | `src/updater.rs` | Auto-update via GitHub releases |

---

## Tauri Commands (42)

### PTY Commands (8)
- `pty_spawn` — Create local PTY session
- `pty_write` — Write to PTY stdin
- `pty_resize` — Resize PTY dimensions
- `pty_kill` — Terminate PTY session
- `pty_list` — List active sessions
- `pty_session_exists` — Check if session exists
- `get_default_shell` — Detect system shell
- `get_terminal_output` — Read from ring buffer

### SSH Commands (7)
- `ssh_connect` — Connect to remote host (bastion support)
- `ssh_write` — Write to remote shell
- `ssh_resize` — Resize remote PTY
- `ssh_disconnect` — Close SSH connection
- `ssh_list_keys` — List ~/.ssh keys
- `ssh_session_exists` — Check session exists
- `ssh_get_output` — Read from ring buffer

### Claude Commands (4)
- `claude_spawn` — Start Claude CLI session (`--output-format stream-json`)
- `claude_write` — Write to Claude stdin
- `claude_kill` — Terminate Claude session
- `detect_claude_project` — Detect CLAUDE.md project

### AI Chat Commands (3)
- `chat_send` — Send message to Anthropic API
- `chat_send_stream` — Streaming chat response (SSE)
- `chat_auth_status` — Get auth status

### Filesystem Commands (5)
- `fs_read_file` — Read file contents
- `fs_write_file` — Write file (with backup)
- `fs_delete_file` — Delete file (with backup)
- `fs_rename_file` — Rename/move file
- `fs_list_dir` — List directory entries

### Collector Commands (3)
- `collector_connect` — Connect to WebSocket
- `collector_disconnect` — Disconnect
- `collector_status` — Get connection status

### Bastion/Fleet Commands (2)
- `bastion_list_hosts` — Fetch host list
- `bastion_fleet_summary` — Fetch fleet summary

### Memory Commands (7)
- `collector_store_entity` — Store entity
- `collector_touch_entity` — Update entity timestamp
- `collector_extract_entities` — Extract from text
- `collector_add_open_loop` — Add open loop
- `collector_add_learned_item` — Add learned item
- `collector_record_decision` — Record decision
- `collector_set_focus` — Set focus entity

### System Commands (3)
- `list_fonts` — List monospace fonts
- `list_shells` — List available shells
- `validate_command` — Check command safety

---

## React Hooks (8)

| Hook | File | Purpose |
|------|------|---------|
| `useTerminalWorkspace` | `hooks/useTerminalWorkspace.ts` | Multi-workspace state, pane management, layouts |
| `useSettings` | `hooks/useSettings.ts` | Tauri store persistence for user preferences |
| `useClaudeSession` | `hooks/useClaudeSession.ts` | Claude CLI session lifecycle |
| `useTeamSession` | `hooks/useTeamSession.ts` | Agent Teams orchestration |
| `useVimMode` | `hooks/useVimMode.ts` | Vim keybinding scroll state |
| `useCommandSafety` | `hooks/useCommandSafety.ts` | Command validation + warnings |
| `useFleetStatus` | `hooks/useFleetStatus.ts` | Fleet/host status polling |
| `useTerminalErrorDetection` | `hooks/useTerminalErrorDetection.ts` | Detect errors in terminal output |

---

## Services (15)

| Service | File | Purpose |
|---------|------|---------|
| `toolRegistry` | `services/toolRegistry.ts` | CLI tool definitions (59 entries, 10 categories) |
| `claudeOutputParser` | `services/claudeOutputParser.ts` | Parse Claude CLI stream-json events |
| `claudeSessionTracker` | `services/claudeSessionTracker.ts` | Track Claude session state |
| `claudeTrustProfile` | `services/claudeTrustProfile.ts` | Tool trust/approval profiles |
| `terminalExecService` | `services/terminalExecService.ts` | Execute commands in terminal |
| `terminalFileService` | `services/terminalFileService.ts` | File operations via PTY |
| `terminalContextBuilder` | `services/terminalContextBuilder.ts` | Build context for AI |
| `terminalMemoryBridge` | `services/terminalMemoryBridge.ts` | Entity extraction, memory storage |
| `localMemoryStore` | `services/localMemoryStore.ts` | Local IndexedDB-like storage |
| `bastionClient` | `services/bastionClient.ts` | Fleet API proxy calls |
| `fleetService` | `services/fleetService.ts` | Fleet status/agent operations |
| `teamHistoryService` | `services/teamHistoryService.ts` | Team session history |
| `teamOutputMonitor` | `services/teamOutputMonitor.ts` | Monitor team agent outputs |
| `teamStorageService` | `services/teamStorageService.ts` | Team config persistence |
| `agentDefinitionService` | `services/agentDefinitionService.ts` | Agent role definitions |

---

## Config Files (5)

| Config | File | Purpose |
|--------|------|---------|
| `terminalConfig` | `config/terminalConfig.ts` | Keyboard shortcuts, limits (panes, workspaces, font sizes), vim bindings |
| `terminalModes` | `config/terminalModes.ts` | Claude CLI modes (strict/balanced/builder/audit), system prompts |
| `teamConfig` | `config/teamConfig.ts` | Agent Teams templates, env generation, cost estimation |
| `claudeConfig` | `config/claudeConfig.ts` | Claude model definitions |
| `themes` | `config/themes.ts` | Terminal color themes |

---

## Tauri IPC Bridges (6)

| Bridge | File | Commands |
|--------|------|----------|
| `tauri-pty` | `lib/tauri-pty.ts` | `pty_spawn`, `pty_write`, `pty_resize`, `pty_kill`, `pty_list`, `pty_session_exists`, `get_terminal_output` |
| `tauri-ssh` | `lib/tauri-ssh.ts` | `ssh_connect`, `ssh_write`, `ssh_resize`, `ssh_disconnect`, `ssh_list_keys`, `ssh_session_exists`, `ssh_get_output` |
| `tauri-claude` | `lib/tauri-claude.ts` | `claude_spawn`, `claude_write`, `claude_kill`, `detect_claude_project` |
| `tauri-fs` | `lib/tauri-fs.ts` | `fs_read_file`, `fs_write_file`, `fs_delete_file`, `fs_rename_file`, `fs_list_dir` |
| `tauri-collector` | `lib/tauri-collector.ts` | `collector_connect`, `collector_disconnect`, `collector_status` |
| `store` | `lib/store.ts` | Tauri plugin-store wrapper |

---

## Components by Category

### Claude Components (15)
| Component | File | Purpose |
|-----------|------|---------|
| `ClaudePaneEmbed` | `components/claude/ClaudePaneEmbed.tsx` | Main Claude CLI streaming view |
| `ClaudeConversation` | `components/claude/ClaudeConversation.tsx` | Message history display |
| `ClaudeInputBar` | `components/claude/ClaudeInputBar.tsx` | User input + send button |
| `ClaudeStatusBar` | `components/claude/ClaudeStatusBar.tsx` | Session status indicator |
| `ClaudeContextPanel` | `components/claude/ClaudeContextPanel.tsx` | Files tracked, context info |
| `ClaudeMdViewer` | `components/claude/ClaudeMdViewer.tsx` | CLAUDE.md file viewer |
| `ClaudeProjectBadge` | `components/claude/ClaudeProjectBadge.tsx` | Project detection badge |
| `ToolCallCard` | `components/claude/ToolCallCard.tsx` | Tool invocation display |
| `BashOutputCard` | `components/claude/BashOutputCard.tsx` | Bash command output |
| `EditDiffCard` | `components/claude/EditDiffCard.tsx` | File edit diff view |
| `ReadFileCard` | `components/claude/ReadFileCard.tsx` | File read display |
| `ApprovalBatch` | `components/claude/ApprovalBatch.tsx` | Multi-tool approval UI |
| `CostTracker` | `components/claude/CostTracker.tsx` | Token usage + cost |
| `TokenBudgetGauge` | `components/claude/TokenBudgetGauge.tsx` | Context window gauge |
| `FilesTracked` | `components/claude/FilesTracked.tsx` | Tracked files list |

### Terminal Components (17)
| Component | File | Purpose |
|-----------|------|---------|
| `TerminalPane` | `components/terminal/TerminalPane.tsx` | Per-pane wrapper with header |
| `TerminalEmbed` | `components/terminal/TerminalEmbed.tsx` | xterm.js local PTY embed |
| `SshTerminalEmbed` | `components/terminal/SshTerminalEmbed.tsx` | xterm.js SSH embed |
| `TerminalChat` | `components/terminal/TerminalChat.tsx` | AI Chat sidebar |
| `SshConnectDialog` | `components/terminal/SshConnectDialog.tsx` | SSH connection form |
| `HostKnowledgeCard` | `components/terminal/HostKnowledgeCard.tsx` | Host info display |
| `ErrorNotificationBar` | `components/terminal/ErrorNotificationBar.tsx` | Error detection banner |
| `SessionRestoreBanner` | `components/terminal/SessionRestoreBanner.tsx` | Session restore prompt |
| `DiffView` | `components/terminal/DiffView.tsx` | Side-by-side diff |
| `FileChangeCard` | `components/terminal/FileChangeCard.tsx` | File change summary |
| `FileChangeGroup` | `components/terminal/FileChangeGroup.tsx` | Grouped file changes |
| `FileApplyConfirmModal` | `components/terminal/FileApplyConfirmModal.tsx` | File apply confirmation |
| `RunnableCodeBlock` | `components/terminal/RunnableCodeBlock.tsx` | Executable code block |
| `MemoryActivityFeed` | `components/terminal/MemoryActivityFeed.tsx` | Memory event feed |
| `SuggestionChips` | `components/terminal/SuggestionChips.tsx` | Command suggestions |
| `TerminalExecConfirmModal` | `components/terminal/TerminalExecConfirmModal.tsx` | Execution confirmation |

### Files Components (5 + 2 helpers)
| Component | File | Purpose |
|-----------|------|---------|
| `FileExplorer` | `components/files/FileExplorer.tsx` | File tree sidebar |
| `FileTree` | `components/files/FileTree.tsx` | Directory tree |
| `FileTreeItem` | `components/files/FileTreeItem.tsx` | Single tree item |
| `FileEditor` | `components/files/FileEditor.tsx` | CodeMirror 6 editor |
| `FileEditorTabs` | `components/files/FileEditorTabs.tsx` | Editor tab bar |
| `quoxEditorTheme` | `components/files/quoxEditorTheme.ts` | Quox theme for CodeMirror (helper) |
| `fileIcons` | `components/files/fileIcons.ts` | File type icon mapping (helper) |

### Teams Components (3)
| Component | File | Purpose |
|-----------|------|---------|
| `TeamLauncherModal` | `components/teams/TeamLauncherModal.tsx` | Team selection + config |
| `TeamControlBar` | `components/teams/TeamControlBar.tsx` | Active team controls |
| `TaskBoard` | `components/teams/TaskBoard.tsx` | Team task board |

### Other Components
| Category | Components |
|----------|------------|
| `hosts/` | `HostPicker`, `FleetDashboard` |
| `tools/` | `ToolPalette`, `ToolParamModal` |
| `settings/` | `QuoxSettings`, `SettingsTerminal`, `GeneralSettings`, `AppearanceSettings` |
| `safety/` | `CommandWarning` |
| `ui/` | `Modal` |

---

## Utils (4)

| Util | File | Purpose |
|------|------|---------|
| `entityExtractor` | `utils/entityExtractor.ts` | Extract entities from terminal output |
| `fileBlockParser` | `utils/fileBlockParser.ts` | Parse file blocks from Claude output |
| `terminalErrorDetector` | `utils/terminalErrorDetector.ts` | Detect error patterns in output |
| `notificationBeep` | `utils/notificationBeep.ts` | Audio notification for attention |

---

## Tool Registry (61 entries)

Categories:
- **TUI** (3): `quox tui`, `quox chat`, `quox login`
- **Fleet** (7): `fleet status`, `fleet summary`, `fleet agents`, `fleet tools`, `fleet exec`, `fleet watch`, `service watch`
- **AI** (4): `quick chat`, `chat status`, `conversations`, `search conversations`
- **Workflows** (5): `list workflows`, `run workflow`, `workflow steps`, `list runs`, `run status`
- **Memory** (7): `memory stats`, `memory list`, `memory search`, `memory export`, `memory create`, `entity list`, `entity search`
- **Monitoring** (8): `service health`, `backup list/create/verify/schedule`, `platform stats`, `inbox`, `inbox stats`
- **Admin** (14): `whoami`, `config`, `logout`, `API keys`, `audit log`, `file stats`, `service list`, `MFA setup`, `retention stats`, `integrations`, `test integration`, `tag list`, `notification channels`
- **Organization** (4): `org list`, `org switch`, `org members`, `org audit`
- **Agents** (6): `agent list`, `agent get`, `agent create`, `agent activate/deactivate`, `agent tools`
- **Assistants** (2): `assistant list`, `assistant deploy`

---

## Terminal Limits (Architecture Constants)

```typescript
TERMINAL_LIMITS = {
  MAX_PANES: 4,
  MAX_WORKSPACES: 8,
  MAX_SCROLLBACK: 5000,
  WORKSPACE_WARN_THRESHOLD: 7,
  MIN_FONT_SIZE: 8,
  MAX_FONT_SIZE: 32,
  DEFAULT_FONT_SIZE: 14,
  FONT_SIZE_STEP: 1,
}
```

---

## Keyboard Shortcuts

| Category | Shortcut | Action |
|----------|----------|--------|
| Pane Focus | Ctrl/Cmd+1-4 | Focus pane 1-4 |
| Terminal | Ctrl/Cmd+\ | Toggle AI chat |
| Terminal | Ctrl/Cmd+Shift+L | Clear terminal |
| Terminal | Ctrl/Cmd+Shift+T | Toggle tool palette |
| Terminal | Ctrl/Cmd+Shift+E | Toggle file explorer |
| Workspaces | Ctrl/Cmd+Shift+N | New workspace |
| Workspaces | Ctrl/Cmd+Shift+W | Close workspace |
| Agent Teams | Ctrl/Cmd+Shift+A | Toggle teams modal |
| Claude Mode | Ctrl/Cmd+Shift+K | Toggle Claude mode |
| Zoom | Ctrl/Cmd+=/-/0 | Zoom in/out/reset |
| Vim | Ctrl/Cmd+Shift+V | Toggle vim mode |
| Help | Ctrl/Cmd+? | Show shortcuts |

---

## Vim Keybindings

| Key | Action |
|-----|--------|
| `i`, `a` | Enter insert mode |
| `j` | Scroll down one line |
| `k` | Scroll up one line |
| `d` | Scroll half page down |
| `u` | Scroll half page up |
| `G` | Scroll to bottom |
| `gg` | Scroll to top (double-tap within 1s) |

---

## Terminal Modes

From `config/terminalModes.ts`:

| Mode | Behavior | CLI Args |
|------|----------|----------|
| `strict` | Confirmation-heavy, safe | `--allowedTools Read,Glob,Grep` |
| `balanced` | Default, practical | (none) |
| `builder` | Fast execution | `--dangerouslySkipPermissions` |
| `audit` | Read-only, no writes | `--allowedTools Read,Glob,Grep` |

---

## Agent Teams Templates

From `config/teamConfig.ts`:

| Template | Layout | Agents | Use Case |
|----------|--------|--------|----------|
| Feature Build | quad | Architect (opus), Builder A (sonnet), Builder B (sonnet), Tester (sonnet) | Full-stack development |
| Code Review | main-side | Security Auditor (opus), Quality Reviewer (sonnet), Docs Writer (haiku) | Security/quality audit |
| Bug Hunt | split-h | Researcher (opus), Fixer (sonnet) | Bug investigation |
| Refactor Sprint | quad | Planner (opus), Refactorer A (sonnet), Refactorer B (sonnet), Reviewer (sonnet) | Planned refactoring |

Cost estimation: Hourly rates — opus $3.60, sonnet $0.72, haiku $0.19

---

## Tests

| Category | Test Files |
|----------|------------|
| Services (10) | `claudeOutputParser`, `claudeTrustProfile`, `claudeSessionTracker`, `toolRegistry`, `terminalExecService`, `terminalContextBuilder`, `terminalMemoryBridge`, `localMemoryStore`, `agentDefinitionService`, `teamStorageService` |
| Hooks (1) | `useClaudeSession` |
| Utils (4) | `fileBlockParser`, `entityExtractor`, `terminalErrorDetector`, `notificationBeep` |
| Config (6) | `terminalConfig`, `terminalModes`, `teamConfig`, `claudeCliArgs`, `tauriFs`, `setup` |
| Components (19) | `ClaudeConversation`, `ClaudeProjectBadge`, `EditDiffCard`, `ToolCallCard`, `TokenBudgetGauge`, `ClaudeModeSelector`, `ClaudeNativeMode`, `TeamLauncherModal`, `TeamControlBar`, `TaskBoard`, `ToolPalette`, `HostKnowledgeCard`, `FleetDashboard.connect`, `SessionRestoreBanner`, `SuggestionChips`, `TerminalChat.wiring`, `FileTree`, `FileExplorer`, `FileEditor` |

Run: `npm test` or `npm run test:watch`

---

## Dependencies

### Frontend (package.json)
| Package | Version | Purpose |
|---------|---------|---------|
| `@tauri-apps/api` | ^2.0.0 | Tauri IPC |
| `@xterm/xterm` | ^5.5.0 | Terminal emulation |
| `codemirror` | ^6.0.2 | Code editor |
| `@codemirror/merge` | ^6.12.1 | Diff view |
| `react` | ^19.0.0 | UI framework |
| `react-markdown` | ^10.1.0 | Markdown rendering |

### Backend (Cargo.toml)
| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2 | Desktop framework (tray-icon feature) |
| `portable-pty` | 0.8 | PTY management |
| `russh` | 0.46 | SSH client |
| `russh-keys` | 0.46 | SSH key management |
| `tokio` | 1 | Async runtime |
| `reqwest` | 0.12 | HTTP client |
| `tokio-tungstenite` | 0.24 | WebSocket client |
| `serde` | 1 | Serialization |

---

## Build & Dev

```bash
# Development
cd quox-terminal
npm run dev         # Vite dev server (http://localhost:1420)
npm run tauri dev   # Full Tauri dev mode

# Build
npm run build       # Frontend build
npm run tauri build # Full app build

# Test
npm run test        # Vitest
npm run test:watch  # Watch mode
```

---

## Event Flow

### Local PTY Session
```
TerminalPane → TerminalEmbed → tauri-pty.ts → invoke("pty_spawn")
                                           → Rust pty/manager.rs
                                           → portable-pty → shell process
                                           → emit("pty-data-{id}")
                                           → TerminalEmbed.onData()
```

### Claude Mode Session
```
TerminalPane → ClaudePaneEmbed → tauri-claude.ts → invoke("claude_spawn")
                                                → Rust claude/session.rs
                                                → Claude CLI (--output-format stream-json)
                                                → emit("claude-event-{id}")
                                                → claudeOutputParser → ClaudeConversation
```

### SSH Session
```
TerminalPane → SshTerminalEmbed → tauri-ssh.ts → invoke("ssh_connect")
                                              → Rust ssh/session.rs
                                              → russh (bastion tunnel)
                                              → emit("ssh-data-{id}")
                                              → SshTerminalEmbed.onData()
```

### AI Chat (Non-CLI)
```
TerminalChat → invoke("chat_send_stream")
            → Rust ai/streaming.rs
            → Anthropic Messages API (SSE)
            → emit("chat-stream-{id}", "chat-stream-done-{id}")
            → TerminalChat.onMessage()
```

---

*Last updated: 2026-05-14T18:30Z (verified by codebase-mirror)*
