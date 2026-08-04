//! Silent raw printing via CUPS (`lp -o raw`) on macOS/Linux.

use crate::thermal::PrinterInfo;
use std::io::Write;
use std::process::{Command, Stdio};

pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    let output = Command::new("lpstat")
        .args(["-p", "-d"])
        .output()
        .map_err(|e| format!("lpstat: {e}"))?;
    let text = String::from_utf8_lossy(&output.stdout);
    let err = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() {
        if err.contains("no destinations") || text.contains("no destinations") {
            return Ok(vec![]);
        }
        // Still try to parse partial output
    }

    let mut default_name = String::new();
    let mut printers = Vec::new();
    for line in text.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("system default destination:") {
            default_name = rest.trim().to_string();
            continue;
        }
        if let Some(rest) = line.strip_prefix("printer ") {
            if let Some(name) = rest.split_whitespace().next() {
                printers.push(PrinterInfo {
                    name: name.to_string(),
                    is_default: false,
                });
            }
        }
    }
    for p in &mut printers {
        if p.name == default_name {
            p.is_default = true;
        }
    }
    if !default_name.is_empty() && !printers.iter().any(|p| p.is_default) {
        if let Some(first) = printers.first_mut() {
            first.is_default = true;
        }
    }
    Ok(printers)
}

pub fn print_raw(printer_name: &str, data: &[u8]) -> Result<(), String> {
    if data.is_empty() {
        return Err("No data to print".into());
    }

    // Prefer stdin to avoid temp files when possible
    let mut child = Command::new("lp")
        .args(["-d", printer_name, "-o", "raw", "-t", "TruERP Receipt", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("lp: {e}"))?;

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| "lp stdin unavailable".to_string())?;
        stdin
            .write_all(data)
            .map_err(|e| format!("lp write: {e}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("lp wait: {e}"))?;
    if output.status.success() {
        return Ok(());
    }

    // Fallback: temp file (some CUPS setups reject stdin)
    let path = std::env::temp_dir().join(format!(
        "truerp-thermal-{}.bin",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    std::fs::write(&path, data).map_err(|e| format!("temp write: {e}"))?;
    let output2 = Command::new("lp")
        .args([
            "-d",
            printer_name,
            "-o",
            "raw",
            "-t",
            "TruERP Receipt",
            &path.display().to_string(),
        ])
        .output()
        .map_err(|e| format!("lp: {e}"))?;
    let _ = std::fs::remove_file(&path);
    if output2.status.success() {
        Ok(())
    } else {
        Err(format!(
            "lp raw print failed: {}",
            String::from_utf8_lossy(&output2.stderr).trim()
        ))
    }
}
