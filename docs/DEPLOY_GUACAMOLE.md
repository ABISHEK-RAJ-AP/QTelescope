# Deploy Q-TeleScope via Apache Guacamole (browser Ubuntu)

Guacamole = website that shows a **remote Ubuntu desktop**. You do **not** SSH to a LAN IP
from your laptop for day-to-day work. You open Guacamole → Ubuntu → Terminal / Files.

```
Your laptop browser  →  Guacamole URL  →  Ubuntu desktop (VM)
                              ↑
                    build & run the app HERE
```

---

## A. What you need from your admin

Ask once (chat / ticket):

1. Guacamole login URL + username/password (or SSO)
2. Which connection = Ubuntu (often named `ubuntu`, `desktop`, `lab-vm`)
3. **How to get files in** (pick what they support):
   - Guacamole **shared drive / SFTP** (drag-drop or File Transfer)
   - **Web upload** on a portal next to Guacamole
   - **Git** from inside the VM (`git clone`)
   - USB / cloud link they allow (`wget` / `curl` a zip)
4. Whether ports **80 / 8000 / 443** are published to the internet, or only usable
   inside the Guacamole session

Without (3) you cannot move the build. Without (4) only **you** see the app inside the VM browser.

---

## B. Move the project INTO Guacamole Ubuntu

### Method 1 — Guacamole file transfer / shared drive (most common)

**On your laptop:**

```bash
cd /home/boss/Desktop
tar czf Quantum_Monitoring.tgz Quantum_Monitoring-main
# optional smaller: exclude node_modules / .venv / big caches
tar czf Quantum_Monitoring.tgz \
  --exclude='Quantum_Monitoring-main/frontend/node_modules' \
  --exclude='Quantum_Monitoring-main/.venv' \
  --exclude='Quantum_Monitoring-main/**/__pycache__' \
  --exclude='Quantum_Monitoring-main/**/.git' \
  Quantum_Monitoring-main
ls -lh Quantum_Monitoring.tgz
```

**In Guacamole:**

1. Connect to Ubuntu desktop.
2. Open **File Transfer** / device menu (often a folder or up-arrow icon on the Guacamole
   sidebar / toolbar — exact UI depends on their theme).
3. Upload `Quantum_Monitoring.tgz`.
4. In Ubuntu Terminal:

```bash
# shared files often land in one of these — try until you find the .tgz
ls ~/
ls /mnt/
ls /Downloads/ 2>/dev/null
ls /media/ 2>/dev/null
find ~ /tmp /mnt /Downloads -name 'Quantum_Monitoring.tgz' 2>/dev/null | head

# then unpack
cd ~
tar xzf Quantum_Monitoring.tgz
cd Quantum_Monitoring-main
pwd
ls
```

If upload lands in a Guacamole “Drive” folder mounted in the VM, copy it home:

```bash
cp /path/to/Quantum_Monitoring.tgz ~/
cd ~ && tar xzf Quantum_Monitoring.tgz && cd Quantum_Monitoring-main
```

### Method 2 — Git clone (if VM has internet + repo access)

Inside Guacamole Ubuntu Terminal:

```bash
cd ~
git clone https://github.com/YOUR_ORG/YOUR_REPO.git Quantum_Monitoring-main
cd Quantum_Monitoring-main
```

Private repo: use a PAT or deploy key the admin allows.

### Method 3 — Download from a link you host

On laptop: put `Quantum_Monitoring.tgz` on Google Drive / OneDrive / internal HTTP,
get a direct URL.

Inside Guacamole Terminal:

```bash
cd ~
curl -L -o Quantum_Monitoring.tgz 'PASTE_DIRECT_URL_HERE'
tar xzf Quantum_Monitoring.tgz
cd Quantum_Monitoring-main
```

---

## C. Build & run inside Guacamole (Docker — recommended)

Still in Guacamole Ubuntu Terminal:

```bash
# once per VM
sudo apt update
sudo apt install -y curl ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

**Log out of the Guacamole desktop connection and reconnect** (so `docker` group applies).

```bash
cd ~/Quantum_Monitoring-main
docker compose -f deployment/docker-compose.yml up -d --build
docker compose -f deployment/docker-compose.yml ps
```

**Open Firefox/Chrome inside Guacamole Ubuntu:**

- App UI: `http://127.0.0.1`   (or `http://localhost`)
- API docs (if enabled): `http://127.0.0.1:8000/docs`

You are browsing **localhost of the VM**, which is correct.

Update later:

```bash
cd ~/Quantum_Monitoring-main
# re-upload new .tgz OR git pull
docker compose -f deployment/docker-compose.yml up -d --build
```

---

## D. Without Docker (if admin blocks Docker)

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm

cd ~/Quantum_Monitoring-main
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
mkdir -p data
export DATABASE_URL='sqlite:///./data/quantum_telemetry.db'
export USE_ALEMBIC=false
export PYTHONPATH=.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

New Terminal tab in Guacamole:

```bash
cd ~/Quantum_Monitoring-main/frontend
npm ci
npm run build
npx vite preview --host 0.0.0.0 --port 4173
```

Open in VM browser: `http://127.0.0.1:4173`  
(Ensure Vite proxies `/api` to `:8000` — already configured in this repo.)

---

## E. “Go live” for other people

| Who | How |
|---|---|
| **Only you** | Guacamole → Ubuntu → browser → `http://127.0.0.1` |
| **Anyone with Guacamole login** | Same: they open Guacamole, same Ubuntu (or their own), same URL **if** they share the VM |
| **Public / org HTTPS URL** | Admin must publish port **80** (and usually reverse-proxy `/api` → `8000`) on their gateway |

Guacamole itself is **not** your app URL. Flow for outsiders is usually:

```
https://apps.company.com/qtelescope  →  (admin reverse proxy)  →  VM:80 / VM:8000
```

You cannot invent that hostname from inside Guacamole alone — admin publishes it.

---

## F. Mental model (don’t mix these)

| Wrong mental model | Right for Guacamole |
|---|---|
| `scp user@192.168.x.x:…` from laptop | Upload via Guacamole file transfer / git / URL |
| “LAN IP of the VM” | Often **not** routed to your laptop; only Guacamole gateway is |
| App runs on Guacamole server | App runs **inside** the Ubuntu session Guacamole displays |
| Share Guacamole URL as the product | Product URL is separate (published 80/443) unless users all use Guacamole |

---

## G. Quick checklist

1. [ ] Log into Guacamole → Ubuntu desktop
2. [ ] Pack `Quantum_Monitoring.tgz` on laptop
3. [ ] Upload into Guacamole → find file in Ubuntu → `tar xzf`
4. [ ] Install Docker → reconnect session
5. [ ] `docker compose -f deployment/docker-compose.yml up -d --build`
6. [ ] VM browser: `http://127.0.0.1`
7. [ ] Ask admin to publish HTTPS if others need access without Guacamole
