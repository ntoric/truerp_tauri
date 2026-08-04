//! Silent thermal (ESC/POS) printing for TruERP desktop.
//! Windows: Winspool RAW / XPS_PASS (no PowerShell, no print dialog).
//! macOS/Linux: CUPS `lp -o raw`.

mod escpos;

#[cfg(target_os = "windows")]
mod winspool;

#[cfg(not(target_os = "windows"))]
mod cups;

use base64::Engine;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
}

/// List OS printers (Winspool / CUPS). Prefer this over PowerShell on Windows.
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        winspool::list_printers()
    }
    #[cfg(not(target_os = "windows"))]
    {
        cups::list_printers()
    }
}

fn resolve_printer_name(printer_name: &str) -> Result<String, String> {
    let trimmed = printer_name.trim();
    if !trimmed.is_empty() {
        return Ok(trimmed.to_string());
    }
    let printers = list_printers()?;
    if let Some(p) = printers.iter().find(|p| p.is_default) {
        return Ok(p.name.clone());
    }
    if let Some(p) = printers.first() {
        return Ok(p.name.clone());
    }
    Err("No printer found. Install a thermal printer or pick one in Settings → Print.".into())
}

fn print_raw(printer_name: &str, data: &[u8]) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        winspool::print_raw(printer_name, data)
    }
    #[cfg(not(target_os = "windows"))]
    {
        cups::print_raw(printer_name, data)
    }
}

/// Render plain receipt text to ESC/POS and send raw to the printer (silent).
#[tauri::command]
pub fn print_thermal(
    content: String,
    printer_name: String,
    paper_width_mm: Option<i32>,
    job_title: String,
    logo_escpos_base64: Option<String>,
) -> Result<(), String> {
    let text = content.trim();
    if text.is_empty() {
        return Err("empty thermal content".into());
    }
    let width = paper_width_mm.unwrap_or(58).clamp(20, 100);
    let logo = logo_escpos_base64
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());
    let data = escpos::render_text_receipt(text, width, logo);
    let target = resolve_printer_name(&printer_name)?;
    let _ = job_title; // reserved for spooler doc name on Windows
    print_raw(&target, &data)
}

/// Print pre-encoded ESC/POS (or other raw) bytes, base64.
#[tauri::command]
pub fn print_raw_base64(data_base64: String, printer_name: String) -> Result<(), String> {
    let mut raw = data_base64.trim().to_string();
    if let Some(i) = raw.find("base64,") {
        raw = raw[i + "base64,".len()..].to_string();
    }
    let data = base64::engine::general_purpose::STANDARD
        .decode(raw.as_bytes())
        .map_err(|e| format!("invalid raw base64: {e}"))?;
    if data.is_empty() {
        return Err("empty raw print data".into());
    }
    let target = resolve_printer_name(&printer_name)?;
    print_raw(&target, &data)
}
