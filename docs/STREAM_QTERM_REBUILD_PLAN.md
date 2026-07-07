# STREAM QTERM-REBUILD — QuoxTerminal Complete Rebuild (Cockpit Surface) — Plan v1

> **STATUS: DRAFT — UNREVIEWED BY OWNER**
> Generated: 2026-07-06 by Fable planning session (QUOX-FABLE-PLANS). Two-pass: [x] research+draft [x] adversarial second pass
> Owner review checklist: [ ] Read [ ] Open questions answered [ ] Scope approved [ ] Priority confirmed
> Roadmap: #114, Tier 3, effort TBD (~3-6w), depends on CLI-COCKPIT (DONE 2026-07-05). Timing gate: LATER — after AUDIT-REAL + ops spine.

---

## 1. Context & Current State

### 1.1 The existing app

Repo `quoxterminal`; the app lives in `quoxterminal/quox-terminal/` (v0.4.1, `quox-terminal/src-tauri/tauri.conf.json:4`). Stack: Tauri 2.0 + Rust backend (~3,150 LoC across 14 modules in `quox-terminal/src-tauri/src/`) + React 19 frontend (95 TS/TSX files) + xterm.js. macOS + Linux only (README.md "Platform Support"). Features shipped: multi-pane local PTY, SSH client with bastion jump, sidebar AI chat (direct Anthropic API), Claude CLI mode, Agent Teams mode, fleet dashboard via collector WS, file explorer + CodeMirror editor, tray/hotkey/updater.

### 1.2 The 2026-07-03 audit verdict, verified at ground truth (2026-07-06)

Verdict source: `quox-dashboard/docs/CONFIDENCE_CAMPAIGN_2026_07_03.md:96` — "quoxterminal: NOT safe to ship". Five findings; current ground-truth status of each:

**(a) Denylist advisory-only / never enforced — CONFIRMED, actually worse than "advisory".**
- The Rust denylist + validator work and are tested (`src-tauri/src/safety/validator.rs:23-80`, `src-tauri/src/safety/denylist.rs`), exposed as IPC command `validate_command` (`src-tauri/src/commands.rs:158-159`, registered `src-tauri/src/lib.rs:73`).
- The ONLY frontend consumer is the hook `src/hooks/useCommandSafety.ts` — which is imported by **zero** components (grep across `src/`: no call sites outside the hook file and its tests). The warning UI `src/components/safety/CommandWarning.tsx` is likewise imported nowhere.
- `pty_write` (`src-tauri/src/commands.rs:41`) and `ssh_write` (`src-tauri/src/commands.rs:403`) write raw bytes with no validation. Any keystroke or AI-suggested command reaches the shell unchecked.
- A *second, duplicated* TypeScript denylist exists in `src/services/terminalExecService.ts:97-121` (own `DENIED_PATTERNS`, own severity model) used for the AI-exec path — frontend-side, so trivially bypassable and drift-prone vs the Rust list. Maturity: **Broken (theater)**.

**(b) SSH host-key verification fail-open — STALE PREMISE: fixed 2026-07-05**, commit `aa9cd9e` ("PERIM-SEC: uniform known_hosts TOFU for ALL SSH host-key types... fail closed"). Current `src-tauri/src/ssh/client.rs:41-104` verifies every key type uniformly and fails closed on known_hosts read errors. **However, two real gaps remain:**
- **Silent TOFU**: Unknown hosts are accepted and persisted with only a log line (`ssh/client.rs:72-82`) — no user prompt, no fingerprint display. A first connection to an attacker's host is accepted silently.
- **No hashed-hostname support**: `known_hosts.rs:88-90` compares plaintext host fields only. OpenSSH `|1|`-hashed entries (the default on many distros) never match → status `Unknown` → silent re-TOFU of a possibly-different key. Also no `@revoked`/`@cert-authority` marker handling. Maturity: **Beta (mechanism sound, UX unsafe)**.

**(c) IPC fs write unrestricted — CONFIRMED.** `src-tauri/src/fs/operations.rs`: `write_file` (:50-54), `delete_file` (:80-84), `rename_file` (:107-122) reject only `PathSeverity::Blocked`; **Amber (`/etc/…`) and Red (`/dev/…`) classifications are computed and then ignored** — `/etc/passwd` and `/dev/sda` are writable via IPC; `~/.ssh/authorized_keys` is Green. Additionally `validate_path` (`src-tauri/src/fs/validation.rs:36-69`) string-checks `..` but never canonicalizes — **symlink traversal bypasses the classifier entirely** (a Green-rooted symlink pointing into `/etc` classifies Green). Maturity: **Broken**.

**(d) Memory no-op stubs — CONFIRMED.** All 7 `collector_*` memory IPC commands log and return `Ok(())`/empty (`src-tauri/src/memory/commands.rs:76-175`; the header comment at :1-9 admits it). Actual persistence is `src/services/localMemoryStore.ts` on top of `src/lib/store.ts` (tauri-plugin-store JSON file, localStorage fallback in dev) — i.e. **local browser-adjacent storage is primary**, a direct violation of the zero-tolerance persistence rule. Server-side memory APIs that should be the source of truth already exist: collector `GET /memory/tools`, `POST /memory/tool/execute`, `POST /memory/tool/batch` (`quox-dashboard/services/collector/server.js:17086-17157`, `requireAuth()`), proxying the quox-memory service (`MEMORY_URL`, `server.js:3256,3334`). Maturity: **Stub**.

**(e) Secrets plaintext at rest — CONFIRMED.** The Anthropic API key is saved via `storeSet("anthropic-api-key", …)` (`src/components/settings/QuoxSettings.tsx:53,106`) → tauri-plugin-store plain JSON on disk (`src/lib/store.ts:22-48`, localStorage fallback). `src-tauri/src/collector/auth.rs:9` *claims* "Tauri secure store (keychain/keyring)" in a comment, but no `keyring`/`stronghold` dependency exists anywhere in `src-tauri` (grep: only that comment). Maturity: **Broken claim**.

### 1.3 What is clean and tested (salvage candidates)

- **Local PTY layer** `src-tauri/src/pty/` (manager/session/shell, ring buffer) — no audit findings; solved problems (resize plumbing, shell detection, 1MB output ring buffer reused by SSH).
- **SSH transport** `src-tauri/src/ssh/client.rs` + `session.rs` (russh; direct, password, bastion `direct-tcpip` jump; post-PERIM-SEC verification callback) — mechanism sound; needs the TOFU-UX + hashed-hosts work in §4.3.
- **Denylist pattern corpus** `safety/denylist.rs` (222 lines of curated regex rules w/ severity) and validator tests — the *data* is good; the *enforcement point* is wrong.
- **Path severity classifier** `fs/validation.rs` — good taxonomy, needs canonicalization + enforcement.
- **Claude CLI integration** `src-tauri/src/claude/` (project detection `detect.rs`, output `parser.rs`, session mgmt) and frontend `src/services/claudeOutputParser.ts`, `useClaudeSession.ts` — this is precisely the "Claude-CLI-in-a-cockpit" capability the rebuild is FOR.
- **Frontend terminal components** (`src/components/terminal/`, xterm.js wiring, workspace tabs) and fleet dashboard (`src/services/fleetService.ts`, `bastionClient.ts`, collector `ws_client.rs`).
- Updater with signed releases (`tauri.conf.json` plugins.updater + pubkey), tray, global hotkey.

### 1.4 The cockpit target (what we are rebuilding INTO)

- **CLI-COCKPIT (roadmap #5) is DONE 2026-07-05**: QuoxCLI (`quox-dashboard/cli/`) now has agent-targeted streaming chat over the collector — `GET /chat/stream` SSE with `query_id`, double-encoded `prompt`, `assistant` (agent id), `session_id` resume, `context` (`cli/lib/commands/chat.js:9-27`; SSE reader `cli/lib/core/client.js:187-290`; service routing auth:3101 / collector:9848 at `client.js:6,41`). Remaining CLI-COCKPIT tails (parity wiring, token-level streaming, run.js bug) per `quox-dashboard/docs/HANDOVER_QUOX_FABLE_2026_07_03.md:39-42`.
- **QL-LITE (#30) reframing** (roadmap note 2026-07-03): QuoxLite ≈ the cockpit ≈ Claude/agent-CLI + Quox skills + CLI/quoxmcp surface; QuoxLite becomes a *packaging* job later. The old `STREAM_QL_PLAN.md` (OpenCode Go fork, 2026-03-29) predates this reframing — treat its architecture as historical, its *vision* (30-sec aha, grows-on-laptop, connect-to-full) as current.
- **Owner's cockpit definition** (memory `idea_quoxterminal_rebuild_cockpit.md`): "Claude (Code or Agent SDK) + Quox skills/prompts/CLAUDE.md guidelines + the driving surfaces." Two agent-driving surfaces: **quox CLI** (shell/scriptable) and **quoxmcp** (audit-verified solid — the 2nd cockpit surface, `CONFIDENCE_CAMPAIGN_2026_07_03.md` / handover :49). Frontier: "an agent that IS CommanderQ, driving the whole platform via these surfaces." The rebuilt desktop terminal is the SHELL around that loop: a governed place to run Claude/agents, chat with collector agents, SSH the fleet, and watch it all with a tamper-evident trail.

---

## 2. Problem Statement & Goals

**Problem.** The shipped QuoxTerminal has governance theater (safety UI never wired, enforcement absent at the write chokepoints), local-primary persistence, plaintext secrets, and a silent-TOFU SSH UX — and its product concept (generic terminal + BYOK AI sidebar) predates the cockpit strategy. Owner decision: complete rebuild as the cockpit surface; do not patch the old codebase.

**Success criteria ("done" looks like):**
1. A new lite-compatible desktop app in this repo whose **every write path (PTY, SSH, fs) passes through one Rust policy gateway**; RED commands physically cannot execute from the agent path; approvals are enforced in Rust (not by the frontend choosing to ask).
2. SSH connects use **prompted TOFU with fingerprint display**, hashed known_hosts matching, fail-closed everywhere; optional strict pinning for fleet hosts from the bastion registry. Automated MITM-simulation tests pass.
3. IPC fs operations are **default-deny outside user-approved workspace roots**, canonicalize-then-check (symlink-safe), severity approvals enforced in Rust.
4. Memory reads/writes go to **collector server-side APIs** (`/memory/tool/execute|batch`); a fresh install + login reproduces memory state; local store is cache/outbox only. Zero no-op stubs.
5. Secrets (Anthropic key if kept, collector token) live in the **OS keychain**; nothing secret in plugin-store JSON or localStorage.
6. Cockpit chat surface streams from collector `GET /chat/stream` with agent targeting + session resume (same contract as QuoxCLI), and Claude CLI mode launches with Quox context packs + quoxmcp + quox CLI available.
7. Every agent-initiated action emits an audit record synced to the collector (tamper-evident trail is the demo wedge).
8. Rust/security surfaces covered by automated tests (cargo test + integration); desktop UI verified via a written manual QA matrix on macOS + Linux; `docs/STATUS_AND_LIMITS_QTERM.md` shipped honest at close.

---

## 3. Non-Goals / Out of Scope

- **Windows support** (unchanged from v0.x, README).
- **Building QuoxLite itself** (Go binary / packaging) — this stream only keeps the cockpit lite-compatible (§4.6).
- **Patching the old `quox-terminal/` app** — it is frozen; no fixes land there (the 2026-07-05 PERIM-SEC SSH fix was the last; new gaps found here, e.g. the fs symlink bypass, are documented, not fixed).
- **New collector/auth endpoints** beyond what exists — the cockpit consumes the same endpoints as QuoxCLI; if a gap is found it becomes a small scoped task, not a server stream.
- **Orchestration widgets** (roadmap pane, stream kickoff UI, multi-agent dev portal / DevShell) — explicitly deferred to a follow-up phase pending owner scope call (Open Question 4); v1 is chat + terminal + SSH + fleet + files, governed.
- **Agent Teams mode parity** — old feature, re-evaluate after v1 (it predates the collector-agent model).
- Marketing/site updates, app-store distribution work (`docs/APPLE_DISTRIBUTION_PLAN.md` remains separate).

---

## 4. Proposed Architecture / Design

### 4.1 Shape: new app, salvage-by-review

New top-level app dir `quoxterminal/cockpit/` (working name; product name decision = Open Question 2), Cargo **workspace** + Vite React frontend. Old `quox-terminal/` stays frozen until v1 parity, then is deleted in the final phase.

```
cockpit/
  src-tauri/                 Tauri 2 shell (thin: window, tray, updater, capability config)
    crates/
      qt-gateway/            THE trust boundary: policy engine + approval broker + audit emitter
      qt-pty/                local PTY (salvaged from quox-terminal/src-tauri/src/pty after review)
      qt-ssh/                russh transport + known-hosts engine (salvaged client/session + NEW verification UX)
      qt-fsx/                canonicalizing, root-scoped file ops (validation.rs taxonomy salvaged; ops rewritten)
      qt-secrets/            OS keychain (keyring crate); no secret ever crosses IPC to the frontend
      qt-collector/          HTTP/SSE client for auth:3101 + collector:9848 (chat, memory, audit sync, fleet)
      qt-claude/             Claude CLI detect/parse/session (salvaged)
  src/                       React cockpit UI (xterm.js panes + chat surface + fleet + files)
    packages/cockpit-ui/     transport-agnostic components (lite-compat, §4.6)
```

**Rule that makes it a rebuild and not a patch:** the IPC surface is designed fresh and minimal; no Rust module is imported until it passes a written salvage review (checklist: no `Ok(true)`-style fail-opens; no unsanitized paths; no secrets handling; tests preserved and extended; owner of the module boundary is `qt-gateway`, not the frontend). Modules failing review are rewritten. Expected salvage: `pty/*`, `ssh/client.rs`+`session.rs`, `safety/denylist.rs` (data), `fs/validation.rs` (taxonomy), `claude/*`, plus most frontend terminal components. Expected rewrite: everything else — IPC command set, state, settings, memory bridge, safety enforcement, secrets, chat.

### 4.2 The exec gateway (fixes audit finding a — honestly)

Single chokepoint crate `qt-gateway`. All writes flow through it; the raw `pty_write`/`ssh_write` IPC commands **do not exist** in the new app.

Two tiers, stated honestly (no keystroke-governance theater):

- **Tier 1 — agent/structured path (hard enforcement).** Every command that originates from software — chat "run this" blocks, Claude-mode tool suggestions, fleet click-to-run, anything invoked via `exec_command(session_id, command, origin)` IPC — is validated in Rust *before* any byte reaches a PTY. `RED+blocked` → rejected, period. `RED+requires_auth`/`ORANGE` → gateway parks the command under a one-time nonce, emits an `approval-request` event; only `approve(nonce)` from the OS-level modal releases it; frontend cannot construct a bypass because the only write IPC for structured commands is `exec_command` itself. `AMBER` → executes + warning event.
- **Tier 2 — human typing (best-effort, honestly labeled).** Interactive keystrokes go to `pty_input(session_id, bytes)` which is *typing*, not command submission. With shell integration installed (OSC 133 command-boundary hooks via the existing `shell_integration` module — salvage candidate), the gateway sees the assembled command line at pre-exec and can hard-block there too. Without shell integration: newline-triggered line-buffer inspection → overlay warning only. The UI labels the mode ("governed prompt" badge when shell integration is active). We never claim keystroke-level enforcement we don't have — `STATUS_AND_LIMITS_QTERM.md` states the tier split.

Policy data: salvaged `denylist.rs` corpus becomes `qt-gateway/policy/rules.rs`, one source of truth — the duplicated TS list in `terminalExecService.ts` dies. Verdict model unchanged (RED/ORANGE/AMBER/GREEN → BLOCK / REQUIRE_OVERRIDE / REQUIRE_APPROVAL / WARN / ALLOW, `validator.rs:14-19` semantics).

**Audit trail:** every Tier-1 verdict + approval + execution emits a local append-only JSONL record (hash-chained, prev-hash field — AEE-lite) and is batched to the collector when connected (endpoint confirmation is P1 task 1.6; candidate: existing AEE ingest used by agents — verify against collector routes at implementation time, do NOT invent one). Offline records queue and sync later. This trail is the "governed agent + tamper-evident audit" wedge from the QL-LITE funnel note.

### 4.3 SSH done right (fixes finding b residue)

Keep russh + the salvaged transport. Replace the verification callback's silent behavior:

1. `check_server_key` consults a new `known_hosts` engine supporting **plaintext AND `|1|` HMAC-SHA1 hashed** host lines, `[host]:port`, and treating `@revoked` as hard-fail / `@cert-authority` as no-match (documented limitation).
2. `Trusted` → proceed. `Changed` → hard fail with key-changed screen (fingerprints old vs new, remediation copy; "remove & retrust" requires typed hostname confirmation).
3. `Unknown` → **pause the handshake** (the callback awaits a oneshot channel), emit `hostkey-prompt` event with SHA256:base64 fingerprint (OpenSSH format), key type, host, port. User Accept → persist entry + proceed; Reject/timeout (60s) → fail closed. No auto-accept path exists.
4. **Fleet pinning (strict mode):** hosts known to QuoxBastion can ship pinned host keys via the bastion API (`bastionClient.ts` already talks to it); when a pin exists, TOFU prompting is disabled for that host — mismatch = hard fail. Requires bastion to expose host keys; if it doesn't yet, this sub-feature is descoped to a follow-up (verify at P3 start; do not build a fake pin source).
5. Config: per-profile `strict | tofu-prompt` (default `tofu-prompt`); no `accept-new`-silent option at all.

### 4.4 IPC fs sandbox (fixes finding c)

`qt-fsx` semantics:
- **Workspace roots:** user grants directories (VS Code-style trust flow); grants persist (non-secret) in plugin-store; the grant UI is Rust-modal-driven.
- Every op: `canonicalize()` target (and parent for creates) → must be prefix-of an approved root, else deny. Kills both `..` and symlink traversal (which the old `validation.rs:36-69` misses).
- Severity taxonomy retained *on the canonical path*: Amber → gateway approval round-trip; Red → write/delete denied outright (read allowed w/ warning); the classifier result is enforced, not decorative (unlike `operations.rs:50-54,80-84`).
- Tauri capability files scoped minimally (audit `capabilities/default.json` at scaffold: no `fs:allow-*` wildcards; only the custom commands we define).

### 4.5 Memory + secrets (fix findings d, e)

- **Memory:** delete the stub pattern entirely. `qt-collector` implements the 7 memory operations as calls to collector `POST /memory/tool/execute` / `batch` (`server.js:17086-17157`), authed with the collector token. A persistent **outbox** (SQLite via `rusqlite`, or JSONL) queues writes offline and replays on reconnect; reads come from the server with a short-lived cache. `localMemoryStore.ts` is deleted; fresh-install-reproduces-state is the acceptance test. Disconnected-forever mode simply has no memory features enabled (honest), until QuoxLite-local-memory exists (out of scope).
- **Secrets:** `qt-secrets` on the `keyring` crate (macOS Keychain / Secret Service). IPC surface: `secret_set(name)`, `secret_probe(name) -> bool` — **no `secret_get` to the frontend**. Consumers (`qt-collector` for tokens; Claude CLI OAuth creds reused as today via `ai::resolve_auth`-style detection in `qt-claude`) read the keychain inside Rust. Collector login: reuse QuoxCLI's auth flow shape (auth:3101) — token lands directly in keychain.

### 4.6 Cockpit surface + lite compatibility

**Chat panel (the core new surface):** speaks the QuoxCLI contract byte-for-byte — `GET /chat/stream` SSE, `query_id`, double-encoded `prompt`, `assistant`, `session_id`, `context` (`cli/lib/commands/chat.js:9-27`). Agent picker (CommanderQ/Sentinel/etc.), multi-turn resume, streamed markdown, runnable command blocks → Tier-1 gateway. The old direct-Anthropic `ai/` client is **dropped** (Open Question 3): local/offline AI = Claude CLI mode; connected AI = collector agents. One less secret, one less parallel chat stack.

**Claude cockpit mode:** launch `claude` in a governed PTY with a **Quox context pack**: workspace CLAUDE.md fragment (Quox guidelines), quoxmcp registered as MCP server (the audit-solid 2nd surface), quox CLI on PATH — packaging the owner's Fable-orchestration loop as the product. Salvaged `claude/detect.rs` drives project awareness; `parser.rs` powers the session HUD.

**Lite-compatibility rules (so QuoxLite can package this later):**
1. All server data via the SAME public endpoints QuoxCLI uses (auth:3101, collector:9848) — no desktop-only endpoints, no Tauri-private data paths for server-owned data.
2. `packages/cockpit-ui` components take a `Transport` interface (`TauriTransport` | plain `HttpTransport`) — the chat/fleet/memory UI must run in a browser context unmodified (this is also how we can smoke-test with vitest/clarify-mcp without a Tauri build).
3. Agent capabilities are expressed as quox CLI commands and quoxmcp tools — never as bespoke IPC — so any future packaging (Go binary, web) inherits the same "agent hands".
4. Config/profile file format aligned with QuoxCLI's service-URL config (`cli/lib/core/config.js` shapes) so one login concept spans CLI + cockpit.

---

## 5. Phase Plan

Estimates assume one implementation session-stream (coder-grade) with orchestrator review; ranges are working days. Total: **26–34d ≈ 5–7 weeks** (roadmap's 3–6w TBD was optimistic at the low end; 3w is only reachable by cutting P5 scope). Parallelism: P2 frontend work can overlap P3 (different layers); P4 overlaps P5 partially.

### Phase 0 — Scaffold + salvage review (3–4d)
1. Create `cockpit/` Cargo workspace + Tauri 2 shell + Vite React app; CI: `cargo test` + `clippy -D warnings` + `vitest` + `cargo audit`.
2. Minimal capability config; document the full IPC command list in `cockpit/docs/IPC_SURFACE.md` (kept current every phase — this is the security review artifact).
3. Execute salvage reviews (checklist in §4.1) for `pty/`, `ssh/`, `safety/denylist.rs`, `fs/validation.rs`, `claude/`, `shell_integration`; record verdicts in the plan-doc appendix; import approved code into crates with tests compiling.
4. `qt-secrets` with keyring + tests (feature-flagged mock keyring for CI).
- **Deliverable:** empty-but-booting app, crates compiling, salvage verdicts written. **Tests:** cargo unit tests for qt-secrets; CI green. **Effort: 3–4d.**

### Phase 1 — Cockpit chat surface (5–6d)
1. `qt-collector`: auth login flow (mirror QuoxCLI), token → keychain; SSE client for `/chat/stream` (port the parsing rules from `cli/lib/core/client.js:187-290` incl. the double-encoding contract).
2. Chat UI in `packages/cockpit-ui`: streaming render, agent picker, session resume, error states (collector down, token expired).
3. Runnable command blocks wired to `exec_command` — gateway skeleton lands HERE (verdict + block + approve nonce flow), even before terminal panes exist, so Tier-1 enforcement is day-one.
4. Audit JSONL emitter + hash chain; collector sync task stub (endpoint confirmation task 1.6).
5. Contract tests against a local collector (docker) or recorded SSE fixtures; live-verify against dev collector.
6. Confirm the collector audit-ingest endpoint for gateway records (read collector routes; if none fits, file a scoped gap note for orchestrator — do not invent).
- **Deliverable:** login → pick agent → streamed governed chat. **Tests:** Rust SSE-parser unit tests, gateway verdict table tests (port `validator.rs` tests), contract test vs fixtures; manual QA: chat happy path + auth failure. **Effort: 5–6d.**

### Phase 2 — Terminal + Claude cockpit mode (5–6d)
1. PTY panes: xterm.js embed, workspace tabs, splits (salvage frontend terminal components; re-wire to new IPC: `pty_open/pty_input/pty_resize/pty_close`).
2. `pty_input` line-buffer inspection + warning overlay (Tier 2); shell-integration (OSC 133) install flow + pre-exec hard gate when present; "governed prompt" badge.
3. Claude cockpit mode: launch Claude CLI in governed PTY with context pack (CLAUDE.md fragment, quoxmcp MCP registration, quox CLI PATH check + doctor hints); session HUD from salvaged parser.
4. Settings view (fonts/shell/theme — non-secret settings in plugin-store fine).
- **Deliverable:** usable governed terminal + Claude mode. **Tests:** Rust PTY lifecycle tests (existing suite), OSC-133 boundary parser unit tests, gateway Tier-2 line-inspection tests; manual QA: typing latency, resize, vim-mode spot check, Claude session on a real repo. **Effort: 5–6d.**

### Phase 3 — SSH done safely (5–7d)
1. `qt-ssh`: import transport; implement known_hosts engine (plaintext + hashed matching, markers) — pure functions, heavy table tests.
2. Pause-handshake TOFU prompt (oneshot channel), fingerprint UI, key-changed screen, 60s fail-closed timeout.
3. Bastion jump path re-verified (`connect_via_bastion` — note: target host-key verification through the tunnel uses the target's handler, `ssh/client.rs:224-228` pattern — keep).
4. Fleet pinning spike: check whether QuoxBastion exposes host keys; implement pin-strict mode if yes, else descope with a note.
5. Integration tests: in-process russh test server presenting (i) unknown key → prompt path, (ii) changed key → hard fail (MITM sim), (iii) hashed-hosts match, (iv) revoked marker → fail. These are the stream's flagship automated tests.
- **Deliverable:** SSH + bastion with prompted TOFU. **Tests:** as above (automated, cargo); manual QA: connect to a real fleet host via access01 bastion, reject flow, accept flow, reconnect-trusted. **Effort: 5–7d.**

### Phase 4 — fs sandbox + file explorer/editor (4–5d)
1. `qt-fsx` ops with canonicalize + root prefix checks + enforced severity approvals; workspace-trust grant flow.
2. Port file tree + CodeMirror editor views (salvage from old frontend, re-wire IPC).
3. Symlink/traversal adversarial test suite (symlink out of root, `..` mixtures, non-UTF8 names, TOCTOU note: open-then-verify via `openat`-style or accept documented residual risk on Linux — decide in-phase, document).
- **Deliverable:** files/editor inside trusted roots only. **Tests:** automated adversarial path suite; manual QA: grant flow, edit/save/backup, Amber approval modal. **Effort: 4–5d.**

### Phase 5 — Memory via server APIs + fleet parity (4–5d)
1. `qt-collector` memory ops → `/memory/tool/execute|batch`; outbox with replay; delete-stub acceptance test (grep gate in CI: no `Ok(())`-stub pattern in memory paths).
2. Terminal memory bridge (entities/errors/commands/focus) re-pointed server-side; fresh-install-reproduces-state live verify.
3. Fleet dashboard: salvage `fleetService`/`ws_client.rs` onto new transport; click-to-connect → P3 SSH.
4. Tray/hotkey/updater re-enable (new app identifier/updater feed decision — Open Question 2 affects this).
- **Deliverable:** memory truthful + fleet parity. **Tests:** outbox unit tests (offline→replay ordering, idempotency keys), memory round-trip against dev collector; manual QA: fleet board live, disconnect/reconnect. **Effort: 4–5d.**

### Phase 6 — Hardening, packaging, honesty doc (4–6d)
1. Security self-audit sweep (multi-pass, incl. secrets grep, IPC surface review vs `IPC_SURFACE.md`, capability diff).
2. Packaging: macOS (Apple Silicon + Intel) + Linux builds, signed updater manifests; upgrade/migration note for old-app users (no settings migration of secrets — user re-enters into keychain; memory now server-side so nothing to migrate; old plugin-store settings optionally imported non-secret fields).
3. Manual QA matrix executed on both OSes (checklist per surface: chat, terminal, Claude mode, SSH, files, fleet, settings, tray/updater).
4. Write `quoxterminal/docs/STATUS_AND_LIMITS_QTERM.md` (required for stream COMPLETE per working rules) — honest tier split for exec governance, TOFU semantics, offline behavior.
5. Delete `quox-terminal/` old app (separate commit, after owner nod) + README rewrite.
- **Deliverable:** shippable v1 + honesty doc. **Effort: 4–6d.**

---

## 6. Blast Radius & Risks

- **Isolated repo, additive dir** — nothing imports `quoxterminal` code from other repos (desktop client). Blast radius of the rebuild itself ≈ zero on the platform. The risky touchpoints are the *server contracts* it consumes:
  - `GET /chat/stream` double-encoding quirk (`chat.js:9-16`) — if collector normalizes this later, CLI + cockpit both break; contract tests in P1 catch it.
  - `/memory/tool/*` shapes (`server.js:17086-17157`) — currently consumed by dashboard + CLI; cockpit adds a third consumer (good per API-first principle, but version drift risk — pin to fixtures + live verify).
  - Bastion host-key pinning (P3.4) may require a QuoxBastion change — cross-repo, gated by a spike, descope-able.
- **Multi-tenant:** cockpit is per-user; collector calls carry the user's token — memory + chat are already org-scoped server-side. No new tenancy surface.
- **russh crate risk:** salvaged transport depends on russh/russh-keys versions; hashed-known-hosts + revoked markers are OUR parsing on top. Mitigation: the known_hosts engine is pure + heavily table-tested; `cargo audit` in CI.
- **Updater continuity:** old app auto-updates from GitHub latest.json (`tauri.conf.json` updater endpoint). Shipping the rebuild on the SAME feed force-upgrades old users to a differently-shaped app; new identifier = old installs strand forever. Needs an owner call (Open Question 2b).
- **Scope spiral risk (the named nemesis):** the cockpit vision (DevShell, roadmap orchestration, Quox-builds-Quox) is huge; this plan pins v1 to governed chat+terminal+SSH+files+fleet and pushes orchestration widgets out (§3). Guard: any new widget idea → roadmap substream, not this stream.
- **TOCTOU residue in fs sandbox** (canonicalize-then-operate race) — documented decision point P4.3; not a regression vs old app (which had nothing).

## 7. Dependencies & Sequencing

- **Depends on CLI-COCKPIT — satisfied** (DONE 2026-07-05); its remaining tails (token-level streaming, parity wiring) are *nice-to-haves* for the cockpit, not blockers — the SSE chunk contract works today (live-verified in that stream).
- **Timing gate (owner):** LATER — after AUDIT-REAL completion + q01 ops spine. This plan is ready-to-start whenever that gate opens.
- **quoxmcp**: consumed as-is (audit: solid). **QuoxBastion**: optional pin API (P3 spike).
- **Blocks/unblocks:** unblocks QL-LITE packaging (#30) — QuoxLite later wraps `packages/cockpit-ui` + the same endpoints; unblocks the DevShell/orchestration-cockpit ideas as follow-on substreams; retires the not-safe-to-ship verdict on the quoxterminal repo.

## 8. Test & Verification Strategy

Per Test Type Triage:
- **Automated (Rust/security/logic):** gateway verdict tables (ported from `validator.rs` tests + new origin/nonce/approval flows); known_hosts engine tables (hashed/plaintext/markers/ports); in-process russh MITM sims (P3.5); fs adversarial path suite (symlinks, traversal, canonical prefixes); outbox replay/idempotency; SSE parser fixtures; secrets keyring mock tests. CI: cargo test + clippy + cargo audit + vitest for `cockpit-ui` logic.
- **Manual QA (desktop UI):** written checklist per phase (chat streaming feel, terminal latency/resize/vim, TOFU prompt flows, approval modals, files trust flow, fleet board, tray/hotkey/updater) executed on macOS + Linux; final matrix in P6. No claim of "UI verified" from unit tests alone.
- **Live verify (orchestrator-run):** P1 chat against dev collector with real OAuth/token; P3 SSH against a real fleet host via access01; P5 memory fresh-install-reproduces-state check against dev collector.
- **Honesty gates:** CI grep for stub patterns in memory paths; `IPC_SURFACE.md` diff review each phase; STATUS_AND_LIMITS doc mandatory before COMPLETE.

## 9. Open Questions for Adam

1. **Salvage-by-review vs literal from-scratch.** "Complete rebuild" — this plan rebuilds the trust architecture, IPC surface, and product surface but salvages ~5 reviewed leaf modules (PTY, SSH transport, denylist data, path taxonomy, Claude parser). OK, or do you want char-zero greenfield? — **Recommended: salvage-by-review (saves ~1.5–2w, the flagged bugs were wiring/enforcement, not in these modules). Confidence: high.**
2. **Naming/placement + updater feed.** (a) New app dir `cockpit/` in quoxterminal repo, old `quox-terminal/` frozen then deleted at P6 — OK? (b) Ship on the SAME updater feed/identifier (existing installs auto-upgrade into the new app) or new identifier (clean break, old installs strand)? — **Recommended: (a) yes; (b) same feed, since old app is not-safe-to-ship — force-upgrading users OFF it is the point. Confidence: (a) high, (b) medium.**
3. **Drop the direct-Anthropic BYOK chat client?** v1 AI = collector agents (connected) + Claude CLI (local). Kills a parallel chat stack + a stored secret. — **Recommended: drop it. Confidence: medium-high** (QL-LITE "zero-install aha" may eventually want BYOK, but that's Lite packaging's problem).
4. **v1 scope of orchestration widgets** (roadmap pane, stream kickoff, sessions board — the "very me, very Quox" vision). — **Recommended: none in v1; first follow-up substream after parity, designed on top of `cockpit-ui`. Confidence: medium** (this is a product-identity call, not technical).
5. **Two-tier exec governance acceptable?** Hard enforcement on agent/structured path; human typing = shell-integration gate when installed, else advisory overlay — stated openly in STATUS_AND_LIMITS. — **Recommended: yes; the alternative (claiming keystroke enforcement) is governance theater. Confidence: high.**
6. **Effort acceptance.** Ground-truth estimate 26–34d (5–7w) vs roadmap "~3-6w". A 3–4w cut exists (defer P4 files + P5 fleet to v1.1). — **Recommended: full v1 at 5–7w; the cut version ships a cockpit without files/fleet which undercuts parity. Confidence: medium.**

## 10. Decisions Made on Owner's Behalf

- Treated "advisory-only denylist" as *zero-wired* (evidence: no call sites) and designed enforcement at the Rust chokepoint rather than fixing the frontend hook.
- Counted the audit's 5th finding (plaintext secrets) as in-scope for the rebuild's security design even though the stream summary lists 4 areas.
- Chose Tauri 2 again (not Electron/native/Go TUI) — team already has the stack, updater keys, and salvageable code; QL-LITE reframing removed the pressure to make the desktop app itself the single binary.
- Chose collector `/chat/stream` (QuoxCLI contract) as the chat backbone instead of the old direct-Anthropic client.
- Made memory hard-require a collector connection (no local-primary fallback mode) per the zero-tolerance persistence rule; offline = outbox for writes, features degrade honestly.
- Specced prompted-TOFU as default with no silent accept-new option; strict pinning only if bastion actually exposes host keys (spike-gated, no fake pin source).
- Kept Windows out of scope; kept Agent Teams mode out of v1.
- Set the flagship automated-test bar at in-process russh MITM simulations + adversarial fs path suite (Rust/security = automated; UI = manual QA matrix).
- Planned deletion of the old app at P6 (after owner nod) rather than indefinite freeze.
- Did not patch the newly-found old-app bugs (fs symlink bypass, unused safety UI) — documented here only, per "do NOT patch the old codebase".

## 11. Second-Pass Review Notes

Adversarial pass done 2026-07-06 (same session, fresh read of the draft):

1. **Stress-test: salvage-by-review vs owner's "complete rebuild".** Strongest case against salvage: (i) the owner's words; (ii) audits repeatedly show bugs living in the *seams* of reused code (this repo's own SSH fix history: the fail-open lived in the verification callback of otherwise-fine transport code); (iii) salvaged code carries its old assumptions (e.g. `ssh/session.rs` emits output on `pty-output-*` events shared with local PTY naming — fine, but couplings like this sneak in). Counter-evidence: every one of the five audit findings is an enforcement/wiring/storage-choice failure, none is in the candidate modules' core logic; rewriting PTY resize plumbing and russh channel handling reproduces exactly the class of subtle bugs the old code already burned down (52bc923 "fix streaming text corruption" etc.). **Verdict: salvage stands, but the review checklist gained a requirement from this pass — each salvaged module must arrive with its event/IPC couplings severed (gateway-owned event names, no direct `app.emit` from transport crates).** §4.1/P0.3 reflect this. Residual risk accepted and surfaced as Open Question 1.
2. **Stress-test: TOFU design.** (i) Pause-the-handshake needs care: russh's `check_server_key` awaiting a UI oneshot means holding the handshake open ~60s — verify russh/server timeout tolerance in P3.2, else pre-connect probe (connect, harvest key, disconnect, prompt, reconnect) is the fallback design — added as an explicit in-phase decision. (ii) Hashed-hosts *writing*: plan reads both formats but writes plaintext by default — an information-disclosure regression vs `HashKnownHosts yes` environments; made write-format config-following (match the file's existing style) a P3.1 acceptance criterion. (iii) The prompt itself is a spoofing surface — fingerprint UI must be a Rust-driven native/OS-modal (like approvals), not a spoofable in-DOM overlay; folded into P3.2. (iv) First-connect-via-bastion prompts twice (bastion + target) — acceptable, but UX copy must distinguish them; noted for P3 manual QA.
3. **Found and fixed in draft:** audit-sync endpoint was originally asserted as existing — corrected to a confirm-first task (P1.6) per verify-premise-at-ground-truth; effort total re-added from phases (26–34d) and the mismatch with the roadmap's 3–6w surfaced as Open Question 6 instead of being silently absorbed.
4. **Honesty check:** the plan claims no enforcement it doesn't design (Tier 2 labeled advisory; pinning spike-gated; memory offline = degraded not fake). STATUS_AND_LIMITS commitments present. No governance theater found on re-read.
5. **Remaining soft spot (acknowledged, not resolved):** the collector-token login UX for a desktop app (device-code vs paste-token vs browser deep-link) is under-specified — P1.1 says "mirror QuoxCLI" which is paste/OAuth-profile based; a nicer flow is a v1.1 concern. Low risk, noted.
