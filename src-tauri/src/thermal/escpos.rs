//! ESC/POS helpers for thermal receipt text.

/// Character columns for common thermal roll widths.
pub fn line_width_for_mm(width_mm: i32) -> usize {
    match width_mm {
        w if w <= 28 => 16, // ~1"
        w if w <= 42 => 24, // ~1.5"
        w if w <= 60 => 32, // ~2" / 58mm
        _ => 48,            // ~3" / 80mm
    }
}

fn sanitize_line(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '₹' => out.push_str("Rs."),
            '–' | '—' => out.push('-'),
            '‘' | '’' => out.push('\''),
            '“' | '”' => out.push('"'),
            '…' => out.push_str("..."),
            '\t' => out.push_str("  "),
            c if c.is_ascii() && !c.is_control() => out.push(c),
            c if c.is_ascii() => {}
            _ => out.push('?'),
        }
    }
    out
}

fn wrap_chars(text: &str, width: usize) -> Vec<String> {
    if width == 0 {
        return vec![text.to_string()];
    }
    let chars: Vec<char> = text.chars().collect();
    if chars.is_empty() {
        return vec![String::new()];
    }
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let mut end = (i + width).min(chars.len());
        if end < chars.len() {
            if let Some(rel) = chars[i..end].iter().rposition(|c| *c == ' ') {
                if rel > width / 3 {
                    end = i + rel;
                }
            }
        }
        let chunk: String = chars[i..end].iter().collect();
        out.push(chunk.trim_end().to_string());
        i = end;
        while i < chars.len() && chars[i] == ' ' {
            i += 1;
        }
    }
    if out.is_empty() {
        out.push(String::new());
    }
    out
}

#[derive(Default, Clone, Copy)]
struct LineStyle {
    center: bool,
    bold: bool,
}

/// Parse leading @C@ / @B@ / @N@ markers from a receipt line.
fn take_markers(line: &str) -> (LineStyle, &str) {
    let mut style = LineStyle::default();
    let mut rest = line;
    loop {
        if let Some(r) = rest.strip_prefix("@C@") {
            style.center = true;
            rest = r;
            continue;
        }
        if let Some(r) = rest.strip_prefix("@B@") {
            style.bold = true;
            rest = r;
            continue;
        }
        if let Some(r) = rest.strip_prefix("@N@") {
            style.bold = false;
            style.center = false;
            rest = r;
            continue;
        }
        break;
    }
    (style, rest)
}

fn decode_base64_bytes(raw: &str) -> Option<Vec<u8>> {
    let mut s = raw.trim().to_string();
    if let Some(i) = s.find("base64,") {
        s = s[i + "base64,".len()..].to_string();
    }
    if s.is_empty() {
        return None;
    }
    base64::Engine::decode(&base64::engine::general_purpose::STANDARD, s.as_bytes()).ok()
}

/// Build a compact ESC/POS buffer from pre-formatted receipt text.
/// Optional `logo_escpos_base64` is pre-encoded GS v 0 (or similar) raster data.
pub fn render_text_receipt(
    content: &str,
    width_mm: i32,
    logo_escpos_base64: Option<&str>,
) -> Vec<u8> {
    let line_width = line_width_for_mm(width_mm);
    let mut data: Vec<u8> = Vec::with_capacity(content.len() + 128);

    data.extend_from_slice(&[0x1B, 0x40]); // initialize
    data.extend_from_slice(&[0x1B, 0x74, 0x00]); // code page PC437

    if let Some(logo_b64) = logo_escpos_base64 {
        if let Some(logo) = decode_base64_bytes(logo_b64) {
            if !logo.is_empty() {
                data.extend_from_slice(&[0x1B, 0x61, 0x01]); // center
                data.extend_from_slice(&logo);
                data.push(b'\n');
                data.extend_from_slice(&[0x1B, 0x61, 0x00]); // left
            }
        }
    }

    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    let mut bold_on = false;
    let mut center_on = false;

    for line in normalized.lines() {
        let (style, body) = take_markers(line);
        let clean = sanitize_line(body);

        if style.center != center_on {
            data.extend_from_slice(&[0x1B, 0x61, if style.center { 0x01 } else { 0x00 }]);
            center_on = style.center;
        }
        if style.bold != bold_on {
            data.extend_from_slice(&[0x1B, 0x45, if style.bold { 0x01 } else { 0x00 }]);
            bold_on = style.bold;
        }

        for chunk in wrap_chars(&clean, line_width) {
            data.extend_from_slice(chunk.as_bytes());
            data.push(b'\n');
        }
    }

    if bold_on {
        data.extend_from_slice(&[0x1B, 0x45, 0x00]);
    }
    if center_on {
        data.extend_from_slice(&[0x1B, 0x61, 0x00]);
    }

    // Feed then partial cut so the next receipt starts cleanly
    data.extend_from_slice(b"\n\n\n");
    data.extend_from_slice(&[0x1D, 0x56, 0x41, 0x10]);
    data
}
