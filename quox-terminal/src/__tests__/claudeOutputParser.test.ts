import { describe, it, expect } from "vitest";
import { parseClaudeEvent } from "../services/claudeOutputParser";

describe("claudeOutputParser", () => {
  describe("parseClaudeEvent", () => {
    it("returns null for invalid input", () => {
      expect(parseClaudeEvent(null)).toBeNull();
      expect(parseClaudeEvent(undefined)).toBeNull();
      expect(parseClaudeEvent("string")).toBeNull();
      expect(parseClaudeEvent(42)).toBeNull();
      expect(parseClaudeEvent({})).toBeNull();
    });

    it("parses system event (serde tagged)", () => {
      const raw = {
        type: "System",
        System: {
          subtype: "init",
          message: "Claude Code v2.1.63",
          data: null,
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("system");
      if (event!.type === "system") {
        expect(event!.subtype).toBe("init");
        expect(event!.message).toBe("Claude Code v2.1.63");
      }
    });

    it("parses system event (flat)", () => {
      const raw = {
        type: "system",
        subtype: "raw_output",
        message: "Loading...",
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("system");
      if (event!.type === "system") {
        expect(event!.subtype).toBe("raw_output");
        expect(event!.message).toBe("Loading...");
      }
    });

    it("parses content_block_delta (serde tagged)", () => {
      const raw = {
        type: "ContentBlockDelta",
        ContentBlockDelta: {
          index: 0,
          delta_type: "text_delta",
          text: "Hello world",
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("content_block_delta");
      if (event!.type === "content_block_delta") {
        expect(event!.index).toBe(0);
        expect(event!.text).toBe("Hello world");
        expect(event!.delta_type).toBe("text_delta");
      }
    });

    it("parses tool_use event", () => {
      const raw = {
        type: "ToolUse",
        ToolUse: {
          tool_name: "Read",
          tool_id: "toolu_abc123",
          input: { file_path: "/src/main.rs" },
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("tool_use");
      if (event!.type === "tool_use") {
        expect(event!.tool_name).toBe("Read");
        expect(event!.tool_id).toBe("toolu_abc123");
        expect(event!.input.file_path).toBe("/src/main.rs");
      }
    });

    it("parses tool_result event", () => {
      const raw = {
        type: "ToolResult",
        ToolResult: {
          tool_id: "toolu_abc123",
          output: "file contents here",
          is_error: false,
          duration_ms: 120,
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("tool_result");
      if (event!.type === "tool_result") {
        expect(event!.tool_id).toBe("toolu_abc123");
        expect(event!.output).toBe("file contents here");
        expect(event!.is_error).toBe(false);
        expect(event!.duration_ms).toBe(120);
      }
    });

    it("parses tool_result with error", () => {
      const raw = {
        type: "ToolResult",
        ToolResult: {
          tool_id: "toolu_err",
          output: "File not found",
          is_error: true,
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      if (event!.type === "tool_result") {
        expect(event!.is_error).toBe(true);
        expect(event!.output).toBe("File not found");
      }
    });

    it("parses assistant_message_start", () => {
      const raw = {
        type: "AssistantMessageStart",
        AssistantMessageStart: {
          message_id: "msg_123",
          model: "claude-opus-4-6",
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("assistant_message_start");
      if (event!.type === "assistant_message_start") {
        expect(event!.message_id).toBe("msg_123");
        expect(event!.model).toBe("claude-opus-4-6");
      }
    });

    it("parses assistant_message_delta with usage", () => {
      const raw = {
        type: "AssistantMessageDelta",
        AssistantMessageDelta: {
          stop_reason: "end_turn",
          usage: { input_tokens: 1000, output_tokens: 200 },
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("assistant_message_delta");
      if (event!.type === "assistant_message_delta") {
        expect(event!.stop_reason).toBe("end_turn");
        expect(event!.usage?.input_tokens).toBe(1000);
        expect(event!.usage?.output_tokens).toBe(200);
      }
    });

    it("parses input_request event", () => {
      const raw = {
        type: "InputRequest",
        InputRequest: {
          request_type: "permission",
          message: "Allow Edit on src/auth.ts?",
          tool_name: "Edit",
          tool_input: { file_path: "src/auth.ts" },
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("input_request");
      if (event!.type === "input_request") {
        expect(event!.request_type).toBe("permission");
        expect(event!.tool_name).toBe("Edit");
      }
    });

    it("parses usage event", () => {
      const raw = {
        type: "Usage",
        Usage: {
          input_tokens: 5000,
          output_tokens: 800,
          cache_read_tokens: 1200,
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("usage");
      if (event!.type === "usage") {
        expect(event!.input_tokens).toBe(5000);
        expect(event!.output_tokens).toBe(800);
        expect(event!.cache_read_tokens).toBe(1200);
      }
    });

    it("parses error event", () => {
      const raw = {
        type: "Error",
        Error: {
          message: "Rate limited",
          code: "rate_limit",
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("error");
      if (event!.type === "error") {
        expect(event!.message).toBe("Rate limited");
        expect(event!.code).toBe("rate_limit");
      }
    });

    it("parses unknown event type", () => {
      const raw = {
        type: "SomeFutureType",
        data: { foo: "bar" },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("unknown");
      if (event!.type === "unknown") {
        expect(event!.raw_type).toBe("SomeFutureType");
      }
    });

    it("parses content_block_stop", () => {
      const raw = {
        type: "ContentBlockStop",
        ContentBlockStop: {
          index: 0,
          block_type: "text",
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      expect(event!.type).toBe("content_block_stop");
      if (event!.type === "content_block_stop") {
        expect(event!.index).toBe(0);
        expect(event!.block_type).toBe("text");
      }
    });

    it("handles missing optional fields gracefully", () => {
      const raw = {
        type: "ToolUse",
        ToolUse: {
          tool_name: "Bash",
          tool_id: "toolu_min",
        },
      };
      const event = parseClaudeEvent(raw);
      expect(event).not.toBeNull();
      if (event!.type === "tool_use") {
        expect(event!.tool_name).toBe("Bash");
        expect(event!.input).toEqual({});
      }
    });
  });
});
