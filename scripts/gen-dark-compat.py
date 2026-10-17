#!/usr/bin/env python3
"""Scan tsx sources for Tailwind palette utility tokens and emit a .dark compat CSS block."""
import re, os, sys

ROOT = "/Users/apple/Projects/widsurf/billbook_clone/frontend"
DIRS = ["app", "components", "hooks", "lib"]

NEUTRALS = {"slate","gray","zinc","neutral","stone"}

TAILWIND = {
"red":    {50:"#fef2f2",100:"#fee2e2",200:"#fecaca",300:"#fca5a5",400:"#f87171",500:"#ef4444",600:"#dc2626",700:"#b91c1c",800:"#991b1b",900:"#7f1d1d",950:"#450a0a"},
"orange": {50:"#fff7ed",100:"#ffedd5",200:"#fed7aa",300:"#fdba74",400:"#fb923c",500:"#f97316",600:"#ea580c",700:"#c2410c",800:"#9a3412",900:"#7c2d12",950:"#431407"},
"amber":  {50:"#fffbeb",100:"#fef3c7",200:"#fde68a",300:"#fcd34d",400:"#fbbf24",500:"#f59e0b",600:"#d97706",700:"#b45309",800:"#92400e",900:"#78350f",950:"#451a03"},
"yellow": {50:"#fefce8",100:"#fef9c3",200:"#fef08a",300:"#fde047",400:"#facc15",500:"#eab308",600:"#ca8a04",700:"#a16207",800:"#854d0e",900:"#713f12",950:"#422006"},
"lime":   {50:"#f7fee7",100:"#ecfccb",200:"#d9f99d",300:"#bef264",400:"#a3e635",500:"#84cc16",600:"#65a30d",700:"#4d7c0f",800:"#3f6212",900:"#365314",950:"#1a2e05"},
"green":  {50:"#f0fdf4",100:"#dcfce7",200:"#bbf7d0",300:"#86efac",400:"#4ade80",500:"#22c55e",600:"#16a34a",700:"#15803d",800:"#166534",900:"#14532d",950:"#052e16"},
"emerald":{50:"#ecfdf5",100:"#d1fae5",200:"#a7f3d0",300:"#6ee7b7",400:"#34d399",500:"#10b981",600:"#059669",700:"#047857",800:"#065f46",900:"#064e3b",950:"#022c22"},
"teal":   {50:"#f0fdfa",100:"#ccfbf1",200:"#99f6e4",300:"#5eead4",400:"#2dd4bf",500:"#14b8a6",600:"#0d9488",700:"#0f766e",800:"#115e59",900:"#134e4a",950:"#042f2e"},
"cyan":   {50:"#ecfeff",100:"#cffafe",200:"#a5f3fc",300:"#67e8f9",400:"#22d3ee",500:"#06b6d4",600:"#0891b2",700:"#0e7490",800:"#155e75",900:"#164e63",950:"#083344"},
"sky":    {50:"#f0f9ff",100:"#e0f2fe",200:"#bae6fd",300:"#7dd3fc",400:"#38bdf8",500:"#0ea5e9",600:"#0284c7",700:"#0369a1",800:"#075985",900:"#0c4a6e",950:"#082f49"},
"indigo": {50:"#eef2ff",100:"#e0e7ff",200:"#c7d2fe",300:"#a5b4fc",400:"#818cf8",500:"#6366f1",600:"#4f46e5",700:"#4338ca",800:"#3730a3",900:"#312e81",950:"#1e1b4b"},
"violet": {50:"#f5f3ff",100:"#ede9fe",200:"#ddd6fe",300:"#c4b5fd",400:"#a78bfa",500:"#8b5cf6",600:"#7c3aed",700:"#6d28d9",800:"#5b21b6",900:"#4c1d95",950:"#2e1065"},
"purple": {50:"#faf5ff",100:"#f3e8ff",200:"#e9d5ff",300:"#d8b4fe",400:"#c084fc",500:"#a855f7",600:"#9333ea",700:"#7e22ce",800:"#6b21a8",900:"#581c87",950:"#3b0764"},
"fuchsia":{50:"#fdf4ff",100:"#fae8ff",200:"#f5d0fe",300:"#f0abfc",400:"#e879f9",500:"#d946ef",600:"#c026d3",700:"#a21caf",800:"#86198f",900:"#701a75",950:"#4a044e"},
"pink":   {50:"#fdf2f8",100:"#fce7f3",200:"#fbcfe8",300:"#f9a8d4",400:"#f472b6",500:"#ec4899",600:"#db2777",700:"#be185d",800:"#9d174d",900:"#831843",950:"#500724"},
"rose":   {50:"#fff1f2",100:"#ffe4e6",200:"#fecdd3",300:"#fda4af",400:"#fb7185",500:"#f43f5e",600:"#e11d48",700:"#be123c",800:"#9f1239",900:"#881337",950:"#4c0519"},
}

def rgb(hexv):
    hexv = hexv.lstrip('#')
    return f"{int(hexv[0:2],16)} {int(hexv[2:4],16)} {int(hexv[4:6],16)}"

def frac(pct):
    """pct 0-100 -> '0.15' style alpha string"""
    return f"{pct/100:.2f}".rstrip('0').rstrip('.')

def prop_decl(prop, val):
    if prop == "text": return f"color: {val}"
    if prop in ("caret","accent"): return f"{prop}-color: {val}"
    if prop == "decoration": return f"text-decoration-color: {val}"
    if prop == "placeholder": return f"color: {val}"
    if prop == "outline": return f"outline-color: {val}"
    if prop in ("border","divide"): return f"border-color: {val}"
    if prop == "bg": return f"background-color: {val}"
    if prop == "ring": return f"--tw-ring-color: {val}"
    if prop in ("from","to","via"):
        return f"--tw-gradient-{prop}: {val} var(--tw-gradient-{prop}-position)"
    return f"{prop}: {val}"

def map_base(prop, fam, shade, alpha):
    al = int(alpha) if alpha else 100
    def a(base_pct):
        return frac(base_pct * al / 100)
    s = int(shade)

    if fam in NEUTRALS:
        if prop == "bg":
            if s <= 50:  return prop_decl(prop, f"hsl(220 26% 14% / {a(100)})")
            if s == 100: return prop_decl(prop, f"hsl(219 24% 17% / {a(100)})")
            if s == 200: return prop_decl(prop, f"hsl(218 22% 22% / {a(100)})")
            if s == 300: return prop_decl(prop, f"hsl(217 20% 28% / {a(100)})")
            return None
        if prop in ("text","fill","stroke","caret","accent","decoration","placeholder"):
            if s >= 700 or s <= 200:
                return prop_decl(prop, "hsl(var(--foreground))")
            if s >= 500:
                return prop_decl(prop, "hsl(var(--muted-foreground))")
            return prop_decl(prop, "hsl(216 15% 55%)")
        if prop in ("border","divide","outline"):
            if s <= 300: return prop_decl(prop, "hsl(var(--border))")
            if s <= 500: return prop_decl(prop, "hsl(216 20% 34%)")
            return prop_decl(prop, "hsl(215 22% 45%)")
        if prop == "ring":
            return prop_decl(prop, "hsl(var(--border))")
        if prop in ("from","to","via"):
            if s <= 200:
                return prop_decl(prop, f"hsl(220 26% 14% / {a(100)})")
            return None
        return None

    if fam == "blue":
        if prop == "bg":
            base = {50:15, 100:24, 200:32}.get(s)
            if base is None: return None
            return prop_decl(prop, f"hsl(var(--theme-500) / {a(base)})")
        if prop in ("text","fill","stroke","caret","accent","decoration","placeholder"):
            target = {500:400,600:400,700:300,800:200,900:100,950:50}.get(s)
            if target is None: return None
            return prop_decl(prop, f"hsl(var(--theme-{target}))")
        if prop in ("border","divide","outline"):
            if s <= 100: return prop_decl(prop, "hsl(var(--theme-500) / 0.3)")
            if s <= 300: return prop_decl(prop, "hsl(var(--theme-500) / 0.45)")
            return prop_decl(prop, "hsl(var(--theme-500))")
        if prop == "ring":
            if s <= 200: return prop_decl(prop, "hsl(var(--theme-500) / 0.35)")
            return prop_decl(prop, "hsl(var(--theme-500))")
        if prop in ("from","to","via"):
            if s <= 200:
                return prop_decl(prop, f"hsl(var(--theme-500) / {a(18)})")
            return None
        return None

    pal = TAILWIND[fam]
    c500 = rgb(pal[500])
    if prop == "bg":
        base = {50:14, 100:22, 200:30}.get(s)
        if base is None: return None
        return prop_decl(prop, f"rgb({c500} / {a(base)})")
    if prop in ("text","fill","stroke","caret","accent","decoration","placeholder"):
        target = {500:400,600:400,700:300,800:200,900:100,950:100}.get(s)
        if target is None: return None
        return prop_decl(prop, pal[target])
    if prop in ("border","divide","outline"):
        aa = {100:25,200:35,300:45}.get(s)
        if aa is None: return None
        return prop_decl(prop, f"rgb({c500} / {a(aa)})")
    if prop == "ring":
        if s <= 300: return prop_decl(prop, f"rgb({c500} / 0.35)")
        return None
    if prop in ("from","to","via"):
        if s <= 200:
            return prop_decl(prop, f"rgb({c500} / {a(18)})")
        return None
    return None

def esc(cls):
    return re.sub(r'([^\w-])', lambda m: '\\' + m.group(1), cls)

def wrap_variant(variant, sel):
    """sel = escaped class with leading dot"""
    if variant is None: return sel
    if variant == "hover": return f"{sel}:hover"
    if variant == "focus": return f"{sel}:focus"
    if variant == "focus-visible": return f"{sel}:focus-visible"
    if variant == "focus-within": return f"{sel}:focus-within"
    if variant == "active": return f"{sel}:active"
    if variant == "disabled": return f"{sel}:disabled"
    if variant == "checked": return f"{sel}:checked"
    if variant == "odd": return f"{sel}:nth-child(odd)"
    if variant == "even": return f"{sel}:nth-child(even)"
    if variant == "first": return f"{sel}:first-child"
    if variant == "last": return f"{sel}:last-child"
    if variant == "group-hover": return f".group:hover {sel}"
    if variant == "peer-checked": return f".peer:checked ~ {sel}"
    if variant == "placeholder": return f"{sel}::placeholder"
    m = re.fullmatch(r'data-\[([\w-]+)(?:=([\w-]+))?\]', variant)
    if m:
        attr = f'[data-{m.group(1)}="{m.group(2)}"]' if m.group(2) else f'[data-{m.group(1)}]'
        return f'{sel}{attr}'
    m = re.fullmatch(r'aria-\[([\w-]+)=([\w-]+)\]', variant)
    if m: return f'{sel}[aria-{m.group(1)}="{m.group(2)}"]'
    return None

def main():
    token_re = re.compile(
        r'(?:(hover|focus-within|focus-visible|focus|group-hover|peer-checked|disabled|checked|active|odd|even|first|last|placeholder|data-\[[\w-]+(?:=[\w-]+)?\]|aria-\[[\w-]+=[\w-]+\]):)?'
        r'(bg|text|border|divide|ring|from|via|to|fill|stroke|caret|accent|decoration|placeholder|outline)-'
        r'(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|blue|white|black)'
        r'(?:-(\d{2,3}))?(?:/(\[?[\d.]+\]?))?'
    )
    hex_re = re.compile(
        r'(?:(hover|focus|focus-visible|focus-within|group-hover|disabled|active|placeholder|data-\[[\w-]+(?:=[\w-]+)?\]):)?'
        r'(bg|text|border|divide)-\[#([0-9a-fA-F]{6,8})\](?:/(\d{1,3}))?'
    )
    tokens = set()
    hextokens = set()
    for d in DIRS:
        for dirpath, _, files in os.walk(os.path.join(ROOT, d)):
            for fn in files:
                if not fn.endswith(('.tsx', '.ts')): continue
                p = os.path.join(dirpath, fn)
                try:
                    src = open(p, encoding='utf8').read()
                except Exception:
                    continue
                for m in token_re.finditer(src):
                    v, pr, f, sh, al = m.groups()
                    if al:
                        raw = al.strip('[]')
                        al = str(int(round(float(raw) * (100 if '.' in raw else 1))))
                    tokens.add((v, pr, f, sh, al))
                for m in hex_re.finditer(src):
                    hextokens.add(m.groups())

    rules = []
    skipped = set()
    for variant, prop, fam, shade, alpha in sorted(tokens, key=str):
        if fam == "white":
            if prop == "bg" and (not alpha or int(alpha) >= 60):
                decl = prop_decl("bg", f"hsl(var(--card) / {frac(int(alpha or 100))})")
            elif prop in ("from", "to", "via"):
                decl = prop_decl(prop, f"hsl(var(--card) / {frac(int(alpha or 100))})")
            else:
                continue
            sel_core = f"{prop}-white" + (f"/{alpha}" if alpha else "")
        elif fam == "black":
            if prop != "text":
                continue
            decl = "color: hsl(var(--foreground))"
            sel_core = f"{prop}-black" + (f"/{alpha}" if alpha else "")
        else:
            if not shade:
                continue
            decl = map_base(prop, fam, shade, alpha)
            if decl is None:
                continue
            sel_core = f"{prop}-{fam}-{shade}" + (f"/{alpha}" if alpha else "")
        cls = f"{variant}:{sel_core}" if variant else sel_core
        sel = wrap_variant(variant, "." + esc(cls))
        if sel is None:
            skipped.add((variant or '') + ':' + sel_core); continue
        if prop == "divide":
            sel += " > :not([hidden]) ~ :not([hidden])"
        elif prop == "placeholder":
            sel += "::placeholder"
        rules.append((f".dark {sel}", decl))

    HEXMAP = {
        "f6f7fb": ("bg", "hsl(var(--background))"),
        "20212b": ("text", "hsl(var(--foreground))"),
        "111111": ("text", "hsl(var(--foreground))"),
        "5b5c6b": ("text", "hsl(var(--muted-foreground))"),
        "737480": ("text", "hsl(var(--muted-foreground))"),
        "92939e": ("text", "hsl(216 14% 56%)"),
        "e4e6ef": ("border", "hsl(var(--border))"),
        "eef0f5": ("border", "hsl(var(--border))"),
        "c81e3a": ("text", "hsl(var(--theme-400))"),
    }
    def lum(h6):
        r,g,b = int(h6[0:2],16),int(h6[2:4],16),int(h6[4:6],16)
        return (0.299*r+0.587*g+0.114*b)/255
    for variant, prop, hexv, alpha in sorted(hextokens, key=str):
        key = hexv.lower()[:6]
        decl = None
        if key in HEXMAP and HEXMAP[key][0] == prop:
            val = HEXMAP[key][1]
            if prop == "bg":
                if alpha and val.endswith(')'):
                    decl = f"background-color: {val[:-1]} / {frac(int(alpha))})"
                else:
                    decl = f"background-color: {val}"
            elif prop == "text": decl = f"color: {val}"
            else: decl = f"border-color: {val}"
        elif prop == "text" and lum(key) < 0.45:
            decl = "color: hsl(var(--foreground))"
        elif prop == "bg" and lum(key) > 0.9:
            decl = f"background-color: hsl(var(--card) / {frac(int(alpha or 100))})"
        elif prop == "border" and lum(key) > 0.8:
            decl = "border-color: hsl(var(--border))"
        if decl is None:
            skipped.add(f"{prop}-[#{key}]"); continue
        sel_core = f"{prop}-[#{key}]" + (f"/{alpha}" if alpha else "")
        cls = f"{variant}:{sel_core}" if variant else sel_core
        sel = wrap_variant(variant, "." + esc(cls))
        if sel is None:
            skipped.add(f"{variant}:{prop}-[#{key}]"); continue
        rules.append((f".dark {sel}", decl))

    out = []
    for sel, decl in rules:
        out.append(f"{sel}:not(.light-scope, .light-scope *) {{ {decl}; }}")
    print("\n".join(out))
    print(f"/* skipped: {sorted(skipped)} */", file=sys.stderr)
    print(f"/* {len(rules)} rules */", file=sys.stderr)

main()
