$ErrorActionPreference = 'Stop'
$signingRoot = Join-Path $env:USERPROFILE '.sonariel/signing'
$encryptedKey = Join-Path $signingRoot 'updater.key.dpapi'
$plainKey = Join-Path $signingRoot 'updater.key'
if (Test-Path -LiteralPath $encryptedKey) { throw 'Signing key already exists. Never replace a published updater key.' }
if (Test-Path -LiteralPath $plainKey) { throw 'Existing plaintext key requires manual review.' }
New-Item -ItemType Directory -Path $signingRoot -Force | Out-Null
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl = Get-Acl -LiteralPath $signingRoot
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
Set-Acl -LiteralPath $signingRoot -AclObject $acl
$signerOutput = & npm.cmd run tauri signer generate -- --ci --write-keys $plainKey 2>&1
if ($LASTEXITCODE -ne 0) { throw 'Tauri signing key generation failed. Output intentionally withheld to protect key material.' }
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
$bytes = [System.IO.File]::ReadAllBytes($plainKey)
try {
    $protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [System.IO.File]::WriteAllBytes($encryptedKey, $protected)
} finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
}
$resolvedPlainKey = (Resolve-Path -LiteralPath $plainKey).Path
if ([System.IO.Path]::GetDirectoryName($resolvedPlainKey) -ne (Resolve-Path -LiteralPath $signingRoot).Path) { throw 'Unexpected generated key location' }
Remove-Item -LiteralPath $resolvedPlainKey
Write-Output 'Signing key generated and protected with Windows DPAPI. Plaintext temporary key removed.'
Write-Output 'Public key:'
Get-Content -LiteralPath ($plainKey + '.pub')
