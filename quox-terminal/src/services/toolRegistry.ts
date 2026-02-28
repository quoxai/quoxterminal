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
  | "admin"
  | "org"
  | "agents"
  | "assistants";

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
  /** Tool requires confirmation before execution */
  dangerous?: boolean;
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
  org: "Organization",
  agents: "Agents",
  assistants: "Assistants",
};

export function getCategoryLabel(category: ToolCategory): string {
  return CATEGORY_LABELS[category];
}

// ── Shared param templates ─────────────────────────────────────────────

const OUTPUT_PARAM: ToolParam = {
  name: "output",
  label: "Output Format",
  type: "select",
  flag: "--output",
  options: [
    { label: "Table", value: "" },
    { label: "JSON", value: "json" },
    { label: "CSV", value: "csv" },
    { label: "Quiet (IDs only)", value: "quiet" },
  ],
};

const LIMIT_PARAM: ToolParam = {
  name: "limit",
  label: "Limit",
  type: "text",
  flag: "--limit",
  placeholder: "25",
};

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
    params: [OUTPUT_PARAM],
    contextMatch: { mode: "ssh" },
  },
  {
    id: "fleet-summary",
    name: "Fleet Summary",
    description: "Show fleet health summary (healthy/degraded/down)",
    category: "fleet",
    command: "quox",
    args: ["fleet", "summary"],
    contextMatch: { mode: "ssh" },
  },
  {
    id: "fleet-agents",
    name: "Fleet Agents",
    description: "List all fleet agents",
    category: "fleet",
    command: "quox",
    args: ["fleet", "agents"],
    params: [OUTPUT_PARAM],
    contextMatch: { mode: "ssh" },
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
    contextMatch: { mode: "ssh" },
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
    id: "fleet-watch",
    name: "Fleet Watch",
    description: "Live fleet status dashboard (auto-refreshing)",
    category: "fleet",
    command: "quox",
    args: ["watch", "fleet"],
    isTui: true,
    params: [
      {
        name: "interval",
        label: "Interval (seconds)",
        type: "text",
        flag: "--interval",
        placeholder: "5",
      },
    ],
  },
  {
    id: "fleet-service-watch",
    name: "Service Watch",
    description: "Live service health dashboard (auto-refreshing)",
    category: "fleet",
    command: "quox",
    args: ["watch", "services"],
    isTui: true,
    params: [
      {
        name: "interval",
        label: "Interval (seconds)",
        type: "text",
        flag: "--interval",
        placeholder: "5",
      },
    ],
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
  {
    id: "ai-conversation-list",
    name: "Conversations",
    description: "List recent AI conversations",
    category: "ai",
    command: "quox",
    args: ["conversation", "list"],
  },
  {
    id: "ai-conversation-search",
    name: "Search Conversations",
    description: "Search AI conversation history",
    category: "ai",
    command: "quox",
    args: ["conversation", "search"],
    params: [
      {
        name: "query",
        label: "Query",
        type: "text",
        flag: "--query",
        placeholder: "deployment issue",
        required: true,
      },
    ],
  },

  // ── Workflows & Runs ──────────────────────────────────────────────────
  {
    id: "wf-list",
    name: "List Workflows",
    description: "List all workflows",
    category: "workflows",
    command: "quox",
    args: ["workflow", "list"],
    params: [OUTPUT_PARAM],
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
    id: "wf-steps",
    name: "Workflow Steps",
    description: "List steps for a workflow",
    category: "workflows",
    command: "quox",
    args: ["workflow", "steps", "list"],
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
    params: [OUTPUT_PARAM, LIMIT_PARAM],
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
      OUTPUT_PARAM,
      LIMIT_PARAM,
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
    id: "mem-export",
    name: "Memory Export",
    description: "Export all memories",
    category: "memory",
    command: "quox",
    args: ["memory", "export"],
  },
  {
    id: "mem-create",
    name: "Create Memory",
    description: "Create a new memory entry",
    category: "memory",
    command: "quox",
    args: ["memory", "create"],
    params: [
      {
        name: "type",
        label: "Type",
        type: "select",
        flag: "--type",
        required: true,
        options: [
          { label: "Fact", value: "fact" },
          { label: "Decision", value: "decision" },
          { label: "Preference", value: "preference" },
          { label: "Observation", value: "observation" },
        ],
      },
      {
        name: "content",
        label: "Content",
        type: "text",
        flag: "--content",
        placeholder: "Memory content...",
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
    params: [OUTPUT_PARAM, LIMIT_PARAM],
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
    dangerous: true,
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
    id: "mon-backup-verify",
    name: "Verify Backup",
    description: "Verify a backup's integrity",
    category: "monitoring",
    command: "quox",
    args: ["backup", "verify"],
    params: [
      {
        name: "backupId",
        label: "Backup ID",
        type: "text",
        placeholder: "bak-abc123",
        required: true,
      },
    ],
  },
  {
    id: "mon-backup-schedule",
    name: "Backup Schedule",
    description: "List backup schedules",
    category: "monitoring",
    command: "quox",
    args: ["backup", "schedule", "list"],
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
    params: [OUTPUT_PARAM, LIMIT_PARAM],
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
    dangerous: true,
  },
  {
    id: "admin-keys",
    name: "API Keys",
    description: "List API keys",
    category: "admin",
    command: "quox",
    args: ["admin", "key", "list"],
    params: [OUTPUT_PARAM],
  },
  {
    id: "admin-audit",
    name: "Audit Log",
    description: "View admin audit logs",
    category: "admin",
    command: "quox",
    args: ["admin", "logs"],
    params: [OUTPUT_PARAM, LIMIT_PARAM],
  },
  {
    id: "admin-file-stats",
    name: "File Stats",
    description: "Show file storage statistics",
    category: "admin",
    command: "quox",
    args: ["file", "stats"],
  },
  {
    id: "admin-service-list",
    name: "Service List",
    description: "List registered services",
    category: "admin",
    command: "quox",
    args: ["admin", "service", "list"],
  },
  {
    id: "admin-mfa-setup",
    name: "MFA Setup",
    description: "Set up multi-factor authentication",
    category: "admin",
    command: "quox",
    args: ["mfa", "setup"],
    isTui: true,
  },
  {
    id: "admin-retention",
    name: "Retention Stats",
    description: "Show data retention statistics",
    category: "admin",
    command: "quox",
    args: ["admin", "retention", "stats"],
  },
  {
    id: "admin-integration-list",
    name: "Integrations",
    description: "List configured integrations",
    category: "admin",
    command: "quox",
    args: ["integration", "list"],
  },
  {
    id: "admin-integration-test",
    name: "Test Integration",
    description: "Test an integration connection",
    category: "admin",
    command: "quox",
    args: ["integration", "test"],
    params: [
      {
        name: "integrationId",
        label: "Integration ID",
        type: "text",
        placeholder: "int-abc123",
        required: true,
      },
    ],
  },
  {
    id: "admin-tag-list",
    name: "Tag List",
    description: "List all tags",
    category: "admin",
    command: "quox",
    args: ["tag", "list"],
  },
  {
    id: "admin-notification",
    name: "Notification Channels",
    description: "List notification channels",
    category: "admin",
    command: "quox",
    args: ["notification", "channels", "list"],
  },

  // ── Organization ──────────────────────────────────────────────────────
  {
    id: "org-list",
    name: "Org List",
    description: "List organizations",
    category: "org",
    command: "quox",
    args: ["org", "list"],
  },
  {
    id: "org-switch",
    name: "Org Switch",
    description: "Switch active organization",
    category: "org",
    command: "quox",
    args: ["org", "switch"],
    params: [
      {
        name: "orgId",
        label: "Organization ID",
        type: "text",
        placeholder: "org-abc123",
        required: true,
      },
    ],
  },
  {
    id: "org-members",
    name: "Org Members",
    description: "List organization members",
    category: "org",
    command: "quox",
    args: ["org", "members", "list"],
  },
  {
    id: "org-audit",
    name: "Org Audit",
    description: "View organization audit log",
    category: "org",
    command: "quox",
    args: ["org", "audit"],
    params: [
      {
        name: "action",
        label: "Action Filter",
        type: "text",
        flag: "--action",
        placeholder: "login",
      },
      LIMIT_PARAM,
    ],
  },

  // ── Agents ────────────────────────────────────────────────────────────
  {
    id: "agent-list",
    name: "Agent List",
    description: "List registered agents",
    category: "agents",
    command: "quox",
    args: ["agent", "list"],
    params: [OUTPUT_PARAM],
  },
  {
    id: "agent-get",
    name: "Agent Details",
    description: "Get agent details",
    category: "agents",
    command: "quox",
    args: ["agent", "get"],
    params: [
      {
        name: "agentId",
        label: "Agent ID",
        type: "text",
        placeholder: "agt-abc123",
        required: true,
      },
    ],
  },
  {
    id: "agent-create",
    name: "Create Agent",
    description: "Create a new agent",
    category: "agents",
    command: "quox",
    args: ["agent", "create"],
    params: [
      {
        name: "name",
        label: "Name",
        type: "text",
        flag: "--name",
        placeholder: "my-agent",
        required: true,
      },
      {
        name: "level",
        label: "Level",
        type: "select",
        flag: "--level",
        options: [
          { label: "Standard", value: "" },
          { label: "Advanced", value: "advanced" },
          { label: "Expert", value: "expert" },
        ],
      },
      {
        name: "domain",
        label: "Domain",
        type: "text",
        flag: "--domain",
        placeholder: "infrastructure",
      },
    ],
  },
  {
    id: "agent-activate",
    name: "Activate Agent",
    description: "Activate an agent",
    category: "agents",
    command: "quox",
    args: ["agent", "activate"],
    params: [
      {
        name: "agentId",
        label: "Agent ID",
        type: "text",
        placeholder: "agt-abc123",
        required: true,
      },
    ],
  },
  {
    id: "agent-deactivate",
    name: "Deactivate Agent",
    description: "Deactivate an agent",
    category: "agents",
    command: "quox",
    args: ["agent", "deactivate"],
    params: [
      {
        name: "agentId",
        label: "Agent ID",
        type: "text",
        placeholder: "agt-abc123",
        required: true,
      },
    ],
  },
  {
    id: "agent-tool-list",
    name: "Agent Tools",
    description: "List tools available to an agent",
    category: "agents",
    command: "quox",
    args: ["agent", "tool", "list"],
    params: [
      {
        name: "agentId",
        label: "Agent ID",
        type: "text",
        placeholder: "agt-abc123",
        required: true,
      },
    ],
  },

  // ── Assistants ────────────────────────────────────────────────────────
  {
    id: "assistant-list",
    name: "Assistant List",
    description: "List deployed assistants",
    category: "assistants",
    command: "quox",
    args: ["assistant", "list"],
  },
  {
    id: "assistant-deploy",
    name: "Deploy Assistant",
    description: "Deploy an assistant",
    category: "assistants",
    command: "quox",
    args: ["assistant", "deploy"],
    params: [
      {
        name: "assistantId",
        label: "Assistant ID",
        type: "text",
        placeholder: "ast-abc123",
        required: true,
      },
    ],
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
 * Shell-escape a value for safe interpolation into a command string.
 *
 * If the value is "safe" (only alphanumeric, dash, underscore, dot, slash, colon),
 * it is returned as-is. Otherwise it is single-quoted with inner single-quotes
 * escaped as `'\''`.
 */
export function shellEscape(value: string): string {
  if (!value) return '';
  // Safe characters that need no quoting
  if (/^[a-zA-Z0-9._\-\/:]+$/.test(value)) return value;
  // Single-quote and escape inner single-quotes
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

/**
 * Build the CLI command string from a tool definition and parameter values.
 *
 * Supports both positional args and named flags:
 * - If a param has `flag` set (e.g., "--query"), emits `--query value`
 * - If a param has no `flag`, appends the value positionally
 * - Flag-type params emit `--name` when checked
 *
 * All param values are shell-escaped to prevent injection.
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
          // Named flag: --query value
          parts.push(param.flag);
          parts.push(shellEscape(value));
        } else {
          // Positional argument
          parts.push(shellEscape(value));
        }
      }
    }
  }

  return parts.join(" ");
}
