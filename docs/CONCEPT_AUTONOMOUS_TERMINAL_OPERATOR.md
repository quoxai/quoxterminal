# Concept: Autonomous Terminal Operator

**Status:** Shelved (experimental, fun, revisit later)
**Date:** 2026-03-02
**Author:** Adam Cowles + Claude Opus 4.6

---

## The Fantasy

You open QuoxTerminal. You type one sentence: "Deploy the new API to staging,
run the integration tests, fix anything that breaks, and tell me when it's done."

QuoxTerminal spawns 6 tabs. Each tab gets a name. Each tab gets a Claude
session. They talk to each other via a shared task list. You watch 24 panes
of terminals moving simultaneously — commands being typed, output scrolling,
agents checking on each other, tasks getting created, assigned, completed.

Your phone buzzes: "Staging deploy complete. 2 tests failed. Fixer agent
patched both. Re-run green. Ready for review."

You were making coffee.

---

## What This Actually Is

Not an MCP bridge. Not Computer Use. Not a new protocol.

It's **Claude Code Agent Teams running inside QuoxTerminal with a UX designed
for spectating at scale.** The AI doesn't need to "see" the QuoxTerminal UI or
control it with mouse clicks. It runs *inside* the terminals. QuoxTerminal is
the viewport, not the target.

The insight: a human can comfortably monitor ~8 Claude terminals before
cognitive overload. An orchestrator agent has no such limit. The bottleneck
isn't Claude — it's the human's ability to track what's happening. So the
real engineering problem isn't "make Claude control more terminals." It's
"make it possible for a human to comfortably spectate 20+ terminals without
missing anything important."

---

## Why It's Compelling

### For the builder (you)

Watching 20 AI agents coordinate across terminals, each working on a piece
of a larger task, visible in real-time — that's the demo that sells itself.
No pitch deck needed. Open the laptop, type a sentence, and let people watch
their jaws drop.

### For real work

The honest productivity case: you already run 8 Claude sessions. That's a
workflow, not a gimmick. The question is whether scaling from 8 to 20+ with
better coordination produces proportionally more output or just proportionally
more chaos.

Arguments it works:
- Parallelizable tasks (test 5 services, audit 3 repos, deploy to 4 envs)
- Agent Teams' shared task list prevents duplicate work
- Each agent is scoped to its own session — blast radius is contained
- The orchestrator pattern (one lead, N workers) already exists in Agent Teams

Arguments it doesn't:
- Most real engineering tasks are *sequential*, not parallel
- 20 Claude sessions burn ~$15-40/hr in API costs at Sonnet rates
- Coordination overhead grows non-linearly with agent count
- When things go wrong, they go wrong in 20 places simultaneously

### For the product

QuoxTerminal's positioning shifts from "nice terminal app with AI" to
"AI operations center." That's a different market. DevOps teams, SREs,
platform engineers — people who already have 20 terminals open and hate it.

---

## Architecture: What Exists vs What's Needed

### Already Built (v0.3.1)

| Component | Status | Notes |
|-----------|--------|-------|
| Multi-pane layouts (up to 4 per tab) | Done | quad, split-h, etc. |
| Multi-workspace tabs (up to 8) | Done | = 32 panes max |
| Claude mode overlay toggle | Done | Works on local + SSH |
| Agent Teams env vars | Done | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
| Team launcher modal | Done | Template gallery + customization |
| Team control bar | Done | Status, pause, stop |
| Task board sidebar | Done | Kanban view of shared tasks |
| Output monitor | Done | Parses PTY output for task patterns |
| Team role badges | Done | Colored dots + names on pane headers |

### The Gap

| Component | Difficulty | Description |
|-----------|-----------|-------------|
| **Scale beyond 4 panes per tab** | Medium | Current `MAX_PANES=4`. Need 6-8 per tab for serious agent density. Layout engine needs new presets (hex, octo). |
| **Smart alert system** | Medium | Surface "Agent waiting for input", "Task completed", "Error detected" as persistent notifications, not just pane header flashes. Sound/desktop notification support. |
| **Agent activity heatmap** | Low | Visual indicator of which panes are active (output flowing) vs idle (waiting). Subtle background color or border animation. |
| **Auto-scroll focus** | Medium | When an agent does something interesting (completes task, hits error), auto-focus that pane briefly or highlight it. Like a TV director cutting between cameras. |
| **Orchestrator pane** | Medium | Dedicated lead agent pane that's always visible (pinned), with a wider view. Other panes arranged around it. Think "mission control" layout. |
| **Cost tracker** | Low | Running total of API spend across all agents. Already have per-session tracking; need aggregation. |
| **Session recording** | Hard | Record the terminal output of an entire team session for replay. Like a flight recorder. Debug why an agent did something stupid. |
| **Graceful degradation** | Medium | When one agent errors/hangs, don't let it block others. Timeout + auto-restart with context recovery. |
| **Human intervention queue** | Medium | When Claude hits a permission boundary or needs approval, queue it visibly rather than blocking silently in a pane you're not watching. |

### The "Spectator Mode" UX

This is the real product insight. The human isn't driving — they're
spectating. The UX should optimize for:

1. **Glanceable status** — I look at the screen for 2 seconds and know:
   which agents are working, which are waiting, how far along we are.

2. **Interrupt-driven attention** — I don't watch continuously. I get
   pulled in when something needs me (approval, error, completion).

3. **Drill-down on demand** — I click a pane to full-screen it and read
   the actual terminal output when I need detail.

4. **Trust but verify** — I can see the command history of any agent,
   what it ran and why, without having to have watched it live.

The mental model is **air traffic control**, not **driving a car**.

```
┌──────────────────────────────────────────────────────────────┐
│  QuoxTerminal — Feature Build Team              [$4.20/hr]   │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  12/20 tasks   [38m elapsed]        │
├──────────────────────────────────────────────────────────────┤
│ ALERTS ─────────────────────────────────────────────────────│
│ ! Builder B waiting for approval: "Delete old migration?"   │
│ * Tester: 14/16 tests passing (2 pending fix)              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─── Architect (LEAD) ──────┐  ┌─── Builder A ───────────┐ │
│  │ $ claude --mode code      │  │ $ claude --mode code     │ │
│  │ > Creating task: "Add     │  │ > Editing src/api/       │ │
│  │   rate limiter to /api/   │  │   rateLimit.ts...        │ │
│  │   upload endpoint"        │  │ ████░ active             │ │
│  │ ████░ active              │  │                          │ │
│  └───────────────────────────┘  └──────────────────────────┘ │
│                                                              │
│  ┌─── Builder B ─────────────┐  ┌─── Tester ──────────────┐ │
│  │ $ claude --mode code      │  │ $ claude --mode code     │ │
│  │ > ⚠ WAITING FOR INPUT     │  │ > Running: npm test      │ │
│  │   "Should I delete the    │  │   ✓ auth.test.ts (14)    │ │
│  │    old migration file?"   │  │   ✗ upload.test.ts (2)   │ │
│  │ ░░░░ blocked              │  │ ████░ active             │ │
│  └───────────────────────────┘  └──────────────────────────┘ │
│                                                              │
│  [Task Board]  [Cost Detail]  [Session Log]  [Stop All]     │
└──────────────────────────────────────────────────────────────┘
```

---

## How It Would Actually Work (Technical)

### Phase 0: What Happens Today

User clicks "Launch Team" in the modal. QuoxTerminal:
1. Creates a workspace tab
2. Sets layout (e.g., quad = 4 panes)
3. Each pane spawns a local PTY (bash shell)
4. Claude mode auto-activates on each pane
5. Writes `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 CLAUDE_CODE_TASK_LIST_ID=xxx claude --mode code` to each PTY
6. Each Claude instance picks up the shared task list and starts working

This already works. The gap is UX at scale, not plumbing.

### Phase 1: Scale the Viewport

**Raise MAX_PANES to 8.** Add layouts:

| Layout | Panes | Use Case |
|--------|-------|----------|
| `hex-grid` | 6 | 1 lead + 5 workers |
| `octo-grid` | 8 | Full team, dense |
| `command-center` | 5 | 1 large lead + 4 small workers |
| `stadium` | 6 | 2 rows of 3, good for monitoring |

With 8 tabs x 8 panes = 64 theoretical panes. Nobody needs that. But
3 tabs x 6 panes = 18 agents is plausible for a complex operation.

The terminal text gets small at 6-8 panes. That's fine — you're not
reading it. You're watching for patterns (green = good, red = bad,
spinning = active, static = idle). Like monitoring dashboards.

### Phase 2: Notification System

Parse PTY output in real-time (we already have `teamOutputMonitor.ts`):

| Pattern | Detection | Alert Level |
|---------|-----------|-------------|
| `? ` / `(y/n)` / `[Y/n]` | Claude waiting for input | Critical (blocks progress) |
| `Task #N completed` | Task finished | Info |
| `error:` / `FAILED` | Something broke | Warning |
| `All tasks completed` | Team done | Success (push notification) |
| No output for 60s | Agent stalled | Warning |
| `/exit` typed by Claude | Agent quit unexpectedly | Critical |

Alert delivery:
- **In-app banner** (always) — the alerts bar in the mockup above
- **Desktop notification** (opt-in) — Tauri notification API
- **Sound** (opt-in) — subtle chime for completion, alert tone for errors
- **Pane border flash** — the pane that needs attention glows briefly

The key insight: **don't interrupt for good news.** Only pull the human
in for decisions, errors, and completion. Everything else is just a
status dot color change.

### Phase 3: The Orchestrator

Agent Teams already has a "lead" agent concept. The orchestrator is the
lead with extra powers:

1. **Task creation** — lead creates and assigns tasks
2. **Checkpoint summaries** — every N minutes, lead writes a status
   summary to a shared file that QuoxTerminal renders in the control bar
3. **Escalation** — lead flags items that need human approval
4. **Cost awareness** — lead's system prompt includes current spend;
   told to wrap up if approaching budget

The orchestrator doesn't need special QuoxTerminal integration. It's
just a Claude instance with a carefully written agent definition file
(`.claude/agents/lead.md`) that instructs it to coordinate.

### Phase 4: Session Recording

Every PTY output chunk already flows through `onPtyOutput`. Tee it to
a log file:

```
~/.quox/recordings/{teamSessionId}/{paneId}.cast
```

Use [asciinema asciicast v2 format](https://docs.asciinema.org/manual/asciicast/v2/)
— it's just newline-delimited JSON with timestamps. Then you can replay
any pane's session later, either in QuoxTerminal or via `asciinema play`.

This is the flight recorder. When an agent does something stupid at
3am, you can replay it frame by frame and understand why.

### Phase 5: Human Intervention Queue

When output monitoring detects a prompt/question:
1. Pause the alert bar notification
2. Show the question text + which agent is asking
3. Two buttons: "Go to pane" (focus it) or "Type response" (inline)
4. Inline response writes directly to that pane's PTY

This keeps the human in spectator mode — they don't have to hunt for
which pane is waiting. The question comes to them.

---

## Danger Study

### Threat Categories

#### 1. Cost Runaway

**Scenario:** 8 agents running Claude Opus 4.6 for 2 hours.

| Model | $/hr per agent | 8 agents x 2hr |
|-------|---------------|-----------------|
| Haiku 4.5 | ~$0.30 | $4.80 |
| Sonnet 4.6 | ~$2.00 | $32.00 |
| Opus 4.6 | ~$8.00 | $128.00 |

An unattended team of 8 Opus agents could burn $60+/hr. With 18 agents
across 3 tabs? That's potentially $150/hr if they're all Opus.

**Mitigations:**
- Hard budget cap per team session (configurable, default $20)
- Cost tracker visible at all times in control bar
- Auto-pause when budget hits 80% with desktop notification
- Default all workers to Sonnet/Haiku, only lead gets Opus
- Show estimated hourly rate before launch

**Residual risk:** Medium. User could override limits. But at least
they'd do it knowingly.

#### 2. Cascading Failures

**Scenario:** Agent A writes a broken config file. Agents B, C, D all
read it. They all try to fix it. They all write conflicting fixes. Now
you have 4 agents fighting over the same file in an infinite loop.

This is the most likely failure mode with multi-agent systems. Agent
Teams' shared task list helps (agents claim tasks, avoiding collisions),
but it doesn't prevent agents from stepping on each other's filesystem
changes.

**Mitigations:**
- File locking: agent definition files should assign directory scopes
  (Builder A owns `src/api/`, Builder B owns `src/ui/`)
- Git-based conflict detection: agents commit to branches, lead merges
- Circuit breaker: if an agent runs the same command 3 times in a row,
  auto-pause and alert the human
- Time box: team sessions have a max duration (default 30min), force
  stop with summary after that

**Residual risk:** High. This is fundamentally hard. Multiple agents
editing the same codebase will produce conflicts. The mitigation is
cultural (good agent definitions) not technical (perfect locking).

#### 3. Security: Credential Leak via Agent Context

**Scenario:** Agent reads a `.env` file or terminal output containing
an API key. That key is now in Claude's context window. It gets sent to
Anthropic's API. If the context is logged, the key is exposed.

**Mitigations:**
- Agent definition files should include: "Never read .env files or
  files containing secrets"
- QuoxTerminal's existing secret detection hook catches writes, but
  can't prevent reads
- Terminal output sanitization before rendering in task board/alerts
- Scope agent filesystem access via Claude's permission system

**Residual risk:** Medium. Can't fully prevent an agent from reading
sensitive data that exists in the project directory.

#### 4. Security: Prompt Injection via Terminal Output

**Scenario:** A remote server's output contains crafted text that looks
like Claude instructions. Agent reads it, follows the injected instruction.

In a multi-agent setup this is worse: the injected instruction could
tell the agent to create a task for OTHER agents to execute. The shared
task list becomes an amplification vector.

**Mitigations:**
- This is an unsolved problem in the industry
- Anthropic's prompt injection classifier helps but isn't perfect
- Limiting agents to known/trusted hosts reduces attack surface
- Read-only mode for monitoring agents (they observe but don't act)
- Human approval gate for any destructive commands (rm, drop, delete)

**Residual risk:** High. This is the fundamental unsolved problem with
agentic systems. No mitigation is complete.

#### 5. Operational: User Loses Track

**Scenario:** 18 agents doing things. User steps away. Comes back to
find agents have been running for 2 hours, spent $200, created 47
commits, and one of them has been stuck in a loop for 90 minutes.

This is the most *likely* bad outcome. Not malicious — just the natural
consequence of inattention to an autonomous system.

**Mitigations:**
- Auto-pause after configurable idle time (no human interaction for N min)
- Session timeout (hard cap at 30/60/120 min)
- Periodic summary notifications ("Team has been running for 30min,
  $12.40 spent, 8/20 tasks done")
- "Are you still watching?" prompt after inactivity (like Netflix)
- All of the above are off by default and opt-in, because they'd be
  annoying for power users

**Residual risk:** Medium. Can be mitigated with good defaults, but
ultimately the user has to pay attention.

#### 6. Runaway Resource Consumption

**Scenario:** Agents spawning subprocesses, downloading packages,
building Docker images, running benchmarks — all in parallel. Machine
runs out of RAM, disk fills up, CPU pegged at 100%.

**Mitigations:**
- Per-agent resource monitoring (track CPU/memory per PTY session)
- Alert when system resources exceed threshold
- Agent definitions should include resource constraints
- cgroups/ulimits on spawned PTY processes (Rust-side, future work)

**Residual risk:** Low-medium. System resource monitoring is
straightforward but not yet implemented.

---

## Risk/Reward Matrix

| Aspect | Assessment |
|--------|-----------|
| **Fun factor** | 10/10 — watching 20 AI agents coordinate in real-time is genuinely mesmerizing |
| **Demo value** | 9/10 — this is the kind of thing that makes people stop scrolling |
| **Real productivity gain** | 4/10 — narrow use cases, most work is sequential |
| **Engineering effort** | Medium — 2-4 weeks for phases 1-3, mostly UI work |
| **Cost to user** | High — multi-agent sessions burn API credits fast |
| **Security risk** | High — prompt injection + credential exposure + cascading failures |
| **Blast radius of failure** | High — multiple live sessions, potentially production servers |
| **Maintenance burden** | Medium — Agent Teams is experimental, API changes break things |
| **Competitive moat** | Medium — cool but reproducible by anyone with xterm.js |

**Overall: High spectacle, moderate effort, narrow utility, high risk.**

The honest summary: this is a feature you build because it's *awesome*,
not because it's *necessary*. And there's nothing wrong with that — some
of the best product moments come from building something that makes
people say "holy shit" before they say "I need this."

But it should be built carefully, with safety defaults that are hard to
override, and positioned as explicitly experimental.

---

## What Would Change Our Mind

Build this when ANY of these become true:

1. **Agent Teams graduates from experimental** — Anthropic promotes it
   to stable, meaning the shared task list protocol is reliable and
   documented. Currently it's a `CLAUDE_CODE_EXPERIMENTAL_*` env var.

2. **Real user demand** — People actually use the 4-agent team launcher
   in v0.3.x and ask for more. Not hypothetical demand. Real usage data.

3. **Cost drops significantly** — If Sonnet-class models drop below
   $0.50/hr, running 8 agents becomes affordable for daily use.

4. **Prompt injection gets solved (or mostly solved)** — Anthropic or
   the industry ships reliable content boundary enforcement.

5. **We need it for a demo/investor pitch** — "Watch QuoxTerminal
   deploy your app using 12 AI agents" is a $10M slide.

---

## Appendix: The 8-Terminal Human Limit

Adam notes he can "comfortably handle about 8 terminals of Claude before
it gets uncomfortable." This is a real cognitive constraint worth
examining.

**What makes 8 uncomfortable:**
- Context switching cost: checking what each agent is doing
- Missing events: an agent asked a question 5 minutes ago, you didn't see it
- Priority confusion: which agent needs attention most?
- Spatial memory: "which pane was doing the database migration again?"

**What would make 20 comfortable:**
- Agents that don't need you (better autonomy, fewer questions)
- Smart notification routing (only interrupt for what matters)
- Spatial stability (panes don't move, roles are labeled clearly)
- Progress dashboards (bar charts, not scrolling text)
- Trust (after seeing agents work reliably 10 times, you stop watching)

The gap from 8 to 20 isn't about terminal count — it's about **trust
calibration** and **attention routing**. You need to trust that agents
handle routine work, and you need a system that surfaces only the
exceptions. This is the same UX problem as monitoring dashboards, NOCs,
and air traffic control.

---

## Appendix: What Claude Can Actually Do Simultaneously

Interesting thought experiment: what IS Claude's limit?

**Per-agent constraints:**
- Each Claude instance is a separate process with its own context window
- Agent Teams sync via filesystem (task list files in `~/.claude/tasks/`)
- File locking is cooperative, not enforced
- Each agent can run bash commands, edit files, read files independently

**System constraints:**
- PTY processes: each agent = 1 bash + 1 claude process = ~50-100MB RAM
- 20 agents = ~1-2GB RAM just for processes
- Disk I/O: 20 agents reading/writing files simultaneously
- Network: 20 simultaneous Claude API connections (Anthropic rate limits?)
- CPU: builds and tests compete for cores

**Coordination constraints:**
- Task list polling: agents check every few seconds, not event-driven
- No real-time messaging between agents (only via task files)
- Lead agent can't "see" what workers are doing in real-time
- Conflicts resolved by last-write-wins (git helps but isn't automatic)

**Practical limit: probably 6-10 agents doing real work.** Beyond that,
coordination overhead and resource contention start dominating. The
shared task list isn't built for 20 concurrent writers.

But for the *demo*? 20 agents all running, terminals scrolling, tasks
appearing on the kanban board? That works. Because the demo doesn't
need them all to be productive — it needs them to look productive.

---

*Filed under: fun experiments, revisit Q3 2026 or when Agent Teams
goes stable. Don't build this on a weekend. Build it on a week where
you've cleared everything else.*
