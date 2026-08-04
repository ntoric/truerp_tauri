use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Resolve resource roots used to find bundled Node and the Next.js server.
pub fn resource_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(dir) = app.path().resource_dir() {
        roots.push(dir.clone());
        // Sometimes resources land one level deeper depending on packaging.
        roots.push(dir.join("resources"));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            roots.push(exe_dir.to_path_buf());
            // macOS .app: Contents/MacOS → Contents/Resources
            let resources = exe_dir.join("../Resources");
            roots.push(resources.canonicalize().unwrap_or(resources));
        }
    }

    // Dev / local prepare-bundle output
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd.join("resources"));
        roots.push(cwd.join("../resources"));
        roots.push(cwd.join("src-tauri/resources"));
        // Reuse Wails desktop bundle during development if present
        roots.push(cwd.join("../desktop/bundle"));
        roots.push(cwd.join("../desktop/frontend"));
    }

    roots
}

pub fn find_existing(roots: &[PathBuf], rel: &str) -> Option<PathBuf> {
    for root in roots {
        let candidate = root.join(rel);
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

pub fn find_node_binary(roots: &[PathBuf]) -> Option<PathBuf> {
    #[cfg(windows)]
    let names = ["node/node.exe", "node.exe"];
    #[cfg(not(windows))]
    let names = ["node/bin/node", "bin/node"];

    for name in names {
        if let Some(p) = find_existing(roots, name) {
            return Some(p);
        }
    }
    which("node")
}

pub fn find_server_dir(roots: &[PathBuf]) -> Option<PathBuf> {
    for rel in ["server", "frontend/server"] {
        if let Some(dir) = find_existing(roots, rel) {
            if dir.join("server.js").exists() {
                return Some(dir);
            }
        }
    }
    None
}

pub fn ensure_runtime_cwd(roots: &[PathBuf]) -> std::io::Result<PathBuf> {
    let runtime = find_existing(roots, "runtime").unwrap_or_else(|| {
        let fallback = dirs::cache_dir()
            .unwrap_or_else(std::env::temp_dir)
            .join("truerp-runtime");
        fallback
    });
    std::fs::create_dir_all(&runtime)?;

    // Prefer HSN next to runtime parent (../HSN_DATASET.csv from runtime cwd).
    if let Some(hsn) = find_existing(roots, "HSN_DATASET.csv") {
        let parent = runtime.parent().map(Path::to_path_buf).unwrap_or_else(|| runtime.clone());
        let dest = parent.join("HSN_DATASET.csv");
        if !dest.exists() {
            let _ = std::fs::copy(&hsn, &dest);
        }
        let runtime_copy = runtime.join("HSN_DATASET.csv");
        if !runtime_copy.exists() {
            let _ = std::fs::copy(&hsn, &runtime_copy);
        }
    }

    std::env::set_current_dir(&runtime)?;
    Ok(runtime)
}

fn which(bin: &str) -> Option<PathBuf> {
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths).find_map(|dir| {
            let full = dir.join(bin);
            if full.is_file() {
                Some(full)
            } else {
                None
            }
        })
    })
}
