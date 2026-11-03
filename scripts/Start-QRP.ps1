# Launch Quantum Resource Portal (QRP): infra + API :8000 + portal UI :5176 in separate terminals.
# Linux/macOS: scripts/start-qrp.sh
# Windows: Start-Process -NoExit for API + QRP Vite.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$StartQrp = Join-Path $Root "scripts" "start-qrp.sh"
$QrpFe = Join-Path $Root "quantum-resource-portal" "frontend"

function Test-BashLauncher {
  if ($IsLinux -or $IsMacOS) { return $true }
  return [bool](Get-Command bash -ErrorAction SilentlyContinue)
}

if (Test-BashLauncher) {
  if (-not (Test-Path $StartQrp)) { throw "Missing $StartQrp" }
  & bash $StartQrp
  if ($LASTEXITCODE -ne 0) {
    Write-Host "start-qrp.sh exited $LASTEXITCODE" -ForegroundColor Red
    Read-Host "Press Enter to close"
  }
  exit $LASTEXITCODE
}

# --- Windows native ---
if (-not (Test-Path $QrpFe)) { throw "Missing $QrpFe" }
Set-Location $Root

if (-not (Test-Path (Join-Path $Root ".env"))) {
  Copy-Item (Join-Path $Root "backend" ".env.example") (Join-Path $Root ".env")
  Write-Host "Created .env from backend/.env.example"
}

$venv = Join-Path $Root ".venv" "Scripts" "Activate.ps1"
if (-not (Test-Path $venv)) { python -m venv .venv }
. $venv
pip install -q -r (Join-Path $Root "backend" "requirements.txt") 2>$null

Get-Content (Join-Path $Root ".env") | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    Set-Item -Path ("env:" + $matches[1].Trim()) -Value $matches[2].Trim().Trim('"')
  }
}
if (-not $env:DATABASE_URL) { $env:DATABASE_URL = "postgresql+psycopg2://postgres:root@localhost:5432/quantum_telemetry" }
if (-not $env:REDIS_URL) { $env:REDIS_URL = "redis://localhost:6379/0" }
$env:COLLECTION_SCHEDULER_ENABLED = "false"
$env:PYTHONPATH = $Root

Write-Host @"

QRP (Windows) — separate terminals
  API:    http://127.0.0.1:8000
  Portal: http://127.0.0.1:5176/qrp

"@

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
  "Set-Location '$QrpFe'; npm run dev -- --host 127.0.0.1 --port 5176"
)

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5176/qrp"
Write-Host "API + QRP UI started in their own windows."
Read-Host "Press Enter to close this launcher (servers keep running)"
