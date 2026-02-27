//! AI Streaming — SSE handler for token-by-token chat responses.
//!
//! Opens a streaming POST to the Anthropic Messages API and parses SSE events,
//! emitting each text delta as a Tauri event for real-time display.

use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use super::client::{resolve_auth, AuthMethod, ChatMessage};

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const DEFAULT_MAX_TOKENS: u32 = 4096;

/// Request body for streaming (includes stream: true).
#[derive(Debug, Serialize)]
struct StreamingRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<ChatMessage>,
    stream: bool,
}

/// A streaming text delta event payload sent to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct StreamDelta {
    pub text: String,
}

/// A stream completion event payload sent to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct StreamDone {
    pub full_text: String,
    pub stop_reason: Option<String>,
    pub error: Option<String>,
}

/// SSE content_block_delta data.
#[derive(Debug, Deserialize)]
struct SseContentBlockDelta {
    delta: TextDelta,
}

#[derive(Debug, Deserialize)]
struct TextDelta {
    #[serde(rename = "type")]
    delta_type: String,
    text: Option<String>,
}

/// SSE message_delta data.
#[derive(Debug, Deserialize)]
struct SseMessageDelta {
    delta: MessageDeltaInner,
}

#[derive(Debug, Deserialize)]
struct MessageDeltaInner {
    stop_reason: Option<String>,
}

/// SSE error data.
#[derive(Debug, Deserialize)]
struct SseError {
    error: SseErrorDetail,
}

#[derive(Debug, Deserialize)]
struct SseErrorDetail {
    message: String,
}

/// Stream a chat response from the Anthropic API.
///
/// Emits Tauri events:
/// - `chat-stream-{stream_id}` — for each text delta (payload: StreamDelta)
/// - `chat-stream-done-{stream_id}` — when streaming finishes (payload: StreamDone)
pub async fn chat_send_stream(
    stream_id: &str,
    messages: Vec<ChatMessage>,
    model: &str,
    manual_api_key: &str,
    system_prompt: &str,
    app_handle: AppHandle,
) -> Result<(), String> {
    let auth = resolve_auth(manual_api_key);

    let (auth_header_name, auth_header_value) = match &auth {
        AuthMethod::CliOAuth { token, .. } => ("Authorization", format!("Bearer {}", token)),
        AuthMethod::ApiKey { key } => {
            if key.starts_with("sk-ant-oat") {
                ("Authorization", format!("Bearer {}", key))
            } else {
                ("x-api-key", key.clone())
            }
        }
        AuthMethod::None => {
            let err = "No authentication configured. Sign in via Settings or add an API key.";
            let _ = app_handle.emit(
                &format!("chat-stream-done-{}", stream_id),
                StreamDone {
                    full_text: String::new(),
                    stop_reason: None,
                    error: Some(err.to_string()),
                },
            );
            return Err(err.to_string());
        }
    };

    let client = Client::new();
    let request_body = StreamingRequest {
        model: model.to_string(),
        max_tokens: DEFAULT_MAX_TOKENS,
        system: system_prompt.to_string(),
        messages,
        stream: true,
    };

    let response = client
        .post(ANTHROPIC_API_URL)
        .header(auth_header_name, auth_header_value)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let done_event = format!("chat-stream-done-{}", stream_id);

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let err_msg = format!(
            "API error ({}): {}",
            status.as_u16(),
            &body[..500.min(body.len())]
        );
        let _ = app_handle.emit(
            &done_event,
            StreamDone {
                full_text: String::new(),
                stop_reason: None,
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    // Process SSE stream
    let delta_event = format!("chat-stream-{}", stream_id);
    let mut full_text = String::new();
    let mut stop_reason: Option<String> = None;
    let mut buffer = String::new();
    let mut byte_stream = response.bytes_stream();

    while let Some(chunk) = byte_stream.next().await {
        let chunk = match chunk {
            Ok(c) => c,
            Err(e) => {
                let _ = app_handle.emit(
                    &done_event,
                    StreamDone {
                        full_text: full_text.clone(),
                        stop_reason: None,
                        error: Some(format!("Stream read error: {}", e)),
                    },
                );
                return Err(format!("Stream read error: {}", e));
            }
        };

        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete SSE events (double newline separated)
        while let Some(boundary) = buffer.find("\n\n") {
            let event_block = buffer[..boundary].to_string();
            buffer = buffer[boundary + 2..].to_string();

            let mut event_type = String::new();
            let mut data = String::new();

            for line in event_block.lines() {
                if let Some(rest) = line.strip_prefix("event: ") {
                    event_type = rest.trim().to_string();
                } else if let Some(rest) = line.strip_prefix("data: ") {
                    data = rest.to_string();
                }
            }

            if data.is_empty() {
                continue;
            }

            match event_type.as_str() {
                "content_block_delta" => {
                    if let Ok(delta) = serde_json::from_str::<SseContentBlockDelta>(&data) {
                        if delta.delta.delta_type == "text_delta" {
                            if let Some(text) = &delta.delta.text {
                                full_text.push_str(text);
                                let _ = app_handle
                                    .emit(&delta_event, StreamDelta { text: text.clone() });
                            }
                        }
                    }
                }
                "message_delta" => {
                    if let Ok(msg_delta) = serde_json::from_str::<SseMessageDelta>(&data) {
                        stop_reason = msg_delta.delta.stop_reason;
                    }
                }
                "message_stop" => {
                    // Streaming complete
                }
                "error" => {
                    if let Ok(err) = serde_json::from_str::<SseError>(&data) {
                        let _ = app_handle.emit(
                            &done_event,
                            StreamDone {
                                full_text: full_text.clone(),
                                stop_reason: None,
                                error: Some(err.error.message),
                            },
                        );
                        return Err("Stream error from API".to_string());
                    }
                }
                _ => {} // ping, message_start, content_block_start, content_block_stop
            }
        }
    }

    // Emit completion
    let _ = app_handle.emit(
        &done_event,
        StreamDone {
            full_text,
            stop_reason,
            error: None,
        },
    );

    Ok(())
}
