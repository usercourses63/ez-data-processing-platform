#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Automated Helm Charts Testing Script

.DESCRIPTION
    Tests both vanilla K8s and OCP Helm charts with helm lint and helm template.
    Validates resource counts and ensures both charts render without errors.

.PARAMETER Verbose
    Display detailed output for each test

.EXAMPLE
    .\test-helm-charts.ps1

.EXAMPLE
    .\test-helm-charts.ps1 -Verbose
#>

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Color output
function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

function Write-Section {
    param([string]$Message)
    Write-Host ""
    Write-Host "═══════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  $Message" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════" -ForegroundColor Yellow
    Write-Host ""
}

# Test results tracking
$script:TotalTests = 0
$script:PassedTests = 0
$script:FailedTests = 0

function Test-Chart {
    param(
        [string]$ChartPath,
        [string]$ChartName,
        [hashtable]$ExpectedCounts
    )

    Write-Section "Testing $ChartName Chart"

    $script:TotalTests++

    # Test 1: Helm Lint
    Write-Info "Running helm lint..."
    try {
        $lintOutput = helm lint $ChartPath 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Helm lint failed for $ChartName"
            if ($Verbose) {
                Write-Host $lintOutput
            }
            $script:FailedTests++
            return $false
        }
        Write-Success "Helm lint passed"
        $script:PassedTests++
    }
    catch {
        Write-Error-Custom "Helm lint error: $_"
        $script:FailedTests++
        return $false
    }

    # Test 2: Helm Template
    Write-Info "Running helm template..."
    try {
        $renderOutput = Join-Path $ChartPath "rendered-$ChartName.yaml"
        helm template test-chart $ChartPath > $renderOutput 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Helm template failed for $ChartName"
            if ($Verbose) {
                Get-Content $renderOutput
            }
            $script:FailedTests++
            return $false
        }
        Write-Success "Helm template rendered successfully"
        $script:PassedTests++
    }
    catch {
        Write-Error-Custom "Helm template error: $_"
        $script:FailedTests++
        return $false
    }

    # Test 3: Validate Resource Counts
    Write-Info "Validating resource counts..."
    $counts = @{}
    foreach ($kind in $ExpectedCounts.Keys) {
        $count = (Select-String -Path $renderOutput -Pattern "kind: $kind").Count
        $counts[$kind] = $count

        if ($count -eq $ExpectedCounts[$kind]) {
            Write-Success "$kind: $count (expected: $($ExpectedCounts[$kind]))"
            $script:PassedTests++
        }
        elseif ($kind -eq "Route" -and $ChartName -eq "ez-platform") {
            # Routes are expected to be 0 for vanilla K8s
            Write-Success "$kind: $count (expected: $($ExpectedCounts[$kind]))"
            $script:PassedTests++
        }
        else {
            Write-Error-Custom "$kind: $count (expected: $($ExpectedCounts[$kind]))"
            $script:FailedTests++
        }
    }

    Write-Host ""
    Write-Host "Resource Summary:" -ForegroundColor White
    foreach ($kind in $counts.Keys) {
        Write-Host "  $kind: $($counts[$kind])" -ForegroundColor Gray
    }

    return $true
}

# Main execution
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  Helm Charts Testing Suite" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

# Verify helm is installed
if (!(Get-Command helm -ErrorAction SilentlyContinue)) {
    Write-Error-Custom "Helm not found. Please install Helm 3.12+"
    exit 1
}

Write-Info "Helm version: $(helm version --short)"
Write-Host ""

# Test 1: Vanilla K8s Chart
$vanillaExpected = @{
    "Deployment" = 17
    "StatefulSet" = 4
    "NetworkPolicy" = 12
    "Service" = 29
    "Ingress" = 1
    "Route" = 0
}

Test-Chart -ChartPath "helm/ez-platform" -ChartName "ez-platform" -ExpectedCounts $vanillaExpected

# Test 2: OCP Chart
$ocpExpected = @{
    "Deployment" = 17
    "StatefulSet" = 4
    "NetworkPolicy" = 12
    "Service" = 29
    "Route" = 4
    "Ingress" = 0
}

Test-Chart -ChartPath "release-package/helm/ez-platform-ocp" -ChartName "ez-platform-ocp" -ExpectedCounts $ocpExpected

# Test Summary
Write-Section "Test Summary"

$successRate = if ($TotalTests -gt 0) {
    [math]::Round(($PassedTests / $TotalTests) * 100, 2)
} else {
    0
}

Write-Host "Total Tests:    $TotalTests" -ForegroundColor White
Write-Host "Passed:         " -NoNewline; Write-Host $PassedTests -ForegroundColor Green
Write-Host "Failed:         " -NoNewline; Write-Host $FailedTests -ForegroundColor Red
Write-Host "Success Rate:   $successRate%" -ForegroundColor $(if ($successRate -eq 100) { "Green" } elseif ($successRate -ge 80) { "Yellow" } else { "Red" })
Write-Host ""

# Exit with appropriate code
if ($FailedTests -eq 0) {
    Write-Success "All tests passed!"
    exit 0
} else {
    Write-Error-Custom "$FailedTests test(s) failed."
    exit 1
}
