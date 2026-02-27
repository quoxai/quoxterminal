/// Local-only implementations of the 7 collector memory commands.
///
/// These are no-op stubs that accept the same arguments as the real collector
/// commands but just return Ok. The TypeScript memory bridge already handles
/// local storage via localStorage — these commands exist so that `invoke()`
/// calls don't throw "command not found" errors.
///
/// When a collector is connected, the TypeScript bridge can optionally relay
/// to the collector WS. These local commands serve as the fallback.

use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct StoreEntityArgs {
    pub entity_type: String,
    pub name: String,
    pub attributes: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct TouchEntityArgs {
    pub entity_type: String,
    pub id: String,
    pub name: String,
    pub context: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ExtractEntitiesArgs {
    pub text: String,
    pub host_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct AddOpenLoopArgs {
    pub task: String,
    pub context: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct AddLearnedItemArgs {
    pub category: String,
    pub content: String,
    pub metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct RecordDecisionArgs {
    pub command: String,
    pub context: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct SetFocusArgs {
    pub task: String,
    pub goal: Option<String>,
}

// ── Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn collector_store_entity(
    entity_type: String,
    name: String,
    attributes: Option<Value>,
) -> Result<(), String> {
    // Local no-op — TypeScript handles localStorage
    log::debug!(
        "[memory] store_entity: type={}, name={}, attrs={:?}",
        entity_type,
        name,
        attributes.is_some()
    );
    Ok(())
}

#[tauri::command]
pub async fn collector_touch_entity(
    entity_type: String,
    id: String,
    name: String,
    context: Option<Value>,
) -> Result<(), String> {
    log::debug!(
        "[memory] touch_entity: type={}, id={}, name={}, ctx={:?}",
        entity_type,
        id,
        name,
        context.is_some()
    );
    Ok(())
}

#[tauri::command]
pub async fn collector_extract_entities(
    text: String,
    host_id: Option<String>,
) -> Result<Vec<Value>, String> {
    log::debug!(
        "[memory] extract_entities: len={}, host={:?}",
        text.len(),
        host_id
    );
    // Return empty — TypeScript side does the actual extraction
    Ok(vec![])
}

#[tauri::command]
pub async fn collector_add_open_loop(
    task: String,
    context: Option<Value>,
) -> Result<(), String> {
    log::debug!(
        "[memory] add_open_loop: task={}, ctx={:?}",
        task,
        context.is_some()
    );
    Ok(())
}

#[tauri::command]
pub async fn collector_add_learned_item(
    category: String,
    content: String,
    metadata: Option<Value>,
) -> Result<(), String> {
    log::debug!(
        "[memory] add_learned_item: cat={}, len={}, meta={:?}",
        category,
        content.len(),
        metadata.is_some()
    );
    Ok(())
}

#[tauri::command]
pub async fn collector_record_decision(
    command: String,
    context: Option<Value>,
) -> Result<(), String> {
    log::debug!(
        "[memory] record_decision: cmd={}, ctx={:?}",
        command,
        context.is_some()
    );
    Ok(())
}

#[tauri::command]
pub async fn collector_set_focus(
    task: String,
    goal: Option<String>,
) -> Result<(), String> {
    log::debug!(
        "[memory] set_focus: task={}, goal={:?}",
        task,
        goal
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_store_entity_succeeds() {
        let result = collector_store_entity(
            "host".to_string(),
            "docker01".to_string(),
            None,
        )
        .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_touch_entity_succeeds() {
        let result = collector_touch_entity(
            "host".to_string(),
            "docker01".to_string(),
            "docker01".to_string(),
            None,
        )
        .await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_extract_entities_returns_empty() {
        let result = collector_extract_entities("some output".to_string(), None).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_set_focus_succeeds() {
        let result =
            collector_set_focus("Terminal on docker01".to_string(), Some("SSH".to_string())).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_add_open_loop_succeeds() {
        let result = collector_add_open_loop("fix error".to_string(), None).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_add_learned_item_succeeds() {
        let result =
            collector_add_learned_item("error".to_string(), "fix xyz".to_string(), None).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_record_decision_succeeds() {
        let result = collector_record_decision("docker restart nginx".to_string(), None).await;
        assert!(result.is_ok());
    }
}
