# shellcheck shell=bash
# Shared PATH bootstrap for desktop / non-interactive launchers.
# Login shells (bash -lc from .desktop) often lack nvm → "npm not found".
# Source from start-*.sh before checking npm.

# Miniforge / conda
export PATH="${MINIFORGE_BIN:-$HOME/miniforge3/bin}:${PATH:-}"

# nvm (preferred: source; fallback: newest installed node bin)
if [[ -z "${NPM_BOOTSTRAPPED:-}" ]]; then
  if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 || true
  elif [[ -d "$HOME/.nvm/versions/node" ]]; then
    _node_bin="$(ls -1d "$HOME/.nvm/versions/node"/v*/bin 2>/dev/null | sort -V | tail -1 || true)"
    if [[ -n "${_node_bin:-}" && -x "$_node_bin/npm" ]]; then
      export PATH="$_node_bin:$PATH"
    fi
    unset _node_bin
  fi

  # Common extras
  [[ -d "$HOME/.local/bin" ]] && export PATH="$HOME/.local/bin:$PATH"
  [[ -d /usr/local/bin ]] && export PATH="/usr/local/bin:$PATH"

  export NPM_BOOTSTRAPPED=1
fi
