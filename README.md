<p align="center">
  <img src="quox-terminal/public/quox-q-icon@2x.png" alt="QuoxTerminal" width="80" />
</p>

<h1 align="center">QuoxTerminal</h1>

<p align="center">
  A native desktop terminal with built-in AI assistant, SSH client, and fleet management.
  <br />
  Built with <strong>Tauri 2.0</strong>, <strong>Rust</strong>, <strong>React 19</strong>, and <strong>xterm.js</strong>.
  <br /><br />
  <strong>Platforms:</strong> macOS &bull; Linux
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#getting-started">Getting Started</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#license">License</a>
</p>

---

## Features

### Terminal
- Native PTY with xterm.js (xterm-256color, true color, Unicode)
- Multi-pane layouts: split horizontal/vertical, quad, main+side
- Workspace tabs with rename, reorder, and session persistence
- Vim-mode keybindings (optional)
- Automatic shell detection (zsh, bash, fish, etc.)
- Custom themes with font/size/opacity controls

### AI Chat
- Sidebar AI assistant powered by the Anthropic Messages API
- Streaming responses (SSE) with token-by-token rendering
- Terminal-aware context: the AI can see your recent output and suggest commands
- Runnable code blocks: click to execute suggestions directly in the terminal
- File change proposals with inline diffs and one-click apply
- Dual authentication: Claude CLI OAuth (`claude login`) or manual API key

### SSH
- Direct SSH connections with key or password authentication
- Bastion/jump host tunneling (`ssh -J` equivalent)
- Known hosts verification with TOFU (Trust On First Use)
- Remote PTY with resize support
- SSH key management (list, detect types)

### Fleet Management
- Real-time fleet dashboard via Quox Collector WebSocket
- Agent status monitoring (connected, stale, dead) with CPU/memory metrics
- Click-to-connect: SSH into any fleet host from the dashboard
- Bastion API proxy for host list and fleet summary

### Safety
- Command denylist with severity levels (red/yellow/green)
- Confirmation modal before executing destructive commands
- Terminal error detection with AI-powered fix suggestions

---

## Platform Support

| Platform | Status |
|----------|--------|
| macOS (Apple Silicon) | Supported |
| macOS (Intel) | Supported |
| Linux (x64) | Supported |
| Windows | Not supported |

QuoxTerminal is built around Unix shells (zsh, bash, fish). Windows shells (PowerShell, cmd) use fundamentally different APIs, escape sequences, and conventions. Windows support is not planned for v0.x.

---

## Getting Started

### Download

Grab the latest release from [GitHub Releases](https://github.com/AdaminX/quoxterminal/releases):

- **macOS** — `.dmg` (Apple Silicon or Intel)
- **Linux** — `.deb` (Debian/Ubuntu) or `.AppImage` (universal)

### Build from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://rustup.rs/) (stable toolchain)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

**macOS:**
```bash
xcode-select --install
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

#### Install & Run

```bash
cd quox-terminal
npm install
npm run tauri dev
```

#### Build for Production

```bash
cd quox-terminal
npm run tauri build
```

The packaged application will be in `quox-terminal/src-tauri/target/release/bundle/`.

---

## Architecture

```
quox-terminal/
  src/                          # React 19 + TypeScript frontend
    components/
      terminal/                 # Terminal panes, chat, SSH dialogs
      hosts/                    # Fleet dashboard, host picker
      settings/                 # App settings panels
      safety/                   # Command warning modals
      ui/                       # Shared UI components
    hooks/                      # React hooks (settings, vim, fleet, safety)
    services/                   # Business logic (context builder, fleet, exec)
    lib/                        # Tauri IPC wrappers (PTY, SSH, collector)
    config/                     # Terminal themes, keybinds, modes

  src-tauri/src/                # Rust backend
    pty/                        # Local PTY session management
    ssh/                        # SSH client, key manager, known hosts
    ai/                         # Anthropic API client + SSE streaming
    collector/                  # WebSocket client + auth for Quox Collector
    safety/                     # Command denylist + validator
    fs/                         # File operations (read, write, delete, rename)
    settings/                   # Font detection, shell discovery
    shell_integration/          # Prompt detection, CWD tracking
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Tauri 2.0 + WRY webview |
| Frontend | React 19, TypeScript, Vite 6 |
| Terminal | xterm.js 5.5 with fit, search, web-links, unicode11 addons |
| Backend | Rust (tokio async runtime) |
| PTY | portable-pty |
| SSH | russh + russh-keys |
| AI | Anthropic Messages API (reqwest + SSE streaming) |
| Fleet | tokio-tungstenite WebSocket client |
| Storage | tauri-plugin-store (JSON settings) |

---

## Configuration

### AI Chat

QuoxTerminal authenticates with the Anthropic API using one of three methods (in priority order):

1. **Claude CLI OAuth** -- Run `claude login` to store credentials at `~/.claude/.credentials.json`
2. **Manual API key** -- Enter your `sk-ant-*` key in Settings
3. **Environment variable** -- Set `ANTHROPIC_API_KEY`

### Quox Collector (Optional)

To use fleet management features, configure your Quox Collector connection in Settings:

- **Collector URL** -- WebSocket endpoint (e.g., `ws://10.0.0.126:9848`)
- **Collector Token** -- API bearer token for authentication

### SSH Keys

QuoxTerminal reads keys from `~/.ssh/`. Supported types:
- Ed25519 (recommended)
- RSA
- ECDSA

Known hosts are verified against `~/.ssh/known_hosts` using TOFU. Changed host keys are rejected to prevent MITM attacks.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` | New workspace tab |
| `Ctrl+Shift+W` | Close current tab |
| `Ctrl+Shift+[` / `]` | Switch tabs |
| `Ctrl+\` | Toggle AI chat sidebar |
| `Ctrl+Shift+P` | Toggle command palette |

Vim mode can be enabled in Settings for modal terminal navigation.

---

## Development

```bash
# Run with hot-reload (frontend + Rust)
cd quox-terminal && npm run tauri dev

# Type-check frontend
npx tsc --noEmit

# Check Rust backend
cd src-tauri && cargo check

# Run frontend tests
npm test
```

---

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/AdaminX">AdaminX</a>
</p>
