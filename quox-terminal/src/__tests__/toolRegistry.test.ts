import { describe, it, expect } from "vitest";
import {
  getTools,
  getToolsByCategory,
  getToolById,
  buildCommand,
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

    it("returns undefined for unknown ID", () => {
      expect(getToolById("nonexistent-tool")).toBeUndefined();
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

    it("quotes values with spaces in named flags", () => {
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
        'quox memory search --query "docker deployment"',
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
});
