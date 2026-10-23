param([switch]$CoreOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    & '.\.venv\Scripts\python.exe' -m PyInstaller --noconfirm --clean --onedir --name sonariel-core --paths core --collect-data sonariel --distpath build/runtime --workpath build/pyinstaller --specpath build core/entry.py
    if ($LASTEXITCODE -ne 0) { throw 'Core bundle failed' }
    & '.\.venv\Scripts\python.exe' scripts/collect-notices.py
    if ($LASTEXITCODE -ne 0) { throw 'License collection failed' }
    if (-not $CoreOnly) {
        & npm.cmd run tauri build
        if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed' }
    }
} finally { Pop-Location }
