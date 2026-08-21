mod paths;
mod pos_queue;
mod print;
mod processes;
mod purchase_bill_queue;
mod proxy;
mod thermal;
#[cfg(desktop)]
mod updater;

use processes::{RuntimeProcesses, PROXY_ADDR};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

const POS_QUEUE_SYNC_EVENT: &str = "pos-queue-sync-requested";
const PURCHASE_BILL_QUEUE_SYNC_EVENT: &str = "purchase-bill-queue-sync-requested";

struct AppState {
    runtime: Arc<RuntimeProcesses>,
    close_confirm_open: AtomicBool,
}

#[tauri::command]
fn frontend_ready(state: tauri::State<'_, AppState>) -> bool {
    state.runtime.frontend_ready.load(Ordering::SeqCst)
}

#[tauri::command]
fn app_url() -> String {
    format!("http://{PROXY_ADDR}/")
}

#[tauri::command]
fn data_directory(state: tauri::State<'_, AppState>) -> String {
    state.runtime.data_root.display().to_string()
}

const BRIDGE_JS: &str = r#"
(function () {
  function invoke(cmd, args) {
    if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) {
      return window.__TAURI__.core.invoke(cmd, args || {});
    }
    return Promise.reject(new Error('Tauri IPC unavailable'));
  }
  window.go = window.go || {};
  window.go.main = window.go.main || {};
  window.go.main.App = {
    HasNativePrinting: function () { return invoke('has_native_printing'); },
    ListPrinters: function () { return invoke('list_printers'); },
    PrintPDF: function (pdfBase64, printerName, jobTitle, paperWidthMm, paperSize) {
      return invoke('print_pdf', {
        pdfBase64: pdfBase64 || '',
        printerName: printerName || '',
        jobTitle: jobTitle || 'TruERP Document',
        paperWidthMm: paperWidthMm == null ? null : paperWidthMm,
        paperSize: paperSize || null
      });
    },
    SavePDF: function (pdfBase64, filename) {
      return invoke('save_pdf', {
        pdfBase64: pdfBase64 || '',
        filename: filename || 'document.pdf'
      });
    },
    SaveFile: function (dataBase64, filename, openAfter, directory, overwrite) {
      return invoke('save_file', {
        dataBase64: dataBase64 || '',
        filename: filename || 'download.bin',
        openAfter: openAfter === true,
        directory: directory || null,
        overwrite: overwrite === true
      });
    },
    PickExportDirectory: function (title) {
      return invoke('pick_export_directory', {
        title: title || null
      });
    },
    PrintThermal: function (content, printerName, paperWidthMm, jobTitle, logoEscposBase64) {
      return invoke('print_thermal', {
        content: content || '',
        printerName: printerName || '',
        paperWidthMm: paperWidthMm == null ? null : paperWidthMm,
        jobTitle: jobTitle || 'TruERP Receipt',
        logoEscposBase64: logoEscposBase64 || null
      });
    },
    PrintRaw: function (dataBase64, printerName) {
      return invoke('print_raw_base64', {
        dataBase64: dataBase64 || '',
        printerName: printerName || ''
      });
    },
    FrontendReady: function () { return invoke('frontend_ready'); },
    DataDirectory: function () { return invoke('data_directory'); },
    APIStatus: function () { return Promise.resolve('running'); },
    AppVersion: function () { return invoke('app_version'); },
    CheckForUpdates: function () { return invoke('check_for_updates'); },
    DownloadAndInstallUpdate: function () { return invoke('download_and_install_update'); }
  };
})();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .try_init();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            frontend_ready,
            app_url,
            data_directory,
            print::has_native_printing,
            print::list_printers,
            print::print_pdf,
            print::save_pdf,
            print::save_file,
            print::pick_export_directory,
            thermal::print_thermal,
            thermal::print_raw_base64,
            #[cfg(desktop)]
            updater::app_version,
            #[cfg(desktop)]
            updater::check_for_updates,
            #[cfg(desktop)]
            updater::download_and_install_update,
            pos_queue::pos_queue_upsert,
            pos_queue::pos_queue_list_unsynced,
            pos_queue::pos_queue_update_status,
            pos_queue::pos_queue_pending_count,
            pos_queue::pos_queue_requeue_failed,
            purchase_bill_queue::purchase_bill_queue_upsert,
            purchase_bill_queue::purchase_bill_queue_list_unsynced,
            purchase_bill_queue::purchase_bill_queue_update_status,
            purchase_bill_queue::purchase_bill_queue_pending_count,
            purchase_bill_queue::purchase_bill_queue_requeue_failed,
            purchase_bill_queue::purchase_bill_queue_delete,
            purchase_bill_queue::purchase_bill_queue_get,
        ])
        // Re-inject after splash → http://127.0.0.1:17888 navigation and any full reload.
        .on_page_load(|webview, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                let _ = webview.eval(BRIDGE_JS);
            }
        })
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval(BRIDGE_JS);
            }

            let data_root = processes::configure_data_dirs().unwrap_or_else(|e| {
                log::warn!("configure data dirs: {e}");
                std::env::temp_dir().join("TruERP")
            });
            let queue_path = data_root.join("pos-queue.sqlite");
            let pos_queue = match pos_queue::PosQueue::open(&queue_path) {
                Ok(queue) => {
                    log::info!("POS queue: {}", queue_path.display());
                    queue
                }
                Err(err) => {
                    log::error!("POS queue unavailable ({err}); falling back to IndexedDB only");
                    pos_queue::PosQueue::disabled()
                }
            };
            let pb_queue_path = data_root.join("purchase-bill-queue.sqlite");
            let purchase_bill_queue = match purchase_bill_queue::PurchaseBillQueue::open(&pb_queue_path) {
                Ok(queue) => {
                    log::info!("Purchase bill queue: {}", pb_queue_path.display());
                    queue
                }
                Err(err) => {
                    log::error!("Purchase bill queue unavailable ({err}); falling back to IndexedDB only");
                    purchase_bill_queue::PurchaseBillQueue::disabled()
                }
            };
            let runtime = Arc::new(RuntimeProcesses::new(data_root));

            let proxy_flag = Arc::clone(&runtime.frontend_ready);
            tauri::async_runtime::spawn(async move {
                if let Err(err) = proxy::run_proxy(proxy_flag).await {
                    log::error!("proxy exited: {err}");
                }
            });

            let handle = app.handle().clone();
            let runtime_for_start = Arc::clone(&runtime);
            std::thread::spawn(move || {
                if let Err(err) = processes::start_runtime_into(&handle, &runtime_for_start) {
                    log::error!("failed to start TruERP runtime: {err}");
                }
            });

            app.manage(AppState {
                runtime: Arc::clone(&runtime),
                close_confirm_open: AtomicBool::new(false),
            });
            app.manage(pos_queue);
            app.manage(purchase_bill_queue);

            let sync_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(15));
                interval.tick().await;
                loop {
                    interval.tick().await;
                    let Some(pos_queue) = sync_handle.try_state::<pos_queue::PosQueue>() else {
                        continue;
                    };
                    let Some(pb_queue) = sync_handle.try_state::<purchase_bill_queue::PurchaseBillQueue>() else {
                        continue;
                    };
                    match pos_queue.unsynced_count() {
                        Ok(count) if count > 0 => {
                            let _ = sync_handle.emit(POS_QUEUE_SYNC_EVENT, count);
                        }
                        Ok(_) => {}
                        Err(err) => log::warn!("POS queue count: {err}"),
                    }
                    match pb_queue.unsynced_count() {
                        Ok(count) if count > 0 => {
                            let _ = sync_handle.emit(PURCHASE_BILL_QUEUE_SYNC_EVENT, count);
                        }
                        Ok(_) => {}
                        Err(err) => log::warn!("Purchase bill queue count: {err}"),
                    }
                }
            });

            // Keep the Wails-compatible bridge alive for the whole session (not just ~90s).
            if let Some(window) = app.get_webview_window("main") {
                let win = window.clone();
                std::thread::spawn(move || loop {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    let _ = win.eval(BRIDGE_JS);
                });
            }

            #[cfg(desktop)]
            {
                if !cfg!(debug_assertions) {
                    updater::spawn_startup_check(app.handle().clone());
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let Some(pos_queue) = window.try_state::<pos_queue::PosQueue>() else {
                        return;
                    };
                    let Some(pb_queue) = window.try_state::<purchase_bill_queue::PurchaseBillQueue>() else {
                        return;
                    };
                    let pos_pending = pos_queue.unsynced_count().unwrap_or(0);
                    let pb_pending = pb_queue.unsynced_count().unwrap_or(0);
                    let pending = pos_pending + pb_pending;
                    if pending <= 0 {
                        return;
                    }
                    if let Some(state) = window.try_state::<AppState>() {
                        if state
                            .close_confirm_open
                            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                            .is_err()
                        {
                            api.prevent_close();
                            return;
                        }
                    }
                    api.prevent_close();
                    let mut parts: Vec<String> = Vec::new();
                    if pos_pending > 0 {
                        parts.push(format!(
                            "{} POS {}",
                            pos_pending,
                            if pos_pending == 1 { "sale" } else { "sales" }
                        ));
                    }
                    if pb_pending > 0 {
                        parts.push(format!(
                            "{} purchase {}",
                            pb_pending,
                            if pb_pending == 1 { "bill" } else { "bills" }
                        ));
                    }
                    let joined = parts.join(" and ");
                    let message = format!(
                        "{joined} {} not been uploaded to the cloud yet.\n\nThey stay on this computer and will sync the next time you open TruERP. Quit anyway?",
                        if pending == 1 { "has" } else { "have" }
                    );
                    let window = window.clone();
                    window
                        .app_handle()
                        .dialog()
                        .message(message)
                        .title("Unsynced records")
                        .kind(MessageDialogKind::Warning)
                        .buttons(MessageDialogButtons::OkCancelCustom("Quit".into(), "Stay".into()))
                        .show(move |should_quit| {
                            if let Some(state) = window.try_state::<AppState>() {
                                state.close_confirm_open.store(false, Ordering::SeqCst);
                            }
                            if should_quit {
                                let _ = window.destroy();
                            }
                        });
                }
                tauri::WindowEvent::Destroyed => {
                    if let Some(state) = window.try_state::<AppState>() {
                        state.runtime.stop();
                    }
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building TruERP")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app.try_state::<AppState>() {
                    state.runtime.stop();
                }
                #[cfg(windows)]
                processes::kill_bundled_node_processes(app);
            }
        });
}
