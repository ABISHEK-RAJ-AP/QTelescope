# Deploy Q-TeleScope on a browser Ubuntu (Guacamole / noVNC / cloud desktop)

You open a **website** → virtual Ubuntu desktop. All commands below run **inside that Ubuntu**
(Terminal), not on your laptop SSH-to-LAN style.

## 0. Open the VM desktop

1. Log into the portal URL your org gave you (Guacamole / Horizon / Proxmox console / similar).
2. Start **Ubuntu** → open **Terminal**.

## 1. Install tools (once)

```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential
# Docker (recommended)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# log out of the desktop session and back in so docker group applies
```

Node (if not using Docker for frontend build):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
python3 -m pip install --user -U pip
```

## 2. Get the code onto the VM

**Option A — Git (if repo is reachable)**

```bash
cd ~
git clone <YOUR_REPO_URL> Quantum_Monitoring
cd Quantum_Monitoring
```

**Option B — Upload from your laptop**

On your **laptop** (path to project):

```bash
cd /home/boss/Desktop
tar czf Quantum_Monitoring.tgz Quantum_Monitoring-main
# then upload Quantum_Monitoring.tgz via the portal’s file share / Guacamole SFTP / browser upload
```

Inside the **VM**:

```bash
cd ~
tar xzf Quantum_Monitoring.tgz
cd Quantum_Monitoring-main   # or whatever the folder is named
```

## 3. Live with Docker (easiest)

```bash
cd ~/Quantum_Monitoring-main   # adjust path
cp -n .env.example .env 2>/dev/null || true
# edit secrets if needed: nano .env

docker compose -f deployment/docker-compose.yml up -d --build
# if you use the postgres overlay:
# docker compose -f docker-compose.yml -f docker-compose.postgres.yml --profile postgres up -d --build
```

Open in the **VM browser** (or publish the port — see §5):

- UI: `http://127.0.0.1` (compose maps frontend `:80`)
- API: `http://127.0.0.1:8000`

```bash
docker compose -f deployment/docker-compose.yml ps
docker compose -f deployment/docker-compose.yml logs -f --tail=80 backend
```

## 4. Live without Docker (dev-style)

```bash
cd ~/Quantum_Monitoring-main

# Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export DATABASE_URL='sqlite:///./data/quantum_telemetry.db'
export USE_ALEMBIC=false
export PYTHONPATH=.
mkdir -p data
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

New terminal tab:

```bash
cd ~/Quantum_Monitoring-main/frontend
npm ci
npm run build
# preview (or serve dist with nginx)
npx vite preview --host 0.0.0.0 --port 4173
# OR for hot reload while testing:
# npm run dev -- --host 0.0.0.0 --port 5173
```

Vite must proxy API to `8000` (already in `vite.config` for `/api`).

## 5. Make it reachable outside the browser-desktop

Browser VMs often only expose published ports via the **portal**, not raw LAN IPs.

Ask the VM admin for one of:

| Method | What you do |
|---|---|
| Portal “Publish port” / reverse proxy | Publish `80` (UI) and optionally `8000` (API) |
| Nginx on VM + their HTTPS hostname | Point hostname → `127.0.0.1:80` |
| Cloudflare tunnel / frp | `cloudflared tunnel` from inside VM |

Example nginx (inside VM) if they gave you a hostname:

```bash
sudo apt install -y nginx
sudo tee /etc/nginx/sites-available/qtelescope <<'EOF'
server {
  listen 80;
  server_name _;
  location / {
    proxy_pass http://127.0.0.1:80;   # docker frontend
    proxy_set_header Host $host;
  }
  location /api/ {
    proxy_pass http://127.0.0.1:8000/api/;
    proxy_set_header Host $host;
  }
}
EOF
sudo ln -sf /etc/nginx/sites-available/qtelescope /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Update after code changes

```bash
cd ~/Quantum_Monitoring-main
git pull   # or re-upload tarball
docker compose -f deployment/docker-compose.yml up -d --build
```

## Checklist

- [ ] Terminal works inside the web desktop
- [ ] `docker` or `node`+`python` installed
- [ ] Code present under `~/…`
- [ ] `docker compose … up -d --build` healthy
- [ ] Open UI in VM browser at `http://127.0.0.1`
- [ ] Admin published port / hostname if others must hit it
