//! AI Client — Sends chat messages to the Anthropic Messages API.
//!
//! Supports two authentication methods (matching QuoxCORE):
//! 1. Claude CLI OAuth token from ~/.claude/.credentials.json (preferred)
//!    - Created by `claude login` / Claude CLI `/login` command
//!    - Uses `Authorization: Bearer {token}` header
//! 2. Manual API key from Settings
//!    - Uses `x-api-key: {key}` header
//!
//! The `resolve_auth` function checks CLI credentials first, then falls back
//! to the manually-configured API key.

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

/// Claude CLI credentials file structure (~/.claude/.credentials.json)
#[derive(Debug, Deserialize)]
struct CliCredentials {
    #[serde(rename = "claudeAiOauth")]
    claude_ai_oauth: Option<OAuthToken>,
}

#[derive(Debug, Deserialize)]
struct OAuthToken {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "expiresAt")]
    expires_at: u64,
}

/// Authentication method resolved for API calls.
#[derive(Debug, Clone, Serialize)]
pub enum AuthMethod {
    /// OAuth token from Claude CLI (Authorization: Bearer)
    CliOAuth { token: String, expires_in_minutes: i64 },
    /// Manual API key from Settings (x-api-key)
    ApiKey { key: String },
    /// No authentication available
    None,
}

/// Auth status returned to the frontend (matches QuoxCORE /chat/status pattern).
#[derive(Debug, Clone, Serialize)]
pub struct ChatAuthStatus {
    pub ready: bool,
    pub auth_method: String,
    pub cli_expires_in_minutes: Option<i64>,
}

const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const DEFAULT_MAX_TOKENS: u32 = 4096;

/// Read Claude CLI OAuth credentials from ~/.claude/.credentials.json
///
/// Returns Some(token) if credentials exist and are not expired, None otherwise.
pub fn read_cli_credentials() -> Option<(String, i64)> {
    let home = dirs::home_dir()?;
    let creds_path = home.join(".claude").join(".credentials.json");

    let content = std::fs::read_to_string(&creds_path).ok()?;
    let creds: CliCredentials = serde_json::from_str(&content).ok()?;
    let oauth = creds.claude_ai_oauth?;

    if oauth.access_token.is_empty() {
        return None;
    }

    // Check expiration (expiresAt is milliseconds since epoch)
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    if oauth.expires_at <= now_ms {
        return None; // Token expired
    }

    let expires_in_mins = ((oauth.expires_at - now_ms) / 60_000) as i64;
    Some((oauth.access_token, expires_in_mins))
}

/// Resolve the best available auth method.
///
/// Priority: CLI OAuth token > manual API key > env var > None
pub fn resolve_auth(manual_api_key: &str) -> AuthMethod {
    // 1. Try CLI OAuth credentials first
    if let Some((token, expires_in_minutes)) = read_cli_credentials() {
        return AuthMethod::CliOAuth { token, expires_in_minutes };
    }

    // 2. Try manual API key from Settings
    if !manual_api_key.is_empty() {
        return AuthMethod::ApiKey { key: manual_api_key.to_string() };
    }

    // 3. Try environment variable
    if let Ok(env_key) = std::env::var("ANTHROPIC_API_KEY") {
        if !env_key.is_empty() {
            return AuthMethod::ApiKey { key: env_key };
        }
    }

    AuthMethod::None
}

/// Get the current chat auth status (for frontend display).
pub fn get_auth_status(manual_api_key: &str) -> ChatAuthStatus {
    match resolve_auth(manual_api_key) {
        AuthMethod::CliOAuth { expires_in_minutes, .. } => ChatAuthStatus {
            ready: true,
            auth_method: "cli_credentials".to_string(),
            cli_expires_in_minutes: Some(expires_in_minutes),
        },
        AuthMethod::ApiKey { .. } => ChatAuthStatus {
            ready: true,
            auth_method: "api_key".to_string(),
            cli_expires_in_minutes: None,
        },
        AuthMethod::None => ChatAuthStatus {
            ready: false,
            auth_method: "none".to_string(),
            cli_expires_in_minutes: None,
        },
    }
}

/// Send a chat message to the Anthropic Messages API and return the response text.
///
/// Automatically selects the correct auth header based on the resolved auth method:
/// - CLI OAuth: `Authorization: Bearer {token}`
/// - API key (standard): `x-api-key: {key}`
/// - API key (OAuth format): `Authorization: Bearer {key}`
pub async fn chat_send(
    messages: Vec<ChatMessage>,
    model: &str,
    manual_api_key: &str,
    system_prompt: &str,
) -> Result<String, String> {
    let auth = resolve_auth(manual_api_key);

    let (auth_header_name, auth_header_value) = match &auth {
        AuthMethod::CliOAuth { token, .. } => {
            ("Authorization", format!("Bearer {}", token))
        }
        AuthMethod::ApiKey { key } => {
            // OAuth tokens (sk-ant-oat...) use Bearer, standard keys use x-api-key
            if key.starts_with("sk-ant-oat") {
                ("Authorization", format!("Bearer {}", key))
            } else {
                ("x-api-key", key.clone())
            }
        }
        AuthMethod::None => {
            return Err(
                "No authentication configured. Either sign in with your Claude subscription \
                 (Settings → AI Services → Open Terminal → /login) or add an Anthropic API key."
                    .to_string(),
            );
        }
    };

    let client = Client::new();

    let request_body = AnthropicRequest {
        model: model.to_string(),
        max_tokens: DEFAULT_MAX_TOKENS,
        system: system_prompt.to_string(),
        messages,
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
