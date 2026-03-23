<!-- Last verified: 2026-03-22 by /codebase-mirror -->

# QuoxTerminal — Codebase Map

## Metrics
| Metric | Count |
|--------|-------|
| Version | 0.3.2 |
| Rust Backend Files | 42 |
| Rust Modules | 11 |
| React Components | 45+ |
| Frontend Services | 15 |
| Hooks | 8 |
| Test Files | 34 |

## Authoritative Files
| File | Purpose |
|------|---------|
| `quox-terminal/package.json` | Frontend config (v0.3.1) |
| `quox-terminal/src-tauri/Cargo.toml` | Rust dependencies (37) |
| `quox-terminal/src-tauri/src/` | Rust backend (42 files, 11 modules) |
| `quox-terminal/src/components/` | React components (8 dirs, 45+ files) |
| `quox-terminal/src/services/` | Frontend services (15 files) |
| `quox-terminal/src/__tests__/` | Test suite (34 files) |

## Invariants
| Check | Status | Details |
|-------|--------|---------|
| rust-modules | ✓ pass | 11 modules: ai, claude, collector, fs, memory, pty, safety, settings, shell_integration, ssh, root |
| component-dirs | ✓ pass | 8 component directories with 45+ components |
| test-coverage | ✓ pass | 34 test files covering components, services, hooks, utilities |

## Rust Backend (42 files, 11 modules)

| Module | Files | Purpose |
|--------|-------|---------|
| ai | 4 | AI client, context, streaming |
| claude | 4 | Parser, session, detection |
| collector | 3 | WebSocket client, auth |
| fs | 3 | File operations, validation |
| memory | 2 | Memory commands |
| pty | 4 | PTY manager, session, shell |
| safety | 3 | Command denylist, validator |
| settings | 3 | Fonts, shells config |
| shell_integration | 3 | CWD tracking, prompt detection |
| ssh | 5 | Client, key manager, session, known hosts |
| root | 7 | main, lib, commands, state, tray, hotkey, updater |

## React Frontend

### Components (8 directories, 45+ files)

| Directory | Files | Purpose |
|-----------|-------|---------|
| claude/ | 15 | AI chat UI (conversation, input, status, tools, diffs, costs) |
| terminal/ | 16 | Terminal panes, SSH, errors, suggestions, memory feed, file ops |
| hosts/ | 2 | Fleet dashboard, host picker |
| settings/ | 4 | Appearance, general, quox, terminal settings |
| teams/ | 3 | Task board, team control, launcher |
| tools/ | 2 | Tool palette, param modal |
| safety/ | 1 | Command warning |
| ui/ | 1 | Modal |

### Services (15)

| Service | Purpose |
|---------|---------|
| agentDefinitionService | Agent definitions |
| bastionClient | Bastion API client |
| claudeOutputParser | Claude output parsing |
| claudeSessionTracker | Session tracking |
| claudeTrustProfile | Trust profiles |
| fleetService | Fleet management |
| localMemoryStore | Local memory |
| teamHistoryService | Team history |
| teamOutputMonitor | Team output monitoring |
| teamStorageService | Team storage |
| terminalContextBuilder | Terminal context |
| terminalExecService | Command execution |
| terminalFileService | File operations |
| terminalMemoryBridge | Memory bridge |
| toolRegistry | Tool registry |

### Hooks (8)

useClaudeSession, useCommandSafety, useFleetStatus, useSettings, useTeamSession, useTerminalErrorDetection, useTerminalWorkspace, useVimMode

## Stack
| Component | Technology |
|-----------|-----------|
| Desktop | Tauri 2.0 |
| Backend | Rust (tokio, russh, portable-pty) |
| Frontend | React 19, TypeScript, Vite 6 |
| Terminal | xterm.js 5.5 |
| Testing | Vitest 3.0, @testing-library/react 16 |
| Platforms | macOS (Apple Silicon + Intel), Linux (x64) |
