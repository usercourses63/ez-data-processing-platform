<#
.SYNOPSIS
    Verifies synchronization between development k8s/ and release-package k8s/

.DESCRIPTION
    This script compares development k8s manifests with release-package k8s manifests to ensure:
    1. File counts match
    2. SecurityContext presence (2 entries per deployment/infrastructure file)
    3. OCP-specific files exist (network-policies.yaml, ocp-routes.yaml)
    4. Helm chart templates match
    5. Content differences are reported

.PARAMETER Verbose
    Enable detailed output for each comparison

.EXAMPLE
    .\verify-release-package-sync.ps1
    .\verify-release-package-sync.ps1 -Verbose

.NOTES
    Exit Codes:
        0 = Synchronized (all checks passed)
        1 = Differences found (synchronization required)
#>

[CmdletBinding()]
param(
    [switch]$VerboseOutput
)

# Set strict mode for better error handling
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Global counters
$Global:TotalChecks = 0
$Global:PassedChecks = 0
$Global:FailedChecks = 0
$Global:Warnings = 0

# Paths
$Global:DevK8sPath = "C:\Users\UserC\source\repos\EZ\k8s"
$Global:ReleaseK8sPath = "C:\Users\UserC\source\repos\EZ\release-package\k8s"
$Global:DevHelmPath = "C:\Users\UserC\source\repos\EZ\helm"
$Global:ReleaseHelmPath = "C:\Users\UserC\source\repos\EZ\release-package\helm"

# Color output function
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White",
        [switch]$NoNewline
    )

    $params = @{
        Object          = $Message
        ForegroundColor = $Color
    }

    if ($NoNewline) {
        $params.Add("NoNewline", $true)
    }

    Write-Host @params
}

# Test header function
function Write-TestHeader {
    param([string]$Title)

    Write-Host ""
    Write-ColorOutput "═══════════════════════════════════════════════════════════════════" -Color Cyan
    Write-ColorOutput "  $Title" -Color Cyan
    Write-ColorOutput "═══════════════════════════════════════════════════════════════════" -Color Cyan
    Write-Host ""
}

# Test result function
function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Details = ""
    )

    $Global:TotalChecks++

    if ($Passed) {
        $Global:PassedChecks++
        Write-ColorOutput "[✓] " -Color Green -NoNewline
        Write-ColorOutput $TestName -Color White

        if ($VerboseOutput -and $Details) {
            Write-ColorOutput "    → $Details" -Color Gray
        }
    }
    else {
        $Global:FailedChecks++
        Write-ColorOutput "[✗] " -Color Red -NoNewline
        Write-ColorOutput $TestName -Color White

        if ($Details) {
            Write-ColorOutput "    → $Details" -Color Yellow
        }
    }
}

# Warning function
function Write-WarningMessage {
    param([string]$Message)

    $Global:Warnings++
    Write-ColorOutput "[!] WARNING: $Message" -Color Yellow
}

# Test path exists
function Test-PathExists {
    param(
        [string]$Path,
        [string]$Description
    )

    if (Test-Path $Path) {
        Write-TestResult -TestName "$Description exists" -Passed $true -Details $Path
        return $true
    }
    else {
        Write-TestResult -TestName "$Description exists" -Passed $false -Details "Path not found: $Path"
        return $false
    }
}

# Get YAML files
function Get-YamlFiles {
    param(
        [string]$Path,
        [string]$Pattern = "*.yaml"
    )

    if (-not (Test-Path $Path)) {
        return @()
    }

    return Get-ChildItem -Path $Path -Filter $Pattern -Recurse -File |
           Where-Object { $_.Name -notmatch "^\..*" }
}

# Count SecurityContexts
function Count-SecurityContexts {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        return 0
    }

    $content = Get-Content $FilePath -Raw
    $matches = [regex]::Matches($content, "securityContext:", [System.Text.RegularExpressions.RegexOptions]::Multiline)

    return $matches.Count
}

# Test OCP SecurityContext
function Test-OcpSecurityContext {
    param(
        [string]$FilePath,
        [string]$RelativePath
    )

    $securityContextCount = Count-SecurityContexts -FilePath $FilePath

    # Deployments and infrastructure files should have 2 securityContext entries
    if ($FilePath -match '(deployments|infrastructure)') {
        if ($securityContextCount -ge 2) {
            Write-TestResult -TestName "SecurityContext in $RelativePath" -Passed $true -Details "$securityContextCount contexts found"
            return $true
        }
        else {
            Write-TestResult -TestName "SecurityContext in $RelativePath" -Passed $false -Details "Expected 2+ contexts, found $securityContextCount"
            return $false
        }
    }

    return $true
}

# Compare file content
function Compare-FileContent {
    param(
        [string]$File1,
        [string]$File2,
        [string]$RelativePath
    )

    if (-not (Test-Path $File1)) {
        Write-TestResult -TestName "Content match: $RelativePath" -Passed $false -Details "Dev file missing"
        return $false
    }

    if (-not (Test-Path $File2)) {
        Write-TestResult -TestName "Content match: $RelativePath" -Passed $false -Details "Release file missing"
        return $false
    }

    $content1 = Get-Content $File1 -Raw
    $content2 = Get-Content $File2 -Raw

    # Normalize line endings
    $content1 = $content1 -replace "`r`n", "`n"
    $content2 = $content2 -replace "`r`n", "`n"

    if ($content1 -eq $content2) {
        Write-TestResult -TestName "Content match: $RelativePath" -Passed $true -Details "Identical"
        return $true
    }
    else {
        # Calculate difference
        $diff = Compare-Object -ReferenceObject ($content1 -split "`n") -DifferenceObject ($content2 -split "`n")
        $diffCount = ($diff | Measure-Object).Count

        Write-TestResult -TestName "Content match: $RelativePath" -Passed $false -Details "$diffCount lines differ"

        if ($VerboseOutput -and $diff) {
            Write-ColorOutput "    Differences:" -Color Yellow
            $diff | Select-Object -First 10 | ForEach-Object {
                $indicator = if ($_.SideIndicator -eq "<=") { "DEV" } else { "REL" }
                Write-ColorOutput "      [$indicator] $($_.InputObject)" -Color Gray
            }
            if ($diffCount -gt 10) {
                Write-ColorOutput "      ... and $($diffCount - 10) more differences" -Color Gray
            }
        }

        return $false
    }
}

# Compare directory structure
function Compare-DirectoryStructure {
    param(
        [string]$DevPath,
        [string]$ReleasePath,
        [string]$DirectoryName
    )

    Write-TestHeader "Comparing $DirectoryName Directory"

    $devFiles = Get-YamlFiles -Path $DevPath
    $releaseFiles = Get-YamlFiles -Path $ReleasePath

    $devFileNames = $devFiles | ForEach-Object { $_.FullName.Replace($DevPath, "").TrimStart("\") }
    $releaseFileNames = $releaseFiles | ForEach-Object { $_.FullName.Replace($ReleasePath, "").TrimStart("\") }

    # Compare file counts
    $devCount = ($devFiles | Measure-Object).Count
    $releaseCount = ($releaseFiles | Measure-Object).Count

    Write-ColorOutput "  Dev files:     $devCount" -Color White
    Write-ColorOutput "  Release files: $releaseCount" -Color White
    Write-Host ""

    if ($devCount -eq $releaseCount) {
        Write-TestResult -TestName "File count match in $DirectoryName" -Passed $true -Details "$devCount files"
    }
    else {
        Write-TestResult -TestName "File count match in $DirectoryName" -Passed $false -Details "Dev: $devCount, Release: $releaseCount"
    }

    # Check for missing files in release
    $missingInRelease = $devFileNames | Where-Object { $releaseFileNames -notcontains $_ }
    if ($missingInRelease) {
        foreach ($file in $missingInRelease) {
            Write-TestResult -TestName "File exists in release: $file" -Passed $false -Details "Missing in release package"
        }
    }

    # Check for extra files in release
    $extraInRelease = $releaseFileNames | Where-Object { $devFileNames -notcontains $_ }
    if ($extraInRelease) {
        foreach ($file in $extraInRelease) {
            Write-WarningMessage "Extra file in release package: $file"
        }
    }

    # Compare content of matching files
    foreach ($fileName in $devFileNames) {
        if ($releaseFileNames -contains $fileName) {
            $devFile = Join-Path $DevPath $fileName
            $releaseFile = Join-Path $ReleasePath $fileName

            Compare-FileContent -File1 $devFile -File2 $releaseFile -RelativePath $fileName

            # Check SecurityContext for deployments and infrastructure
            if ($fileName -match '(deployments|infrastructure).*\.yaml$') {
                Test-OcpSecurityContext -FilePath $releaseFile -RelativePath $fileName
            }
        }
    }
}

# Test prerequisites
function Test-Prerequisites {
    Write-TestHeader "Prerequisites Check"

    $allExist = $true

    $allExist = (Test-PathExists -Path $Global:DevK8sPath -Description "Development k8s directory") -and $allExist
    $allExist = (Test-PathExists -Path $Global:ReleaseK8sPath -Description "Release package k8s directory") -and $allExist

    if (-not $allExist) {
        Write-ColorOutput "`nERROR: Missing required directories. Cannot proceed." -Color Red
        exit 1
    }

    return $allExist
}

# Test OCP-specific files
function Test-OcpSpecificFiles {
    Write-TestHeader "OCP-Specific Files Check"

    $requiredFiles = @(
        "network-policies.yaml",
        "ocp-routes.yaml"
    )

    foreach ($file in $requiredFiles) {
        $devFile = Join-Path $Global:DevK8sPath $file
        $releaseFile = Join-Path $Global:ReleaseK8sPath $file

        $devExists = Test-Path $devFile
        $releaseExists = Test-Path $releaseFile

        if ($devExists -and $releaseExists) {
            Write-TestResult -TestName "OCP file $file exists in both" -Passed $true
            Compare-FileContent -File1 $devFile -File2 $releaseFile -RelativePath $file
        }
        elseif (-not $devExists -and -not $releaseExists) {
            Write-TestResult -TestName "OCP file $file" -Passed $false -Details "Missing in both dev and release"
        }
        elseif (-not $releaseExists) {
            Write-TestResult -TestName "OCP file $file" -Passed $false -Details "Missing in release package"
        }
        elseif (-not $devExists) {
            Write-WarningMessage "OCP file $file exists in release but not in dev"
        }
    }
}

# Test Helm charts
function Test-HelmCharts {
    Write-TestHeader "Helm Chart Comparison"

    if (-not (Test-Path $Global:DevHelmPath)) {
        Write-WarningMessage "Development Helm charts not found at $Global:DevHelmPath"
        return
    }

    if (-not (Test-Path $Global:ReleaseHelmPath)) {
        Write-TestResult -TestName "Helm charts in release package" -Passed $false -Details "Helm directory missing"
        return
    }

    # Compare Chart.yaml files
    $devChart = Join-Path $Global:DevHelmPath "ez-platform/Chart.yaml"
    $releaseChart = Join-Path $Global:ReleaseHelmPath "ez-platform/Chart.yaml"

    if ((Test-Path $devChart) -and (Test-Path $releaseChart)) {
        Compare-FileContent -File1 $devChart -File2 $releaseChart -RelativePath "Chart.yaml"
    }

    # Compare templates
    $devTemplates = Join-Path $Global:DevHelmPath "ez-platform/templates"
    $releaseTemplates = Join-Path $Global:ReleaseHelmPath "ez-platform/templates"

    if ((Test-Path $devTemplates) -and (Test-Path $releaseTemplates)) {
        Compare-DirectoryStructure -DevPath $devTemplates -ReleasePath $releaseTemplates -DirectoryName "Helm Templates"
    }
    else {
        Write-TestResult -TestName "Helm templates directory" -Passed $false -Details "Templates directory missing"
    }
}

# Test all directories
function Test-AllDirectories {
    $directories = @(
        "configmaps",
        "deployments",
        "infrastructure",
        "services",
        "ingress",
        "jobs"
    )

    foreach ($dir in $directories) {
        $devPath = Join-Path $Global:DevK8sPath $dir
        $releasePath = Join-Path $Global:ReleaseK8sPath $dir

        if ((Test-Path $devPath) -or (Test-Path $releasePath)) {
            Compare-DirectoryStructure -DevPath $devPath -ReleasePath $releasePath -DirectoryName $dir
        }
        else {
            Write-WarningMessage "Directory $dir does not exist in dev or release"
        }
    }
}

# Write summary report
function Write-SummaryReport {
    Write-TestHeader "Verification Summary"

    $passPercentage = if ($Global:TotalChecks -gt 0) {
        [math]::Round(($Global:PassedChecks / $Global:TotalChecks) * 100, 2)
    } else {
        0
    }

    Write-ColorOutput "  Total Checks:    $($Global:TotalChecks)" -Color White
    Write-ColorOutput "  Passed:          " -Color White -NoNewline
    Write-ColorOutput "$($Global:PassedChecks)" -Color Green
    Write-ColorOutput "  Failed:          " -Color White -NoNewline
    Write-ColorOutput "$($Global:FailedChecks)" -Color Red
    Write-ColorOutput "  Warnings:        " -Color White -NoNewline
    Write-ColorOutput "$($Global:Warnings)" -Color Yellow
    Write-Host ""
    Write-ColorOutput "  Success Rate:    " -Color White -NoNewline

    if ($passPercentage -eq 100) {
        Write-ColorOutput "$passPercentage%" -Color Green
    }
    elseif ($passPercentage -ge 90) {
        Write-ColorOutput "$passPercentage%" -Color Yellow
    }
    else {
        Write-ColorOutput "$passPercentage%" -Color Red
    }

    Write-Host ""
    Write-ColorOutput "═══════════════════════════════════════════════════════════════════" -Color Cyan

    if ($Global:FailedChecks -eq 0) {
        Write-ColorOutput "`n✓ SYNCHRONIZED: Development and release package are in sync." -Color Green
        Write-Host ""
        return 0
    }
    else {
        Write-ColorOutput "`n✗ DIFFERENCES FOUND: Synchronization required." -Color Red
        Write-ColorOutput "  Run the sync script to update release package." -Color Yellow
        Write-Host ""
        return 1
    }
}

# Main execution
$startTime = Get-Date

Write-ColorOutput @"
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║     EZ Platform Release Package Synchronization Verifier        ║
║                        Version 1.0.0                             ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
"@ -Color Cyan

Write-Host ""
Write-ColorOutput "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -Color Gray
Write-Host ""

try {
    # Run all verification tests
    Test-Prerequisites
    Test-OcpSpecificFiles
    Test-AllDirectories
    Test-HelmCharts

    # Generate summary
    $exitCode = Write-SummaryReport

    $endTime = Get-Date
    $duration = $endTime - $startTime

    Write-ColorOutput "Completed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -Color Gray
    Write-ColorOutput "Duration:  $([math]::Round($duration.TotalSeconds, 2)) seconds" -Color Gray
    Write-Host ""

    exit $exitCode
}
catch {
    Write-ColorOutput "`nERROR: An unexpected error occurred:" -Color Red
    Write-ColorOutput $_.Exception.Message -Color Red
    Write-ColorOutput $_.ScriptStackTrace -Color Gray
    exit 1
}
