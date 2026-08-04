#!/usr/bin/env bash
# Legacy helper: build a local Go API binary.
#
# TruERP desktop is now a thin client against a cloud API. This script is kept
# only for ad-hoc offline experiments and is NOT used by build-macos/windows.
set -euo pipefail

echo "note: desktop builds no longer bundle the API. Deploy backend/ as a cloud service" >&2
echo "      and set NEXT_PUBLIC_API_URL when preparing the frontend." >&2
echo "" >&2

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/.." && pwd)"
BACKEND="${REPO_ROOT}/backend"
OUT_DIR="${ROOT_DIR}/src-tauri/resources/bin"

if [[ ! -d "${BACKEND}" ]]; then
  echo "error: backend not found at ${BACKEND}" >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"

GOOS="${GOOS:-$(go env GOOS)}"
GOARCH="${GOARCH:-$(go env GOARCH)}"
EXT=""
if [[ "${GOOS}" == "windows" ]]; then
  EXT=".exe"
fi

OUT="${OUT_DIR}/truerp-api${EXT}"
echo "==> Building TruERP API for ${GOOS}/${GOARCH} -> ${OUT}"
(
  cd "${BACKEND}"
  CGO_ENABLED="${CGO_ENABLED:-1}" GOOS="${GOOS}" GOARCH="${GOARCH}" \
    go build -trimpath -ldflags="-s -w" -o "${OUT}" .
)
chmod +x "${OUT}" || true

if [[ "$(uname -s)" == "Darwin" && "${GOOS}" == "darwin" ]]; then
  echo "==> Ad-hoc codesigning ${OUT}"
  codesign --force --sign - --timestamp=none "${OUT}"
  xattr -dr com.apple.quarantine "${OUT}" 2>/dev/null || true
fi

echo "Done. API binary: ${OUT}"
echo "This binary is not packaged by the desktop thin-client build."
