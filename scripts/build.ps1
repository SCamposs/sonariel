param([switch]$CoreOnly, [switch]$SignUpdates)
$ErrorActionPreference = 'Stop'
$previousSigningKey = $env:TAURI_SIGNING_PRIVATE_KEY
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    # PyInstaller --noconfirm removes the previous onedir tree before copying.
    # Refuse before touching any files if a shared core still owns that runtime.
    $runtimeExecutable = Join-Path $root 'build/runtime/sonariel-core/sonariel-core.exe'
    if (Get-Process -Name sonariel-core -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $runtimeExecutable }) {
        throw 'Build runtime is in use. Finish its queue/MCP and shut down that development core, or build to a separate output directory. No process was stopped.'
    }
    & cargo build --release --locked --manifest-path native/fx/Cargo.toml
    if ($LASTEXITCODE -ne 0) { throw 'Native DSP build failed' }
    $nativeFx = Join-Path $root 'native/fx/target/release/sonariel-fx.exe'
    $voiceWorker = Join-Path $root 'core/sonariel/recipes/voice_worker.py'
    $stableWorker = Join-Path $root 'core/sonariel/recipes/stable_worker.py'
    & '.\.venv\Scripts\python.exe' -m PyInstaller --noconfirm --clean --onedir --name sonariel-core --paths core --collect-data sonariel --add-data "$voiceWorker;sonariel/recipes" --add-data "$stableWorker;sonariel/recipes" --add-binary "$nativeFx;sonariel/bin" --distpath build/runtime --workpath build/pyinstaller --specpath build core/entry.py
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
