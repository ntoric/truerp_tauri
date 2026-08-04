#!/usr/bin/env bash
# Windows Tauri build (run on Windows or cross-compile with care).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -z "${NEXT_PUBLIC_API_URL:-}" ]]; then
  echo "error: set NEXT_PUBLIC_API_URL to your cloud API (e.g. https://api.example.com/api/v1)" >&2
  exit 1
fi

if [[ "${SKIP_FRONTEND:-0}" != "1" ]]; then
  ./scripts/prepare-frontend.sh
fi
./scripts/prepare-bundle.sh windows-x64

if [[ ! -d node_modules/@tauri-apps/cli ]]; then
  npm install
fi

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" && -z "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" ]]; then
  DEFAULT_KEY="${HOME}/.tauri/truerp.key"
  if [[ -f "${DEFAULT_KEY}" ]]; then
    export TAURI_SIGNING_PRIVATE_KEY_PATH="${DEFAULT_KEY}"
  else
    echo "Missing updater signing key. Set TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH," >&2
    echo "or generate one with: npx tauri signer generate -w ~/.tauri/truerp.key" >&2
    exit 1
  fi
fi
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

echo "==> Building Tauri app"
npm run tauri:build

echo "Done. Artifacts under src-tauri/target/release/bundle/"
echo "Generate updater manifest with: npm run desktop:manifest -- --version <ver> --base-url <release-url>"
