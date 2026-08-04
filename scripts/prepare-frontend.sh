#!/usr/bin/env bash
# Build a Next.js standalone server into src-tauri/resources/server
# from a staged copy of this frontend/ tree (excludes Tauri/desktop bits).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/.." && pwd)"
STAGING="${ROOT_DIR}/.staging/desktop-ui"
SERVER_OUT="${ROOT_DIR}/src-tauri/resources/server"

echo "==> Staging desktop UI copy from ${ROOT_DIR}"
rm -rf "${STAGING}"
mkdir -p "${STAGING}"

rsync -a \
  --exclude node_modules \
  --exclude .next \
  --exclude out \
  --exclude .git \
  --exclude .staging \
  --exclude src-tauri \
  --exclude splash \
  --exclude scripts \
  --exclude 'README-desktop.md' \
  --exclude '*.tsbuildinfo' \
  "${ROOT_DIR}/" "${STAGING}/"

cat > "${STAGING}/next.config.mjs" <<'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  // Desktop packaging builds a staged copy; ignore upstream type/lint debt.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Many client pages use useSearchParams without a Suspense boundary.
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
EOF

# Staging package must not pull Tauri CLI / desktop scripts into the Next build.
# Run Python from the staging directory so Windows-native Python gets a real cwd
# (Git Bash /d/... absolute paths break pathlib when interpolated as strings).
(
  cd "${STAGING}"
  python3 - <<'PY'
import json
from pathlib import Path

root = Path.cwd()
pkg_path = root / "package.json"
data = json.loads(pkg_path.read_text(encoding="utf-8"))
data["scripts"] = {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
}
# Drop Tauri CLI — not needed for Next standalone packaging.
dev = data.get("devDependencies") or {}
dev.pop("@tauri-apps/cli", None)
data["devDependencies"] = dev
pkg_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

ts_path = root / "tsconfig.json"
ts = json.loads(ts_path.read_text(encoding="utf-8"))
opts = ts.setdefault("compilerOptions", {})
opts.setdefault("target", "ES2017")
opts["downlevelIteration"] = True
ts_path.write_text(json.dumps(ts, indent=2) + "\n", encoding="utf-8")
print(f"Updated staging package.json + tsconfig under {root}")
PY
)

echo "==> Installing frontend dependencies in staging"
cd "${STAGING}"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "==> Building Next.js standalone server"
# Desktop is a thin client: bake the cloud API base URL into the UI bundle.
# Prefer HTTPS (e.g. https://api.example.com/api/v1). Absolute http://localhost:*
# can hang in the macOS WebView — use a reachable cloud/staging host for desktop builds.
if [[ -z "${NEXT_PUBLIC_API_URL:-}" ]]; then
  echo "error: NEXT_PUBLIC_API_URL is required for desktop builds." >&2
  echo "example: NEXT_PUBLIC_API_URL=https://api.example.com/api/v1 npm run desktop:prepare-ui" >&2
  exit 1
fi
case "${NEXT_PUBLIC_API_URL}" in
  http://localhost*|http://127.0.0.1*)
    echo "warning: ${NEXT_PUBLIC_API_URL} may hang in the macOS WebView; prefer a public HTTPS API URL." >&2
    ;;
esac
echo "    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"
export NEXT_PUBLIC_API_URL
npm run build

STANDALONE="${STAGING}/.next/standalone"
# Next may nest standalone under the package folder name.
if [[ ! -f "${STANDALONE}/server.js" ]]; then
  NESTED="$(find "${STANDALONE}" -maxdepth 3 -type f -name server.js 2>/dev/null | head -n 1 || true)"
  if [[ -n "${NESTED}" ]]; then
    STANDALONE="$(cd "$(dirname "${NESTED}")" && pwd)"
  fi
fi
if [[ ! -f "${STANDALONE}/server.js" ]]; then
  echo "error: standalone server.js not found under ${STAGING}/.next/standalone" >&2
  exit 1
fi

echo "==> Publishing standalone server to src-tauri/resources/server"
rm -rf "${SERVER_OUT}"
mkdir -p "${SERVER_OUT}"
rsync -a "${STANDALONE}/" "${SERVER_OUT}/"
mkdir -p "${SERVER_OUT}/.next"
rsync -a "${STAGING}/.next/static/" "${SERVER_OUT}/.next/static/"
if [[ -d "${STAGING}/public" ]]; then
  rsync -a "${STAGING}/public/" "${SERVER_OUT}/public/"
fi

echo "Done. Next.js standalone server is in ${SERVER_OUT}"
echo "(repo root reference: ${REPO_ROOT})"
