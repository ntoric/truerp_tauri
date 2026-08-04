mod paths;
mod print;
mod processes;
mod proxy;
mod thermal;
#[cfg(desktop)]
mod updater;

use processes::{RuntimeProcesses, PROXY_ADDR};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::Manager;

struct AppState {
    runtime: Arc<RuntimeProcesses>,
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
    PrintThermal: function (content, printerName, paperWidthMm, jobTitle, logoEscposBase64) {
      return invoke('print_thermal', {
        content: content || '',
        printerName: printerName || '',
        paperWidthMm: paperWidthMm == null ? null : paperWidthMm,
        jobTitle: jobTitle || 'TruERP Receipt',
        logoEscposBase64: logoEscposBase64 || null
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
            thermal::print_thermal,
            thermal::print_raw_base64,
            #[cfg(desktop)]
            updater::app_version,
            #[cfg(desktop)]
            updater::check_for_updates,
            #[cfg(desktop)]
            updater::download_and_install_update,
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval(BRIDGE_JS);
            }

            let data_root = processes::configure_data_dirs().unwrap_or_else(|e| {
                log::warn!("configure data dirs: {e}");
                std::env::temp_dir().join("TruERP")
            });
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
            });

            if let Some(window) = app.get_webview_window("main") {
                let win = window.clone();
                std::thread::spawn(move || {
                    for _ in 0..180 {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        let _ = win.eval(BRIDGE_JS);
                    }
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
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<AppState>() {
                    state.runtime.stop();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running TruERP");
}
