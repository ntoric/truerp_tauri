# TruERP Desktop (Tauri)

Desktop client for **Windows** and **macOS**. Lives inside `frontend/` (`src-tauri/` + `splash/`); the **billing API runs as a separate cloud service** (deploy `../backend`).

Does **not** replace the existing Wails app in `../desktop/`.

## Architecture

| Piece | How it runs |
|-------|-------------|
| Shell | Tauri 2 (WebView2 on Windows, WKWebView on macOS) |
| API | Cloud Go/Gin service (`API_TRANSPORT=rest`) — **not** bundled or spawned by the desktop app |
| UI | Next.js **standalone** server on `127.0.0.1:3000`, built with `NEXT_PUBLIC_API_URL` pointing at the cloud API |
| Proxy | Rust reverse proxy on `127.0.0.1:17888` — WebView loads the local UI only |
| Node | Portable Node.js shipped in app resources |

```
Tauri WebView → http://127.0.0.1:17888/ (local UI)
                     │
                     └── fetch → https://api.example.com/api/v1  (cloud)
```

## Layout

```
frontend/
├── app/ …                 # Next.js web + desktop UI source
├── splash/                # Tauri bootstrap WebView
├── scripts/               # desktop prepare / build helpers
├── src-tauri/             # Rust shell, print, updater
└── package.json           # next + tauri scripts
```

## Prerequisites

- Rust (stable) + Cargo
- Node.js 18+ and npm (to *build* the UI; runtime Node is bundled)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS
- A deployed TruERP API (see `../backend/.env.example`)

## Quick start (dev)

```bash
cd frontend
npm install

# Point the UI at your cloud (or staging) API — bake-time env for Next.js:
export NEXT_PUBLIC_API_URL="https://api.example.com/api/v1"

npm run desktop:prepare-ui
npm run desktop:prepare-bundle     # downloads portable Node for this machine

npm run tauri:dev
```

Avoid baking `http://localhost:8088/...` into macOS desktop builds — absolute localhost API calls can hang in WKWebView. Use a public HTTPS API URL.

Web-only Next.js stays unchanged: `npm run dev` / `npm run build`.

## Build macOS

```bash
cd frontend
export NEXT_PUBLIC_API_URL="https://api.example.com/api/v1"
npm run desktop:macos
# or: SKIP_FRONTEND=1 npm run desktop:macos   # if server already prepared
```

Artifacts: `src-tauri/target/release/bundle/macos/` and `dmg/` when available.

## Build Windows

```bash
cd frontend
export NEXT_PUBLIC_API_URL="https://api.example.com/api/v1"
npm run desktop:windows
```

### Windows install error: `node.exe` file locked

If the NSIS installer shows **Error opening file for writing: …\TruERP\resources\node\node.exe**, a previous TruERP session left the bundled Node process running. Clicking **Ignore** skips installing Node, so the app cannot open.

**Recover on the affected PC:**

1. Close TruERP if it is open.
2. Open Task Manager → end **TruERP** and any **Node.js** process whose path is under `%LOCALAPPDATA%\TruERP\`.
   Or in PowerShell:
   ```powershell
   taskkill /F /T /IM TruERP.exe 2>$null
   $node = Join-Path $env:LOCALAPPDATA "TruERP\resources\node\node.exe"
   Get-CimInstance Win32_Process |
     Where-Object { $_.ExecutablePath -ieq $node } |
     ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
   ```
3. Re-run the installer (do **not** click Ignore if the error appears again).
4. If it still fails, uninstall TruERP, reboot, then install again.

Newer builds kill the bundled Node automatically in the NSIS pre-install hook (`src-tauri/windows/hooks.nsh`).

## Runtime resources

Packaged under `src-tauri/resources/`:

```
server/                 # Next.js standalone (cloud API URL baked in)
node/                   # portable Node
runtime/
HSN_DATASET.csv
```

The Go API binary is **not** packaged. AI embedding models (`models/`) are also not packaged.

## Printer support

Tauri exposes the same desktop print surface the Wails app uses (via a Wails-compatible bridge):

- `ListPrinters` / `list_printers`
- `PrintPDF` / `print_pdf` (optional `paperWidthMm` for thermal rolls, `paperSize` for A4/Letter/Legal)
- `HasNativePrinting` / `has_native_printing`

Configure **Settings → Print** in the app:

| Mode | Sizes |
|------|--------|
| A4 / PDF | A4, Letter, Legal |
| Thermal receipts | **1″ (25mm), 1.5″ (38mm), 2″ (58mm), 3″ (80mm)** |
| Barcode labels | 1″ / 1.5″ / 2″ / 3″ thermal labels, or A4 sheet |

On macOS, thermal jobs pass a custom CUPS media size matching the PDF page width so narrow rolls scale correctly.

## App updates

Release builds ship with the [Tauri updater](https://v2.tauri.app/plugin/updater/). On launch (release only) the app checks for a newer version and offers to install it. Users can also check from **Settings → Help → Desktop Updates**.

### Signing keys

Generate once (already done on this machine as `~/.tauri/truerp.key`):

```bash
cd frontend
npx tauri signer generate -w ~/.tauri/truerp.key
```

- **Private key** (`~/.tauri/truerp.key`) — keep secret; required to sign every release. Never commit it.
- **Public key** — embedded in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.

Build scripts auto-use `~/.tauri/truerp.key` via `TAURI_SIGNING_PRIVATE_KEY_PATH` (override with env vars if needed).

### GitHub Actions release (recommended)

Pushing a semver tag builds macOS (arm64 + x64) and Windows installers and publishes a GitHub Release (including updater `latest.json`).

Workflows:

| Path | When it runs |
|------|----------------|
| [`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml) | TruERP monorepo (`ntoric/TruERP`) |
| [`.github/workflows/desktop-release.yml`](./.github/workflows/desktop-release.yml) | Frontend repo (`ntoric/truerp_tauri`) |

In-app updates read a **public** `latest.json`. The desktop app is configured to poll
`https://github.com/ntoric/truerp_tauri/releases/latest/download/latest.json`.
Ship desktop tags from `truerp_tauri` (or otherwise publish that manifest + signed artifacts to a public URL).

```bash
git tag v1.2.3
git push origin v1.2.3
```

Configure these **repository secrets** before the first run:

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_API_URL` | Cloud API baked into the UI (e.g. `https://truerp-backend.ntoric.com/api/v1`) |
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of the updater private key file |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Optional passphrase for that key |

The workflow syncs `package.json` / `tauri.conf.json` / `Cargo.toml` version from the tag (`v1.2.3` → `1.2.3`), prepares the standalone UI + portable Node, then builds with `tauri-apps/tauri-action`.

### Manual publishing

1. Sync version: `./scripts/sync-desktop-version.sh v1.0.1`
2. Build with `NEXT_PUBLIC_API_URL` set: `npm run desktop:macos` and/or `npm run desktop:windows`.
3. Generate the manifest:

```bash
npm run desktop:manifest -- \
  --version 1.0.1 \
  --base-url https://github.com/ntoric/truerp_tauri/releases/download/v1.0.1 \
  --notes "What changed"
```

4. Upload the updater artifacts (`.app.tar.gz` / setup `.exe` + matching `.sig`) and `latest.json` to the GitHub release.
5. Clients poll `https://github.com/ntoric/truerp_tauri/releases/latest/download/latest.json` (override at runtime with `TRUERP_UPDATE_ENDPOINT`).

## Notes

- Staging copy lives in `frontend/.staging/` (gitignored).
- Changing the API host requires rebuilding the UI package (`npm run desktop:prepare-ui`) so `NEXT_PUBLIC_API_URL` is re-baked.
- The Wails desktop app in `../desktop/` remains available and unchanged.
