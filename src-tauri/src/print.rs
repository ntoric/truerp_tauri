use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::thermal;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
}

#[tauri::command]
pub fn has_native_printing() -> bool {
    true
}

#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    // Prefer Winspool/CUPS helpers (no PowerShell flash on Windows).
    let printers = thermal::list_printers()?;
    Ok(printers
        .into_iter()
        .map(|p| PrinterInfo {
            name: p.name,
            is_default: p.is_default,
        })
        .collect())
}

fn decode_pdf_base64(pdf_base64: &str) -> Result<Vec<u8>, String> {
    let mut raw = pdf_base64.trim().to_string();
    if raw.is_empty() {
        return Err("empty PDF content".into());
    }
    if let Some(i) = raw.find("base64,") {
        raw = raw[i + "base64,".len()..].to_string();
    }
    let data = base64::engine::general_purpose::STANDARD
        .decode(raw.as_bytes())
        .map_err(|e| format!("invalid PDF base64: {e}"))?;
    if data.len() < 5 || &data[..4] != b"%PDF" {
        return Err("content is not a PDF".into());
    }
    Ok(data)
}

#[tauri::command]
pub fn print_pdf(
    pdf_base64: String,
    printer_name: String,
    job_title: String,
    paper_width_mm: Option<i32>,
    paper_size: Option<String>,
) -> Result<(), String> {
    let data = decode_pdf_base64(&pdf_base64)?;

    let title = {
        let t = job_title.trim();
        if t.is_empty() {
            "TruERP Document".to_string()
        } else {
            t.to_string()
        }
    };
    let path = write_temp_print_file(&format!("{}.pdf", sanitize_file_stem(&title)), &data)?;
    let media = resolve_media_option(paper_width_mm, paper_size.as_deref());
    let result = print_pdf_file(&path, printer_name.trim(), &title, media.as_deref());
    let _ = fs::remove_file(&path);
    result
}

fn decode_bytes_base64(data_base64: &str) -> Result<Vec<u8>, String> {
    let mut raw = data_base64.trim().to_string();
    if raw.is_empty() {
        return Err("empty file content".into());
    }
    if let Some(i) = raw.find("base64,") {
        raw = raw[i + "base64,".len()..].to_string();
    }
    base64::engine::general_purpose::STANDARD
        .decode(raw.as_bytes())
        .map_err(|e| format!("invalid file base64: {e}"))
}

fn sanitize_download_filename(filename: &str, default_ext: &str) -> String {
    let trimmed = filename.trim();
    let (stem_raw, ext_raw) = match trimmed.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() && !ext.is_empty() && ext.len() <= 8 => {
            (stem, ext)
        }
        _ => (trimmed, default_ext.trim_start_matches('.')),
    };
    let stem = sanitize_file_stem(stem_raw);
    let mut ext = String::new();
    for ch in ext_raw.chars() {
        if ch.is_ascii_alphanumeric() {
            ext.push(ch.to_ascii_lowercase());
        }
    }
    if ext.is_empty() {
        format!("{stem}.{default_ext}")
    } else {
        format!("{stem}.{ext}")
    }
}

fn write_downloads_file(name: &str, data: &[u8]) -> Result<String, String> {
    let dir = dirs::download_dir()
        .or_else(dirs::document_dir)
        .unwrap_or_else(std::env::temp_dir);
    fs::create_dir_all(&dir).map_err(|e| format!("create downloads dir: {e}"))?;

    let mut path = dir.join(name);
    if path.exists() {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        path = dir.join(format!("{nanos}-{name}"));
    }

    fs::write(&path, data).map_err(|e| format!("write file: {e}"))?;
    open_saved_file(&path)?;
    Ok(path.display().to_string())
}

/// Save a PDF to the user's Downloads folder and open it (WKWebView cannot rely on `<a download>`).
#[tauri::command]
pub fn save_pdf(pdf_base64: String, filename: String) -> Result<String, String> {
    let data = decode_pdf_base64(&pdf_base64)?;
    let name = sanitize_download_filename(&filename, "pdf");
    write_downloads_file(&name, &data)
}

/// Save arbitrary bytes (CSV/Excel/etc.) to Downloads — same WKWebView limitation as PDFs.
#[tauri::command]
pub fn save_file(data_base64: String, filename: String) -> Result<String, String> {
    let data = decode_bytes_base64(&data_base64)?;
    if data.is_empty() {
        return Err("empty file content".into());
    }
    let name = sanitize_download_filename(&filename, "bin");
    write_downloads_file(&name, &data)
}

#[cfg(target_os = "macos")]
fn open_saved_file(path: &std::path::Path) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("open PDF: {e}"))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn open_saved_file(path: &std::path::Path) -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "start", "", &path.display().to_string()])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("open PDF: {e}"))?;
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn open_saved_file(path: &std::path::Path) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("open PDF: {e}"))?;
    Ok(())
}

/// Prefer explicit paper size (A4/Letter/Legal); otherwise custom thermal width in mm.
fn resolve_media_option(paper_width_mm: Option<i32>, paper_size: Option<&str>) -> Option<String> {
    if let Some(size) = paper_size {
        let normalized = size.trim().to_ascii_lowercase();
        match normalized.as_str() {
            "a4" => return Some("A4".into()),
            "letter" => return Some("Letter".into()),
            "legal" => return Some("Legal".into()),
            _ => {}
        }
    }
    let width = paper_width_mm.unwrap_or(0);
    if width > 0 && width < 100 {
        // Tall custom roll so CUPS does not crop long receipts.
        Some(format!("Custom.{}x2000mm", width))
    } else {
        None
    }
}

fn write_temp_print_file(name: &str, data: &[u8]) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("truerp-print");
    fs::create_dir_all(&dir).map_err(|e| format!("temp dir: {e}"))?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let path = dir.join(format!("{nanos}-{name}"));
    fs::write(&path, data).map_err(|e| format!("write temp pdf: {e}"))?;
    Ok(path)
}

fn sanitize_file_stem(s: &str) -> String {
    let mut out = String::new();
    for ch in s.chars() {
        match ch {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' => out.push(ch),
            _ => out.push('-'),
        }
    }
    let trimmed = out.trim_matches('-');
    if trimmed.is_empty() {
        "print".into()
    } else if trimmed.len() > 48 {
        trimmed[..48].into()
    } else {
        trimmed.into()
    }
}

#[cfg(target_os = "macos")]
fn print_pdf_file(
    path: &std::path::Path,
    printer_name: &str,
    title: &str,
    media: Option<&str>,
) -> Result<(), String> {
    let mut args = vec![
        "-t".to_string(),
        title.to_string(),
        "-o".to_string(),
        "fit-to-page".to_string(),
    ];
    if let Some(m) = media {
        args.push("-o".to_string());
        args.push(format!("media={m}"));
    }
    if !printer_name.is_empty() {
        args.insert(0, "-d".to_string());
        args.insert(1, printer_name.to_string());
    }
    args.push(path.display().to_string());
    let output = Command::new("lp")
        .args(&args)
        .output()
        .map_err(|e| format!("lp: {e}"))?;
    if !output.status.success() {
        if media.is_some() {
            return print_pdf_file(path, printer_name, title, None);
        }
        return Err(format!(
            "lp: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn print_pdf_file(
    path: &std::path::Path,
    printer_name: &str,
    _title: &str,
    _media: Option<&str>,
) -> Result<(), String> {
    // A4/document PDF path. Thermal receipts use print_thermal (ESC/POS + Winspool) instead.
    // CREATE_NO_WINDOW avoids the PowerShell console flash.
    let path_s = path.display().to_string().replace('\'', "''");
    let ps = if !printer_name.is_empty() {
        let printer = printer_name.replace('\'', "''");
        format!(
            "Start-Process -FilePath '{path_s}' -Verb PrintTo -ArgumentList '{printer}' -WindowStyle Hidden; Start-Sleep -Milliseconds 800"
        )
    } else {
        format!(
            "Start-Process -FilePath '{path_s}' -Verb Print -WindowStyle Hidden; Start-Sleep -Milliseconds 800"
        )
    };
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &ps,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("print pdf: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "print pdf: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn print_pdf_file(
    _path: &std::path::Path,
    _printer_name: &str,
    _title: &str,
    _media: Option<&str>,
) -> Result<(), String> {
    Err("native PDF printing is not supported on this platform".into())
}
