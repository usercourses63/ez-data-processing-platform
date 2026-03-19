# Assemble EZ Platform deployment package from dist/ image tars
#
# Usage:
#   pwsh -File scripts/assemble-package.ps1 [-Version <version>] [-OutputBase <path>]
#
# Example:
#   pwsh -File scripts/assemble-package.ps1 -Version v0.2.0 -OutputBase dist

param(
    [string]$Version = "v0.0.0",
    [string]$OutputBase = "dist"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

# Resolve relative to repo root
if (-not [System.IO.Path]::IsPathRooted($OutputBase)) {
    $OutputBase = Join-Path $RepoRoot $OutputBase
}

$Timestamp = (Get-Date -Format "yyyyMMdd-HHmmss")
$PkgName = "deployment-$Version-$Timestamp"
$PkgDir = Join-Path $OutputBase $PkgName

Write-Host "Assembling deployment package: $PkgName" -ForegroundColor Cyan

# Require dist/images/ populated by prior scripts
$ServicesDir = Join-Path $OutputBase "images\services"
if (-not (Test-Path $ServicesDir)) {
    Write-Error "$ServicesDir not found. Run build-all-images.ps1 first."
    exit 1
}

# Create package structure
New-Item -ItemType Directory -Force -Path (Join-Path $PkgDir "images\services") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $PkgDir "images\infrastructure") | Out-Null

# Copy image tars
$serviceTars = Get-ChildItem (Join-Path $OutputBase "images\services\*.tar") -ErrorAction SilentlyContinue
foreach ($tar in $serviceTars) { Copy-Item $tar.FullName (Join-Path $PkgDir "images\services\") }

$infraTars = Get-ChildItem (Join-Path $OutputBase "images\infrastructure\*.tar") -ErrorAction SilentlyContinue
foreach ($tar in $infraTars) { Copy-Item $tar.FullName (Join-Path $PkgDir "images\infrastructure\") }

# Copy Helm chart
New-Item -ItemType Directory -Force -Path (Join-Path $PkgDir "helm") | Out-Null
Copy-Item -Recurse (Join-Path $RepoRoot "helm\ez-platform") (Join-Path $PkgDir "helm\")

# Copy values file
Copy-Item (Join-Path $RepoRoot "helm\ez-platform\values-local.yaml") (Join-Path $PkgDir "values-local.yaml")

# Copy install scripts
Copy-Item (Join-Path $RepoRoot "release-package\install.ps1") (Join-Path $PkgDir "install.ps1")

# Copy IMAGE-MANIFEST.txt
Copy-Item (Join-Path $RepoRoot "release-package\IMAGE-MANIFEST.txt") (Join-Path $PkgDir "IMAGE-MANIFEST.txt")

# Copy DEPLOYMENT-GUIDE.md
$readme = Join-Path $RepoRoot "release-package\README.md"
if (Test-Path $readme) {
    Copy-Item $readme (Join-Path $PkgDir "DEPLOYMENT-GUIDE.md")
}

Write-Host "Package assembled at: $PkgDir" -ForegroundColor Green
Write-Host "Contents:" -ForegroundColor Cyan
Get-ChildItem -Recurse $PkgDir | Where-Object { -not $_.PSIsContainer } |
    Select-Object @{N='File';E={$_.FullName.Replace($PkgDir,'').TrimStart('\')}} |
    Format-Table -AutoSize

# Output package name for scripts that chain from this one
Write-Host "PKG_NAME=$PkgName"
Write-Host "PKG_DIR=$PkgDir"
