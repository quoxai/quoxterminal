<!-- Last verified: 2026-04-14T18:15:00Z by /codebase-mirror -->

# QuoxTerminal — Codebase Map

Tauri 2 desktop terminal with PTY, SSH, Claude CLI integration, Agent Teams, and fleet management.

## Metrics
| Metric | Count |
|--------|-------|
| Rust Modules | 11 |
| Rust Files | 41 |
| React Components | 49 |
| Frontend Services | 15 |
| Frontend Hooks | 8 |
| Test Files | 40 |
| Config Files | 5 |
| Tauri Commands | 42 |
| Lib Bindings | 6 |

## Stack
- **Backend:** Tauri 2 (Rust), portable-pty 0.8, russh 0.46, tokio, reqwest 0.12
- **Frontend:** React 19, TypeScript, xterm.js 5.5, CodeMirror 6, react-markdown
- **Tauri Plugins:** store, clipboard-manager, global-shortcut, updater
- **Version:** 0.4.1

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Frontend                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Terminal │ │  Claude  │ │  Files   │ │  Fleet   │           │
│  │   Pane   │ │   Mode   │ │ Explorer │ │Dashboard │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                  │
│  ┌────┴────────────┴────────────┴────────────┴────┐             │
│  │                 Tauri Bindings (lib/)          │             │
│  │   tauri-pty, tauri-ssh, tauri-claude, etc.    │             │
│  └─────────────────────┬──────────────────────────┘             │
└────────────────────────┼────────────────────────────────────────┘
                         │ IPC
┌────────────────────────┼────────────────────────────────────────┐
│                        ▼                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Tauri Backend (Rust)                 │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌───────┐ │    │
│  │  │  PTY   │ │  SSH   │ │ Claude │ │   AI   │ │ Fleet │ │    │
│  │  │Manager │ │Session │ │Session │ │ Chat   │ │ API   │ │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └───────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
quoxterminal/
├── quox-terminal/                # Frontend + Tauri app
│   ├── src/                      # React frontend (TypeScript)
│   │   ├── components/           # 49 React components
│   │   │   ├── claude/           # Claude Mode UI (15 components)
│   │   │   ├── files/            # File explorer & editor (5 components)
│   │   │   ├── hosts/            # Fleet/host picker (2 components)
│   │   │   ├── safety/           # Command warning overlays (1 component)
│   │   │   ├── settings/         # Settings panel (4 components)
│   │   │   ├── teams/            # Agent Teams UI (3 components)
│   │   │   ├── terminal/         # Terminal pane & SSH (17 components)
│   │   │   ├── tools/            # Tool palette (2 components)
│   │   │   └── ui/               # Shared UI primitives (1 component)
│   │   ├── config/               # 5 config modules
│   │   ├── hooks/                # 8 React hooks
│   │   ├── lib/                  # 6 Tauri IPC wrappers
│   │   ├── pages/                # 2 page components
│   │   ├── services/             # 15 service modules
│   │   ├── types/                # TypeScript types
│   │   ├── utils/                # 4 utility modules
│   │   └── __tests__/            # 40 test files (vitest)
│   ├── src-tauri/                # Rust backend
│   │   ├── src/
│   │   │   ├── ai/               # 4 files — Anthropic API client
│   │   │   ├── claude/           # 4 files — Claude CLI session + NDJSON parser
│   │   │   ├── collector/        # 3 files — WebSocket collector connection
│   │   │   ├── fs/               # 3 files — Native file operations
│   │   │   ├── memory/           # 2 files — Local entity storage bridge
│   │   │   ├── pty/              # 4 files — PTY session management
│   │   │   ├── safety/           # 3 files — Command validation/denylist
│   │   │   ├── settings/         # 3 files — Font/shell detection
│   │   │   ├── shell_integration/# 3 files — Shell integration scripts
│   │   │   └── ssh/              # 5 files — SSH client via russh
│   │   └── tauri.conf.json       # Tauri configuration
│   └── package.json              # Frontend dependencies
├── .github/                      # GitHub workflows (ci.yml)
└── CODEBASE_MAP.md               # This file
```

---

## Rust Backend (src-tauri/src/)

### Module Map

| Module | Files | Purpose |
|--------|-------|---------|
| `lib.rs` | Entry | Tauri app setup, plugin registration, command handlers |
| `commands.rs` | Commands | 42 Tauri IPC commands (PTY, SSH, Claude, FS, AI, Fleet) |
| `state.rs` | State | AppState with PTY/SSH/Claude managers |
| `pty/` | 4 files | Local PTY session management (portable-pty) |
| `ssh/` | 5 files | SSH sessions via russh (key mgmt, known_hosts, client) |
| `claude/` | 4 files | Claude CLI integration (spawn, parse NDJSON events) |
| `ai/` | 4 files | Anthropic Messages API client (streaming, context) |
| `collector/` | 3 files | WebSocket connection to Quox collector |
| `fs/` | 3 files | Native file read/write/delete/rename operations |
| `memory/` | 2 files | Local entity storage bridge |
| `safety/` | 3 files | Command denylist validator |
| `settings/` | 3 files | Font enumeration, shell detection |
| `shell_integration/` | 3 files | CWD tracking, prompt detection |

**Desktop Features (root src/)**
| File | Purpose |
|------|---------|
| `tray.rs` | System tray integration |
| `hotkey.rs` | Global hotkey (Cmd/Ctrl+`) |
| `updater.rs` | Auto-update checker |

### Rust Module Details

**PTY Module (`pty/`)**
| File | Purpose |
|------|---------|
| `mod.rs` | Module exports |
| `manager.rs` | PtyManager — session lifecycle |
| `session.rs` | PtySession — single PTY instance |
| `shell.rs` | Shell detection, default shell |

**SSH Module (`ssh/`)**
| File | Purpose |
|------|---------|
| `mod.rs` | Module exports |
| `client.rs` | SSH client wrapper |
| `session.rs` | SshSession — connection + channel |
| `key_manager.rs` | SSH key enumeration |
| `known_hosts.rs` | Known hosts file handling |

**Claude Module (`claude/`)**
| File | Purpose |
|------|---------|
| `mod.rs` | Module exports |
| `session.rs` | ClaudeSession — spawns `claude` CLI |
| `parser.rs` | NDJSON stream event parser |
| `detect.rs` | Claude project detection (CLAUDE.md) |

**AI Module (`ai/`)**
| File | Purpose |
|------|---------|
| `mod.rs` | Module exports |
| `client.rs` | Anthropic API client |
| `streaming.rs` | SSE streaming handler |
| `context.rs` | Context management |

**Collector Module (`collector/`)**
| File | Purpose |
|------|---------|
| `mod.rs` | Module exports |
| `ws_client.rs` | WebSocket client |
| `auth.rs` | Collector authentication |

### Key Tauri Commands

**PTY (Local Terminal)**
- `pty_spawn` — Spawn new PTY session (returns session ID)
- `pty_write` — Write to PTY stdin
- `pty_resize` — Resize terminal dimensions
- `pty_kill` — Kill session
- `pty_list` — List active sessions
- `pty_session_exists` — Check if session is alive
- `get_terminal_output` — Read from output ring buffer
- `get_default_shell` — Detect system shell

**SSH (Remote Terminal)**
- `ssh_connect` — Connect to host (key or password auth, bastion support)
- `ssh_disconnect` — Close SSH connection
- `ssh_write` — Write to remote shell
- `ssh_resize` — Resize remote PTY
- `ssh_list_keys` — List ~/.ssh keys
- `ssh_session_exists` — Check connection alive
- `ssh_get_output` — Read from output buffer

**Claude Mode**
- `claude_spawn` — Start Claude CLI session
- `claude_write` — Write to Claude stdin
- `claude_kill` — Kill Claude session
- `detect_claude_project` — Check for CLAUDE.md/.claude dir

**AI Chat**
- `chat_send` — Send message to Anthropic API
- `chat_send_stream` — Streaming chat response
- `chat_auth_status` — Check API key status

**Fleet/Collector**
- `collector_connect` — WebSocket connect to collector
- `collector_disconnect` — Close connection
- `collector_status` — Check connection status
- `bastion_list_hosts` — List fleet hosts
- `bastion_fleet_summary` — Fleet health summary

**File System**
- `fs_read_file` — Read file contents
- `fs_write_file` — Write file (optional backup)
- `fs_delete_file` — Delete file (optional backup)
- `fs_rename_file` — Rename/move file
- `fs_list_dir` — List directory entries

**Memory Bridge**
- `collector_store_entity` — Store knowledge entity locally
- `collector_touch_entity` — Update entity timestamp
- `collector_extract_entities` — Extract entities from text
- `collector_add_open_loop` — Add pending task
- `collector_add_learned_item` — Add learned fact
- `collector_record_decision` — Record decision
- `collector_set_focus` — Set current focus area

**Settings**
- `list_fonts` — List available monospace fonts
- `list_shells` — List available shells

---

## React Frontend (src/)

### Entry Points

| File | Purpose |
|------|---------|
| `main.tsx` | React root, renders App |
| `App.tsx` | Root component, renders TerminalView |
| `App.css` | Global styles |

### Pages

| Component | Path | Purpose |
|-----------|------|---------|
| `TerminalView` | `pages/TerminalView.tsx` | Main workspace with tabbed panes, layout picker, keyboard shortcuts |
| `SettingsView` | `pages/SettingsView.tsx` | Settings page wrapper |

### Components by Domain

**Terminal (`components/terminal/` — 17 components)**
| Component | Purpose |
|-----------|---------|
| `TerminalPane` | Per-pane wrapper with header, mode switching, SSH/Claude toggle |
| `TerminalEmbed` | xterm.js instance for local PTY |
| `SshTerminalEmbed` | xterm.js instance for SSH sessions |
| `TerminalChat` | AI chat sidebar |
| `SshConnectDialog` | SSH connection configuration modal |
| `HostKnowledgeCard` | Shows learned facts about connected host |
| `SessionRestoreBanner` | Banner to restore previous sessions |
| `RunnableCodeBlock` | Code block with "Run" button |
| `DiffView` | Side-by-side diff display |
| `FileChangeCard` | File change notification card |
| `FileChangeGroup` | Grouped file changes |
| `ErrorNotificationBar` | Error detection notification |
| `SuggestionChips` | Quick action suggestion chips |
| `MemoryActivityFeed` | Memory/entity activity feed |
| `FileApplyConfirmModal` | Confirm file changes |
| `TerminalExecConfirmModal` | Confirm command execution |

**Claude Mode (`components/claude/` — 15 components)**
| Component | Purpose |
|-----------|---------|
| `ClaudeConversation` | Renders Claude stream events |
| `ClaudeInputBar` | User input for Claude mode |
| `ClaudeStatusBar` | Status bar with model/mode/cost |
| `ClaudeContextPanel` | Context/files panel |
| `ClaudePaneEmbed` | Claude mode pane wrapper |
| `ClaudeProjectBadge` | Shows detected Claude project |
| `ClaudeMdViewer` | CLAUDE.md viewer |
| `ToolCallCard` | Renders tool call events |
| `BashOutputCard` | Renders bash output events |
| `ReadFileCard` | Renders file read events |
| `EditDiffCard` | Renders edit diff events |
| `CostTracker` | Token/cost tracking |
| `TokenBudgetGauge` | Visual token budget |
| `ApprovalBatch` | Batch approval UI |
| `FilesTracked` | Shows tracked files |

**Files (`components/files/` — 5 components + 2 utils)**
| Component | Purpose |
|-----------|---------|
| `FileExplorer` | Directory tree sidebar |
| `FileTree` | Recursive tree component |
| `FileTreeItem` | Single tree item |
| `FileEditor` | CodeMirror 6 editor |
| `FileEditorTabs` | Editor tab bar |
| `fileIcons.ts` | File type icon mapping |
| `quoxEditorTheme.ts` | Quox CodeMirror theme |

**Teams (`components/teams/` — 3 components)**
| Component | Purpose |
|-----------|---------|
| `TeamLauncherModal` | Launch agent team modal |
| `TeamControlBar` | Active team status bar |
| `TaskBoard` | Shared task board sidebar |

**Hosts (`components/hosts/` — 2 components)**
| Component | Purpose |
|-----------|---------|
| `HostPicker` | Fleet host dropdown picker |
| `FleetDashboard` | Fleet dashboard sidebar |

**Tools (`components/tools/` — 2 components)**
| Component | Purpose |
|-----------|---------|
| `ToolPalette` | Tool command palette sidebar |
| `ToolParamModal` | Tool parameter input modal |

**Settings (`components/settings/` — 4 components)**
| Component | Purpose |
|-----------|---------|
| `QuoxSettings` | Settings panel container |
| `SettingsTerminal` | Terminal settings tab |
| `GeneralSettings` | General settings tab |
| `AppearanceSettings` | Appearance settings tab |

**Safety (`components/safety/` — 1 component)**
| Component | Purpose |
|-----------|---------|
| `CommandWarning` | Dangerous command warning overlay |

**UI (`components/ui/` — 1 component)**
| Component | Purpose |
|-----------|---------|
| `Modal` | Reusable modal component |

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useTerminalWorkspace` | `hooks/useTerminalWorkspace.ts` | Multi-workspace state (layouts, panes, tabs) |
| `useTeamSession` | `hooks/useTeamSession.ts` | Agent team session lifecycle |
| `useSettings` | `hooks/useSettings.ts` | Settings state (font size, theme) |
| `useVimMode` | `hooks/useVimMode.ts` | Vim-style keybindings |
| `useClaudeSession` | `hooks/useClaudeSession.ts` | Claude session state |
| `useTerminalErrorDetection` | `hooks/useTerminalErrorDetection.ts` | Terminal error pattern detection |
| `useCommandSafety` | `hooks/useCommandSafety.ts` | Command safety validation |
| `useFleetStatus` | `hooks/useFleetStatus.ts` | Fleet connection status |

### Services

| Service | File | Purpose |
|---------|------|---------|
| `toolRegistry` | `services/toolRegistry.ts` | Static registry of 60+ Quox CLI tools |
| `claudeOutputParser` | `services/claudeOutputParser.ts` | Parse Claude CLI NDJSON events |
| `claudeSessionTracker` | `services/claudeSessionTracker.ts` | Track Claude session state |
| `claudeTrustProfile` | `services/claudeTrustProfile.ts` | Trust level management |
| `terminalExecService` | `services/terminalExecService.ts` | Execute commands in terminal |
| `terminalContextBuilder` | `services/terminalContextBuilder.ts` | Build context from terminal output |
| `terminalMemoryBridge` | `services/terminalMemoryBridge.ts` | Bridge to memory storage |
| `terminalFileService` | `services/terminalFileService.ts` | File operation service |
| `localMemoryStore` | `services/localMemoryStore.ts` | Local IndexedDB memory cache |
| `teamStorageService` | `services/teamStorageService.ts` | Team session persistence |
| `teamHistoryService` | `services/teamHistoryService.ts` | Team history tracking |
| `teamOutputMonitor` | `services/teamOutputMonitor.ts` | Monitor team agent output |
| `fleetService` | `services/fleetService.ts` | Fleet agent definitions |
| `agentDefinitionService` | `services/agentDefinitionService.ts` | Agent role definitions |
| `bastionClient` | `services/bastionClient.ts` | Fleet host discovery via bastion API |

### Config Modules

| Config | File | Purpose |
|--------|------|---------|
| `terminalConfig` | `config/terminalConfig.ts` | Keyboard shortcuts, architecture limits, vim bindings |
| `terminalModes` | `config/terminalModes.ts` | Mode system (strict/balanced/builder/audit), model selection |
| `teamConfig` | `config/teamConfig.ts` | Agent team templates and env generation |
| `claudeConfig` | `config/claudeConfig.ts` | Claude CLI configuration |
| `themes` | `config/themes.ts` | Terminal color themes |

### Tauri Bindings (lib/)

| Binding | File | Purpose |
|---------|------|---------|
| `tauri-pty` | `lib/tauri-pty.ts` | PTY commands: spawn, write, resize, kill, list |
| `tauri-ssh` | `lib/tauri-ssh.ts` | SSH commands: connect, disconnect, write, resize, list keys |
| `tauri-claude` | `lib/tauri-claude.ts` | Claude commands: spawn, write, kill, detect project |
| `tauri-fs` | `lib/tauri-fs.ts` | File system commands: read, write, delete, rename, list |
| `tauri-collector` | `lib/tauri-collector.ts` | Collector WebSocket commands |
| `store` | `lib/store.ts` | Tauri store wrapper (settings persistence) |

### Types

| Type File | Purpose |
|-----------|---------|
| `types/terminal.ts` | Terminal-related TypeScript types |

### Utils

| Util | File | Purpose |
|------|------|---------|
| `fileBlockParser` | `utils/fileBlockParser.ts` | Parse file:create/edit/delete blocks |
| `terminalErrorDetector` | `utils/terminalErrorDetector.ts` | Detect error patterns in output |
| `notificationBeep` | `utils/notificationBeep.ts` | Audio notification |
| `entityExtractor` | `utils/entityExtractor.ts` | Extract entities from text |

---

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Frontend dependencies (React 19, xterm, CodeMirror) |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Vite build configuration |
| `vitest.config.ts` | Vitest test configuration |
| `src-tauri/Cargo.toml` | Rust dependencies (Tauri 2, russh, portable-pty) |
| `src-tauri/tauri.conf.json` | Tauri app configuration (window, CSP, updater) |

---

## Key Features

### 1. Multi-Pane Workspaces
- 8 layout presets: single, split-h, split-v, main-side, side-main, top-split, split-top, quad
- Up to 8 workspace tabs, 4 panes per workspace
- Per-pane session state (local PTY, SSH, Claude mode, editor)
- Workspace persistence via Tauri store

### 2. Terminal Modes
- **Pane Modes:** local (PTY), ssh (remote), claude (Claude CLI overlay), editor (CodeMirror)
- **Claude Modes:** strict, balanced, builder, audit — control AI behavior
- **Model Selection:** Opus 4.6, Sonnet 4.6, Haiku 4.5

### 3. Claude CLI Integration
- Spawns `claude` CLI process with `--output-format stream-json`
- Parses NDJSON events: assistant_message, tool_use, tool_result, input_request, usage
- Mode-aware prompting system with base + policy composition
- Trust profiles for approval batching

### 4. Agent Teams
- Pre-built templates: Feature Build, Code Review, Bug Hunt, Refactor Sprint
- Shared task list via `CLAUDE_CODE_TASK_LIST_ID` env var
- Team control bar with pause/stop
- Task board sidebar
- Team history tracking

### 5. Fleet Management
- Host discovery via bastion API (cached 30s)
- Fleet dashboard sidebar
- Quick SSH connect to fleet hosts
- Host knowledge cards (learned facts)
- Bastion/jump host support

### 6. File Explorer + Editor
- Directory tree with file type icons
- CodeMirror 6 editor with Quox theme
- Multi-file tabs with dirty indicators
- File change cards with apply confirmation

### 7. Tool Palette
- 60+ Quox CLI commands organized by category (TUI, Fleet, AI, Workflows, Memory, Monitoring, Admin, Org, Agents, Assistants)
- Context-aware suggestions based on pane mode
- Parameter input modals with shell escaping
- Command execution in focused pane

### 8. Keyboard Shortcuts
- `Ctrl/Cmd+1-4`: Focus panes
- `Ctrl/Cmd+\`: Toggle AI chat
- `Ctrl/Cmd+Shift+L`: Clear terminal
- `Ctrl/Cmd+Shift+T`: Toggle tool palette
- `Ctrl/Cmd+Shift+E`: Toggle file explorer
- `Ctrl/Cmd+Shift+N`: New workspace
- `Ctrl/Cmd+Shift+W`: Close workspace
- `Ctrl/Cmd+Shift+K`: Toggle Claude mode
- `Ctrl/Cmd+Shift+V`: Toggle Vim mode
- `Ctrl/Cmd+Shift+A`: Toggle Agent Teams modal
- `Ctrl/Cmd+=/−/0`: Zoom in/out/reset
- `Ctrl/Cmd+?`: Show shortcuts overlay

### 9. Vim Mode
- Optional vim-style keybindings (toggle with Ctrl/Cmd+Shift+V)
- j/k: scroll line down/up
- d/u: scroll half page down/up
- G: scroll to bottom
- gg: scroll to top
- i/a: enter insert mode

---

## Test Coverage

40 test files covering:
- Claude output parsing and session tracking
- Terminal configuration and modes
- Team configuration and storage
- Tool registry and command building
- File block parsing
- Entity extraction
- Component rendering (Claude, Files, Teams, Terminal)
- Memory bridge and storage
- Trust profiles
- CLI argument generation

Run tests: `npm test` (vitest)

---

## Build & Run

```bash
# Development
cd quox-terminal
npm install
npm run tauri dev

# Production build
npm run tauri build

# Run tests
npm test
```

---

## Event Flow

### PTY Session
```
TerminalPane → tauri-pty.ptySpawn() → Rust pty_spawn
                                           ↓
xterm.js ← tauri event "pty-output-{id}" ← Rust reader thread
                                           ↓
User input → tauri-pty.ptyWrite() → Rust pty_write → PTY stdin
```

### SSH Session
```
SshConnectDialog → tauri-ssh.sshConnect() → Rust ssh_connect
                                                  ↓
xterm.js ← tauri event "pty-output-{id}" ← Rust SSH channel reader
                                                  ↓
User input → tauri-ssh.sshWrite() → Rust ssh_write → SSH channel
```

### Claude Mode
```
ClaudeInputBar → tauri-claude.claudeWrite() → Rust claude_write
                                                   ↓
ClaudeConversation ← tauri event "claude-event-{id}" ← Rust NDJSON parser
```

### AppState Structure (Rust)
```rust
pub struct AppState {
    pub pty_manager: Mutex<PtyManager>,           // Local PTY sessions
    pub ssh_sessions: tokio::sync::Mutex<HashMap<String, SshSession>>,
    pub claude_sessions: Mutex<HashMap<String, ClaudeSession>>,
    pub collector_client: tokio::sync::Mutex<Option<CollectorWsClient>>,
}
```

---

## Dependencies

### Rust (Cargo.toml)
| Crate | Version | Purpose |
|-------|---------|---------|
| tauri | 2 | Desktop app framework |
| tauri-plugin-store | 2 | Persistent settings |
| tauri-plugin-clipboard-manager | 2 | Clipboard access |
| tauri-plugin-global-shortcut | 2 | Global hotkeys |
| tauri-plugin-updater | 2 | Auto-updates |
| portable-pty | 0.8 | Local PTY |
| russh | 0.46 | SSH client |
| russh-keys | 0.46 | SSH key handling |
| tokio | 1 | Async runtime |
| reqwest | 0.12 | HTTP client |
| tokio-tungstenite | 0.24 | WebSocket client |
| serde/serde_json | 1 | Serialization |

### Frontend (package.json)
| Package | Version | Purpose |
|---------|---------|---------|
| react | 19 | UI framework |
| @tauri-apps/api | 2 | Tauri bindings |
| @xterm/xterm | 5.5 | Terminal emulator |
| codemirror | 6 | Code editor |
| react-markdown | 10 | Markdown rendering |
