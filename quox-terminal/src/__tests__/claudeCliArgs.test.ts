import { describe, it, expect } from "vitest";
import { getClaudeArgs, getModelFlag, TERMINAL_MODES, CLAUDE_MODELS } from "../config/terminalModes";

describe("getClaudeArgs", () => {
  it("returns empty args for balanced mode (default)", () => {
    expect(getClaudeArgs("balanced")).toEqual([]);
  });

  it("returns --allowedTools with read-only tools for strict mode", () => {
    const args = getClaudeArgs("strict");
    expect(args).toContain("--allowedTools");
    expect(args[1]).toContain("Read");
    expect(args[1]).toContain("Glob");
    expect(args[1]).toContain("Grep");
    // Strict should NOT include WebSearch (read-only like audit)
    expect(args[1]).not.toContain("WebSearch");
  });

  it("returns --dangerouslySkipPermissions for builder mode", () => {
    const args = getClaudeArgs("builder");
    expect(args).toContain("--dangerouslySkipPermissions");
  });

  it("returns read-only --allowedTools for audit mode", () => {
    const args = getClaudeArgs("audit");
    expect(args).toContain("--allowedTools");
    expect(args[1]).toContain("Read");
    expect(args[1]).toContain("Glob");
    expect(args[1]).toContain("Grep");
    // Audit should NOT include WebSearch (stricter than strict)
    expect(args[1]).not.toContain("WebSearch");
  });

  it("returns empty array for unknown mode (fallback)", () => {
    // @ts-expect-error — testing invalid input
    expect(getClaudeArgs("unknown")).toEqual([]);
  });

  it("all modes have cliArgs defined", () => {
    for (const mode of Object.values(TERMINAL_MODES)) {
      expect(Array.isArray(mode.cliArgs)).toBe(true);
    }
  });

  it("includes model flag when model is specified", () => {
    const args = getClaudeArgs("balanced", "opus");
    expect(args).toContain("--model");
    expect(args).toContain("opus");
  });

  it("does not include model flag for default model (sonnet)", () => {
    const args = getClaudeArgs("balanced", "sonnet");
    expect(args).not.toContain("--model");
  });

  it("combines mode args and model args", () => {
    const args = getClaudeArgs("strict", "haiku");
    expect(args).toContain("--allowedTools");
    expect(args).toContain("--model");
    expect(args).toContain("haiku");
  });
});

describe("getModelFlag", () => {
  it("returns empty for default model (sonnet)", () => {
    expect(getModelFlag("sonnet")).toEqual([]);
  });

  it("returns --model opus for opus", () => {
    expect(getModelFlag("opus")).toEqual(["--model", "opus"]);
  });

  it("returns --model haiku for haiku", () => {
    expect(getModelFlag("haiku")).toEqual(["--model", "haiku"]);
  });
});

describe("CLAUDE_MODELS", () => {
  it("has 3 model options", () => {
    expect(CLAUDE_MODELS).toHaveLength(3);
  });

  it("each model has id, label, flag, and color", () => {
    for (const model of CLAUDE_MODELS) {
      expect(model.id).toBeDefined();
      expect(model.label).toBeDefined();
      expect(model.flag).toBeDefined();
      expect(model.color).toBeDefined();
    }
  });
});
