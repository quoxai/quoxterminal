/// Token-based authentication for the Quox Collector.
///
/// Authentication flow:
/// 1. Desktop app stores collector URL + API token in secure storage
/// 2. On connect, token is sent in the WebSocket handshake headers
/// 3. Collector validates token and returns session info
/// 4. Token refresh happens automatically before expiry
///
/// Tokens are stored using the Tauri secure store (keychain/keyring).

/// Authentication credentials for the collector.
#[derive(Debug, Clone)]
pub struct CollectorAuth {
    /// Base URL of the collector (e.g., "ws://10.0.0.126:9848")
    pub collector_url: String,
    /// API token for authentication
    pub token: String,
    /// Optional organization ID for multi-tenant setups
    pub org_id: Option<String>,
}

/// Result of an authentication attempt.
#[derive(Debug)]
pub enum AuthResult {
    /// Authentication succeeded
    Authenticated {
        user_id: String,
        org_id: String,
        tier: String,
    },
    /// Token is invalid or expired
    InvalidToken,
    /// Collector is unreachable
    Unreachable,
    /// Other error
    Error(String),
}

impl CollectorAuth {
    /// Create new authentication credentials.
    pub fn new(collector_url: &str, token: &str) -> Self {
        Self {
            collector_url: collector_url.to_string(),
            token: token.to_string(),
            org_id: None,
        }
    }

    /// Set the organization ID.
    pub fn with_org(mut self, org_id: &str) -> Self {
        self.org_id = Some(org_id.to_string());
        self
    }

    /// Validate the token against the collector.
    pub async fn validate(&self) -> AuthResult {
        let url = format!(
            "{}/api/v1/health",
            self.collector_url.trim_end_matches('/')
        );

        let client = reqwest::Client::new();
        let mut req = client.get(&url);
        if !self.token.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", self.token));
        }

        match req
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            Ok(resp) => {
                if resp.status().is_success() {
                    AuthResult::Authenticated {
                        user_id: "desktop".to_string(),
                        org_id: self.org_id.clone().unwrap_or_default(),
                        tier: "desktop".to_string(),
                    }
                } else {
                    AuthResult::InvalidToken
                }
            }
            Err(_) => AuthResult::Unreachable,
        }
    }

    /// Store credentials in the Tauri secure store (stub).
    pub async fn save_to_store(&self) -> Result<(), String> {
        // TODO: Use tauri-plugin-store to persist credentials securely
        Err("Credential storage not yet implemented".to_string())
    }

    /// Load credentials from the Tauri secure store (stub).
    pub async fn load_from_store() -> Result<Option<Self>, String> {
        // TODO: Use tauri-plugin-store to load stored credentials
        Ok(None)
    }

    /// Check if the collector is reachable.
    pub async fn is_collector_available(url: &str) -> bool {
        let check_url = format!("{}/api/v1/health", url.trim_end_matches('/'));
        match reqwest::Client::new()
            .get(&check_url)
            .timeout(std::time::Duration::from_secs(3))
            .send()
            .await
        {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }
}
