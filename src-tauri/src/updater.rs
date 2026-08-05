use crate::processes;
use serde::Serialize;
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub available: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub date: Option<String>,
}

fn current_version<R: Runtime>(app: &AppHandle<R>) -> String {
    app.package_info().version.to_string()
}

fn build_updater<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri_plugin_updater::Updater, String> {
    let app_for_exit = app.clone();
    let mut builder = app
        .updater_builder()
        .on_before_exit(move || {
            // Windows NSIS cannot overwrite resources\node\node.exe while it is locked.
            log::info!("stopping bundled Node before Windows update install");
            processes::kill_bundled_node_processes(&app_for_exit);
        });

    if let Ok(raw) = std::env::var("TRUERP_UPDATE_ENDPOINT") {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            let endpoint = trimmed
                .parse()
                .map_err(|e| format!("invalid TRUERP_UPDATE_ENDPOINT: {e}"))?;
            builder = builder
                .endpoints(vec![endpoint])
                .map_err(|e| e.to_string())?;
        }
    }

    builder.build().map_err(|e| e.to_string())
}

async fn fetch_update<R: Runtime>(app: &AppHandle<R>) -> Result<Option<Update>, String> {
    let updater = build_updater(app)?;
    updater.check().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn app_version(app: AppHandle) -> String {
    current_version(&app)
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let current = current_version(&app);
    match fetch_update(&app).await? {
        Some(update) => Ok(UpdateCheckResult {
            available: true,
            current_version: current,
            version: Some(update.version.clone()),
            notes: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
        }),
        None => Ok(UpdateCheckResult {
            available: false,
            current_version: current,
            version: None,
            notes: None,
            date: None,
        }),
    }
}

#[tauri::command]
pub async fn download_and_install_update(app: AppHandle) -> Result<(), String> {
    let Some(update) = fetch_update(&app).await? else {
        return Err("No update available".into());
    };

    log::info!(
        "downloading TruERP update {} -> {}",
        current_version(&app),
        update.version
    );

    update
        .download_and_install(
            |chunk_len, content_len| {
                log::debug!("update progress: +{chunk_len} / {content_len:?}");
            },
            || {
                log::info!("update download finished; installing");
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    log::info!("update installed; restarting");
    app.restart();
}

/// Quiet startup check: prompts only when an update exists.
pub fn spawn_startup_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Let splash / local servers come up before network checks.
        tokio::time::sleep(std::time::Duration::from_secs(8)).await;

        let update = match fetch_update(&app).await {
            Ok(update) => update,
            Err(err) => {
                log::debug!("startup update check skipped: {err}");
                return;
            }
        };

        let Some(update) = update else {
            log::debug!("no TruERP update available");
            return;
        };

        let version = update.version.clone();
        let notes = update
            .body
            .clone()
            .unwrap_or_else(|| "A newer version of TruERP is ready to install.".into());
        let prompt = format!(
            "TruERP {version} is available (you have {}).\n\n{notes}\n\nDownload and install now?",
            current_version(&app)
        );

        let should_install = app
            .dialog()
            .message(prompt)
            .title("Update available")
            .kind(MessageDialogKind::Info)
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Update".into(),
                "Later".into(),
            ))
            .blocking_show();

        if !should_install {
            return;
        }

        if let Err(err) = update
            .download_and_install(
                |_, _| {},
                || {
                    log::info!("startup update download finished");
                },
            )
            .await
        {
            log::error!("failed to install update: {err}");
            app.dialog()
                .message(format!("Could not install the update:\n{err}"))
                .title("Update failed")
                .kind(MessageDialogKind::Error)
                .blocking_show();
            return;
        }

        app.restart();
    });
}
