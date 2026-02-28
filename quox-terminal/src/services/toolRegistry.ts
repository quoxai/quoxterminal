/**
 * toolRegistry.ts — Static registry of Quox CLI tools
 *
 * Provides tool definitions for the Tool Palette sidebar.
 * Each tool maps to a CLI command that can be executed in a terminal pane.
 */

export type ToolCategory =
  | "fleet"
  | "ops"
  | "ai"
  | "workflows"
  | "memory"
  | "secrets"
  | "monitoring"
  | "admin"
  | "tui";

export interface ToolParam {
  name: string;
  label: string;
  type: "text" | "select" | "flag";
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
  fleet: "Fleet & Infrastructure",
  ops: "Operations & Deployment",
  ai: "AI & Chat",
  workflows: "Workflow Engine",
  memory: "Memory & Knowledge",
  secrets: "Secrets & Vault",
  monitoring: "Monitoring & Health",
  admin: "Admin & Config",
  tui: "Interactive TUI",
};

export function getCategoryLabel(category: ToolCategory): string {
  return CATEGORY_LABELS[category];
}

const TOOLS: ToolDefinition[] = [
  // ── Fleet ──────────────────────────────────────────────────────────────
  {
    id: "fleet-list",
    name: "Fleet List",
    description: "List all fleet agents",
    category: "fleet",
    command: "quox",
    args: ["fleet", "list"],
  },
  {
    id: "fleet-status",
    name: "Fleet Status",
    description: "Show fleet status summary",
    category: "fleet",
    command: "quox",
    args: ["fleet", "status"],
  },
  {
    id: "agent-status",
    name: "Agent Status",
    description: "Show quoxagent daemon status",
    category: "fleet",
    command: "quoxagent",
    args: ["status"],
  },
  {
    id: "agent-list",
    name: "Agent List",
    description: "List registered agents",
    category: "fleet",
    command: "quoxagent",
    args: ["list"],
  },

  // ── Operations ─────────────────────────────────────────────────────────
  {
    id: "ops-deploy",
    name: "Deploy Service",
    description: "Deploy a service to the fleet",
    category: "ops",
    command: "quox",
    args: ["deploy"],
    tags: ["remote", "ops"],
    params: [
      {
        name: "service",
        label: "Service",
        type: "select",
        required: true,
        options: [
          { label: "Collector", value: "collector" },
          { label: "Dashboard", value: "dashboard" },
          { label: "Website", value: "website" },
          { label: "Bastion", value: "bastion" },
          { label: "Agent", value: "agent" },
        ],
      },
    ],
  },
  {
    id: "ops-logs",
    name: "Service Logs",
    description: "View logs for a service",
    category: "ops",
    command: "quox",
    args: ["logs"],
    tags: ["remote", "ops"],
    params: [
      {
        name: "service",
        label: "Service",
        type: "select",
        required: true,
        options: [
          { label: "Collector", value: "collector" },
          { label: "Dashboard", value: "dashboard" },
          { label: "Website", value: "website" },
          { label: "Bastion", value: "bastion" },
          { label: "Agent", value: "agent" },
        ],
      },
    ],
  },
  {
    id: "ops-restart",
    name: "Restart Service",
    description: "Restart a running service",
    category: "ops",
    command: "quox",
    args: ["restart"],
    tags: ["remote", "ops"],
    params: [
      {
        name: "service",
        label: "Service",
        type: "select",
        required: true,
        options: [
          { label: "Collector", value: "collector" },
          { label: "Dashboard", value: "dashboard" },
          { label: "Website", value: "website" },
          { label: "Bastion", value: "bastion" },
          { label: "Agent", value: "agent" },
        ],
      },
    ],
  },
  {
    id: "bastion-exec",
    name: "Bastion Exec",
    description: "Execute command on remote host via bastion",
    category: "ops",
    command: "bastion",
    args: ["exec"],
    tags: ["remote", "ssh"],
    contextMatch: { mode: "ssh" },
    params: [
      {
        name: "host",
        label: "Host",
        type: "text",
        placeholder: "docker01",
        required: true,
      },
      {
        name: "cmd",
        label: "Command",
        type: "text",
        placeholder: "uptime",
        required: true,
      },
    ],
  },

  // ── AI ─────────────────────────────────────────────────────────────────
  {
    id: "ai-chat",
    name: "QuoxChat",
    description: "Start interactive AI chat session",
    category: "ai",
    command: "quox",
    args: ["chat"],
  },
  {
    id: "ai-ask",
    name: "Quick Ask",
    description: "Ask a one-shot question to AI",
    category: "ai",
    command: "quox",
    args: ["ask"],
    params: [
      {
        name: "question",
        label: "Question",
        type: "text",
        placeholder: "What is the fleet status?",
        required: true,
      },
    ],
  },

  // ── Workflows ──────────────────────────────────────────────────────────
  {
    id: "wf-list",
    name: "List Workflows",
    description: "List all available workflows",
    category: "workflows",
    command: "quoxflow",
    args: ["list"],
  },
  {
    id: "wf-run",
    name: "Run Workflow",
    description: "Execute a workflow by name",
    category: "workflows",
    command: "quoxflow",
    args: ["run"],
    params: [
      {
        name: "workflow",
        label: "Workflow",
        type: "text",
        placeholder: "deploy-pipeline",
        required: true,
      },
    ],
  },
  {
    id: "wf-status",
    name: "Workflow Status",
    description: "Check status of a workflow run",
    category: "workflows",
    command: "quoxflow",
    args: ["status"],
    params: [
      {
        name: "id",
        label: "Run ID",
        type: "text",
        placeholder: "run-abc123",
        required: true,
      },
    ],
  },

  // ── Memory ─────────────────────────────────────────────────────────────
  {
    id: "mem-status",
    name: "Memory Status",
    description: "Show memory service status",
    category: "memory",
    command: "quox",
    args: ["memory", "status"],
  },
  {
    id: "mem-search",
    name: "Memory Search",
    description: "Search memory by query",
    category: "memory",
    command: "quox",
    args: ["memory", "search"],
    params: [
      {
        name: "query",
        label: "Query",
        type: "text",
        placeholder: "docker deployment",
        required: true,
      },
    ],
  },
  {
    id: "mem-entities",
    name: "Memory Entities",
    description: "List known entities in memory",
    category: "memory",
    command: "quox",
    args: ["memory", "entities"],
  },

  // ── Secrets & Vault ────────────────────────────────────────────────────
  {
    id: "vault-list",
    name: "Vault List",
    description: "List credentials (masked)",
    category: "secrets",
    command: "quox",
    args: ["vault", "list"],
  },
  {
    id: "vault-stats",
    name: "Vault Stats",
    description: "Show vault health dashboard",
    category: "secrets",
    command: "quox",
    args: ["vault", "stats"],
    tags: ["diagnostic"],
  },
  {
    id: "vault-test-all",
    name: "Test All Credentials",
    description: "Test all credential connections",
    category: "secrets",
    command: "quox",
    args: ["vault", "test-all"],
  },
  {
    id: "vault-expiring",
    name: "Expiring Credentials",
    description: "List credentials expiring soon",
    category: "secrets",
    command: "quox",
    args: ["vault", "expiring"],
    params: [
      {
        name: "days",
        label: "Days",
        type: "text",
        placeholder: "7",
        default: "7",
      },
    ],
  },
  {
    id: "vault-scan",
    name: "Vault Health Scan",
    description: "Run health scan and show issues",
    category: "secrets",
    command: "quox",
    args: ["vault", "scan"],
    tags: ["diagnostic"],
  },
  {
    id: "vault-activity",
    name: "Vault Activity",
    description: "Show vault audit trail",
    category: "secrets",
    command: "quox",
    args: ["vault", "activity"],
  },

  // ── Monitoring ─────────────────────────────────────────────────────────
  {
    id: "mon-health",
    name: "Platform Health",
    description: "Check overall platform health",
    category: "monitoring",
    command: "quox",
    args: ["health"],
    tags: ["diagnostic"],
  },
  {
    id: "mon-agent-health",
    name: "Agent Health",
    description: "Check quoxagent health endpoint",
    category: "monitoring",
    command: "quoxagent",
    args: ["health"],
    tags: ["diagnostic"],
  },
  {
    id: "mon-bastion-status",
    name: "Bastion Status",
    description: "Check bastion connectivity",
    category: "monitoring",
    command: "bastion",
    args: ["status"],
    tags: ["remote", "ssh"],
    contextMatch: { mode: "ssh" },
  },

  // ── Admin ──────────────────────────────────────────────────────────────
  {
    id: "admin-config",
    name: "Show Config",
    description: "Display current configuration",
    category: "admin",
    command: "quox",
    args: ["config", "show"],
  },
  {
    id: "admin-login",
    name: "Login",
    description: "Authenticate with QuoxCORE",
    category: "admin",
    command: "quox",
    args: ["login"],
  },
  {
    id: "admin-whoami",
    name: "Who Am I",
    description: "Show current user identity",
    category: "admin",
    command: "quox",
    args: ["whoami"],
  },

  // ── TUI ────────────────────────────────────────────────────────────────
  {
    id: "tui-bastion",
    name: "Bastion TUI",
    description: "Launch full bastion terminal UI",
    category: "tui",
    command: "bastion",
  },
  {
    id: "tui-quox",
    name: "Quox Interactive",
    description: "Launch interactive Quox CLI",
    category: "tui",
    command: "quox",
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
  // Disconnected pane — only admin tools (login, config)
  if (!context.connected) {
    return TOOLS.filter(
      (t) => t.id === "admin-login" || t.id === "admin-config",
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
    // SSH pane — ops tools, monitoring, and tools matching SSH mode
    for (const tool of TOOLS) {
      if (tool.contextMatch?.mode === "ssh") add(tool);
      if (tool.tags?.includes("ops")) add(tool);
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
    // Local pane — admin tools, TUI tools
    for (const tool of TOOLS) {
      if (tool.category === "admin") add(tool);
      if (tool.category === "tui") add(tool);
    }
  }

  return suggestions.slice(0, 5);
}

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
          parts.push(`--${param.name}`);
        }
      } else if (value) {
        parts.push(value);
      }
    }
  }

  return parts.join(" ");
}
