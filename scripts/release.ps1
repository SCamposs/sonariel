param([switch]$Publish, [switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    if ($Publish) {
        if ((& git status --porcelain)) { throw 'Commit validated changes before publishing a release.' }
        if ((& git branch --show-current) -ne 'main') { throw 'Release publication requires main.' }
        if ((& git remote get-url origin) -ne 'https://github.com/SCamposs/sonariel.git') { throw 'Unexpected release remote.' }
    }
    if (-not $SkipBuild) { & scripts/build.ps1 -SignUpdates }
    & .venv/Scripts/python.exe scripts/prepare-release.py
    if ($LASTEXITCODE -ne 0) { throw 'Release preparation failed' }
    $version = (Get-Content -Raw package.json | ConvertFrom-Json).version
    $releaseRoot = Join-Path $env:USERPROFILE ".sonariel/releases/$version"
    if ($Publish) {
        & .venv/Scripts/python.exe scripts/audit-publication.py
        if ($LASTEXITCODE -ne 0) { throw 'Publication hygiene check failed' }
        $remoteHead = (& git ls-remote origin refs/heads/main).Split("`t")[0]
        if ((& git rev-parse HEAD) -ne $remoteHead) { throw 'Push the reviewed main commit first.' }
        & git tag "v$version"
        if ($LASTEXITCODE -ne 0) { throw 'Tag already exists or could not be created; do not overwrite release tags.' }
        & git push origin "v$version"
        if ($LASTEXITCODE -ne 0) { throw 'Tag push failed' }
        & gh release create "v$version" --repo SCamposs/sonariel --verify-tag --title "Sonariel v$version" --notes-file "docs/releases/v$version.md" (Join-Path $releaseRoot "Sonariel_${version}_x64-setup.exe") (Join-Path $releaseRoot "Sonariel_${version}_x64-setup.exe.sig") (Join-Path $releaseRoot 'latest.json') (Join-Path $releaseRoot 'SHA256SUMS.txt') (Join-Path $releaseRoot 'LICENSE.txt')
        if ($LASTEXITCODE -ne 0) { throw 'Release publication failed; inspect the existing tag/release before retrying.' }
    }
} finally { Pop-Location }
