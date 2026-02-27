/// WebSocket client for connecting to the Quox Collector service.
///
/// The collector (port 9848) is the central hub for:
/// - Memory operations (store/search entities, learned items)
/// - Agent communication (AEE protocol)
/// - Fleet management commands
/// - Real-time event streaming
///
/// This client maintains a persistent WebSocket connection and
/// provides request/response patterns over the WS channel.

use std::sync::Arc;
use tokio::sync::{mpsc, watch};
use tokio_tungstenite::tungstenite::Message;

use super::auth::CollectorAuth;

/// Connection state for the collector WebSocket.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Failed(String),
}

/// WebSocket client for the Quox Collector.
pub struct CollectorWsClient {
    url: String,
    state: Arc<watch::Sender<ConnectionState>>,
    state_rx: watch::Receiver<ConnectionState>,
    auth: Option<CollectorAuth>,
    tx: Option<mpsc::UnboundedSender<Message>>,
}

impl CollectorWsClient {
    /// Create a new collector WebSocket client.
    pub fn new(url: &str) -> Self {
        let (state_tx, state_rx) = watch::channel(ConnectionState::Disconnected);
        Self {
            url: url.to_string(),
            state: Arc::new(state_tx),
            state_rx,
            auth: None,
            tx: None,
        }
    }

    /// Set authentication credentials.
    pub fn with_auth(mut self, auth: CollectorAuth) -> Self {
        self.auth = Some(auth);
        self
    }

    /// Connect to the collector WebSocket.
    /// Spawns a background task that handles the connection, reconnection,
    /// and message routing.
    pub async fn connect(&mut self, app_handle: tauri::AppHandle) -> Result<(), String> {
        let _ = self.state.send(ConnectionState::Connecting);

        let ws_url = self
            .url
            .replace("http://", "ws://")
            .replace("https://", "wss://");
        let ws_url = format!("{}/collector/terminal/ws", ws_url.trim_end_matches('/'));

        let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
        self.tx = Some(tx);

        let state = self.state.clone();
        let auth_token = self.auth.as_ref().map(|a| a.token.clone());

        // Spawn connection task
        tokio::spawn(async move {
            use futures_util::{SinkExt, StreamExt};
            use tauri::Emitter;
            use tokio_tungstenite::connect_async;

            match connect_async(&ws_url).await {
                Ok((ws_stream, _)) => {
                    let _ = state.send(ConnectionState::Connected);
                    let (mut write, mut read) = ws_stream.split();

                    // If we have an auth token, send it as the first message
                    if let Some(token) = auth_token {
                        let auth_msg = serde_json::json!({
                            "type": "auth",
                            "token": token
                        });
                        let _ = write
                            .send(Message::Text(auth_msg.to_string().into()))
                            .await;
                    }

                    loop {
                        tokio::select! {
                            // Messages from the server
                            msg = read.next() => {
                                match msg {
                                    Some(Ok(Message::Text(text))) => {
                                        let text_str: &str = &text;
                                        // Parse message type for structured event emission
                                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(text_str) {
                                            let msg_type = parsed.get("type")
                                                .and_then(|t| t.as_str())
                                                .unwrap_or("unknown");
                                            match msg_type {
                                                "init" => {
                                                    let _ = app_handle.emit("collector-fleet-init", text_str);
                                                }
                                                "agent_joined" | "agent_added" | "heartbeat" => {
                                                    let _ = app_handle.emit("collector-agent-update", text_str);
                                                }
                                                "agent_removed" => {
                                                    let _ = app_handle.emit("collector-agent-removed", text_str);
                                                }
                                                "error" => {
                                                    let _ = app_handle.emit("collector-error", text_str);
                                                }
                                                _ => {
                                                    let _ = app_handle.emit("collector-message", text_str);
                                                }
                                            }
                                        } else {
                                            let _ = app_handle.emit("collector-message", text_str);
                                        }
                                    }
                                    Some(Ok(Message::Close(_))) | None => {
                                        let _ = state.send(ConnectionState::Disconnected);
                                        break;
                                    }
                                    Some(Err(e)) => {
                                        log::warn!("Collector WS error: {}", e);
                                        let _ = state.send(ConnectionState::Failed(e.to_string()));
                                        break;
                                    }
                                    _ => {} // Ping/Pong handled by tungstenite
                                }
                            }
                            // Messages to send to the server
                            outgoing = rx.recv() => {
                                match outgoing {
                                    Some(msg) => {
                                        if let Err(e) = write.send(msg).await {
                                            log::warn!("Failed to send to collector: {}", e);
                                            break;
                                        }
                                    }
                                    None => break, // Channel closed
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    let _ = state.send(ConnectionState::Failed(format!(
                        "Connection failed: {}",
                        e
                    )));
                }
            }
        });

        Ok(())
    }

    /// Disconnect from the collector.
    pub async fn disconnect(&mut self) -> Result<(), String> {
        self.tx = None; // Drop sender, which closes the channel and stops the task
        let _ = self.state.send(ConnectionState::Disconnected);
        Ok(())
    }

    /// Get current connection state.
    pub fn state(&self) -> ConnectionState {
        self.state_rx.borrow().clone()
    }

    /// Check if connected to the collector.
    pub fn is_connected(&self) -> bool {
        *self.state_rx.borrow() == ConnectionState::Connected
    }

    /// Send a raw message to the collector.
    pub async fn send_raw(&self, message: &str) -> Result<(), String> {
        if let Some(tx) = &self.tx {
            tx.send(Message::Text(message.to_string().into()))
                .map_err(|e| format!("Failed to send: {}", e))
        } else {
            Err("Not connected".to_string())
        }
    }

    /// Send a memory store request.
    pub async fn store_entity(
        &self,
        entity_type: &str,
        name: &str,
        attributes: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let msg = serde_json::json!({
            "type": "memory_store",
            "entityType": entity_type,
            "name": name,
            "attributes": attributes
        });
        self.send_raw(&msg.to_string()).await?;
        // For now, return success immediately (response comes via events)
        Ok(serde_json::json!({"status": "sent"}))
    }

    /// Send a memory search request.
    pub async fn search_memories(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<serde_json::Value>, String> {
        let msg = serde_json::json!({
            "type": "memory_search",
            "query": query,
            "limit": limit
        });
        self.send_raw(&msg.to_string()).await?;
        // For now, return empty (results come via events)
        Ok(vec![])
    }
}
