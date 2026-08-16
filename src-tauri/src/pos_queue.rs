use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PosQueueItem {
    pub client_sale_id: String,
    pub payload: String,
    pub status: String,
    pub error_message: Option<String>,
}

pub struct PosQueue {
    conn: Mutex<Option<Connection>>,
}

impl PosQueue {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("create pos queue dir: {e}"))?;
        }
        let conn = Connection::open(path).map_err(|e| format!("open pos queue: {e}"))?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            CREATE TABLE IF NOT EXISTS pos_sales (
                client_sale_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_pos_sales_status ON pos_sales(status);
            "#,
        )
        .map_err(|e| format!("init pos queue: {e}"))?;
        Ok(Self {
            conn: Mutex::new(Some(conn)),
        })
    }

    pub fn disabled() -> Self {
        Self {
            conn: Mutex::new(None),
        }
    }

    fn with_conn<T>(&self, f: impl FnOnce(&Connection) -> Result<T, rusqlite::Error>) -> Result<T, String> {
        let guard = self.conn.lock().map_err(|e| e.to_string())?;
        let conn = guard.as_ref().ok_or_else(|| "POS queue is unavailable".to_string())?;
        f(conn).map_err(|e| e.to_string())
    }

    pub fn upsert(
        &self,
        client_sale_id: &str,
        payload: &str,
        status: &str,
        error_message: Option<&str>,
    ) -> Result<(), String> {
        let id = client_sale_id.trim();
        if id.is_empty() {
            return Err("client_sale_id is required".into());
        }
        let now = now_rfc3339();
        let normalized = normalize_status(status);
        self.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO pos_sales (client_sale_id, payload, status, error_message, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?5)
                ON CONFLICT(client_sale_id) DO UPDATE SET
                    payload = excluded.payload,
                    status = excluded.status,
                    error_message = excluded.error_message,
                    updated_at = excluded.updated_at
                "#,
                params![id, payload, normalized, error_message, now],
            )?;
            Ok(())
        })
    }

    pub fn update_status(&self, client_sale_id: &str, status: &str, error_message: Option<&str>) -> Result<(), String> {
        let now = now_rfc3339();
        let normalized = normalize_status(status);
        let changed = self.with_conn(|conn| {
            conn.execute(
                r#"
                UPDATE pos_sales
                SET status = ?1, error_message = ?2, updated_at = ?3
                WHERE client_sale_id = ?4
                "#,
                params![normalized, error_message, now, client_sale_id],
            )
        })?;
        if changed == 0 {
            return Err(format!("sale {client_sale_id} not found in POS queue"));
        }
        Ok(())
    }

    pub fn list_unsynced(&self) -> Result<Vec<PosQueueItem>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT client_sale_id, payload, status, error_message
                FROM pos_sales
                WHERE status IN ('pending', 'failed')
                ORDER BY created_at ASC
                "#,
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(PosQueueItem {
                    client_sale_id: row.get(0)?,
                    payload: row.get(1)?,
                    status: row.get(2)?,
                    error_message: row.get(3)?,
                })
            })?;
            let mut items = Vec::new();
            for row in rows {
                items.push(row?);
            }
            Ok(items)
        })
    }

    pub fn unsynced_count(&self) -> Result<i64, String> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT COUNT(*) FROM pos_sales WHERE status IN ('pending', 'failed')",
                [],
                |row| row.get(0),
            )
        })
    }

    pub fn requeue_failed(&self) -> Result<usize, String> {
        let now = now_rfc3339();
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE pos_sales SET status = 'pending', updated_at = ?1 WHERE status = 'failed'",
                params![now],
            )
        })
    }
}

fn normalize_status(status: &str) -> &'static str {
    match status.trim().to_ascii_lowercase().as_str() {
        "synced" => "synced",
        "failed" => "failed",
        _ => "pending",
    }
}

fn now_rfc3339() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}")
}

#[tauri::command]
pub fn pos_queue_upsert(
    queue: State<'_, PosQueue>,
    client_sale_id: String,
    payload: String,
    status: Option<String>,
    error_message: Option<String>,
) -> Result<(), String> {
    queue.upsert(
        &client_sale_id,
        &payload,
        status.as_deref().unwrap_or("pending"),
        error_message.as_deref(),
    )
}

#[tauri::command]
pub fn pos_queue_list_unsynced(queue: State<'_, PosQueue>) -> Result<Vec<PosQueueItem>, String> {
    queue.list_unsynced()
}

#[tauri::command]
pub fn pos_queue_update_status(
    queue: State<'_, PosQueue>,
    client_sale_id: String,
    status: String,
    error_message: Option<String>,
) -> Result<(), String> {
    queue.update_status(&client_sale_id, &status, error_message.as_deref())
}

#[tauri::command]
pub fn pos_queue_pending_count(queue: State<'_, PosQueue>) -> Result<i64, String> {
    queue.unsynced_count()
}

#[tauri::command]
pub fn pos_queue_requeue_failed(queue: State<'_, PosQueue>) -> Result<usize, String> {
    queue.requeue_failed()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn persists_and_lists_unsynced_sales() {
        let dir = std::env::temp_dir().join(format!("truerp-pos-queue-{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("pos-queue.sqlite");
        let _ = fs::remove_file(&path);

        let queue = PosQueue::open(&path).expect("open queue");
        queue
            .upsert("sale-1", r#"{"id":"sale-1"}"#, "pending", None)
            .unwrap();
        queue
            .upsert("sale-2", r#"{"id":"sale-2"}"#, "failed", Some("timeout"))
            .unwrap();
        queue
            .upsert("sale-3", r#"{"id":"sale-3"}"#, "synced", None)
            .unwrap();

        let unsynced = queue.list_unsynced().unwrap();
        assert_eq!(unsynced.len(), 2);
        assert_eq!(queue.unsynced_count().unwrap(), 2);

        queue.update_status("sale-1", "synced", None).unwrap();
        assert_eq!(queue.unsynced_count().unwrap(), 1);

        queue.requeue_failed().unwrap();
        let unsynced = queue.list_unsynced().unwrap();
        assert_eq!(unsynced.len(), 1);
        assert_eq!(unsynced[0].client_sale_id, "sale-2");
        assert_eq!(unsynced[0].status, "pending");

        let _ = fs::remove_file(&path);
        let _ = fs::remove_dir_all(&dir);
    }
}
