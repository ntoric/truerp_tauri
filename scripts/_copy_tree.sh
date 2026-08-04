#!/usr/bin/env bash
# Portable directory sync for desktop packaging scripts.
#
# Native Windows rsync (Chocolatey/cwRsync) breaks under Git Bash: MSYS converts
# /d/... paths to D:/..., and rsync treats "D:" as a remote host →
# "The source and destination cannot both be remote."
#
# Prefer rsync on Unix. On Windows (or when rsync is missing), use tar with
# relative paths so no drive-letter remote parsing occurs.

_is_windows_shell() {
  case "$(uname -s 2>/dev/null || true)" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

# copy_tree SRC DST [--exclude PATTERN ...]
# Copies contents of SRC into DST (DST is created). Like: rsync -a SRC/ DST/
copy_tree() {
  local src="${1:?copy_tree: src required}"
  local dst="${2:?copy_tree: dst required}"
  shift 2

  local -a excludes=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --exclude)
        [[ $# -ge 2 ]] || { echo "copy_tree: --exclude needs a pattern" >&2; return 1; }
        excludes+=("$2")
        shift 2
        ;;
      --exclude=*)
        excludes+=("${1#--exclude=}")
        shift
        ;;
      *)
        echo "copy_tree: unknown argument: $1" >&2
        return 1
        ;;
    esac
  done

  if [[ ! -d "${src}" ]]; then
    echo "copy_tree: source is not a directory: ${src}" >&2
    return 1
  fi
  mkdir -p "${dst}"

  if command -v rsync >/dev/null 2>&1 && ! _is_windows_shell; then
    local -a rsync_args=(-a)
    local pattern
    if ((${#excludes[@]})); then
      for pattern in "${excludes[@]}"; do
        rsync_args+=(--exclude "${pattern}")
      done
    fi
    rsync "${rsync_args[@]}" "${src}/" "${dst}/"
    return
  fi

  local -a tar_args=(-cf -)
  local pattern
  if ((${#excludes[@]})); then
    for pattern in "${excludes[@]}"; do
      tar_args+=(--exclude="${pattern}")
    done
  fi
  tar_args+=(.)

  # Relative cwd paths avoid MSYS drive-letter conversion issues.
  (
    cd "${src}"
    tar "${tar_args[@]}"
  ) | (
    cd "${dst}"
    tar -xf -
  )
}
