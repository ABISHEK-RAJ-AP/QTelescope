# shellcheck shell=bash
# Resolve QRP / TeleScope trees. VM default: /home/cloud/<repo>.

qrp_frontend_dir() {
  local d
  for d in \
    "${QRP_ROOT:-}" \
    /home/cloud/QuantumResourcePortal \
    "${HOME}/QuantumResourcePortal" \
    "${HOME}/cloud/QuantumResourcePortal"
  do
    if [[ -n "$d" && -d "$d/frontend" ]]; then
      cd "$d/frontend" && pwd
      return 0
    fi
  done
  return 1
}

telescope_root_dir() {
  local d
  for d in \
    "${TELESCOPE_ROOT:-}" \
    /home/cloud/QTelescope \
    /home/cloud/Quantum_Monitoring-main \
    "${HOME}/QTelescope" \
    "${HOME}/Quantum_Monitoring-main"
  do
    if [[ -n "$d" && -f "$d/app/main.py" ]]; then
      cd "$d" && pwd
      return 0
    fi
  done
  return 1
}
