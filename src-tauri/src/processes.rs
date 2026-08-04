use crate::paths::{
    ensure_runtime_cwd, find_node_binary, find_server_dir, resource_roots,
};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::AppHandle;

pub const FRONTEND_ADDR: &str = "127.0.0.1:3000";
pub const PROXY_ADDR: &str = "127.0.0.1:17888";

pub struct RuntimeProcesses {
    pub data_root: PathBuf,
    pub frontend_ready: Arc<AtomicBool>,
    frontend_child: Mutex<Option<Child>>,
}

impl RuntimeProcesses {
    pub fn new(data_root: PathBuf) -> Self {
        Self {
            data_root,
            frontend_ready: Arc::new(AtomicBool::new(false)),
            frontend_child: Mutex::new(None),
        }
    }

    pub fn stop(&self) {
        if let Ok(mut guard) = self.frontend_child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

impl Drop for RuntimeProcesses {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Local data dir for runtime logs (and any future desktop-only caches).
/// The billing API and database live in the cloud — nothing is stored here for the API.
pub fn configure_data_dirs() -> Result<PathBuf, String> {
    let config_dir =
        dirs::config_dir().ok_or_else(|| "cannot resolve user config dir".to_string())?;
    let data_root = config_dir.join("TruERP");
    std::fs::create_dir_all(&data_root).map_err(|e| format!("create data dirs: {e}"))?;
    Ok(data_root)
}

fn runtime_log(data_root: &Path, msg: &str) {
    let line = format!("{} {msg}\n", chrono_like_now());
    let path = data_root.join("runtime.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = f.write_all(line.as_bytes());
    }
    log::info!("{msg}");
}

fn chrono_like_now() -> String {
    use std::time::SystemTime;
    let secs = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("ts={secs}")
}

pub fn start_runtime_into(app: &AppHandle, runtime: &RuntimeProcesses) -> Result<(), String> {
    let roots = resource_roots(app);
    let _ = ensure_runtime_cwd(&roots).map_err(|e| format!("runtime cwd: {e}"))?;
    runtime_log(
        &runtime.data_root,
        &format!("data directory: {}", runtime.data_root.display()),
    );
    runtime_log(
        &runtime.data_root,
        "Cloud API mode: desktop shell starts UI only (no local API process)",
    );
    start_frontend(runtime, &roots)?;
    Ok(())
}

fn start_frontend(runtime: &RuntimeProcesses, roots: &[PathBuf]) -> Result<(), String> {
    let server_dir = find_server_dir(roots).ok_or_else(|| {
        "Next.js standalone server not found. Run npm run desktop:prepare-ui".to_string()
    })?;
    let node_bin = find_node_binary(roots).ok_or_else(|| {
        "Node.js binary not found. Run npm run desktop:prepare-bundle or install Node.js".to_string()
    })?;

    // If a leftover UI is already healthy, reuse it instead of failing to bind :3000.
    if http_status(&format!("http://{FRONTEND_ADDR}")).is_ok_and(|code| (200..500).contains(&code))
    {
        runtime.frontend_ready.store(true, Ordering::SeqCst);
        runtime_log(
            &runtime.data_root,
            &format!("Reusing existing UI on http://{FRONTEND_ADDR}"),
        );
        return Ok(());
    }

    runtime_log(
        &runtime.data_root,
        &format!(
            "Starting UI: {} (node {})",
            server_dir.display(),
            node_bin.display()
        ),
    );

    let ui_log = runtime.data_root.join("ui.log");
    let mut cmd = Command::new(&node_bin);
    cmd.arg("server.js")
        .current_dir(&server_dir)
        .env("PORT", "3000")
        .env("HOSTNAME", "127.0.0.1")
        .env("HOST", "127.0.0.1");

    if let Ok(out) = std::fs::File::create(&ui_log) {
        if let Ok(err) = out.try_clone() {
            cmd.stdout(Stdio::from(out)).stderr(Stdio::from(err));
        } else {
            cmd.stdout(Stdio::from(out)).stderr(Stdio::null());
        }
    } else {
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("failed to start Next.js: {e}"))?;

    *runtime
        .frontend_child
        .lock()
        .map_err(|_| "frontend child lock poisoned".to_string())? = Some(child);

    wait_http(&format!("http://{FRONTEND_ADDR}"), Duration::from_secs(90))?;
    runtime.frontend_ready.store(true, Ordering::SeqCst);
    runtime_log(
        &runtime.data_root,
        &format!("TruERP UI listening on http://{FRONTEND_ADDR}"),
    );
    Ok(())
}

fn wait_http(url: &str, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if http_status(url).is_ok_and(|code| (200..500).contains(&code)) {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    Err(format!("service did not become ready at {url}"))
}

fn http_status(url: &str) -> Result<u16, ()> {
    use std::net::TcpStream;

    let url = url.strip_prefix("http://").ok_or(())?;
    let (host_port, path) = match url.split_once('/') {
        Some((hp, p)) => (hp, format!("/{p}")),
        None => (url, "/".to_string()),
    };
    let mut stream = TcpStream::connect(host_port).map_err(|_| ())?;
    stream
        .set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|_| ())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(2)))
        .map_err(|_| ())?;
    let req = format!("GET {path} HTTP/1.1\r\nHost: {host_port}\r\nConnection: close\r\n\r\n");
    stream.write_all(req.as_bytes()).map_err(|_| ())?;
    let mut buf = [0u8; 64];
    let n = stream.read(&mut buf).map_err(|_| ())?;
    let head = String::from_utf8_lossy(&buf[..n]);
    head.split_whitespace()
        .nth(1)
        .and_then(|s| s.parse::<u16>().ok())
        .ok_or(())
}
