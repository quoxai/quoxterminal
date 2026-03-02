import { describe, it, expect } from "vitest";
import { getClaudeArgs, TERMINAL_MODES } from "../config/terminalModes";

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
});
