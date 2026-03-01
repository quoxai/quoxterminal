/**
 * claudeOutputParser.ts — TypeScript types and parser for Claude CLI stream-json output.
 *
 * Mirrors the Rust structs in claude/parser.rs. The Rust backend parses NDJSON
 * and emits typed events via Tauri; the frontend uses these types to render them.
 */

// ── Event Types ──────────────────────────────────────────────────────────────

export type ClaudeEventType =
  | "system"
  | "assistant_message_start"
  | "content_block_delta"
  | "content_block_stop"
  | "assistant_message_delta"
  | "tool_use"
  | "tool_result"
  | "input_request"
  | "usage"
  | "error"
  | "unknown";

export interface SystemEvent {
  type: "system";
  subtype: string;
  message: string;
  data?: unknown;
}

export interface AssistantMessageStartEvent {
  type: "assistant_message_start";
  message_id: string;
  model: string;
}

export interface ContentBlockDeltaEvent {
  type: "content_block_delta";
  index: number;
  delta_type: string;
  text: string;
}

export interface ContentBlockStopEvent {
  type: "content_block_stop";
  index: number;
  block_type: string;
}

export interface AssistantMessageDeltaEvent {
  type: "assistant_message_delta";
  stop_reason: string;
  usage?: TokenUsage;
}

export interface ToolUseEvent {
  type: "tool_use";
  tool_name: string;
  tool_id: string;
  input: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: "tool_result";
  tool_id: string;
  output: string;
  is_error: boolean;
  duration_ms?: number;
}

export interface InputRequestEvent {
  type: "input_request";
  request_type: string;
  message: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export interface UsageEvent {
  type: "usage";
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

export interface UnknownEvent {
  type: "unknown";
  raw_type: string;
  data: unknown;
}

export type ClaudeEvent =
  | SystemEvent
  | AssistantMessageStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | AssistantMessageDeltaEvent
  | ToolUseEvent
  | ToolResultEvent
  | InputRequestEvent
  | UsageEvent
  | ErrorEvent
  | UnknownEvent;

// ── Conversation Model ───────────────────────────────────────────────────────

export type ToolCallStatus =
  | "pending"
  | "approved"
  | "running"
  | "done"
  | "denied"
  | "error";

export interface ToolCall {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  output?: string;
  status: ToolCallStatus;
  duration?: number;
  collapsed: boolean;
  isError?: boolean;
}

export type MessageRole = "user" | "assistant" | "system";

export interface ClaudeMessage {
  id: string;
  type: MessageRole;
  text: string;
  toolCalls: ToolCall[];
  timestamp: number;
  pending: boolean;
}

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Normalize a raw Tauri event payload into a typed ClaudeEvent.
 * The Rust backend emits events tagged with serde `type` field.
 */
export function parseClaudeEvent(raw: unknown): ClaudeEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  const eventType = obj.type as string;

  if (!eventType) return null;

  switch (eventType) {
    case "System":
    case "system": {
      const inner = (obj.System || obj) as Record<string, unknown>;
      return {
        type: "system",
        subtype: (inner.subtype as string) || "",
        message: (inner.message as string) || "",
        data: inner.data,
      };
    }

    case "AssistantMessageStart":
    case "assistant_message_start": {
      const inner = (obj.AssistantMessageStart || obj) as Record<
        string,
        unknown
      >;
      return {
        type: "assistant_message_start",
        message_id: (inner.message_id as string) || "",
        model: (inner.model as string) || "",
      };
    }

    case "ContentBlockDelta":
    case "content_block_delta": {
      const inner = (obj.ContentBlockDelta || obj) as Record<string, unknown>;
      return {
        type: "content_block_delta",
        index: (inner.index as number) || 0,
        delta_type: (inner.delta_type as string) || "text_delta",
        text: (inner.text as string) || "",
      };
    }

    case "ContentBlockStop":
    case "content_block_stop": {
      const inner = (obj.ContentBlockStop || obj) as Record<string, unknown>;
      return {
        type: "content_block_stop",
        index: (inner.index as number) || 0,
        block_type: (inner.block_type as string) || "text",
      };
    }

    case "AssistantMessageDelta":
    case "assistant_message_delta": {
      const inner = (obj.AssistantMessageDelta || obj) as Record<
        string,
        unknown
      >;
      return {
        type: "assistant_message_delta",
        stop_reason: (inner.stop_reason as string) || "",
        usage: inner.usage as TokenUsage | undefined,
      };
    }

    case "ToolUse":
    case "tool_use": {
      const inner = (obj.ToolUse || obj) as Record<string, unknown>;
      return {
        type: "tool_use",
        tool_name: (inner.tool_name as string) || "",
        tool_id: (inner.tool_id as string) || "",
        input: (inner.input as Record<string, unknown>) || {},
      };
    }

    case "ToolResult":
    case "tool_result": {
      const inner = (obj.ToolResult || obj) as Record<string, unknown>;
      return {
        type: "tool_result",
        tool_id: (inner.tool_id as string) || "",
        output: (inner.output as string) || "",
        is_error: (inner.is_error as boolean) || false,
        duration_ms: inner.duration_ms as number | undefined,
      };
    }

    case "InputRequest":
    case "input_request": {
      const inner = (obj.InputRequest || obj) as Record<string, unknown>;
      return {
        type: "input_request",
        request_type: (inner.request_type as string) || "",
        message: (inner.message as string) || "",
        tool_name: inner.tool_name as string | undefined,
        tool_input: inner.tool_input as Record<string, unknown> | undefined,
      };
    }

    case "Usage":
    case "usage": {
      const inner = (obj.Usage || obj) as Record<string, unknown>;
      return {
        type: "usage",
        input_tokens: (inner.input_tokens as number) || 0,
        output_tokens: (inner.output_tokens as number) || 0,
        cache_read_tokens: inner.cache_read_tokens as number | undefined,
        cache_creation_tokens: inner.cache_creation_tokens as
          | number
          | undefined,
      };
    }

    case "Error":
    case "error": {
      const inner = (obj.Error || obj) as Record<string, unknown>;
      return {
        type: "error",
        message: (inner.message as string) || "Unknown error",
        code: inner.code as string | undefined,
      };
    }

    default: {
      const inner = (obj.Unknown || obj) as Record<string, unknown>;
      return {
        type: "unknown",
        raw_type: (inner.raw_type as string) || eventType,
        data: inner.data || obj,
      };
    }
  }
}
