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

/// Build a compact ESC/POS buffer from pre-formatted receipt text.
/// Avoids PDF page geometry (source of long blank gaps on thermal rolls).
pub fn render_text_receipt(content: &str, width_mm: i32) -> Vec<u8> {
    let line_width = line_width_for_mm(width_mm);
    let mut data: Vec<u8> = Vec::with_capacity(content.len() + 64);

    data.extend_from_slice(&[0x1B, 0x40]); // initialize
    data.extend_from_slice(&[0x1B, 0x61, 0x00]); // align left
    data.extend_from_slice(&[0x1B, 0x74, 0x00]); // code page PC437

    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    for line in normalized.lines() {
        let clean = sanitize_line(line);
        for chunk in wrap_chars(&clean, line_width) {
            data.extend_from_slice(chunk.as_bytes());
            data.push(b'\n');
        }
    }

    // Feed then partial cut so the next receipt starts cleanly
    data.extend_from_slice(b"\n\n\n");
    data.extend_from_slice(&[0x1D, 0x56, 0x41, 0x10]);
    data
}
