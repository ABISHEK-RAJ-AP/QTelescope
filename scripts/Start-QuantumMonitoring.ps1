# Launch Q-TeleScope local dev (PostgreSQL + Redis + API + Vite) in separate terminals.
# Linux/macOS: scripts/start-dev.sh (bootstraps nvm PATH for desktop/login shells).
# Windows: native venv + Start-Process -NoExit windows.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$StartDev = Join-Path $Root "scripts" "start-dev.sh"

function Test-UnixHost {
  if ($PSVersionTable.PSEdition -eq 'Core' -and ($IsLinux -or $IsMacOS)) { return $true }
  if (Test-Path "/etc/os-release") { return $true }
  return $false
}

if ((Test-UnixHost) -or ((Test-Path $StartDev) -and (Get-Command bash -ErrorAction SilentlyContinue))) {
  if (-not (Test-Path $StartDev)) { throw "Missing $StartDev" }
  Write-Host "Starting Q-TeleScope via start-dev.sh (bootstraps npm/nvm PATH)…" -ForegroundColor Cyan
  & bash $StartDev
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    Write-Host "start-dev.sh exited $code" -ForegroundColor Red
    Read-Host "Press Enter to close"
  }
  exit $code
}

# --- Windows native ---
Set-Location $Root

function Resolve-NpmCmd {
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($npm) { return $npm.Source }
  $candidates = @(
    "$env:ProgramFiles\nodejs\npm.cmd",
    "$env:LOCALAPPDATA\fnm_multishells\*\npm.cmd",
    "$env:APPDATA\nvm\*\npm.cmd"
  )
  foreach ($pattern in $candidates) {
    $hit = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  throw "npm not found. Install Node.js LTS and reopen the terminal."
}

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

$npmCmd = Resolve-NpmCmd
Write-Host @"

Q-TeleScope (Windows) — separate terminals
  Backend:  http://127.0.0.1:8000
  Frontend: http://127.0.0.1:5173
  npm:      $npmCmd

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
  "Set-Location '$Root\frontend'; & '$npmCmd' run dev -- --host 127.0.0.1 --port 5173"
)

Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5173/"
Write-Host "API + UI started in their own windows."
Read-Host "Press Enter to close this launcher (servers keep running)"
