import { describe, it, expect } from "vitest";
import {
  getTools,
  getToolsByCategory,
  getToolById,
  buildCommand,
  shellEscape,
  getCategoryLabel,
  getSuggestedTools,
  type ToolDefinition,
  type ToolCategory,
  type PaneContext,
} from "../services/toolRegistry";

describe("toolRegistry", () => {
  describe("getTools", () => {
    it("returns a non-empty array", () => {
      const tools = getTools();
      expect(tools.length).toBeGreaterThan(0);
    });

    it("has no duplicate IDs", () => {
      const tools = getTools();
      const ids = tools.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("all tools have required fields", () => {
      const tools = getTools();
      for (const tool of tools) {
        expect(tool.id).toBeTruthy();
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.command).toBeTruthy();
        expect(tool.category).toBeTruthy();
      }
    });

    it("all tools use the quox binary", () => {
      const tools = getTools();
      for (const tool of tools) {
        expect(tool.command).toBe("quox");
      }
    });
  });

  describe("getToolsByCategory", () => {
    it("groups tools by category", () => {
      const grouped = getToolsByCategory();
      expect(Object.keys(grouped).length).toBeGreaterThan(0);

      for (const [cat, tools] of Object.entries(grouped)) {
        expect(tools.length).toBeGreaterThan(0);
        for (const tool of tools) {
          expect(tool.category).toBe(cat);
        }
      }
    });

    it("contains all known categories", () => {
      const grouped = getToolsByCategory();
      const categories: ToolCategory[] = [
        "tui",
        "fleet",
        "ai",
        "workflows",
        "memory",
        "monitoring",
        "admin",
        "org",
        "agents",
        "assistants",
      ];
      for (const cat of categories) {
        expect(grouped[cat]).toBeDefined();
        expect(grouped[cat].length).toBeGreaterThan(0);
      }
    });

    it("total count matches getTools()", () => {
      const grouped = getToolsByCategory();
      const totalGrouped = Object.values(grouped).reduce(
        (sum, tools) => sum + tools.length,
        0,
      );
      expect(totalGrouped).toBe(getTools().length);
    });
  });

  describe("getToolById", () => {
    it("finds a known tool", () => {
      const tool = getToolById("fleet-status");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("Fleet Status");
      expect(tool!.category).toBe("fleet");
    });

    it("finds new category tools", () => {
      expect(getToolById("org-list")).toBeDefined();
      expect(getToolById("agent-list")).toBeDefined();
      expect(getToolById("assistant-list")).toBeDefined();
    });

    it("returns undefined for unknown ID", () => {
      expect(getToolById("nonexistent-tool")).toBeUndefined();
    });
  });

  describe("shellEscape", () => {
    it("returns empty string for empty input", () => {
      expect(shellEscape("")).toBe("");
    });

    it("does not quote safe values", () => {
      expect(shellEscape("hello")).toBe("hello");
      expect(shellEscape("my-tool")).toBe("my-tool");
      expect(shellEscape("path/to/file")).toBe("path/to/file");
      expect(shellEscape("file.txt")).toBe("file.txt");
    });

    it("quotes values with spaces", () => {
      expect(shellEscape("hello world")).toBe("'hello world'");
    });

    it("escapes single quotes", () => {
      expect(shellEscape("it's")).toBe("'it'\\''s'");
    });

    it("quotes values with special characters", () => {
      expect(shellEscape('{"key": "value"}')).toBe("'{\"key\": \"value\"}'");
      expect(shellEscape("$(echo pwned)")).toBe("'$(echo pwned)'");
      expect(shellEscape("`whoami`")).toBe("'`whoami`'");
      expect(shellEscape("a;b")).toBe("'a;b'");
      expect(shellEscape("a|b")).toBe("'a|b'");
    });
  });

  describe("buildCommand", () => {
    it("builds command with args only", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "fleet",
        command: "quox",
        args: ["fleet", "status"],
      };
      expect(buildCommand(tool)).toBe("quox fleet status");
    });

    it("builds command with positional text param", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "ai",
        command: "quox",
        args: ["chat"],
        params: [
          { name: "message", label: "Message", type: "text", required: true },
        ],
      };
      expect(buildCommand(tool, { message: "hello" })).toBe(
        "quox chat hello",
      );
    });

    it("builds command with named flag param", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "memory",
        command: "quox",
        args: ["memory", "search"],
        params: [
          { name: "query", label: "Query", type: "text", flag: "--query", required: true },
        ],
      };
      expect(buildCommand(tool, { query: "docker" })).toBe(
        "quox memory search --query docker",
      );
    });

    it("shell-escapes values with spaces", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "memory",
        command: "quox",
        args: ["memory", "search"],
        params: [
          { name: "query", label: "Query", type: "text", flag: "--query", required: true },
        ],
      };
      expect(buildCommand(tool, { query: "docker deployment" })).toBe(
        "quox memory search --query 'docker deployment'",
      );
    });

    it("shell-escapes values with special characters", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "fleet",
        command: "quox",
        args: ["fleet", "exec"],
        params: [
          { name: "input", label: "Input", type: "text", flag: "--input" },
        ],
      };
      expect(buildCommand(tool, { input: '{"key": "value"}' })).toBe(
        "quox fleet exec --input '{\"key\": \"value\"}'",
      );
    });

    it("prevents command injection via $()", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "fleet",
        command: "quox",
        args: ["fleet", "exec"],
        params: [
          { name: "input", label: "Input", type: "text", flag: "--input" },
        ],
      };
      expect(buildCommand(tool, { input: "$(echo pwned)" })).toBe(
        "quox fleet exec --input '$(echo pwned)'",
      );
    });

    it("prevents command injection via backticks", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "fleet",
        command: "quox",
        args: ["fleet", "exec"],
        params: [
          { name: "input", label: "Input", type: "text", flag: "--input" },
        ],
      };
      expect(buildCommand(tool, { input: "`whoami`" })).toBe(
        "quox fleet exec --input '`whoami`'",
      );
    });

    it("prevents command injection via semicolons", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "fleet",
        command: "quox",
        args: ["fleet", "exec"],
        params: [
          { name: "input", label: "Input", type: "text", flag: "--input" },
        ],
      };
      expect(buildCommand(tool, { input: "foo; rm -rf /" })).toBe(
        "quox fleet exec --input 'foo; rm -rf /'",
      );
    });

    it("builds command with boolean flag param enabled", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "admin",
        command: "quox",
        args: ["config"],
        params: [{ name: "verbose", label: "Verbose", type: "flag" }],
      };
      expect(buildCommand(tool, { verbose: "true" })).toBe(
        "quox config --verbose",
      );
    });

    it("omits flag param when not enabled", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "admin",
        command: "quox",
        args: ["config"],
        params: [{ name: "verbose", label: "Verbose", type: "flag" }],
      };
      expect(buildCommand(tool, { verbose: "" })).toBe("quox config");
    });

    it("skips empty text params", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "admin",
        command: "quox",
        args: ["agent", "list"],
        params: [
          { name: "status", label: "Status", type: "text", flag: "--status" },
        ],
      };
      expect(buildCommand(tool, { status: "" })).toBe("quox agent list");
    });

    it("works with real tool from registry", () => {
      const tool = getToolById("fleet-status")!;
      expect(buildCommand(tool)).toBe("quox fleet status");
    });

    it("works with real parameterized tool from registry", () => {
      const tool = getToolById("mem-search")!;
      expect(buildCommand(tool, { query: "nginx" })).toBe(
        "quox memory search --query nginx",
      );
    });
  });

  describe("getCategoryLabel", () => {
    it("returns human-readable labels", () => {
      expect(getCategoryLabel("fleet")).toBe("Fleet & Infrastructure");
      expect(getCategoryLabel("ai")).toBe("AI & Chat");
      expect(getCategoryLabel("tui")).toBe("Interactive TUI");
      expect(getCategoryLabel("org")).toBe("Organization");
      expect(getCategoryLabel("agents")).toBe("Agents");
      expect(getCategoryLabel("assistants")).toBe("Assistants");
    });
  });

  describe("getSuggestedTools", () => {
    it("returns fleet tools for SSH context", () => {
      const ctx: PaneContext = {
        mode: "ssh",
        hostId: "root@docker01",
        connected: true,
      };
      const suggestions = getSuggestedTools(ctx);
      expect(suggestions.length).toBeGreaterThan(0);
      const ids = suggestions.map((t) => t.id);
      expect(ids).toContain("fleet-status");
    });

    it("returns TUI/admin tools for local context", () => {
      const ctx: PaneContext = {
        mode: "local",
        hostId: "",
        connected: true,
      };
      const suggestions = getSuggestedTools(ctx);
      expect(suggestions.length).toBeGreaterThan(0);
      const ids = suggestions.map((t) => t.id);
      expect(ids).toContain("tui-quox");
    });

    it("returns diagnostic tools when hasError is true", () => {
      const ctx: PaneContext = {
        mode: "local",
        hostId: "",
        connected: true,
        hasError: true,
      };
      const suggestions = getSuggestedTools(ctx);
      const ids = suggestions.map((t) => t.id);
      expect(ids).toContain("mon-health");
      expect(ids).toContain("mem-stats");
    });

    it("returns max 5 results", () => {
      const ctx: PaneContext = {
        mode: "ssh",
        hostId: "root@docker01",
        connected: true,
        hasError: true,
      };
      const suggestions = getSuggestedTools(ctx);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it("returns login/config tools for disconnected pane", () => {
      const ctx: PaneContext = {
        mode: "local",
        hostId: "",
        connected: false,
      };
      const suggestions = getSuggestedTools(ctx);
      const ids = suggestions.map((t) => t.id);
      expect(ids).toContain("tui-login");
      expect(ids).toContain("admin-config");
    });

    it("deduplicates results", () => {
      const ctx: PaneContext = {
        mode: "ssh",
        hostId: "root@docker01",
        connected: true,
        hasError: true,
      };
      const suggestions = getSuggestedTools(ctx);
      const ids = suggestions.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("dangerous flag", () => {
    it("admin-logout is marked dangerous", () => {
      const tool = getToolById("admin-logout");
      expect(tool?.dangerous).toBe(true);
    });

    it("mon-backup-create is marked dangerous", () => {
      const tool = getToolById("mon-backup-create");
      expect(tool?.dangerous).toBe(true);
    });

    it("fleet-status is not dangerous", () => {
      const tool = getToolById("fleet-status");
      expect(tool?.dangerous).toBeFalsy();
    });
  });

  describe("contextMatch", () => {
    it("fleet-status has contextMatch for SSH", () => {
      const tool = getToolById("fleet-status");
      expect(tool?.contextMatch?.mode).toBe("ssh");
    });
  });
});
