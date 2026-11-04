# Launch Quantum Resource Portal (QRP): infra + API :8000 + portal UI :5176 in separate terminals.
# Linux/macOS: scripts/start-qrp.sh (bootstraps nvm PATH for desktop/login shells).
# Windows: Start-Process -NoExit for API + QRP Vite.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$StartQrp = Join-Path $Root "scripts" "start-qrp.sh"
$QrpFe = Join-Path $Root "quantum-resource-portal" "frontend"

function Test-UnixHost {
  if ($PSVersionTable.PSEdition -eq 'Core' -and ($IsLinux -or $IsMacOS)) { return $true }
  if ($env:OSTYPE -match 'linux|darwin') { return $true }
  if (Test-Path "/etc/os-release") { return $true }
  return $false
}

# Prefer bash launcher on Unix (or whenever bash + start-qrp.sh are available).
# Avoids Windows-branch "npm not found" when a .ps1 is double-clicked on Linux.
$hasBash = [bool](Get-Command bash -ErrorAction SilentlyContinue)
if ((Test-UnixHost) -or ((Test-Path $StartQrp) -and $hasBash)) {
  if (-not (Test-Path $StartQrp)) { throw "Missing $StartQrp" }
  Write-Host "Starting QRP via start-qrp.sh (bootstraps npm/nvm PATH)…" -ForegroundColor Cyan
  & bash $StartQrp
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    Write-Host "start-qrp.sh exited $code" -ForegroundColor Red
    Read-Host "Press Enter to close"
  }
  exit $code
}

# --- Windows native ---
if (-not (Test-Path $QrpFe)) { throw "Missing $QrpFe" }
Set-Location $Root

function Resolve-NpmCmd {
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) { return $npm.Source }
  $candidates = @(
    "$env:ProgramFiles\nodejs\npm.cmd",
    "$env:LOCALAPPDATA\fnm_multishells\*\npm.cmd",
    "$env:APPDATA\nvm\*\npm.cmd",
    "$env:USERPROFILE\.nvm\*\npm.cmd"
  )
  foreach ($pattern in $candidates) {
    $hit = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  throw "npm not found. Install Node.js LTS and reopen the terminal."
}

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

$npmCmd = Resolve-NpmCmd
Write-Host @"

QRP (Windows) — separate terminals
  API:    http://127.0.0.1:8000
  Portal: http://127.0.0.1:5176/qrp
  npm:    $npmCmd

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
  "Set-Location '$QrpFe'; & '$npmCmd' run dev -- --host 127.0.0.1 --port 5176"
)

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5176/qrp"
Write-Host "API + QRP UI started in their own windows."
Read-Host "Press Enter to close this launcher (servers keep running)"
