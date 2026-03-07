<!-- Last verified: 2026-03-06 by /codebase-mirror -->

# QuoxTerminal — Codebase Map

## Metrics
| Metric | Count |
|--------|-------|
| Version | 0.3.1 |
| Rust Source Files | 42 |
| Rust Modules | 11 |
| Rust Dependencies | 19 |
| React Components | 45 |
| React Component Dirs | 8 |
| Test Files | 34 |
| npm Dependencies | 16 |

## Authoritative Files
| File | Purpose |
|------|---------|
| `quox-terminal/package.json` | Frontend config |
| `quox-terminal/src-tauri/Cargo.toml` | Rust dependencies |
| `quox-terminal/src-tauri/src/` | Rust backend modules |
| `quox-terminal/src/` | React frontend |
| `quox-terminal/src/__tests__/` | Test suite |

## Invariants
| Check | Status | Details |
|-------|--------|---------|
| Test coverage | ✓ pass | 34 test files (18 service + 16 component) |
| Dual platform | ✓ pass | macOS + Linux builds |

## Rust Modules (src-tauri/src/)
| Module | Files | Purpose |
|--------|-------|---------|
| ai/ | 4 | Claude client, context, streaming |
| claude/ | 4 | CLI detect, parser, session |
| collector/ | 3 | WebSocket client, auth |
| fs/ | 3 | File ops, validation |
| memory/ | 2 | Memory bridge commands |
| pty/ | 4 | PTY shell, manager, session |
| safety/ | 3 | Command denylist, validator |
| settings/ | 3 | Fonts, shells config |
| shell_integration/ | 3 | CWD tracking, prompt detection |
| ssh/ | 5 | SSH client, keys, sessions, known_hosts |
| root | 7 | main, lib, state, commands, tray, hotkey, updater |

## React Component Directories
| Directory | Components | Purpose |
|-----------|-----------|---------|
| components/claude/ | 15 | Claude AI chat, cost tracking, diffs |
| components/hosts/ | 2 | Fleet dashboard, host picker |
| components/safety/ | 1 | Command warning |
| components/settings/ | 4 | Appearance, general, Quox, terminal settings |
| components/teams/ | 3 | Task board, team control, launcher modal |
| components/terminal/ | 16 | Terminal panes, chat, SSH, file ops, suggestions |
| components/tools/ | 2 | Tool palette, param modal |
| components/ui/ | 1 | Modal |

## Test Files (34)
Key test areas: terminal chat, fleet dashboard, session restore, error detection, memory bridge, tool palette, Claude output parser, Claude session tracker, entity extractor, team config, task board, agent definitions

## Key Dependencies
| Stack | Packages |
|-------|----------|
| Tauri 2.0 | tauri, plugin-store, plugin-clipboard, plugin-global-shortcut, plugin-updater |
| Terminal | xterm.js + addons (fit, search, unicode11, web-links) |
| React | react 19, react-dom, react-markdown |
| Rust SSH | russh, russh-keys |
| Rust PTY | portable-pty |
| HTTP | reqwest |
