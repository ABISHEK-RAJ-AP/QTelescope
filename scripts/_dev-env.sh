# Shared PATH bootstrap for desktop / login-shell launchers.
# Source from start-qrp.sh / start-dev.sh before any `npm` / `python` checks.
# Desktop .desktop files use `bash -lc` which often skips ~/.bashrc (where nvm lives).

# Miniforge / conda-style python
if [[ -d "${MINIFORGE_BIN:-$HOME/miniforge3/bin}" ]]; then
  export PATH="${MINIFORGE_BIN:-$HOME/miniforge3/bin}:${PATH:-}"
fi
if [[ -d "$HOME/miniconda3/bin" ]]; then
  export PATH="$HOME/miniconda3/bin:$PATH"
fi
if [[ -d "$HOME/anaconda3/bin" ]]; then
  export PATH="$HOME/anaconda3/bin:$PATH"
fi

# nvm (prefer sourcing; fall back to newest installed node bin)
if ! command -v npm >/dev/null 2>&1; then
  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
  fi
fi
if ! command -v npm >/dev/null 2>&1; then
  _nvm_bin="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "${_nvm_bin:-}" && -x "$_nvm_bin/npm" ]]; then
    export PATH="$_nvm_bin:$PATH"
  fi
  unset _nvm_bin
fi

# fnm / volta / asdf (best-effort)
if ! command -v npm >/dev/null 2>&1 && [[ -x "$HOME/.local/share/fnm/fnm" ]]; then
  eval "$("$HOME/.local/share/fnm/fnm" env)" >/dev/null 2>&1 || true
fi
if ! command -v npm >/dev/null 2>&1 && [[ -x "$HOME/.volta/bin/npm" ]]; then
  export PATH="$HOME/.volta/bin:$PATH"
fi
if ! command -v npm >/dev/null 2>&1 && [[ -d "$HOME/.asdf/shims" ]]; then
  export PATH="$HOME/.asdf/shims:$PATH"
fi

# User-local bins last-resort prepend for tools installed via npm -g without nvm
if [[ -d "$HOME/.local/bin" ]]; then
  export PATH="$HOME/.local/bin:$PATH"
fi
