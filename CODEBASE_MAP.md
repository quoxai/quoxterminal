<!-- Last verified: 2026-03-14 by /codebase-mirror -->

# QuoxTerminal — Codebase Map

## Metrics
| Metric | Count |
|--------|-------|
| Rust Modules | 10 directories, 41 .rs files |
| Rust LOC | 4,423 |
| React Components | 45 files |
| React Services | 15 files |
| React Hooks | 8 files |
| Test Files | 35 |
| Version | 0.3.1 |

## Authoritative Files
| File | Purpose |
|------|---------|
| `quox-terminal/package.json` | Frontend config, v0.3.1 |
| `quox-terminal/src-tauri/Cargo.toml` | Rust config, v0.3.1 |
| `quox-terminal/src-tauri/src/commands.rs` | Tauri command handlers |
| `quox-terminal/src-tauri/src/main.rs` | Entry point |

## Invariants
| Check | Status | Details |
|-------|--------|---------|
| Test coverage | ✓ pass | 35 test files |
| Dual platform | ✓ pass | macOS (Apple Silicon + Intel) + Linux (x64) |
| Component coverage | ✓ pass | 45 components across 8 categories |

## Rust Backend Modules
| Module | Files | Purpose |
|--------|-------|---------|
| ai/ | 4 | AI client, context, streaming |
| claude/ | 4 | Claude detection, parsing, sessions |
| collector/ | 3 | Collector auth, WebSocket client |
| fs/ | 3 | File operations, validation |
| memory/ | 2 | Memory service, commands |
| pty/ | 4 | PTY manager, sessions, shell |
| safety/ | 3 | Command denylist, validation |
| settings/ | 3 | Font, shell configuration |
| shell_integration/ | 3 | CWD tracking, prompt detection |
| ssh/ | 5 | SSH client, key manager, sessions |

## React Component Categories
| Category | Count | Key Components |
|----------|-------|---------------|
| claude/ | 15 | ClaudeConversation, ClaudeInputBar, TokenBudgetGauge, ToolCallCard |
| terminal/ | 14 | TerminalPane, TerminalChat, SessionRestoreBanner, FileChangeCard |
| hosts/ | 2 | FleetDashboard, HostPicker |
| teams/ | 3 | TaskBoard, TeamControlBar, TeamLauncherModal |
| settings/ | 4 | AppearanceSettings, GeneralSettings, QuoxSettings |
| tools/ | 2 | ToolPalette, ToolParamModal |
| safety/ | 1 | CommandWarning |
| ui/ | 1 | Modal |

## React Services (15)
agentDefinitionService, bastionClient, claudeOutputParser, claudeSessionTracker, claudeTrustProfile, fleetService, localMemoryStore, teamHistoryService, teamOutputMonitor, teamStorageService, terminalContextBuilder, terminalExecService, terminalFileService, terminalMemoryBridge, toolRegistry

## React Hooks (8)
useClaudeSession, useCommandSafety, useFleetStatus, useSettings, useTeamSession, useTerminalErrorDetection, useTerminalWorkspace, useVimMode

## Key Dependencies
- **Rust:** tauri 2.x, russh 0.46, portable-pty 0.8, reqwest 0.12, tokio 1.x
- **Frontend:** React 19, xterm.js 5.5, Vite 6, Vitest 3, TypeScript 5.6

## Platforms
macOS (Apple Silicon + Intel): .dmg | Linux (x64): .deb + .AppImage | Windows: not supported
