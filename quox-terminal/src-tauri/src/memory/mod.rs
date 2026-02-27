/// Memory module — local-only entity/session/error storage.
///
/// These commands are called by the TypeScript `terminalMemoryBridge.ts`.
/// In desktop v0.x, they store data locally via a JSON file (Tauri store).
/// A future version may relay to the collector WebSocket for cloud sync.

pub mod commands;
