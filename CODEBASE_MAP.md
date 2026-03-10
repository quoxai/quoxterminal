<!-- Last verified: 2026-03-10 by /codebase-mirror -->

# QuoxTerminal — Codebase Map

## Metrics
| Metric | Count |
|--------|-------|
| Rust Modules | 14 directories, 41 .rs files |
| React Components | 44 files |
| Test Files | 34 |
| Version | 0.3.1 |

## Authoritative Files
| File | Purpose |
|------|---------|
| `quox-terminal/package.json` | Frontend config, v0.3.1 |
| `quox-terminal/src-tauri/Cargo.toml` | Rust config, v0.3.1 |
| `quox-terminal/src-tauri/src/commands.rs` | Tauri command handlers |

## Invariants
| Check | Status | Details |
|-------|--------|---------|
| Test coverage | ✓ pass | 34 test files |
| Dual platform | ✓ pass | macOS + Linux builds |

## Rust Modules (14)
| Module | Files | Purpose |
|--------|-------|---------|
| ai/ | 4 | AI integration (client, context, streaming) |
| claude/ | 4 | Claude detection, parser, session |
| collector/ | 3 | Auth, WebSocket client |
| fs/ | 3 | File operations, validation |
| memory/ | 2 | Memory system commands |
| pty/ | 4 | PTY manager, session, shell |
| safety/ | 3 | Command denylist, validation |
| settings/ | 3 | Fonts, shells config |
| shell_integration/ | 3 | CWD tracking, prompt detection |
| ssh/ | 5 | SSH client, keys, known_hosts |

## Frontend Components
claude/, hosts/, safety/, settings/, teams/, terminal/, tools/, ui/
