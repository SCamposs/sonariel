param([switch]$CoreOnly, [switch]$SignUpdates)
$ErrorActionPreference = 'Stop'
$previousSigningKey = $env:TAURI_SIGNING_PRIVATE_KEY
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    & '.\.venv\Scripts\python.exe' -m PyInstaller --noconfirm --clean --onedir --name sonariel-core --paths core --collect-data sonariel --distpath build/runtime --workpath build/pyinstaller --specpath build core/entry.py
    if ($LASTEXITCODE -ne 0) { throw 'Core bundle failed' }
    & '.\.venv\Scripts\python.exe' scripts/collect-notices.py
    if ($LASTEXITCODE -ne 0) { throw 'License collection failed' }
    if (-not $CoreOnly) {
        if ($SignUpdates) {
            if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
                Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
                $keyPath = Join-Path $env:USERPROFILE '.sonariel/signing/updater.key.dpapi'
                $keyBytes = [System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes($keyPath), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
                try { $env:TAURI_SIGNING_PRIVATE_KEY = [System.Text.Encoding]::UTF8.GetString($keyBytes) } finally { [Array]::Clear($keyBytes, 0, $keyBytes.Length) }
            }
            & npm.cmd run tauri build
        } else {
            & npm.cmd run tauri build -- --config src-tauri/tauri.dev-bundle.conf.json
        }
        if ($LASTEXITCODE -ne 0) { throw 'Desktop build failed' }
    }
} finally {
    if ($null -ne $previousSigningKey) { $env:TAURI_SIGNING_PRIVATE_KEY = $previousSigningKey }
    else { Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue }
    Pop-Location
}
