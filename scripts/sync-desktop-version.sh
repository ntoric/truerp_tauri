#!/usr/bin/env bash
# Sync frontend package / Tauri / Cargo version from a release tag (e.g. v1.2.3 → 1.2.3).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RAW="${1:-${GITHUB_REF_NAME:-}}"
if [[ -z "${RAW}" ]]; then
  echo "usage: $0 <version|vX.Y.Z>" >&2
  exit 1
fi

VERSION="${RAW#v}"
if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-].*)?$ ]]; then
  echo "error: invalid version '${RAW}' (expected semver like v1.2.3)" >&2
  exit 1
fi

echo "==> Syncing desktop version to ${VERSION}"

python3 - <<PY
import json
import re
from pathlib import Path

root = Path("${ROOT_DIR}")
version = "${VERSION}"

pkg_path = root / "package.json"
pkg = json.loads(pkg_path.read_text())
pkg["version"] = version
pkg_path.write_text(json.dumps(pkg, indent=2) + "\n")

conf_path = root / "src-tauri" / "tauri.conf.json"
conf = json.loads(conf_path.read_text())
conf["version"] = version
conf_path.write_text(json.dumps(conf, indent=2) + "\n")

cargo_path = root / "src-tauri" / "Cargo.toml"
cargo = cargo_path.read_text()
cargo_new, n = re.subn(
    r'(?m)^version\s*=\s*"[^"]*"',
    f'version = "{version}"',
    cargo,
    count=1,
)
if n != 1:
    raise SystemExit(f"failed to update version in {cargo_path}")
cargo_path.write_text(cargo_new)

print(f"Updated package.json, tauri.conf.json, Cargo.toml → {version}")
PY
