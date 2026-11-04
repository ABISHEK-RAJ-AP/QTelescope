#!/usr/bin/env bash
# Run ON the Guacamole/Ubuntu box that has nginx. Prints why other laptops fail.
set -euo pipefail

echo "=== nginx listen ==="
ss -lntp 2>/dev/null | grep -E ':80\s' || netstat -lntp 2>/dev/null | grep ':80' || echo "(no :80 listener — nginx not up)"

echo ""
echo "=== local healthz ==="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1/healthz || echo "FAIL local"

echo ""
echo "=== this machine IPs (other laptops must use one of these, not localhost) ==="
hostname -I 2>/dev/null || ip -4 addr show | awk '/inet /{print $2}'

echo ""
echo "=== default route / likely LAN iface ==="
ip route | awk '/default/{print}'

echo ""
echo "=== firewall ==="
if command -v ufw >/dev/null 2>&1; then
  sudo ufw status verbose || true
else
  echo "ufw not installed"
fi
sudo iptables -L INPUT -n 2>/dev/null | head -20 || true

echo ""
echo "=== Guacamole / NAT hint ==="
echo "If your IP looks like 10.x / 172.16-31.x and other office laptops are"
echo "192.168.x — they often CANNOT reach this Guacamole guest (NAT)."
echo "Fix: port-forward on Guacamole HOST, or run share-http.sh for a tunnel URL."
