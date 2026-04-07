<!-- Last verified: 2026-04-07 by /codebase-mirror -->

# QuoxTerminal — Codebase Map

Tauri desktop terminal with PTY, SSH, Claude AI integration, and fleet management.

## Metrics
| Metric | Count |
|--------|-------|
| Rust Modules | 11 |
| Rust Files | 41 |
| React Component Dirs | 9 |
| Test Files | 39 |

## Authoritative Files
| File | Purpose |
|------|---------|
| `quox-terminal/src-tauri/src/main.rs` | Tauri entry point |
| `quox-terminal/src-tauri/src/commands.rs` | IPC command registration |
| `quox-terminal/src-tauri/src/state.rs` | App state management |
| `quox-terminal/package.json` | v0.4.1, React 19 |

## Invariants
| Check | Status | Details |
|-------|--------|---------|
| tauri-commands | ✓ pass | All Rust modules have TS bindings |
| test-coverage | ✓ pass | 39 test files |

## Rust Modules (11)
| Module | Files | Purpose |
|--------|-------|---------|
| ai/ | 4 | AI streaming client + context |
| claude/ | 4 | Claude CLI detection + output parsing |
| collector/ | 3 | QuoxCORE collector WebSocket + auth |
| fs/ | 3 | File system operations with validation |
| memory/ | 2 | Memory/context persistence |
| pty/ | 4 | PTY lifecycle management |
| safety/ | 3 | Command safety validation (denylist) |
| settings/ | 3 | User settings (fonts, shells) |
| shell_integration/ | 3 | Shell CWD + prompt detection |
| ssh/ | 5 | SSH client with key management |
| root | 7 | commands, hotkey, lib, main, state, tray, updater |

## React Component Directories (9)
claude/ (15), terminal/ (16), safety/ (1), tools/ (2), ui/ (1), files/, hosts/, settings/, teams/

## Key Dependencies
Tauri 2, portable-pty 0.8, russh 0.46, tokio (async), xterm.js 5.5, CodeMirror 6, React 19
