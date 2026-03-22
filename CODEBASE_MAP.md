<!-- Last verified: 2026-03-21 by /codebase-mirror -->

# QuoxTerminal — Codebase Map

## Metrics

| Metric | Count |
|--------|-------|
| Version | 0.3.1 |
| Rust modules (src-tauri/src/) | 41 files across 11 modules |
| React components (.tsx) | ~45 |
| Test files | 44 |

## Stack

Tauri 2.0, Rust (backend), React 19 + TypeScript (frontend), xterm.js

## Rust Backend Modules (src-tauri/src/)

| Module | Files |
|--------|-------|
| ai/ | client.rs, context.rs, streaming.rs, mod.rs |
| claude/ | parser.rs, session.rs, detect.rs, mod.rs |
| collector/ | ws_client.rs, auth.rs, mod.rs |
| fs/ | validation.rs, operations.rs, mod.rs |
| memory/ | commands.rs, mod.rs |
| pty/ | manager.rs, session.rs, shell.rs, mod.rs |
| safety/ | denylist.rs, validator.rs, mod.rs |
| settings/ | fonts.rs, shells.rs, mod.rs |
| shell_integration/ | cwd_tracking.rs, prompt_detection.rs, mod.rs |
| ssh/ | client.rs, key_manager.rs, session.rs, known_hosts.rs, mod.rs |
| root | main.rs, lib.rs, commands.rs, state.rs, tray.rs, hotkey.rs, updater.rs |

## React Frontend Components

Key areas: terminal/, claude/, hosts/, teams/, tools/, safety/, settings/, ui/

Notable components: TerminalChat, TerminalEmbed, TerminalPane, ClaudeConversation, ClaudeInputBar, FleetDashboard, TeamLauncherModal, TaskBoard, ToolPalette, CommandWarning

## Test Files (44)

Located in quox-terminal/src/__tests__/. Covers: terminal core, Claude integration, fleet dashboard, session persistence, error detection, memory bridge, tool palette, team management, native mode, trust profiles, and more.
