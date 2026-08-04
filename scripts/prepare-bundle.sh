#!/usr/bin/env bash
# Stage install payload: slim Node.js + runtime assets into src-tauri/resources.
# AI embedding models are intentionally never bundled.
#
# Usage: ./scripts/prepare-bundle.sh [darwin-arm64|darwin-x64|windows-x64|skip-node]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT_DIR}/.." && pwd)"
RES_DIR="${ROOT_DIR}/src-tauri/resources"
# Full semver required for nodejs.org/dist/vX.Y.Z/... URLs.
# Do NOT reuse CI's NODE_VERSION=20 (setup-node major) — that 404s.
DEFAULT_BUNDLED_NODE_VERSION="20.18.1"
BUNDLED_NODE_VERSION="${BUNDLED_NODE_VERSION:-}"
if [[ -z "${BUNDLED_NODE_VERSION}" ]]; then
  if [[ "${NODE_VERSION:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    BUNDLED_NODE_VERSION="${NODE_VERSION}"
  else
    BUNDLED_NODE_VERSION="${DEFAULT_BUNDLED_NODE_VERSION}"
  fi
fi
TARGET="${1:-}"

# shellcheck source=_copy_tree.sh
source "${ROOT_DIR}/scripts/_copy_tree.sh"

if [[ -z "${TARGET}" ]]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) TARGET="darwin-arm64" ;;
    Darwin-x86_64) TARGET="darwin-x64" ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT*) TARGET="windows-x64" ;;
    *) TARGET="darwin-arm64" ;;
  esac
fi

mkdir -p "${RES_DIR}/runtime" "${RES_DIR}/node"

echo "==> AI models are not packaged (by design)"

HSN_SRC=""
for candidate in \
  "${ROOT_DIR}/HSN_DATASET.csv" \
  "${ROOT_DIR}/src-tauri/resources/HSN_DATASET.csv" \
  "${REPO_ROOT}/HSN_DATASET.csv" \
  "${REPO_ROOT}/backend/HSN_DATASET.csv"
do
  if [[ -f "${candidate}" ]]; then
    HSN_SRC="${candidate}"
    break
  fi
done

if [[ -n "${HSN_SRC}" ]]; then
  echo "==> Copying HSN_DATASET.csv from ${HSN_SRC}"
  cp "${HSN_SRC}" "${RES_DIR}/HSN_DATASET.csv"
  cp "${HSN_SRC}" "${RES_DIR}/runtime/HSN_DATASET.csv"
else
  echo "warning: HSN_DATASET.csv not found"
fi

: > "${RES_DIR}/runtime/.keep"

slim_nodejs() {
  local root="$1"
  local os="$2"

  echo "==> Slimming Node.js runtime"
  rm -rf "${RES_DIR}/node"
  if [[ "${os}" == "windows" ]]; then
    mkdir -p "${RES_DIR}/node"
    cp "${root}/node.exe" "${RES_DIR}/node/node.exe"
    [[ -f "${root}/LICENSE" ]] && cp "${root}/LICENSE" "${RES_DIR}/node/LICENSE"
  else
    mkdir -p "${RES_DIR}/node/bin"
    cp "${root}/bin/node" "${RES_DIR}/node/bin/node"
    chmod +x "${RES_DIR}/node/bin/node"
    [[ -f "${root}/LICENSE" ]] && cp "${root}/LICENSE" "${RES_DIR}/node/LICENSE"
  fi
}

if [[ "${TARGET}" != "skip-node" ]]; then
  echo "==> Fetching portable Node.js ${BUNDLED_NODE_VERSION} (${TARGET})"
  TMP_DIR="$(mktemp -d)"
  cleanup() { rm -rf "${TMP_DIR}"; }
  trap cleanup EXIT

  case "${TARGET}" in
    windows-x64|windows/amd64)
      ARCHIVE="node-v${BUNDLED_NODE_VERSION}-win-x64.zip"
      URL="https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/${ARCHIVE}"
      echo "    ${URL}"
      curl -fsSL "${URL}" -o "${TMP_DIR}/${ARCHIVE}"
      if command -v unzip >/dev/null 2>&1; then
        unzip -q "${TMP_DIR}/${ARCHIVE}" -d "${TMP_DIR}"
      else
        (
          cd "${TMP_DIR}"
          ARCHIVE_NAME="${ARCHIVE}" python3 - <<'PY'
import os
import zipfile
from pathlib import Path

root = Path.cwd()
archive = root / os.environ["ARCHIVE_NAME"]
zipfile.ZipFile(archive).extractall(root)
PY
        )
      fi
      slim_nodejs "${TMP_DIR}/node-v${BUNDLED_NODE_VERSION}-win-x64" windows
      ;;
    darwin-arm64)
      ARCHIVE="node-v${BUNDLED_NODE_VERSION}-darwin-arm64.tar.gz"
      URL="https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/${ARCHIVE}"
      echo "    ${URL}"
      curl -fsSL "${URL}" -o "${TMP_DIR}/${ARCHIVE}"
      tar -xzf "${TMP_DIR}/${ARCHIVE}" -C "${TMP_DIR}"
      slim_nodejs "${TMP_DIR}/node-v${BUNDLED_NODE_VERSION}-darwin-arm64" darwin
      ;;
    darwin-x64)
      ARCHIVE="node-v${BUNDLED_NODE_VERSION}-darwin-x64.tar.gz"
      URL="https://nodejs.org/dist/v${BUNDLED_NODE_VERSION}/${ARCHIVE}"
      echo "    ${URL}"
      curl -fsSL "${URL}" -o "${TMP_DIR}/${ARCHIVE}"
      tar -xzf "${TMP_DIR}/${ARCHIVE}" -C "${TMP_DIR}"
      slim_nodejs "${TMP_DIR}/node-v${BUNDLED_NODE_VERSION}-darwin-x64" darwin
      ;;
    *)
      echo "error: unsupported target '${TARGET}'" >&2
      exit 1
      ;;
  esac
  trap - EXIT
  rm -rf "${TMP_DIR}"
else
  echo "Skipping Node download (will use system node at runtime)"
fi

# Remove any previously bundled local API binary (cloud API is used instead).
rm -rf "${RES_DIR}/bin"

if [[ ! -f "${RES_DIR}/server/server.js" ]]; then
  if [[ -f "${REPO_ROOT}/desktop/frontend/server/server.js" ]]; then
    echo "==> Reusing existing desktop/frontend/server"
    mkdir -p "${RES_DIR}/server"
    copy_tree "${REPO_ROOT}/desktop/frontend/server" "${RES_DIR}/server"
  else
    echo "warning: frontend server missing — run npm run desktop:prepare-ui with NEXT_PUBLIC_API_URL set"
  fi
fi

echo "==> Resource size summary"
du -sh "${RES_DIR}" "${RES_DIR}"/* 2>/dev/null | sort -hr || true
echo "Resources staged at ${RES_DIR}"
