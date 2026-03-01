//! Parser for Claude CLI `--output-format stream-json` NDJSON output.
//!
//! The Claude CLI emits one JSON object per line. Each object has a `type` field
//! that determines the payload structure. We parse these into a typed `ClaudeEvent`
//! enum for the frontend to consume via Tauri events.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Top-level event emitted to the frontend via Tauri events.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClaudeEvent {
    /// System-level message (init, config info)
    System(SystemEvent),
    /// Start of an assistant message turn
    AssistantMessageStart(AssistantMessageStartEvent),
    /// Streaming text content from the assistant
    ContentBlockDelta(ContentBlockDeltaEvent),
    /// A complete content block (text or tool_use)
    ContentBlockStop(ContentBlockStopEvent),
    /// Assistant message complete
    AssistantMessageDelta(AssistantMessageDeltaEvent),
    /// Tool use request from Claude
    ToolUse(ToolUseEvent),
    /// Result of a tool execution
    ToolResult(ToolResultEvent),
    /// Claude is requesting user input (permission prompt, question)
    InputRequest(InputRequestEvent),
    /// Usage/token statistics
    Usage(UsageEvent),
    /// An error from the CLI
    Error(ErrorEvent),
    /// Unparsed/unknown event type — forward raw JSON
    Unknown(UnknownEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemEvent {
    pub subtype: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub data: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessageStartEvent {
    #[serde(default)]
    pub message_id: String,
    #[serde(default)]
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentBlockDeltaEvent {
    #[serde(default)]
    pub index: usize,
    #[serde(default)]
    pub delta_type: String,
    #[serde(default)]
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentBlockStopEvent {
    #[serde(default)]
    pub index: usize,
    #[serde(default)]
    pub block_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessageDeltaEvent {
    #[serde(default)]
    pub stop_reason: String,
    #[serde(default)]
    pub usage: Option<TokenUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUseEvent {
    pub tool_name: String,
    pub tool_id: String,
    #[serde(default)]
    pub input: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResultEvent {
    pub tool_id: String,
    #[serde(default)]
    pub output: String,
    #[serde(default)]
    pub is_error: bool,
    #[serde(default)]
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputRequestEvent {
    #[serde(default)]
    pub request_type: String,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub tool_name: Option<String>,
    #[serde(default)]
    pub tool_input: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageEvent {
    pub input_tokens: u64,
    pub output_tokens: u64,
    #[serde(default)]
    pub cache_read_tokens: Option<u64>,
    #[serde(default)]
    pub cache_creation_tokens: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    #[serde(default)]
    pub input_tokens: u64,
    #[serde(default)]
    pub output_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorEvent {
    pub message: String,
    #[serde(default)]
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnknownEvent {
    pub raw_type: String,
    pub data: Value,
}

/// Parse a single NDJSON line from the Claude CLI stream-json output.
///
/// The Claude CLI emits JSON objects with varying structures. We normalize
/// them into our `ClaudeEvent` enum. Unknown event types are preserved as
/// `ClaudeEvent::Unknown` so the frontend can handle them gracefully.
pub fn parse_stream_json_line(line: &str) -> Result<ClaudeEvent, String> {
    let line = line.trim();
    if line.is_empty() {
        return Err("Empty line".to_string());
    }

    let raw: Value = serde_json::from_str(line)
        .map_err(|e| format!("JSON parse error: {}", e))?;

    let event_type = raw.get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    match event_type {
        "system" => {
            Ok(ClaudeEvent::System(SystemEvent {
                subtype: raw.get("subtype").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                message: raw.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                data: raw.get("data").cloned().unwrap_or(Value::Null),
            }))
        }

        "assistant" | "message_start" => {
            Ok(ClaudeEvent::AssistantMessageStart(AssistantMessageStartEvent {
                message_id: raw.get("message_id")
                    .or_else(|| raw.get("id"))
                    .and_then(|v| v.as_str()).unwrap_or("").to_string(),
                model: raw.get("model").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }))
        }

        "content_block_delta" => {
            let delta = raw.get("delta").unwrap_or(&Value::Null);
            Ok(ClaudeEvent::ContentBlockDelta(ContentBlockDeltaEvent {
                index: raw.get("index").and_then(|v| v.as_u64()).unwrap_or(0) as usize,
                delta_type: delta.get("type").and_then(|v| v.as_str()).unwrap_or("text_delta").to_string(),
                text: delta.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }))
        }

        "content_block_stop" => {
            Ok(ClaudeEvent::ContentBlockStop(ContentBlockStopEvent {
                index: raw.get("index").and_then(|v| v.as_u64()).unwrap_or(0) as usize,
                block_type: raw.get("content_block")
                    .and_then(|cb| cb.get("type"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("text")
                    .to_string(),
            }))
        }

        "message_delta" => {
            let delta = raw.get("delta").unwrap_or(&Value::Null);
            let usage = raw.get("usage").and_then(|u| {
                Some(TokenUsage {
                    input_tokens: u.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
                    output_tokens: u.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
                })
            });
            Ok(ClaudeEvent::AssistantMessageDelta(AssistantMessageDeltaEvent {
                stop_reason: delta.get("stop_reason").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                usage,
            }))
        }

        "tool_use" => {
            Ok(ClaudeEvent::ToolUse(ToolUseEvent {
                tool_name: raw.get("name")
                    .or_else(|| raw.get("tool_name"))
                    .and_then(|v| v.as_str()).unwrap_or("").to_string(),
                tool_id: raw.get("id")
                    .or_else(|| raw.get("tool_id"))
                    .and_then(|v| v.as_str()).unwrap_or("").to_string(),
                input: raw.get("input").cloned().unwrap_or(Value::Null),
            }))
        }

        "tool_result" => {
            Ok(ClaudeEvent::ToolResult(ToolResultEvent {
                tool_id: raw.get("tool_use_id")
                    .or_else(|| raw.get("tool_id"))
                    .and_then(|v| v.as_str()).unwrap_or("").to_string(),
                output: raw.get("content")
                    .or_else(|| raw.get("output"))
                    .and_then(|v| {
                        if let Some(s) = v.as_str() {
                            Some(s.to_string())
                        } else {
                            Some(v.to_string())
                        }
                    })
                    .unwrap_or_default(),
                is_error: raw.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false),
                duration_ms: raw.get("duration_ms").and_then(|v| v.as_u64()),
            }))
        }

        "input_request" => {
            Ok(ClaudeEvent::InputRequest(InputRequestEvent {
                request_type: raw.get("request_type").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                message: raw.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                tool_name: raw.get("tool_name").and_then(|v| v.as_str()).map(|s| s.to_string()),
                tool_input: raw.get("tool_input").cloned(),
            }))
        }

        "usage" | "result" => {
            // "result" type often contains usage info at end of session
            let usage = raw.get("usage").unwrap_or(&raw);
            Ok(ClaudeEvent::Usage(UsageEvent {
                input_tokens: usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
                output_tokens: usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
                cache_read_tokens: usage.get("cache_read_input_tokens")
                    .or_else(|| usage.get("cache_read_tokens"))
                    .and_then(|v| v.as_u64()),
                cache_creation_tokens: usage.get("cache_creation_input_tokens")
                    .or_else(|| usage.get("cache_creation_tokens"))
                    .and_then(|v| v.as_u64()),
            }))
        }

        "error" => {
            Ok(ClaudeEvent::Error(ErrorEvent {
                message: raw.get("error")
                    .and_then(|e| e.get("message").or(Some(e)))
                    .and_then(|v| {
                        if let Some(s) = v.as_str() { Some(s.to_string()) }
                        else { Some(v.to_string()) }
                    })
                    .unwrap_or_else(|| raw.get("message").and_then(|v| v.as_str()).unwrap_or("Unknown error").to_string()),
                code: raw.get("error")
                    .and_then(|e| e.get("type"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            }))
        }

        _ => {
            Ok(ClaudeEvent::Unknown(UnknownEvent {
                raw_type: event_type.to_string(),
                data: raw,
            }))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_system_event() {
        let line = r#"{"type":"system","subtype":"init","message":"Claude Code v2.1.63"}"#;
        let event = parse_stream_json_line(line).unwrap();
        match event {
            ClaudeEvent::System(e) => {
                assert_eq!(e.subtype, "init");
                assert_eq!(e.message, "Claude Code v2.1.63");
            }
            _ => panic!("Expected System event"),
        }
    }

    #[test]
    fn test_parse_content_block_delta() {
        let line = r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}"#;
        let event = parse_stream_json_line(line).unwrap();
        match event {
            ClaudeEvent::ContentBlockDelta(e) => {
                assert_eq!(e.index, 0);
                assert_eq!(e.text, "Hello ");
                assert_eq!(e.delta_type, "text_delta");
            }
            _ => panic!("Expected ContentBlockDelta event"),
        }
    }

    #[test]
    fn test_parse_tool_use() {
        let line = r#"{"type":"tool_use","id":"toolu_123","name":"Read","input":{"file_path":"/src/main.rs"}}"#;
        let event = parse_stream_json_line(line).unwrap();
        match event {
            ClaudeEvent::ToolUse(e) => {
                assert_eq!(e.tool_name, "Read");
                assert_eq!(e.tool_id, "toolu_123");
                assert_eq!(e.input["file_path"], "/src/main.rs");
            }
            _ => panic!("Expected ToolUse event"),
        }
    }

    #[test]
    fn test_parse_tool_result() {
        let line = r#"{"type":"tool_result","tool_use_id":"toolu_123","content":"file contents here","is_error":false}"#;
        let event = parse_stream_json_line(line).unwrap();
        match event {
            ClaudeEvent::ToolResult(e) => {
                assert_eq!(e.tool_id, "toolu_123");
                assert_eq!(e.output, "file contents here");
                assert!(!e.is_error);
            }
            _ => panic!("Expected ToolResult event"),
        }
    }

    #[test]
    fn test_parse_message_delta() {
        let line = r#"{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":1000,"output_tokens":200}}"#;
        let event = parse_stream_json_line(line).unwrap();
        match event {
            ClaudeEvent::AssistantMessageDelta(e) => {
                assert_eq!(e.stop_reason, "end_turn");
                let usage = e.usage.unwrap();
                assert_eq!(usage.input_tokens, 1000);
                assert_eq!(usage.output_tokens, 200);
            }
            _ => panic!("Expected AssistantMessageDelta event"),
        }
    }

    #[test]
    fn test_parse_error() {
        let line = r#"{"type":"error","error":{"type":"rate_limit","message":"Rate limited"}}"#;
        let event = parse_stream_json_line(line).unwrap();
        match event {
            ClaudeEvent::Error(e) => {
                assert_eq!(e.message, "Rate limited");
                assert_eq!(e.code, Some("rate_limit".to_string()));
            }
            _ => panic!("Expected Error event"),
        }
    }

    #[test]
    fn test_parse_unknown_event() {
        let line = r#"{"type":"some_future_type","data":"hello"}"#;
        let event = parse_stream_json_line(line).unwrap();
        match event {
            ClaudeEvent::Unknown(e) => {
                assert_eq!(e.raw_type, "some_future_type");
            }
            _ => panic!("Expected Unknown event"),
        }
    }

    #[test]
    fn test_parse_empty_line() {
        assert!(parse_stream_json_line("").is_err());
        assert!(parse_stream_json_line("  ").is_err());
    }

    #[test]
    fn test_parse_invalid_json() {
        assert!(parse_stream_json_line("not json").is_err());
    }

    #[test]
    fn test_parse_input_request() {
        let line = r#"{"type":"input_request","request_type":"permission","message":"Allow Read?","tool_name":"Read","tool_input":{"file_path":"test.rs"}}"#;
        let event = parse_stream_json_line(line).unwrap();
        match event {
            ClaudeEvent::InputRequest(e) => {
                assert_eq!(e.request_type, "permission");
                assert_eq!(e.message, "Allow Read?");
                assert_eq!(e.tool_name, Some("Read".to_string()));
            }
            _ => panic!("Expected InputRequest event"),
        }
    }

    #[test]
    fn test_parse_usage_result() {
        let line = r#"{"type":"result","usage":{"input_tokens":5000,"output_tokens":800,"cache_read_input_tokens":1200}}"#;
        let event = parse_stream_json_line(line).unwrap();
        match event {
            ClaudeEvent::Usage(e) => {
                assert_eq!(e.input_tokens, 5000);
                assert_eq!(e.output_tokens, 800);
                assert_eq!(e.cache_read_tokens, Some(1200));
            }
            _ => panic!("Expected Usage event"),
        }
    }
}
