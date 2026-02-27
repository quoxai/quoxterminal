//! AI Client — Sends chat messages to the Anthropic Messages API.
//!
//! Simple async function that takes messages, model name, API key, and system prompt,
//! then returns the assistant's response text.

use reqwest::Client;
use serde::{Deserialize, Serialize};

/// A single message in the conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Request body for the Anthropic Messages API.
#[derive(Debug, Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<ChatMessage>,
}

/// A content block in the Anthropic response.
#[derive(Debug, Deserialize)]
struct ContentBlock {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
}

/// Response from the Anthropic Messages API.
#[derive(Debug, Deserialize)]
struct AnthropicResponse {
    content: Vec<ContentBlock>,
    #[allow(dead_code)]
    model: Option<String>,
    #[allow(dead_code)]
    stop_reason: Option<String>,
}

/// Error response from the Anthropic API.
#[derive(Debug, Deserialize)]
struct AnthropicError {
    error: AnthropicErrorDetail,
}

#[derive(Debug, Deserialize)]
struct AnthropicErrorDetail {
    message: String,
    #[allow(dead_code)]
    #[serde(rename = "type")]
    error_type: Option<String>,
}

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const DEFAULT_MAX_TOKENS: u32 = 4096;

/// Send a chat message to the Anthropic Messages API and return the response text.
///
/// # Arguments
/// * `messages` - Conversation history (user/assistant messages)
/// * `model` - Model identifier (e.g., "claude-sonnet-4-20250514")
/// * `api_key` - Anthropic API key
/// * `system_prompt` - System prompt text (sent as the `system` field)
///
/// # Returns
/// The assistant's response text, or an error string.
pub async fn chat_send(
    messages: Vec<ChatMessage>,
    model: &str,
    api_key: &str,
    system_prompt: &str,
) -> Result<String, String> {
    if api_key.is_empty() {
        return Err("API key is not configured. Add your Anthropic API key in Settings.".to_string());
    }

    let client = Client::new();

    let request_body = AnthropicRequest {
        model: model.to_string(),
        max_tokens: DEFAULT_MAX_TOKENS,
        system: system_prompt.to_string(),
        messages,
    };

    let response = client
        .post(ANTHROPIC_API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        // Try to parse error response for a better message
        if let Ok(err_resp) = serde_json::from_str::<AnthropicError>(&body) {
            return Err(format!("API error ({}): {}", status.as_u16(), err_resp.error.message));
        }
        return Err(format!("API error ({}): {}", status.as_u16(), body));
    }

    let api_response: AnthropicResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse response: {} — body: {}", e, &body[..200.min(body.len())]))?;

    // Extract text from content blocks
    let text = api_response
        .content
        .iter()
        .filter(|block| block.content_type == "text")
        .filter_map(|block| block.text.as_deref())
        .collect::<Vec<_>>()
        .join("");

    if text.is_empty() {
        return Err("Empty response from API".to_string());
    }

    Ok(text)
}
