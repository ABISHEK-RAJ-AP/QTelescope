# shellcheck shell=bash
# Source from launchers so desktop / non-login shells find npm + Python.
# Desktop .desktop often runs with a stripped PATH (no nvm).

_qt_ensure_dev_path() {
  # Miniforge (local Postgres/Redis helpers + python)
  local mf="${MINIFORGE_BIN:-$HOME/miniforge3/bin}"
  if [[ -d "$mf" ]]; then
    case ":${PATH:-}:" in
      *":$mf:"*) ;;
      *) export PATH="$mf:${PATH:-}" ;;
    esac
  fi

  # nvm (default / latest installed node)
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi

  # Direct nvm version bin (works even if nvm.sh fails in restricted shells)
  if ! command -v npm >/dev/null 2>&1; then
    local npm_bin=""
    npm_bin="$(ls -1d "$HOME"/.nvm/versions/node/*/bin/npm 2>/dev/null | tail -1 || true)"
    if [[ -n "$npm_bin" && -x "$npm_bin" ]]; then
      export PATH="$(dirname "$npm_bin"):${PATH:-}"
    fi
  fi

  # Common system locations
  for d in /usr/local/bin "$HOME/.local/bin" "$HOME/bin"; do
    if [[ -x "$d/npm" ]]; then
      case ":${PATH:-}:" in
        *":$d:"*) ;;
        *) export PATH="$d:${PATH:-}" ;;
      esac
    fi
  done
}

_qt_ensure_dev_path
unset -f _qt_ensure_dev_path
