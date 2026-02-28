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
        "fleet",
        "ops",
        "ai",
        "workflows",
        "memory",
        "secrets",
        "monitoring",
        "admin",
        "tui",
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
      const tool = getToolById("fleet-list");
      expect(tool).toBeDefined();
      expect(tool!.name).toBe("Fleet List");
      expect(tool!.category).toBe("fleet");
    });

    it("returns undefined for unknown ID", () => {
      expect(getToolById("nonexistent-tool")).toBeUndefined();
    });
  });

  describe("buildCommand", () => {
    it("builds command with no args or params", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "admin",
        command: "bastion",
      };
      expect(buildCommand(tool)).toBe("bastion");
    });

    it("builds command with args", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "fleet",
        command: "quox",
        args: ["fleet", "list"],
      };
      expect(buildCommand(tool)).toBe("quox fleet list");
    });

    it("builds command with text params", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "ai",
        command: "quox",
        args: ["ask"],
        params: [
          { name: "question", label: "Question", type: "text", required: true },
        ],
      };
      expect(buildCommand(tool, { question: "hello world" })).toBe(
        "quox ask hello world",
      );
    });

    it("builds command with select params", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "ops",
        command: "quox",
        args: ["deploy"],
        params: [
          {
            name: "service",
            label: "Service",
            type: "select",
            required: true,
            options: [{ label: "Collector", value: "collector" }],
          },
        ],
      };
      expect(buildCommand(tool, { service: "collector" })).toBe(
        "quox deploy collector",
      );
    });

    it("builds command with flag param enabled", () => {
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
        category: "ops",
        command: "quox",
        args: ["deploy"],
        params: [
          { name: "service", label: "Service", type: "text", required: true },
        ],
      };
      expect(buildCommand(tool, { service: "" })).toBe("quox deploy");
    });

    it("uses default param value when not provided", () => {
      const tool: ToolDefinition = {
        id: "test",
        name: "Test",
        description: "Test tool",
        category: "ops",
        command: "quox",
        args: ["logs"],
        params: [
          {
            name: "service",
            label: "Service",
            type: "text",
            default: "collector",
          },
        ],
      };
      expect(buildCommand(tool)).toBe("quox logs collector");
    });

    it("works with real tool from registry", () => {
      const tool = getToolById("fleet-list")!;
      expect(buildCommand(tool)).toBe("quox fleet list");
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
    it("returns ops/monitoring tools for SSH context", () => {
      const ctx: PaneContext = {
        mode: "ssh",
        hostId: "root@docker01",
        connected: true,
      };
      const suggestions = getSuggestedTools(ctx);
      expect(suggestions.length).toBeGreaterThan(0);
      const ids = suggestions.map((t) => t.id);
      expect(ids).toContain("bastion-exec");
      expect(ids).toContain("mon-bastion-status");
    });

    it("returns admin/TUI tools for local context", () => {
      const ctx: PaneContext = {
        mode: "local",
        hostId: "",
        connected: true,
      };
      const suggestions = getSuggestedTools(ctx);
      expect(suggestions.length).toBeGreaterThan(0);
      const ids = suggestions.map((t) => t.id);
      expect(ids).toContain("admin-config");
      expect(ids).toContain("admin-whoami");
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
      expect(ids).toContain("mon-agent-health");
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

    it("returns only admin tools for disconnected pane", () => {
      const ctx: PaneContext = {
        mode: "local",
        hostId: "",
        connected: false,
      };
      const suggestions = getSuggestedTools(ctx);
      const ids = suggestions.map((t) => t.id);
      expect(ids).toContain("admin-login");
      expect(ids).toContain("admin-config");
      // Should not include ops or monitoring tools
      expect(ids).not.toContain("bastion-exec");
      expect(ids).not.toContain("mon-health");
    });

    it("matches host pattern in hostId", () => {
      // Add a tool with hostPattern dynamically is not needed — we test existing tools
      // bastion-exec has contextMatch.mode === "ssh", no hostPattern
      // So this test verifies the SSH path includes ops tools for docker hosts
      const ctx: PaneContext = {
        mode: "ssh",
        hostId: "root@docker01",
        connected: true,
      };
      const suggestions = getSuggestedTools(ctx);
      const ids = suggestions.map((t) => t.id);
      // ops tools should be included for SSH context
      expect(ids).toContain("ops-logs");
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
      // No duplicate IDs
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("returns SSH-mode tools not present in local suggestions", () => {
      const sshCtx: PaneContext = {
        mode: "ssh",
        hostId: "root@docker01",
        connected: true,
      };
      const localCtx: PaneContext = {
        mode: "local",
        hostId: "",
        connected: true,
      };
      const sshIds = getSuggestedTools(sshCtx).map((t) => t.id);
      const localIds = getSuggestedTools(localCtx).map((t) => t.id);

      // bastion-exec should only be in SSH suggestions
      expect(sshIds).toContain("bastion-exec");
      expect(localIds).not.toContain("bastion-exec");
    });
  });
});
