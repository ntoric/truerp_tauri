//! Silent raw printing via Windows Spooler (winspool.drv).
//! Adapted from Mario Tauri — no PowerShell, no print dialog.

use crate::thermal::PrinterInfo;
use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;

const PRINTER_ENUM_LOCAL: u32 = 0x00000002;
const PRINTER_ENUM_CONNECTIONS: u32 = 0x00000004;
const PRINTER_DRIVER_XPS: u32 = 0x00000002;

#[repr(C)]
struct PrinterInfo5 {
    printer_name: *const u16,
    port_name: *const u16,
    attributes: u32,
    device_not_selected_timeout: u32,
    transmission_retry_timeout: u32,
}

#[repr(C)]
struct DocInfo1 {
    doc_name: *const u16,
    output_file: *const u16,
    datatype: *const u16,
}

#[repr(C)]
struct DriverInfo8 {
    version: u32,
    name: *const u16,
    environment: *const u16,
    driver_path: *const u16,
    data_file: *const u16,
    config_file: *const u16,
    help_file: *const u16,
    dependent_files: *const u16,
    monitor_name: *const u16,
    default_data_type: *const u16,
    previous_names: *const u16,
    driver_date_low: u32,
    driver_date_high: u32,
    driver_version: u64,
    mfg_name: *const u16,
    oem_url: *const u16,
    hardware_id: *const u16,
    provider: *const u16,
    print_processor: *const u16,
    vendor_setup: *const u16,
    color_profiles: *const u16,
    inf_path: *const u16,
    printer_driver_attributes: u32,
    core_driver_dependencies: *const u16,
    min_inbox_driver_ver_date_low: u32,
    min_inbox_driver_ver_date_high: u32,
    min_inbox_driver_ver_version: u32,
}

extern "system" {
    fn OpenPrinterW(printer_name: *const u16, printer_handle: *mut isize, default: usize) -> i32;
    fn ClosePrinter(printer_handle: isize) -> i32;
    fn StartDocPrinterW(printer_handle: isize, level: u32, doc_info: *const DocInfo1) -> u32;
    fn StartPagePrinter(printer_handle: isize) -> i32;
    fn WritePrinter(printer_handle: isize, buf: *const u8, cb_buf: u32, written: *mut u32) -> i32;
    fn EndPagePrinter(printer_handle: isize) -> i32;
    fn EndDocPrinter(printer_handle: isize) -> i32;
    fn EnumPrintersW(
        flags: u32,
        name: *const u16,
        level: u32,
        printer_enum: *mut u8,
        cb_buf: u32,
        needed: *mut u32,
        returned: *mut u32,
    ) -> i32;
    fn GetPrinterDriverW(
        printer_handle: isize,
        environment: *const u16,
        level: u32,
        driver_info: *mut u8,
        cb_buf: u32,
        needed: *mut u32,
    ) -> i32;
    fn GetDefaultPrinterW(psz_buffer: *mut u16, pcch_buffer: *mut u32) -> i32;
}

fn to_wide(s: &str) -> Vec<u16> {
    OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
}

unsafe fn from_wide_ptr(ptr: *const u16) -> String {
    if ptr.is_null() {
        return String::new();
    }
    let mut len = 0;
    while *ptr.add(len) != 0 {
        len += 1;
    }
    let slice = std::slice::from_raw_parts(ptr, len);
    String::from_utf16_lossy(slice)
}

fn default_printer_name() -> Option<String> {
    let mut needed: u32 = 0;
    unsafe {
        GetDefaultPrinterW(std::ptr::null_mut(), &mut needed);
    }
    if needed == 0 {
        return None;
    }
    let mut buf = vec![0u16; needed as usize];
    let ok = unsafe { GetDefaultPrinterW(buf.as_mut_ptr(), &mut needed) };
    if ok == 0 {
        return None;
    }
    let s = String::from_utf16_lossy(&buf);
    let name = s.trim_end_matches('\0').trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
    let mut needed: u32 = 0;
    let mut returned: u32 = 0;
    let mut buf = vec![0u8; 1];

    unsafe {
        EnumPrintersW(
            flags,
            std::ptr::null(),
            5,
            buf.as_mut_ptr(),
            buf.len() as u32,
            &mut needed,
            &mut returned,
        );
    }
    if needed == 0 {
        return Ok(Vec::new());
    }

    buf.resize(needed as usize, 0);
    let ret = unsafe {
        EnumPrintersW(
            flags,
            std::ptr::null(),
            5,
            buf.as_mut_ptr(),
            buf.len() as u32,
            &mut needed,
            &mut returned,
        )
    };
    if ret == 0 {
        return Err(format!(
            "EnumPrinters failed: {}",
            std::io::Error::last_os_error()
        ));
    }

    let default_name = default_printer_name().unwrap_or_default();
    let info_size = std::mem::size_of::<PrinterInfo5>();
    let mut printers = Vec::new();
    for i in 0..returned as usize {
        let ptr = unsafe { buf.as_ptr().add(i * info_size) as *const PrinterInfo5 };
        let name = unsafe { from_wide_ptr((*ptr).printer_name) };
        if name.is_empty() {
            continue;
        }
        let is_default = !default_name.is_empty() && name.eq_ignore_ascii_case(&default_name);
        printers.push(PrinterInfo { name, is_default });
    }
    if !printers.iter().any(|p| p.is_default) {
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

    let mut last_err = String::new();
    for attempt in 0..3 {
        match print_raw_once(printer_name, data) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = e;
                log::warn!("thermal print attempt {} failed: {}", attempt + 1, last_err);
                std::thread::sleep(std::time::Duration::from_millis(400));
            }
        }
    }
    Err(format!("Failed to print after 3 attempts: {last_err}"))
}

fn print_raw_once(printer_name: &str, data: &[u8]) -> Result<(), String> {
    let wide_name = to_wide(printer_name);
    let mut h_printer: isize = 0;
    let ret = unsafe { OpenPrinterW(wide_name.as_ptr(), &mut h_printer as *mut isize, 0) };
    if ret == 0 {
        return Err(format!(
            "OpenPrinter failed for '{printer_name}': {}",
            std::io::Error::last_os_error()
        ));
    }

    let result = print_raw_inner(h_printer, data);
    unsafe {
        ClosePrinter(h_printer);
    }
    result
}

fn print_raw_inner(h_printer: isize, data: &[u8]) -> Result<(), String> {
    let data_type_str = detect_data_type(h_printer);
    let doc_name = to_wide("TruERP Receipt");
    let data_type = to_wide(&data_type_str);
    let doc_info = DocInfo1 {
        doc_name: doc_name.as_ptr(),
        output_file: std::ptr::null(),
        datatype: data_type.as_ptr(),
    };

    let job_id = unsafe { StartDocPrinterW(h_printer, 1, &doc_info) };
    if job_id == 0 {
        return Err(format!(
            "StartDocPrinter failed: {}",
            std::io::Error::last_os_error()
        ));
    }

    if unsafe { StartPagePrinter(h_printer) } == 0 {
        unsafe {
            EndDocPrinter(h_printer);
        }
        return Err(format!(
            "StartPagePrinter failed: {}",
            std::io::Error::last_os_error()
        ));
    }

    let mut written: u32 = 0;
    let ret = unsafe { WritePrinter(h_printer, data.as_ptr(), data.len() as u32, &mut written) };

    unsafe {
        EndPagePrinter(h_printer);
        EndDocPrinter(h_printer);
    }

    if ret == 0 {
        return Err(format!(
            "WritePrinter failed: {}",
            std::io::Error::last_os_error()
        ));
    }
    if written == 0 {
        return Err("WritePrinter returned 0 bytes written".into());
    }
    log::info!(
        "thermal raw print: wrote {written} bytes (datatype={data_type_str})"
    );
    Ok(())
}

fn detect_data_type(h_printer: isize) -> String {
    let mut needed: u32 = 0;
    unsafe {
        GetPrinterDriverW(
            h_printer,
            std::ptr::null(),
            8,
            std::ptr::null_mut(),
            0,
            &mut needed,
        );
    }
    if needed == 0 {
        return "RAW".into();
    }
    let mut buf = vec![0u8; needed as usize];
    let ret = unsafe {
        GetPrinterDriverW(
            h_printer,
            std::ptr::null(),
            8,
            buf.as_mut_ptr(),
            needed,
            &mut needed,
        )
    };
    if ret != 0 {
        let di = unsafe { &*(buf.as_ptr() as *const DriverInfo8) };
        if di.printer_driver_attributes & PRINTER_DRIVER_XPS != 0 {
            return "XPS_PASS".into();
        }
    }
    "RAW".into()
}
