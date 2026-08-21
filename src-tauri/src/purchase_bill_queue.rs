use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

/// A durable, on-disk queue of purchase bill submissions that have not yet
/// reached the cloud API. Mirrors `pos_queue.rs`: a `rusqlite` connection over
/// `purchase-bill-queue.sqlite` in the app data dir, exposed to the frontend
/// via Tauri commands. The frontend sync engine (`purchaseBillSync.ts`) reads
/// `list_unsynced`, POSTs each row to `/purchase/bills` with
/// `Idempotency-Key = client_bill_id`, and calls `update_status` to mark the
/// row synced/failed. Because the backend dedups on `client_bill_id`, blind
/// retries are safe even if a previous attempt saved on the server but the
/// response was lost.

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PurchaseBillQueueItem {
    pub client_bill_id: String,
    pub payload: String,
    pub as_draft: bool,
    pub status: String,
    pub error_message: Option<String>,
    pub vendor_name: Option<String>,
    pub item_count: i64,
    pub total_amount: f64,
    pub created_at: String,
}

pub struct PurchaseBillQueue {
    conn: Mutex<Option<Connection>>,
}

impl PurchaseBillQueue {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("create purchase bill queue dir: {e}"))?;
        }
        let conn = Connection::open(path).map_err(|e| format!("open purchase bill queue: {e}"))?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            CREATE TABLE IF NOT EXISTS purchase_bills (
                client_bill_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                as_draft INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT,
                vendor_name TEXT,
                item_count INTEGER NOT NULL DEFAULT 0,
                total_amount REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_purchase_bills_status ON purchase_bills(status);
            "#,
        )
        .map_err(|e| format!("init purchase bill queue: {e}"))?;
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
        let conn = guard
            .as_ref()
            .ok_or_else(|| "Purchase bill queue is unavailable".to_string())?;
        f(conn).map_err(|e| e.to_string())
    }

    pub fn upsert(
        &self,
        client_bill_id: &str,
        payload: &str,
        as_draft: bool,
        status: &str,
        error_message: Option<&str>,
        vendor_name: Option<&str>,
        item_count: i64,
        total_amount: f64,
    ) -> Result<(), String> {
        let id = client_bill_id.trim();
        if id.is_empty() {
            return Err("client_bill_id is required".into());
        }
        let now = now_rfc3339();
        let normalized = normalize_status(status);
        let draft_flag: i64 = if as_draft { 1 } else { 0 };
        self.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO purchase_bills
                    (client_bill_id, payload, as_draft, status, error_message,
                     vendor_name, item_count, total_amount, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
                ON CONFLICT(client_bill_id) DO UPDATE SET
                    payload = excluded.payload,
                    as_draft = excluded.as_draft,
                    status = excluded.status,
                    error_message = excluded.error_message,
                    vendor_name = excluded.vendor_name,
                    item_count = excluded.item_count,
                    total_amount = excluded.total_amount,
                    updated_at = excluded.updated_at
                "#,
                params![
                    id,
                    payload,
                    draft_flag,
                    normalized,
                    error_message,
                    vendor_name,
                    item_count,
                    total_amount,
                    now
                ],
            )?;
            Ok(())
        })
    }

    pub fn update_status(
        &self,
        client_bill_id: &str,
        status: &str,
        error_message: Option<&str>,
    ) -> Result<(), String> {
        let now = now_rfc3339();
        let normalized = normalize_status(status);
        let changed = self.with_conn(|conn| {
            conn.execute(
                r#"
                UPDATE purchase_bills
                SET status = ?1, error_message = ?2, updated_at = ?3
                WHERE client_bill_id = ?4
                "#,
                params![normalized, error_message, now, client_bill_id],
            )
        })?;
        if changed == 0 {
            return Err(format!("purchase bill {client_bill_id} not found in queue"));
        }
        Ok(())
    }

    pub fn delete(&self, client_bill_id: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "DELETE FROM purchase_bills WHERE client_bill_id = ?1",
                params![client_bill_id],
            )
        })?;
        Ok(())
    }

    pub fn get(&self, client_bill_id: &str) -> Result<Option<PurchaseBillQueueItem>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT client_bill_id, payload, as_draft, status, error_message,
                       vendor_name, item_count, total_amount, created_at
                FROM purchase_bills
                WHERE client_bill_id = ?1
                "#,
            )?;
            let mut rows = stmt.query_map(params![client_bill_id], |row| {
                Ok(PurchaseBillQueueItem {
                    client_bill_id: row.get(0)?,
                    payload: row.get(1)?,
                    as_draft: row.get::<_, i64>(2)? != 0,
                    status: row.get(3)?,
                    error_message: row.get(4)?,
                    vendor_name: row.get(5)?,
                    item_count: row.get(6)?,
                    total_amount: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })?;
            if let Some(row) = rows.next() {
                Ok(Some(row?))
            } else {
                Ok(None)
            }
        })
    }

    pub fn list_unsynced(&self) -> Result<Vec<PurchaseBillQueueItem>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT client_bill_id, payload, as_draft, status, error_message,
                       vendor_name, item_count, total_amount, created_at
                FROM purchase_bills
                WHERE status IN ('pending', 'failed')
                ORDER BY rowid ASC
                "#,
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(PurchaseBillQueueItem {
                    client_bill_id: row.get(0)?,
                    payload: row.get(1)?,
                    as_draft: row.get::<_, i64>(2)? != 0,
                    status: row.get(3)?,
                    error_message: row.get(4)?,
                    vendor_name: row.get(5)?,
                    item_count: row.get(6)?,
                    total_amount: row.get(7)?,
                    created_at: row.get(8)?,
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
                "SELECT COUNT(*) FROM purchase_bills WHERE status IN ('pending', 'failed')",
                [],
                |row| row.get(0),
            )
        })
    }

    pub fn requeue_failed(&self) -> Result<usize, String> {
        let now = now_rfc3339();
        self.with_conn(|conn| {
            conn.execute(
                "UPDATE purchase_bills SET status = 'pending', updated_at = ?1 WHERE status = 'failed'",
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
pub fn purchase_bill_queue_upsert(
    queue: State<'_, PurchaseBillQueue>,
    client_bill_id: String,
    payload: String,
    as_draft: Option<bool>,
    status: Option<String>,
    error_message: Option<String>,
    vendor_name: Option<String>,
    item_count: Option<i64>,
    total_amount: Option<f64>,
) -> Result<(), String> {
    queue.upsert(
        &client_bill_id,
        &payload,
        as_draft.unwrap_or(false),
        status.as_deref().unwrap_or("pending"),
        error_message.as_deref(),
        vendor_name.as_deref(),
        item_count.unwrap_or(0),
        total_amount.unwrap_or(0.0),
    )
}

#[tauri::command]
pub fn purchase_bill_queue_list_unsynced(
    queue: State<'_, PurchaseBillQueue>,
) -> Result<Vec<PurchaseBillQueueItem>, String> {
    queue.list_unsynced()
}

#[tauri::command]
pub fn purchase_bill_queue_update_status(
    queue: State<'_, PurchaseBillQueue>,
    client_bill_id: String,
    status: String,
    error_message: Option<String>,
) -> Result<(), String> {
    queue.update_status(&client_bill_id, &status, error_message.as_deref())
}

#[tauri::command]
pub fn purchase_bill_queue_pending_count(queue: State<'_, PurchaseBillQueue>) -> Result<i64, String> {
    queue.unsynced_count()
}

#[tauri::command]
pub fn purchase_bill_queue_requeue_failed(queue: State<'_, PurchaseBillQueue>) -> Result<usize, String> {
    queue.requeue_failed()
}

#[tauri::command]
pub fn purchase_bill_queue_delete(
    queue: State<'_, PurchaseBillQueue>,
    client_bill_id: String,
) -> Result<(), String> {
    queue.delete(&client_bill_id)
}

#[tauri::command]
pub fn purchase_bill_queue_get(
    queue: State<'_, PurchaseBillQueue>,
    client_bill_id: String,
) -> Result<Option<PurchaseBillQueueItem>, String> {
    queue.get(&client_bill_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn persists_and_lists_unsynced_bills() {
        let dir = std::env::temp_dir().join(format!("truerp-pb-queue-{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        let path = dir.join("purchase-bill-queue.sqlite");
        let _ = fs::remove_file(&path);

        let queue = PurchaseBillQueue::open(&path).expect("open queue");
        queue
            .upsert("cbid-1", r#"{"client_bill_id":"cbid-1"}"#, false, "pending", None, Some("Acme"), 3, 100.0)
            .unwrap();
        queue
            .upsert("cbid-2", r#"{"client_bill_id":"cbid-2"}"#, true, "failed", Some("timeout"), None, 1, 0.0)
            .unwrap();
        queue
            .upsert("cbid-3", r#"{"client_bill_id":"cbid-3"}"#, false, "synced", None, None, 0, 0.0)
            .unwrap();

        let unsynced = queue.list_unsynced().unwrap();
        assert_eq!(unsynced.len(), 2);
        assert_eq!(queue.unsynced_count().unwrap(), 2);
        assert_eq!(unsynced[0].client_bill_id, "cbid-1");
        assert!(!unsynced[0].as_draft);
        assert_eq!(unsynced[1].as_draft, true);
        assert_eq!(unsynced[1].vendor_name, None);

        queue.update_status("cbid-1", "synced", None).unwrap();
        assert_eq!(queue.unsynced_count().unwrap(), 1);

        queue.requeue_failed().unwrap();
        let unsynced = queue.list_unsynced().unwrap();
        assert_eq!(unsynced.len(), 1);
        assert_eq!(unsynced[0].client_bill_id, "cbid-2");
        assert_eq!(unsynced[0].status, "pending");

        // get + delete
        let fetched = queue.get("cbid-2").unwrap();
        assert!(fetched.is_some());
        queue.delete("cbid-2").unwrap();
        assert!(queue.get("cbid-2").unwrap().is_none());
        assert_eq!(queue.unsynced_count().unwrap(), 0);

        let _ = fs::remove_file(&path);
        let _ = fs::remove_dir_all(&dir);
    }
}
