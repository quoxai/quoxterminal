/**
 * useClaudeSession — Hook managing a single Claude CLI session.
 *
 * Handles: spawn, listen to events, accumulate messages + tool calls,
 * send user input, and kill on cleanup.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { claudeSpawn, claudeWrite, claudeKill } from "../lib/tauri-claude";
import {
  parseClaudeEvent,
  type ClaudeMessage,
  type ToolCall,
  type ClaudeEvent,
} from "../services/claudeOutputParser";
import { playNotificationBeep, requestWindowAttention } from "../utils/notificationBeep";

export type SessionStatus =
  | "idle"
  | "spawning"
  | "running"
  | "waiting" // waiting for user input
  | "error"
  | "exited";

export interface ClaudeSessionState {
  sessionId: string | null;
  status: SessionStatus;
  messages: ClaudeMessage[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  error: string | null;
}

interface UseClaudeSessionReturn {
  state: ClaudeSessionState;
  spawn: (cwd: string, args?: string[]) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  approveToolCall: (toolId: string) => Promise<void>;
  denyToolCall: (toolId: string, reason?: string) => Promise<void>;
  kill: () => Promise<void>;
}

let messageCounter = 0;
function nextMessageId(): string {
  return `msg-${Date.now()}-${messageCounter++}`;
}

export default function useClaudeSession(): UseClaudeSessionReturn {
  const [state, setState] = useState<ClaudeSessionState>({
    sessionId: null,
    status: "idle",
    messages: [],
    model: "",
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    error: null,
  });

  const unlistenRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      unlistenRef.current?.();
      unlistenExitRef.current?.();
      if (sessionIdRef.current) {
        claudeKill(sessionIdRef.current).catch(() => {});
      }
    };
  }, []);

  // Beep + bounce dock icon + flash tab when Claude transitions to waiting
  useEffect(() => {
    if (state.status === "waiting") {
      playNotificationBeep();
      requestWindowAttention();
      // Dispatch custom event so workspace tabs can flash
      window.dispatchEvent(new CustomEvent("claude-waiting", {
        detail: { sessionId: state.sessionId },
      }));
    }
  }, [state.status, state.sessionId]);

  const handleEvent = useCallback((rawEvent: ClaudeEvent) => {
    setState((prev) => {
      // Deep-copy messages to avoid mutating previous state objects.
      // Shallow array copy ([...prev.messages]) shares object references,
      // causing React to see stale/mutated state under rapid streaming.
      const messages = prev.messages.map((m) => ({
        ...m,
        toolCalls: m.toolCalls.map((tc) => ({ ...tc })),
      }));
      let { model, inputTokens, outputTokens, cacheReadTokens, status } = prev;

      switch (rawEvent.type) {
        case "assistant_message_start": {
          if (rawEvent.model) model = rawEvent.model;
          // Start a new assistant message
          messages.push({
            id: rawEvent.message_id || nextMessageId(),
            type: "assistant",
            text: "",
            toolCalls: [],
            timestamp: Date.now(),
            pending: true,
          });
          status = "running";
          break;
        }

        case "content_block_delta": {
          // Append text to current assistant message (now safe — message is a fresh copy)
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.type === "assistant") {
            lastMsg.text += rawEvent.text;
          }
          break;
        }

        case "content_block_stop": {
          // Block finished — no action needed, text already accumulated
          break;
        }

        case "tool_use": {
          // Add tool call to current assistant message
          const currentMsg = messages[messages.length - 1];
          if (currentMsg && currentMsg.type === "assistant") {
            currentMsg.toolCalls.push({
              id: rawEvent.tool_id,
              tool: rawEvent.tool_name,
              input: rawEvent.input,
              status: "running",
              collapsed: false,
            });
          }
          break;
        }

        case "tool_result": {
          // Find the tool call and update it
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const tcIdx = msg.toolCalls.findIndex(
              (t) => t.id === rawEvent.tool_id,
            );
            if (tcIdx !== -1) {
              msg.toolCalls[tcIdx] = {
                ...msg.toolCalls[tcIdx],
                output: rawEvent.output,
                status: rawEvent.is_error ? "error" : "done",
                duration: rawEvent.duration_ms,
                isError: rawEvent.is_error,
                collapsed: true, // collapse completed tool calls
              };
              break;
            }
          }
          break;
        }

        case "assistant_message_delta": {
          // Message complete
          const lastAssistant = messages[messages.length - 1];
          if (lastAssistant && lastAssistant.type === "assistant") {
            lastAssistant.pending = false;
          }
          if (rawEvent.usage) {
            inputTokens += rawEvent.usage.input_tokens;
            outputTokens += rawEvent.usage.output_tokens;
          }
          status = "running";
          break;
        }

        case "input_request": {
          status = "waiting";
          // Add as system message so UI can render the prompt
          messages.push({
            id: nextMessageId(),
            type: "system",
            text: rawEvent.message,
            toolCalls: [],
            timestamp: Date.now(),
            pending: true,
          });
          break;
        }

        case "usage": {
          inputTokens = rawEvent.input_tokens;
          outputTokens = rawEvent.output_tokens;
          if (rawEvent.cache_read_tokens) {
            cacheReadTokens = rawEvent.cache_read_tokens;
          }
          break;
        }

        case "error": {
          messages.push({
            id: nextMessageId(),
            type: "system",
            text: `Error: ${rawEvent.message}`,
            toolCalls: [],
            timestamp: Date.now(),
            pending: false,
          });
          status = "error";
          break;
        }

        case "system": {
          // Raw output or init — only show if it has useful info
          if (rawEvent.subtype === "init" || rawEvent.subtype === "raw_output") {
            // Skip raw output noise, but keep init messages
            if (rawEvent.subtype === "init" && rawEvent.message) {
              messages.push({
                id: nextMessageId(),
                type: "system",
                text: rawEvent.message,
                toolCalls: [],
                timestamp: Date.now(),
                pending: false,
              });
            }
          }
          break;
        }

        // unknown, content_block_stop — no UI action needed
        default:
          break;
      }

      return {
        ...prev,
        messages,
        model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        status,
      };
    });
  }, []);

  const spawn = useCallback(
    async (cwd: string, args?: string[]) => {
      // Clean up existing session
      if (sessionIdRef.current) {
        unlistenRef.current?.();
        unlistenExitRef.current?.();
        await claudeKill(sessionIdRef.current).catch(() => {});
      }

      setState({
        sessionId: null,
        status: "spawning",
        messages: [],
        model: "",
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        error: null,
      });

      try {
        const sid = await claudeSpawn(cwd, args);
        sessionIdRef.current = sid;

        // Listen for claude events
        const unlisten = await listen<unknown>(
          `claude-event-${sid}`,
          (event) => {
            const parsed = parseClaudeEvent(event.payload);
            if (parsed) handleEvent(parsed);
          },
        );
        unlistenRef.current = unlisten;

        // Listen for exit
        const unlistenExit = await listen<{ code: number }>(
          `claude-exit-${sid}`,
          () => {
            setState((prev) => ({
              ...prev,
              status: "exited",
            }));
          },
        );
        unlistenExitRef.current = unlistenExit;

        setState((prev) => ({
          ...prev,
          sessionId: sid,
          status: "running",
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setState((prev) => ({
          ...prev,
          status: "error",
          error: msg,
        }));
      }
    },
    [handleEvent],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionIdRef.current) return;

      // Add user message to conversation
      setState((prev) => ({
        ...prev,
        status: "running",
        messages: [
          ...prev.messages,
          {
            id: nextMessageId(),
            type: "user" as const,
            text,
            toolCalls: [],
            timestamp: Date.now(),
            pending: false,
          },
        ],
      }));

      // Write to Claude stdin (with newline to submit)
      await claudeWrite(sessionIdRef.current, text + "\n");
    },
    [],
  );

  const approveToolCall = useCallback(
    async (toolId: string) => {
      if (!sessionIdRef.current) return;
      // Update tool call status
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) => ({
          ...msg,
          toolCalls: msg.toolCalls.map((tc) =>
            tc.id === toolId ? { ...tc, status: "approved" as const } : tc,
          ),
        })),
      }));
      // Send approval to Claude stdin
      await claudeWrite(sessionIdRef.current, "y\n");
    },
    [],
  );

  const denyToolCall = useCallback(
    async (toolId: string, reason?: string) => {
      if (!sessionIdRef.current) return;
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) => ({
          ...msg,
          toolCalls: msg.toolCalls.map((tc) =>
            tc.id === toolId ? { ...tc, status: "denied" as const } : tc,
          ),
        })),
      }));
      // Send denial (with optional reason)
      const response = reason ? `n\n${reason}\n` : "n\n";
      await claudeWrite(sessionIdRef.current, response);
    },
    [],
  );

  const kill = useCallback(async () => {
    if (sessionIdRef.current) {
      unlistenRef.current?.();
      unlistenExitRef.current?.();
      await claudeKill(sessionIdRef.current).catch(() => {});
      sessionIdRef.current = null;
      setState((prev) => ({
        ...prev,
        sessionId: null,
        status: "exited",
      }));
    }
  }, []);

  return {
    state,
    spawn,
    sendMessage,
    approveToolCall,
    denyToolCall,
    kill,
  };
}
