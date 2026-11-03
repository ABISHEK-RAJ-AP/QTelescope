# Launch Q-TeleScope local dev (PostgreSQL + Redis + API + Vite) in separate terminals.
# Linux/macOS: scripts/start-dev.sh (opens gnome-terminal windows that stay open).
# Windows: native venv + Start-Process -NoExit windows.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$StartDev = Join-Path $Root "scripts" "start-dev.sh"

function Test-BashLauncher {
  if ($IsLinux -or $IsMacOS) { return $true }
  return [bool](Get-Command bash -ErrorAction SilentlyContinue)
}

if (Test-BashLauncher) {
  if (-not (Test-Path $StartDev)) { throw "Missing $StartDev" }
  # -NoExit equivalent: bash script pauses at end. Run under bash so desktop click does not vanish silently.
  & bash $StartDev
  if ($LASTEXITCODE -ne 0) {
    Write-Host "start-dev.sh exited $LASTEXITCODE" -ForegroundColor Red
    Read-Host "Press Enter to close"
  }
  exit $LASTEXITCODE
}

# --- Windows native ---
Set-Location $Root

if (-not (Test-Path (Join-Path $Root ".env"))) {
  Copy-Item (Join-Path $Root "backend" ".env.example") (Join-Path $Root ".env")
  Write-Host "Created .env from backend/.env.example — set DATABASE_URL and REDIS_URL for Postgres/Redis."
}

$venv = Join-Path $Root ".venv" "Scripts" "Activate.ps1"
if (-not (Test-Path $venv)) {
  python -m venv .venv
}
. $venv
pip install -q -r (Join-Path $Root "backend" "requirements.txt") 2>$null

Get-Content (Join-Path $Root ".env") | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    $name = $matches[1].Trim()
    $val = $matches[2].Trim().Trim('"')
    Set-Item -Path "env:$name" -Value $val
  }
}

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql+psycopg2://postgres:root@localhost:5432/quantum_telemetry"
}
if (-not $env:REDIS_URL) {
  $env:REDIS_URL = "redis://localhost:6379/0"
}
$env:USE_ALEMBIC = "true"
$env:COLLECTION_SCHEDULER_ENABLED = "false"
$env:PYTHONPATH = $Root

Write-Host @"

Q-TeleScope (Windows) — separate terminals
  Backend:  http://127.0.0.1:8000
  Frontend: http://127.0.0.1:5173

Ensure PostgreSQL and Redis match .env before login.

"@

# Redis helper window (informational — install Redis for Windows or use WSL)
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  @"
Write-Host 'Redis check (optional helper)'
try { redis-cli ping } catch { Write-Host 'redis-cli not found — start Redis yourself if REDIS_URL points at localhost:6379' -ForegroundColor Yellow }
Write-Host 'Leave this open or close after Redis is up.'
"@
)

Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  @"
Set-Location '$Root'
Get-Content .env | ForEach-Object { if (`$_ -match '^\s*([^#=]+)=(.*)$') { Set-Item env:`$(`$matches[1].Trim()) `$matches[2].Trim().Trim('\"') } }
`$env:PYTHONPATH='.'
`$env:COLLECTION_SCHEDULER_ENABLED='false'
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
"@
)

Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$Root\frontend'; npm run dev -- --host 127.0.0.1 --port 5173"
)

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5173/"
Write-Host "API + UI started in their own windows."
Read-Host "Press Enter to close this launcher (servers keep running)"
