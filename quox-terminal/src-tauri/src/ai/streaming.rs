// Streaming SSE handler — placeholder for Phase 4
//
// Full implementation will use Server-Sent Events to stream tokens back
// to the frontend in real-time, providing a typing-like experience.
//
// Architecture plan:
//   1. Open a streaming POST to Anthropic Messages API with `stream: true`
//   2. Parse SSE events as they arrive (content_block_delta, message_stop, etc.)
//   3. Emit each text delta as a Tauri event to the frontend
//   4. Frontend accumulates deltas into the assistant message bubble
//
// This will be implemented in a future iteration.

/// Placeholder — streaming not yet implemented.
pub fn _streaming_placeholder() {
    // Will be replaced with actual SSE streaming logic
}
