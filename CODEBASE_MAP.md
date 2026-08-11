<!-- Last verified: 2026-08-11 by /codebase-mirror -->

# QuoxTerminal — Codebase Map

> **Version:** 0.4.1 · **Stack:** Tauri 2 + React 19 + Rust + TypeScript · **License:** BUSL-1.1

Native desktop terminal with AI integration, SSH (via bastion), Claude CLI streaming, and fleet
management. App lives in the nested `quox-terminal/` directory. xterm.js terminal emulation,
CodeMirror 6 editing, Rust/Tauri native shell.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        QuoxTerminal                             │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React 19 + TypeScript + Vite 6)                      │
│  ├── xterm.js 5.5 — terminal emulation                          │
│  ├── CodeMirror 6 — file editor                                 │
│  └── Tauri API — IPC to Rust backend                            │
├─────────────────────────────────────────────────────────────────┤
│  Backend (Rust + Tauri 2.0 + tokio async)                       │
│  ├── portable-pty — local PTY sessions                          │
│  ├── russh — SSH client                                         │
│  ├── reqwest — Anthropic API (AI chat)                          │
│  ├── tokio-tungstenite — Collector WebSocket                    │
│  └── tauri-plugin-store — settings persistence                  │
├─────────────────────────────────────────────────────────────────┤
│  Platforms: macOS (Intel + Apple Silicon), Linux (x64)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Metrics

| Metric | Count |
|--------|-------|
| React components (TSX) | 49 |
| Pages (TSX) | 2 |
| React hooks | 8 |
| Services | 15 |
| Config files | 5 |
| Tauri IPC bridges (lib/) | 6 |
| Utils | 4 |
| Rust source files | 41 |
| Rust command modules (dirs) | 10 |
| Tauri commands (registered in lib.rs) | 42 |
| Cargo dependencies | 20 |
| Tool registry entries (10 categories) | 59 |
| Terminal themes | 7 |
| Test files (`*.test.ts` + `*.test.tsx`) | 40 |
| Rust unit tests (`#[test]`/`#[tokio::test]`) | 74 |

---

## Directory Structure

```
quoxterminal/
├── quox-terminal/
│   ├── src/                          # React/TypeScript frontend
│   │   ├── pages/
│   │   │   ├── TerminalView.tsx      # Main terminal workspace (multi-tab)
│   │   │   └── SettingsView.tsx      # App settings panels
│   │   │
│   │   ├── components/               # UI components (49 TSX)
│   │   │   ├── terminal/             # Terminal panes + chat (16 TSX)
│   │   │   │   ├── TerminalPane.tsx          # Per-pane wrapper (PTY/SSH)
│   │   │   │   ├── TerminalEmbed.tsx         # Local xterm.js renderer
│   │   │   │   ├── SshTerminalEmbed.tsx      # Remote PTY renderer (SSH)
│   │   │   │   ├── TerminalChat.tsx          # AI chat panel (mode-aware)
│   │   │   │   ├── RunnableCodeBlock.tsx     # Clickable shell commands
│   │   │   │   ├── FileChangeCard.tsx        # File diff UI with apply
│   │   │   │   ├── FileChangeGroup.tsx       # Groups multiple file changes
│   │   │   │   ├── FileApplyConfirmModal.tsx # File apply confirmation
│   │   │   │   ├── SshConnectDialog.tsx      # SSH connection form
│   │   │   │   ├── ErrorNotificationBar.tsx  # Error detection + AI fixes
│   │   │   │   ├── DiffView.tsx              # Code diff viewer
│   │   │   │   ├── SuggestionChips.tsx       # Follow-up actions
│   │   │   │   ├── HostKnowledgeCard.tsx     # Host metadata display
│   │   │   │   ├── MemoryActivityFeed.tsx    # Memory activity stream
│   │   │   │   ├── SessionRestoreBanner.tsx  # Session recovery UI
│   │   │   │   └── TerminalExecConfirmModal.tsx # Command safety warning
│   │   │   │
│   │   │   ├── claude/               # Claude AI integration (15 TSX)
│   │   │   │   ├── ClaudeConversation.tsx    # Chat message history
│   │   │   │   ├── ClaudeInputBar.tsx        # Message input
│   │   │   │   ├── ClaudePaneEmbed.tsx       # Claude mode pane wrapper
│   │   │   │   ├── ClaudeStatusBar.tsx       # Status indicator
│   │   │   │   ├── ClaudeContextPanel.tsx    # Context settings
│   │   │   │   ├── ClaudeProjectBadge.tsx    # Project indicator
│   │   │   │   ├── ClaudeMdViewer.tsx        # Markdown renderer
│   │   │   │   ├── CostTracker.tsx           # Token usage display
│   │   │   │   ├── TokenBudgetGauge.tsx      # Token budget gauge
│   │   │   │   ├── ToolCallCard.tsx          # Tool invocation display
│   │   │   │   ├── ApprovalBatch.tsx         # Multi-action approval
│   │   │   │   ├── BashOutputCard.tsx        # Terminal output display
│   │   │   │   ├── ReadFileCard.tsx          # File read display
│   │   │   │   ├── EditDiffCard.tsx          # Edit diff display
│   │   │   │   └── FilesTracked.tsx          # Tracked files list
│   │   │   │
│   │   │   ├── files/                # File explorer + editor (5 TSX + 2 TS)
│   │   │   │   ├── FileExplorer.tsx          # Sidebar file tree
│   │   │   │   ├── FileTree.tsx              # Directory node
│   │   │   │   ├── FileTreeItem.tsx          # File/folder node
│   │   │   │   ├── FileEditor.tsx            # CodeMirror 6 editor
│   │   │   │   ├── FileEditorTabs.tsx        # Open file tabs
│   │   │   │   ├── quoxEditorTheme.ts        # Quox theme for CodeMirror
│   │   │   │   └── fileIcons.ts              # File type icons
│   │   │   │
│   │   │   ├── hosts/                # Fleet dashboard (2 TSX)
│   │   │   │   ├── FleetDashboard.tsx        # Real-time status (WebSocket)
│   │   │   │   └── HostPicker.tsx            # Host selection
│   │   │   │
│   │   │   ├── teams/                # Team & agent management (3 TSX)
│   │   │   │   ├── TeamLauncherModal.tsx     # Create/select team
│   │   │   │   ├── TeamControlBar.tsx        # Team status bar
│   │   │   │   └── TaskBoard.tsx             # Agent task tracking
│   │   │   │
│   │   │   ├── tools/                # Tool palette (2 TSX)
│   │   │   │   ├── ToolPalette.tsx           # Categorized CLI tools
│   │   │   │   └── ToolParamModal.tsx        # Tool parameter form
│   │   │   │
│   │   │   ├── settings/             # Settings modal (4 TSX)
│   │   │   │   ├── QuoxSettings.tsx          # Settings container
│   │   │   │   ├── GeneralSettings.tsx       # General settings
│   │   │   │   ├── AppearanceSettings.tsx    # Theme/font settings
│   │   │   │   └── SettingsTerminal.tsx      # Terminal settings
│   │   │   │
│   │   │   ├── safety/               # Command warnings (1 TSX)
│   │   │   │   └── CommandWarning.tsx        # Dangerous command warning
│   │   │   │
│   │   │   └── ui/                   # Shared primitives (1 TSX)
│   │   │       └── Modal.tsx                 # Shared modal component
│   │   │
│   │   ├── hooks/                    # React state hooks (8 files)
│   │   │   ├── useTerminalWorkspace.ts       # Tab & layout management
│   │   │   ├── useClaudeSession.ts           # Claude chat state
│   │   │   ├── useTeamSession.ts             # Agent team session
│   │   │   ├── useSettings.ts                # Persistent settings
│   │   │   ├── useCommandSafety.ts           # Command validation
│   │   │   ├── useFleetStatus.ts             # Fleet monitoring
│   │   │   ├── useVimMode.ts                 # Vim keybinding toggle
│   │   │   └── useTerminalErrorDetection.ts  # Error parsing
│   │   │
│   │   ├── services/                 # Business logic (15 files)
│   │   │   ├── toolRegistry.ts               # Static tool definitions (10 categories)
│   │   │   ├── terminalContextBuilder.ts     # AI context composition
│   │   │   ├── terminalExecService.ts        # Command execution
│   │   │   ├── terminalFileService.ts        # File read/write via Tauri
│   │   │   ├── terminalMemoryBridge.ts       # Local memory operations
│   │   │   ├── claudeOutputParser.ts         # Parse Claude responses
│   │   │   ├── claudeSessionTracker.ts       # Session tracking
│   │   │   ├── claudeTrustProfile.ts         # Trust validation
│   │   │   ├── fleetService.ts               # Collector WebSocket
│   │   │   ├── bastionClient.ts              # Bastion HTTP proxy
│   │   │   ├── localMemoryStore.ts           # localStorage entity storage
│   │   │   ├── agentDefinitionService.ts     # Agent templates
│   │   │   ├── teamStorageService.ts         # Team config persistence
│   │   │   ├── teamOutputMonitor.ts          # Team output events
│   │   │   └── teamHistoryService.ts         # Team run history
│   │   │
│   │   ├── lib/                      # Tauri IPC wrappers (6 files)
│   │   │   ├── tauri-pty.ts                  # PTY invoke/listen
│   │   │   ├── tauri-ssh.ts                  # SSH commands
│   │   │   ├── tauri-claude.ts               # Claude CLI mode
│   │   │   ├── tauri-fs.ts                   # File operations
│   │   │   ├── tauri-collector.ts            # Collector WebSocket
│   │   │   └── store.ts                      # Tauri store wrapper
│   │   │
│   │   ├── config/                   # Configuration (5 files)
│   │   │   ├── terminalModes.ts              # Mode policies + prompts
│   │   │   ├── terminalConfig.ts             # Shortcuts, limits
│   │   │   ├── teamConfig.ts                 # Agent templates
│   │   │   ├── claudeConfig.ts               # Claude CLI settings
│   │   │   └── themes.ts                     # Color schemes
│   │   │
│   │   ├── utils/                    # Utility functions (4 files)
│   │   │   ├── fileBlockParser.ts            # Parse file blocks
│   │   │   ├── entityExtractor.ts            # Extract entities from text
│   │   │   ├── terminalErrorDetector.ts      # Detect terminal errors
│   │   │   └── notificationBeep.ts           # Audio notifications
│   │   │
│   │   ├── types/                    # TypeScript definitions
│   │   │   └── terminal.ts                   # Core terminal types
│   │   │
│   │   ├── __tests__/                # Vitest test suites (40 files)
│   │   ├── App.tsx                   # Root component
│   │   └── main.tsx                  # Entry point
│   │
│   ├── src-tauri/                    # Rust backend
│   │   ├── tauri.conf.json           # Tauri config
│   │   ├── Cargo.toml                # Rust dependencies
│   │   ├── src/
│   │   │   ├── main.rs               # Entry point
│   │   │   ├── lib.rs                # Tauri builder + plugin setup
│   │   │   ├── commands.rs           # IPC handlers (42 commands)
│   │   │   ├── state.rs              # AppState singleton
│   │   │   │
│   │   │   ├── pty/                  # Local PTY (portable-pty)
│   │   │   │   ├── mod.rs                    # Module exports
│   │   │   │   ├── manager.rs                # Session registry
│   │   │   │   ├── session.rs                # PTY with ring buffer
│   │   │   │   └── shell.rs                  # Shell detection
│   │   │   │
│   │   │   ├── ssh/                  # SSH client (russh)
│   │   │   │   ├── mod.rs                    # Module exports
│   │   │   │   ├── session.rs                # Connection lifecycle
│   │   │   │   ├── client.rs                 # Host key verification
│   │   │   │   ├── key_manager.rs            # Key detection
│   │   │   │   └── known_hosts.rs            # TOFU validation
│   │   │   │
│   │   │   ├── ai/                   # Anthropic API client
│   │   │   │   ├── mod.rs                    # Module exports
│   │   │   │   ├── client.rs                 # Core integration
│   │   │   │   ├── streaming.rs              # SSE handler
│   │   │   │   └── context.rs                # System prompt
│   │   │   │
│   │   │   ├── collector/            # Collector WebSocket
│   │   │   │   ├── mod.rs                    # Module exports
│   │   │   │   ├── ws_client.rs              # Connect/auth
│   │   │   │   └── auth.rs                   # Token validation
│   │   │   │
│   │   │   ├── safety/               # Command denylist
│   │   │   │   ├── mod.rs                    # Module exports
│   │   │   │   ├── denylist.rs               # 500+ patterns
│   │   │   │   └── validator.rs              # Severity levels
│   │   │   │
│   │   │   ├── fs/                   # File operations
│   │   │   │   ├── mod.rs                    # Module exports
│   │   │   │   ├── operations.rs             # Read/write/delete
│   │   │   │   └── validation.rs             # Path security
│   │   │   │
│   │   │   ├── claude/               # Claude CLI mode
│   │   │   │   ├── mod.rs                    # Module exports
│   │   │   │   ├── detect.rs                 # Project detection
│   │   │   │   ├── session.rs                # CLI subprocess
│   │   │   │   └── parser.rs                 # NDJSON stream parser
│   │   │   │
│   │   │   ├── memory/               # Local entity storage
│   │   │   │   ├── mod.rs                    # Module exports
│   │   │   │   └── commands.rs               # 7 Tauri commands
│   │   │   │
│   │   │   ├── settings/             # Fonts/shells detection
│   │   │   │   ├── mod.rs                    # Module exports
│   │   │   │   ├── fonts.rs                  # System fonts
│   │   │   │   └── shells.rs                 # Available shells
│   │   │   │
│   │   │   ├── shell_integration/    # CWD/prompt tracking
│   │   │   │   ├── mod.rs                    # Module exports
│   │   │   │   ├── cwd_tracking.rs           # Directory tracking
│   │   │   │   └── prompt_detection.rs       # Prompt parsing
│   │   │   │
│   │   │   ├── tray.rs               # System tray
│   │   │   ├── hotkey.rs             # Global hotkey
│   │   │   └── updater.rs            # Auto-updater
│   │   │
│   │   ├── capabilities/             # Tauri RBAC
│   │   └── icons/                    # App icons
│   │
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── docs/                             # Architecture docs
│   ├── STREAM_QTERM_REBUILD_PLAN.md
│   ├── APPLE_DISTRIBUTION_PLAN.md
│   ├── FILE_EXPLORER_EDITOR_DESIGN_SPEC.md
│   ├── STREAM_FE_FILE_EXPLORER_EDITOR_PLAN.md
│   └── CONCEPT_AUTONOMOUS_TERMINAL_OPERATOR.md
│
├── README.md
├── LICENSE
└── CODEBASE_MAP.md                   # This file
```

---

## Entry Points

| Layer | File | Purpose |
|-------|------|---------|
| Frontend | `src/main.tsx` | React root render |
| Frontend | `src/App.tsx` | Root → `<TerminalView />` |
| Frontend | `src/pages/TerminalView.tsx` | Main orchestrator |
| Backend | `src-tauri/src/main.rs` | Delegates to `lib.rs::run()` |
| Backend | `src-tauri/src/lib.rs` | Tauri builder, plugins, commands |

---

## Registration Chains

**Add a Tauri command:** define `#[tauri::command]` fn in module under `src-tauri/src/<domain>/`
→ re-export from `mod.rs` → add to `tauri::generate_handler![...]` in `lib.rs`
→ add matching wrapper in `src/lib/tauri-<domain>.ts`.

**Add a React component:** create TSX under `src/components/<domain>/` → import in consumer
(`pages/TerminalView.tsx` for workspace surfaces) → add `*.test.tsx` under `src/__tests__/`.

**Add a tool:** entry in `src/services/toolRegistry.ts` (10 categories); `buildCommand()` renders
to shell-escaped string.

---

## Authoritative Files

| File | Purpose | Count |
|------|---------|-------|
| `src-tauri/src/lib.rs` | Tauri builder + command registration | 42 commands |
| `src-tauri/src/state.rs` | `AppState` (PTY/SSH/Claude/Collector managers) | — |
| `src-tauri/Cargo.toml` | Rust dependencies | 20 deps |
| `src/services/toolRegistry.ts` | Static tool definitions | 10 categories |
| `src/config/` | themes, terminalConfig, terminalModes, teamConfig, claudeConfig | 5 files |
| `src/lib/tauri-*.ts` | IPC bridges (pty, ssh, claude, fs, collector, store) | 6 files |

---

## Rust Backend Modules (10 domains)

| Module | Files | Purpose |
|--------|-------|---------|
| `pty/` | mod.rs, manager.rs, session.rs, shell.rs | Local PTY (portable-pty) |
| `ssh/` | mod.rs, client.rs, session.rs, key_manager.rs, known_hosts.rs | SSH client (russh), TOFU |
| `claude/` | mod.rs, session.rs, parser.rs, detect.rs | Claude CLI subprocess |
| `ai/` | mod.rs, client.rs, streaming.rs, context.rs | Anthropic Messages API |
| `fs/` | mod.rs, operations.rs, validation.rs | File ops (sandboxed) |
| `safety/` | mod.rs, validator.rs, denylist.rs | Command safety (red/yellow/green) |
| `memory/` | mod.rs, commands.rs | Local entity bridge (7 commands) |
| `collector/` | mod.rs, ws_client.rs, auth.rs | Collector WebSocket |
| `settings/` | mod.rs, fonts.rs, shells.rs | System introspection |
| `shell_integration/` | mod.rs, cwd_tracking.rs, prompt_detection.rs | Terminal state |

**Top-level:** main.rs, lib.rs, commands.rs, state.rs, tray.rs, hotkey.rs, updater.rs

### PTY Module Detail (`pty/`)

| File | Purpose |
|------|---------|
| `manager.rs` | `PtyManager`: spawn, write, resize, kill sessions |
| `session.rs` | `PtySession`: portable-pty wrapper, shell integration, ring buffer |
| `shell.rs` | Shell detection (zsh → bash → fish → sh) |

**Events emitted:** `pty-output-{sessionId}`, `pty-exit-{sessionId}`

**Shell integration:** Custom Quox prompt (#38bdf8 sky-blue, #a78bfa violet), git branch display. Disable via `QUOX_NO_PROMPT` env var.

### SSH Module Detail (`ssh/`)

| File | Purpose |
|------|---------|
| `session.rs` | `SshSession`: russh connection, PTY channel, streaming output |
| `client.rs` | `ClientHandler`: host key verification, TOFU |
| `key_manager.rs` | SSH key listing from `~/.ssh/` |
| `known_hosts.rs` | Known hosts parser, RSA/ECDSA/Ed25519 support |

**Security:** TOFU (Trust On First Use), fail-closed on key mismatch or parse error.

### Claude Module Detail (`claude/`)

| File | Purpose |
|------|---------|
| `session.rs` | Spawns `claude` CLI with `--output-format stream-json` |
| `parser.rs` | NDJSON parser for stream-json events |
| `detect.rs` | Detects Claude projects (CLAUDE.md, .claude/) |

**Event types:** System, AssistantMessageStart, ContentBlockDelta, ContentBlockStop, ToolUse, ToolResult, InputRequest, Usage, Error

### AI Module Detail (`ai/`)

| File | Purpose |
|------|---------|
| `client.rs` | Anthropic Messages API client (reqwest) |
| `context.rs` | Terminal context builder for AI prompts |
| `streaming.rs` | SSE response handler |

**Auth:** Claude CLI OAuth (`~/.claude/.credentials.json`) preferred, manual API key fallback.

---

## Frontend Components

| Directory | Count | Key Files |
|-----------|-------|-----------|
| `claude/` | 15 | ClaudeConversation, ClaudeInputBar, ClaudePaneEmbed, ToolCallCard, EditDiffCard, CostTracker |
| `terminal/` | 16 | TerminalPane, TerminalEmbed, SshTerminalEmbed, TerminalChat, DiffView, FileChangeCard |
| `files/` | 7 | FileExplorer, FileTree, FileTreeItem, FileEditor, FileEditorTabs, quoxEditorTheme, fileIcons |
| `hosts/` | 2 | FleetDashboard, HostPicker |
| `teams/` | 3 | TeamLauncherModal, TeamControlBar, TaskBoard |
| `tools/` | 2 | ToolPalette, ToolParamModal |
| `settings/` | 4 | QuoxSettings, GeneralSettings, AppearanceSettings, SettingsTerminal |
| `safety/` | 1 | CommandWarning |
| `ui/` | 1 | Modal |

**Pages:** TerminalView.tsx (main workspace, tabbed multi-pane), SettingsView.tsx

### Terminal Components Detail

| File | Purpose |
|------|---------|
| `TerminalPane.tsx` | Per-pane wrapper (local/SSH/Claude modes) |
| `TerminalEmbed.tsx` | xterm.js terminal for local PTY |
| `SshTerminalEmbed.tsx` | xterm.js terminal for SSH |
| `TerminalChat.tsx` | AI chat sidebar |
| `RunnableCodeBlock.tsx` | Code block with "Run" button |
| `SshConnectDialog.tsx` | SSH connection modal |
| `FileChangeCard.tsx` | File edit proposal with diff |
| `DiffView.tsx` | Unified diff viewer |
| `TerminalExecConfirmModal.tsx` | Command safety warning |
| `HostKnowledgeCard.tsx` | Host metadata display |
| `MemoryActivityFeed.tsx` | Memory activity stream |
| `SessionRestoreBanner.tsx` | Session recovery UI |

### Claude Components Detail

| File | Purpose |
|------|---------|
| `ClaudePaneEmbed.tsx` | Claude mode pane wrapper |
| `ClaudeConversation.tsx` | Message stream renderer (auto-scroll) |
| `ToolCallCard.tsx` | Tool execution card (HITL approval) |
| `ClaudeInputBar.tsx` | Chat input |
| `ClaudeStatusBar.tsx` | Status, tokens, cost, model selector |
| `TokenBudgetGauge.tsx` | Visual token gauge |
| `ClaudeContextPanel.tsx` | Context settings panel |
| `ClaudeProjectBadge.tsx` | Project indicator badge |
| `ClaudeMdViewer.tsx` | Markdown content renderer |
| `ApprovalBatch.tsx` | Multi-action approval modal |
| `BashOutputCard.tsx` | Bash command output display |
| `ReadFileCard.tsx` | File read output display |
| `EditDiffCard.tsx` | Edit diff display |
| `FilesTracked.tsx` | Tracked files list |
| `CostTracker.tsx` | Token usage and cost display |

---

## Frontend Hooks (8)

| Hook | Purpose |
|------|---------|
| `useTerminalWorkspace` | Multi-workspace + pane state |
| `useClaudeSession` | Claude CLI tracking |
| `useTeamSession` | Agent team session |
| `useSettings` | App settings (Tauri store) |
| `useCommandSafety` | Command denylist validation |
| `useFleetStatus` | Fleet WebSocket listener |
| `useVimMode` | Vim keybinding toggle |
| `useTerminalErrorDetection` | Error parsing |

---

## Frontend Services (15)

| Service | Purpose |
|---------|---------|
| `toolRegistry` | CLI tool definitions (10 categories) |
| `fleetService` | Fleet agent listing |
| `bastionClient` | Bastion API proxy |
| `terminalFileService` | File read/write via Tauri |
| `terminalContextBuilder` | Build AI context from terminal |
| `terminalExecService` | Execute commands in PTY/SSH |
| `localMemoryStore` | localStorage entity storage |
| `terminalMemoryBridge` | Local memory operations |
| `claudeOutputParser` | Parse Claude stream-json |
| `claudeTrustProfile` | Trust validation |
| `claudeSessionTracker` | Session tracking (files, tokens, cost) |
| `agentDefinitionService` | Agent templates |
| `teamStorageService` | Team config persistence |
| `teamOutputMonitor` | Team output events |
| `teamHistoryService` | Team run history |

---

## IPC Bridges & Commands

### `lib/tauri-pty.ts` → `pty/`
```
pty_spawn, pty_write, pty_resize, pty_kill, pty_list,
pty_session_exists, get_default_shell, get_terminal_output
```

### `lib/tauri-ssh.ts` → `ssh/`
```
ssh_connect, ssh_disconnect, ssh_write, ssh_resize,
ssh_list_keys, ssh_session_exists, ssh_get_output
```

### `lib/tauri-claude.ts` → `claude/`
```
claude_spawn, claude_write, claude_kill, detect_claude_project
```

### `lib/tauri-fs.ts` → `fs/`
```
fs_read_file, fs_write_file, fs_delete_file, fs_rename_file, fs_list_dir
```

### `lib/tauri-collector.ts` → `collector/` + `memory/`
```
collector_connect, collector_disconnect, collector_status,
collector_store_entity, collector_touch_entity, collector_extract_entities,
collector_add_open_loop, collector_add_learned_item,
collector_record_decision, collector_set_focus
```

### `commands.rs` (other)
```
chat_send, chat_send_stream, chat_auth_status,
bastion_list_hosts, bastion_fleet_summary,
validate_command, list_fonts, list_shells
```

---

## Terminal Modes

| Mode | Exec Policy | File Policy | Use Case |
|------|-------------|-------------|----------|
| **strict** | No auto-exec, warn=block | Require confirm | Maximum safety |
| **balanced** | No auto-exec, warn=no-block | Auto-apply | Daily use |
| **builder** | No auto-exec, warn=no-block | Auto-apply | Power users |
| **audit** | No exec (read-only) | Hide buttons | Diagnosis only |

Each mode includes a ~200-line system prompt in `config/terminalModes.ts`.

---

## Configuration

### `config/terminalConfig.ts`
- Limits: MAX_PANES=4, MAX_WORKSPACES=8, MAX_SCROLLBACK=5000
- Font: 8-32px (default 14)
- 40+ keyboard shortcuts (platform-aware)

### `config/terminalModes.ts`
- Terminal modes: strict, balanced, builder, audit
- Model selection: opus, sonnet, haiku
- Base system prompt + per-mode policies

### `config/teamConfig.ts`
- Agent templates: Feature Build, Code Review, Bug Hunt, Refactor Sprint
- Team env generation (CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)
- Cost estimation per-model (opus $3.60/hr, sonnet $0.72/hr, haiku $0.19/hr)

### `config/claudeConfig.ts`
- Claude CLI binary detection, stream-json protocol
- Token costs: opus/sonnet/haiku pricing

### `config/themes.ts`
- 7 terminal color schemes: quox-dark (default), monokai, solarized-dark, dracula, nord, one-dark, catppuccin

### `tauri.conf.json`
- App: QuoxTerminal v0.4.1
- Identifier: `com.quox.terminal`
- Dev URL: `http://localhost:1420`
- Window: 1200x800 (min 600x400)
- Updater: GitHub releases
- CSP: self + api.anthropic.com + localhost WS

---

## Key Dependencies

### Frontend (`package.json`)
```
react: ^19.0.0
@xterm/xterm: ^5.5.0
codemirror: ^6.0.2
@tauri-apps/api: ^2.0.0
react-markdown: ^10.1.0
vite: ^6.0.0
vitest: ^3.0.0
typescript: ^5.6.0
```

### Backend (`Cargo.toml`)
```
tauri: 2 (tray-icon)
tauri-plugin-{store,clipboard-manager,global-shortcut,updater}: 2
portable-pty: 0.8
russh: 0.46
russh-keys: 0.46
tokio: 1 (full)
reqwest: 0.12 (json, stream)
tokio-tungstenite: 0.24
uuid: 1
regex: 1
dirs: 6
base64: 0.22
futures-util: 0.3
serde: 1, serde_json: 1
log: 0.4, async-trait: 0.1
```

---

## Security

### Command Safety (`safety/denylist.rs`)
- **Red**: Destructive (`rm -rf`, `chmod 777`, `sudo reboot`)
- **Orange**: High caution (`dd`, `mkfs`, format)
- **Amber**: Moderate caution (long-running, network)
- **Green**: Safe (read-only)
- **SAFETY-2**: enforcement wired into live paths — `TerminalEmbed` gates typed commands through `validate_command`, `fs/operations.rs` enforces path validation on every write (`fs_write_file` requires a `backup` arg)
- **SAFETY-3**: bracketed-paste input also routed through the safety gate (pasting a dangerous command no longer bypasses validation)

### SSH Known Hosts (`ssh/known_hosts.rs`)
- TOFU verification: Ed25519, RSA, ECDSA
- Fail-closed on parse/read errors
- **PERIM-SEC fix**: uniform verification for all SSH key types (was accepting non-Ed25519 without check)

### File Operations (`fs/validation.rs`)
- Blocks: /System, /bin, /sbin, /usr/bin, /usr/sbin, /etc, /var
- Warnings: /usr/local, sensitive home paths

### AI Context Isolation
- Terminal output windowed (recent N lines)
- Sensitive env vars filtered
- File contents truncated

---

## Types (`types/terminal.ts`)

```typescript
type SessionId = string;
type LayoutPreset = "single" | "split-h" | "split-v" | "main-side" |
                    "side-main" | "top-split" | "split-top" | "quad";

interface SessionInfo { id, shell, cwd, pid, createdAt }
interface PaneState { id, sessionId, title }
interface WorkspaceTab { id, name, layout, panes, activePaneId }
interface AppSettings { fontFamily, fontSize, theme, defaultShell,
                        cursorStyle, cursorBlink, scrollback, globalHotkey }
```

---

## Constraints

1. **No Windows** — Unix shells only (zsh/bash/fish/sh)
2. **Max 4 panes** — xterm.js performance limit
3. **Max 8 workspaces** — UI/memory limit
4. **5000 line scrollback** — Ring buffer, older history lost
5. **SSH keys** — Ed25519, RSA, ECDSA only (no P-521)
6. **Collector optional** — Fleet features degrade gracefully

---

## Development

```bash
# Dev (hot reload)
cd quox-terminal && npm run tauri dev

# Tests
npm test              # Vitest
npx tsc --noEmit     # Type check
cd src-tauri && cargo check

# Build
npm run tauri build  # → src-tauri/target/release/bundle/
```

**Platforms:** macOS (.dmg universal), Linux (.deb/.AppImage)

---

## Invariants

| Check | Status | Details |
|-------|--------|---------|
| Tauri commands defined vs registered | ✓ pass | 42 `#[tauri::command]` fns, 42 entries in `generate_handler!` |
| Every `lib/tauri-*.ts` bridge maps to a Rust module | ✓ pass | pty, ssh, claude, fs, collector (+ store plugin) |
| package.json / Cargo.toml / tauri.conf.json version sync | ✓ pass | all 0.4.1 |
| Every service/component area has test coverage | ✓ pass | 40 Vitest files + 74 Rust unit tests |

---

## Recent Changes

- Claude native mode fix: `-p` rejects TTY-backed stdin, was breaking every message (`claude/session.rs`, `commands.rs`)
- `SAFETY-3`: closed bracketed-paste bypass of the command safety gate (`TerminalEmbed.tsx`)
- Agent-definition writes fix: `fs_write_file` requires a `backup` arg, caller was omitting it and failing silently (`agentDefinitionService.ts`)
- `SAFETY-2`: command/path safety enforcement wired into live paths (`commands.rs`, `fs/operations.rs`, `TerminalEmbed.tsx`, `terminalFileService.ts`)
- `PERIM-SEC`: Uniform TOFU for all SSH key types (was accepting non-Ed25519 without verification)
