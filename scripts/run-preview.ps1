param(
    [string]$ApplicationDirectory = (Join-Path $env:USERPROFILE 'SonarielPreview/0.3.2'),
    [string]$DataHome = (Join-Path $env:USERPROFILE '.sonariel-preview')
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$appRoot = [IO.Path]::GetFullPath($ApplicationDirectory)
$dataRoot = [IO.Path]::GetFullPath($DataHome)
$stableRoot = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.sonariel'))
if ($dataRoot -eq $stableRoot -or $dataRoot.StartsWith($stableRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Choose a separate preview data directory, not the stable profile.'
}
if ($appRoot -eq [IO.Path]::GetPathRoot($appRoot) -or $appRoot -eq $env:USERPROFILE) { throw 'Choose a dedicated application folder.' }
$sourceExe = Join-Path $repo 'src-tauri/target/release/sonariel.exe'
$sourceRuntime = Join-Path $repo 'build/runtime/sonariel-core'
if (-not (Test-Path -LiteralPath $sourceExe) -or -not (Test-Path -LiteralPath $sourceRuntime)) { throw 'Run scripts/build.ps1 first.' }
if (Get-Process -Name sonariel -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq (Join-Path $appRoot 'sonariel.exe') }) {
    throw 'This preview is open. Close its window before refreshing these application files; no process was stopped.'
}
$marker = Join-Path $appRoot 'sonariel-preview.marker'
if ((Test-Path -LiteralPath $appRoot) -and (Get-ChildItem -LiteralPath $appRoot -Force) -and -not (Test-Path -LiteralPath $marker)) { throw 'Non-empty unowned application folder; preserved.' }
New-Item -ItemType Directory -Force -Path $appRoot | Out-Null
New-Item -ItemType File -Force -Path $marker | Out-Null
$targetExe = Join-Path $appRoot 'sonariel.exe'
$refresh = -not (Test-Path -LiteralPath $targetExe)
if (-not $refresh) { $refresh = (Get-FileHash -LiteralPath $sourceExe).Hash -ne (Get-FileHash -LiteralPath $targetExe).Hash }
foreach ($file in (Get-ChildItem -LiteralPath $sourceRuntime -Recurse -File)) {
    $relative = $file.FullName.Substring($sourceRuntime.Length + 1)
    $target = Join-Path (Join-Path $appRoot 'runtime') $relative
    if (-not (Test-Path -LiteralPath $target) -or (Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $target).Hash) { $refresh = $true; break }
}
if ($refresh) {
    $runtimeExe = Join-Path $appRoot 'runtime/sonariel-core.exe'
    if (Get-Process -Name sonariel-core -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $runtimeExe }) {
        throw 'Preview core still owns runtime files. Finish its queue/MCP and shut it down before refreshing. No process was stopped.'
    }
    Copy-Item -LiteralPath $sourceExe -Destination $targetExe -Force
    New-Item -ItemType Directory -Force -Path (Join-Path $appRoot 'runtime') | Out-Null
    Get-ChildItem -LiteralPath $sourceRuntime -Force | Copy-Item -Destination (Join-Path $appRoot 'runtime') -Recurse -Force
}
$previousHome = $env:SONARIEL_HOME
try {
    $env:SONARIEL_HOME = $dataRoot
    Start-Process -FilePath (Join-Path $appRoot 'sonariel.exe') -WorkingDirectory $appRoot -WindowStyle Hidden
    Write-Output "Preview application: $appRoot"
    Write-Output "Isolated data: $dataRoot"
} finally {
    if ($null -eq $previousHome) { Remove-Item Env:SONARIEL_HOME -ErrorAction SilentlyContinue }
    else { $env:SONARIEL_HOME = $previousHome }
}
