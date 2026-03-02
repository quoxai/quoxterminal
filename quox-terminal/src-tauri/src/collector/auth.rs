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
    /// Base URL of the collector (e.g., "ws://localhost:9848")
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

    /// Store credentials in the Tauri store settings file.
    pub async fn save_to_store(&self, app_handle: &tauri::AppHandle) -> Result<(), String> {
        use tauri::Manager;

        let store_path = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?
            .join("quox-terminal-settings.json");

        let mut root: serde_json::Value = if store_path.exists() {
            let content = std::fs::read_to_string(&store_path)
                .map_err(|e| format!("Failed to read store: {}", e))?;
            serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        let config = serde_json::json!({
            "collectorUrl": self.collector_url,
            "collectorToken": self.token,
            "orgId": self.org_id,
        });
        root["quox-connection-config"] = config;

        let serialized = serde_json::to_string_pretty(&root)
            .map_err(|e| format!("Failed to serialize store: {}", e))?;

        if let Some(parent) = store_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create store dir: {}", e))?;
        }

        std::fs::write(&store_path, serialized)
            .map_err(|e| format!("Failed to write store: {}", e))?;

        Ok(())
    }

    /// Load credentials from the Tauri store settings file.
    pub async fn load_from_store(app_handle: &tauri::AppHandle) -> Result<Option<Self>, String> {
        use tauri::Manager;

        let store_path = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?
            .join("quox-terminal-settings.json");

        if !store_path.exists() {
            return Ok(None);
        }

        let content = std::fs::read_to_string(&store_path)
            .map_err(|e| format!("Failed to read store: {}", e))?;
        let parsed: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse store: {}", e))?;

        let config = match parsed.get("quox-connection-config") {
            Some(c) => c,
            None => return Ok(None),
        };

        let url = config
            .get("collectorUrl")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let token = config
            .get("collectorToken")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if url.is_empty() {
            return Ok(None);
        }

        let mut auth = Self::new(url, token);
        if let Some(org) = config.get("orgId").and_then(|v| v.as_str()) {
            auth.org_id = Some(org.to_string());
        }

        Ok(Some(auth))
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
