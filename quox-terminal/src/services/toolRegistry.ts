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
}

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  fleet: "Fleet & Infrastructure",
  ops: "Operations & Deployment",
  ai: "AI & Chat",
  workflows: "Workflow Engine",
  memory: "Memory & Knowledge",
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

  // ── Monitoring ─────────────────────────────────────────────────────────
  {
    id: "mon-health",
    name: "Platform Health",
    description: "Check overall platform health",
    category: "monitoring",
    command: "quox",
    args: ["health"],
  },
  {
    id: "mon-agent-health",
    name: "Agent Health",
    description: "Check quoxagent health endpoint",
    category: "monitoring",
    command: "quoxagent",
    args: ["health"],
  },
  {
    id: "mon-bastion-status",
    name: "Bastion Status",
    description: "Check bastion connectivity",
    category: "monitoring",
    command: "bastion",
    args: ["status"],
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
