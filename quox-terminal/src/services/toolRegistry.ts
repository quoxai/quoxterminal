/**
 * toolRegistry.ts — Static registry of Quox CLI tools
 *
 * Provides tool definitions for the Tool Palette sidebar.
 * Each tool maps to a `quox` CLI subcommand that can be executed in a terminal pane.
 *
 * All commands use the `quox` binary. There are no separate binaries
 * (bastion, quoxagent, quoxflow do not exist as standalone CLIs).
 */

export type ToolCategory =
  | "tui"
  | "fleet"
  | "ai"
  | "workflows"
  | "memory"
  | "monitoring"
  | "admin";

export interface ToolParam {
  name: string;
  label: string;
  type: "text" | "select" | "flag";
  /** CLI flag name (e.g., "--query"). If omitted, value is appended positionally. */
  flag?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
  default?: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  command: string;
  args?: string[];
  params?: ToolParam[];
  requiresSsh?: boolean;
  icon?: string;
  tags?: string[];
  /** Tool launches an interactive TUI or live-updating display */
  isTui?: boolean;
  contextMatch?: {
    mode?: "local" | "ssh";
    hostPattern?: string;
  };
}

export interface PaneContext {
  mode: string;
  hostId: string;
  connected: boolean;
  hasError?: boolean;
}

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  tui: "Interactive TUI",
  fleet: "Fleet & Infrastructure",
  ai: "AI & Chat",
  workflows: "Workflows & Runs",
  memory: "Memory & Entities",
  monitoring: "Monitoring & Health",
  admin: "Admin & Config",
};

export function getCategoryLabel(category: ToolCategory): string {
  return CATEGORY_LABELS[category];
}

const TOOLS: ToolDefinition[] = [
  // ── Interactive TUI (highlighted at top) ──────────────────────────────
  {
    id: "tui-quox",
    name: "Quox TUI",
    description: "Launch full interactive terminal UI",
    category: "tui",
    command: "quox",
    args: ["tui"],
    isTui: true,
  },
  {
    id: "tui-chat",
    name: "Interactive Chat",
    description: "Chat with CommanderQ AI (interactive REPL)",
    category: "tui",
    command: "quox",
    args: ["chat"],
    isTui: true,
  },
  {
    id: "tui-fleet-watch",
    name: "Fleet Watch",
    description: "Live fleet status dashboard (auto-refreshing)",
    category: "tui",
    command: "quox",
    args: ["watch", "fleet"],
    isTui: true,
  },
  {
    id: "tui-service-watch",
    name: "Service Watch",
    description: "Live service health dashboard (auto-refreshing)",
    category: "tui",
    command: "quox",
    args: ["watch", "services"],
    isTui: true,
  },
  {
    id: "tui-login",
    name: "Interactive Login",
    description: "Authenticate with QuoxCORE (interactive prompts)",
    category: "tui",
    command: "quox",
    args: ["login"],
    isTui: true,
  },

  // ── Fleet & Infrastructure ────────────────────────────────────────────
  {
    id: "fleet-status",
    name: "Fleet Status",
    description: "Show fleet status table",
    category: "fleet",
    command: "quox",
    args: ["fleet", "status"],
  },
  {
    id: "fleet-summary",
    name: "Fleet Summary",
    description: "Show fleet health summary (healthy/degraded/down)",
    category: "fleet",
    command: "quox",
    args: ["fleet", "summary"],
  },
  {
    id: "fleet-agents",
    name: "Fleet Agents",
    description: "List all fleet agents",
    category: "fleet",
    command: "quox",
    args: ["fleet", "agents"],
  },
  {
    id: "fleet-tools",
    name: "Fleet Tools",
    description: "List available fleet tools",
    category: "fleet",
    command: "quox",
    args: ["fleet", "tools"],
  },
  {
    id: "fleet-exec",
    name: "Fleet Exec",
    description: "Execute a fleet tool on a target host",
    category: "fleet",
    command: "quox",
    args: ["fleet", "exec"],
    params: [
      {
        name: "tool",
        label: "Tool",
        type: "text",
        flag: "--tool",
        placeholder: "system-info",
        required: true,
      },
      {
        name: "host",
        label: "Host",
        type: "text",
        flag: "--host",
        placeholder: "docker01",
      },
      {
        name: "input",
        label: "Input (JSON)",
        type: "text",
        flag: "--input",
        placeholder: '{"key": "value"}',
      },
    ],
  },
  {
    id: "agent-list",
    name: "Agent List",
    description: "List registered agents",
    category: "fleet",
    command: "quox",
    args: ["agent", "list"],
  },

  // ── AI & Chat ─────────────────────────────────────────────────────────
  {
    id: "ai-chat",
    name: "Quick Chat",
    description: "Send a one-shot message to CommanderQ",
    category: "ai",
    command: "quox",
    args: ["chat"],
    params: [
      {
        name: "message",
        label: "Message",
        type: "text",
        placeholder: "What is the fleet status?",
        required: true,
      },
    ],
  },
  {
    id: "ai-chat-status",
    name: "Chat Status",
    description: "Check AI chat service availability",
    category: "ai",
    command: "quox",
    args: ["chat-status"],
  },

  // ── Workflows & Runs ──────────────────────────────────────────────────
  {
    id: "wf-list",
    name: "List Workflows",
    description: "List all workflows",
    category: "workflows",
    command: "quox",
    args: ["workflow", "list"],
  },
  {
    id: "wf-run",
    name: "Run Workflow",
    description: "Execute a workflow by ID",
    category: "workflows",
    command: "quox",
    args: ["workflow", "run"],
    params: [
      {
        name: "workflowId",
        label: "Workflow ID",
        type: "text",
        placeholder: "wf-abc123",
        required: true,
      },
    ],
  },
  {
    id: "run-list",
    name: "List Runs",
    description: "List workflow run history",
    category: "workflows",
    command: "quox",
    args: ["run", "list"],
  },
  {
    id: "run-get",
    name: "Run Status",
    description: "Check status of a workflow run",
    category: "workflows",
    command: "quox",
    args: ["run", "get"],
    params: [
      {
        name: "runId",
        label: "Run ID",
        type: "text",
        placeholder: "run-abc123",
        required: true,
      },
    ],
  },

  // ── Memory & Entities ─────────────────────────────────────────────────
  {
    id: "mem-stats",
    name: "Memory Stats",
    description: "Show memory statistics",
    category: "memory",
    command: "quox",
    args: ["memory", "stats"],
    tags: ["diagnostic"],
  },
  {
    id: "mem-list",
    name: "Memory List",
    description: "List stored memories",
    category: "memory",
    command: "quox",
    args: ["memory", "list"],
    params: [
      {
        name: "type",
        label: "Type",
        type: "select",
        flag: "--type",
        options: [
          { label: "All", value: "" },
          { label: "Fact", value: "fact" },
          { label: "Entity", value: "entity" },
          { label: "Decision", value: "decision" },
          { label: "Preference", value: "preference" },
          { label: "Observation", value: "observation" },
        ],
      },
    ],
  },
  {
    id: "mem-search",
    name: "Memory Search",
    description: "Search memories by query",
    category: "memory",
    command: "quox",
    args: ["memory", "search"],
    params: [
      {
        name: "query",
        label: "Query",
        type: "text",
        flag: "--query",
        placeholder: "docker deployment",
        required: true,
      },
    ],
  },
  {
    id: "entity-list",
    name: "Entity List",
    description: "List knowledge graph entities",
    category: "memory",
    command: "quox",
    args: ["entity", "list"],
  },
  {
    id: "entity-search",
    name: "Entity Search",
    description: "Search entities by query",
    category: "memory",
    command: "quox",
    args: ["entity", "search"],
    params: [
      {
        name: "query",
        label: "Query",
        type: "text",
        flag: "--query",
        placeholder: "nginx",
        required: true,
      },
    ],
  },

  // ── Monitoring & Health ───────────────────────────────────────────────
  {
    id: "mon-health",
    name: "Service Health",
    description: "Check health of all QuoxCORE services",
    category: "monitoring",
    command: "quox",
    args: ["service", "health"],
    tags: ["diagnostic"],
  },
  {
    id: "mon-backup-list",
    name: "Backup List",
    description: "List available backups",
    category: "monitoring",
    command: "quox",
    args: ["backup", "list"],
  },
  {
    id: "mon-backup-create",
    name: "Create Backup",
    description: "Create a new backup",
    category: "monitoring",
    command: "quox",
    args: ["backup", "create"],
    params: [
      {
        name: "label",
        label: "Label",
        type: "text",
        flag: "--label",
        placeholder: "daily-backup",
      },
      {
        name: "type",
        label: "Type",
        type: "select",
        flag: "--type",
        options: [
          { label: "Full", value: "full" },
          { label: "Incremental", value: "incremental" },
        ],
      },
    ],
  },
  {
    id: "mon-admin-stats",
    name: "Platform Stats",
    description: "Show platform statistics",
    category: "monitoring",
    command: "quox",
    args: ["admin", "stats"],
    tags: ["diagnostic"],
  },
  {
    id: "mon-inbox",
    name: "Inbox",
    description: "List pending approvals and tasks",
    category: "monitoring",
    command: "quox",
    args: ["inbox", "list"],
  },
  {
    id: "mon-inbox-stats",
    name: "Inbox Stats",
    description: "Show inbox statistics",
    category: "monitoring",
    command: "quox",
    args: ["inbox", "stats"],
  },

  // ── Admin & Config ────────────────────────────────────────────────────
  {
    id: "admin-whoami",
    name: "Who Am I",
    description: "Show current user identity",
    category: "admin",
    command: "quox",
    args: ["whoami"],
  },
  {
    id: "admin-config",
    name: "Show Config",
    description: "Display current CLI configuration",
    category: "admin",
    command: "quox",
    args: ["config", "get"],
  },
  {
    id: "admin-logout",
    name: "Logout",
    description: "End current session",
    category: "admin",
    command: "quox",
    args: ["logout"],
  },
  {
    id: "admin-org-list",
    name: "Organizations",
    description: "List organizations",
    category: "admin",
    command: "quox",
    args: ["org", "list"],
  },
  {
    id: "admin-keys",
    name: "API Keys",
    description: "List API keys",
    category: "admin",
    command: "quox",
    args: ["admin", "key", "list"],
  },
  {
    id: "admin-audit",
    name: "Audit Log",
    description: "View admin audit logs",
    category: "admin",
    command: "quox",
    args: ["admin", "logs"],
  },
  {
    id: "admin-file-stats",
    name: "File Stats",
    description: "Show file storage statistics",
    category: "admin",
    command: "quox",
    args: ["file", "stats"],
  },
];

export function getTools(): ToolDefinition[] {
  return TOOLS;
}

export function getToolsByCategory(): Record<ToolCategory, ToolDefinition[]> {
  const result = {} as Record<ToolCategory, ToolDefinition[]>;
  for (const tool of TOOLS) {
    if (!result[tool.category]) {
      result[tool.category] = [];
    }
    result[tool.category].push(tool);
  }
  return result;
}

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function getSuggestedTools(context: PaneContext): ToolDefinition[] {
  if (!context.connected) {
    return TOOLS.filter(
      (t) => t.id === "tui-login" || t.id === "admin-config",
    );
  }

  const suggestions: ToolDefinition[] = [];
  const seen = new Set<string>();

  const add = (tool: ToolDefinition) => {
    if (!seen.has(tool.id)) {
      seen.add(tool.id);
      suggestions.push(tool);
    }
  };

  // Error context — include diagnostic/monitoring tools first
  if (context.hasError) {
    for (const tool of TOOLS) {
      if (tool.tags?.includes("diagnostic")) add(tool);
    }
  }

  if (context.mode === "ssh") {
    // SSH pane — fleet tools and monitoring
    for (const tool of TOOLS) {
      if (tool.category === "fleet") add(tool);
      if (tool.contextMatch?.mode === "ssh") add(tool);
    }
    // Host pattern matching
    if (context.hostId) {
      for (const tool of TOOLS) {
        if (
          tool.contextMatch?.hostPattern &&
          new RegExp(tool.contextMatch.hostPattern).test(context.hostId)
        ) {
          add(tool);
        }
      }
    }
  } else {
    // Local pane — TUI tools first, then admin
    for (const tool of TOOLS) {
      if (tool.isTui) add(tool);
    }
    for (const tool of TOOLS) {
      if (tool.category === "admin") add(tool);
    }
  }

  return suggestions.slice(0, 5);
}

/**
 * Build the CLI command string from a tool definition and parameter values.
 *
 * Supports both positional args and named flags:
 * - If a param has `flag` set (e.g., "--query"), emits `--query value`
 * - If a param has no `flag`, appends the value positionally
 * - Flag-type params emit `--name` when checked
 */
export function buildCommand(
  tool: ToolDefinition,
  paramValues: Record<string, string> = {},
): string {
  const parts = [tool.command];

  if (tool.args) {
    parts.push(...tool.args);
  }

  if (tool.params) {
    for (const param of tool.params) {
      const value = paramValues[param.name] ?? param.default ?? "";
      if (param.type === "flag") {
        if (value === "true" || value === param.name) {
          parts.push(param.flag || `--${param.name}`);
        }
      } else if (value) {
        if (param.flag) {
          // Named flag: --query "search term"
          parts.push(param.flag);
          parts.push(value.includes(" ") ? `"${value}"` : value);
        } else {
          // Positional argument
          parts.push(value.includes(" ") ? `"${value}"` : value);
        }
      }
    }
  }

  return parts.join(" ");
}
