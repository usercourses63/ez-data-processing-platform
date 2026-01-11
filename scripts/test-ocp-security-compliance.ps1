#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Automated OCP SecurityContext Compliance Test Suite

.DESCRIPTION
    Verifies that all Kubernetes manifests meet OpenShift Container Platform (OCP)
    security requirements including SecurityContext, NetworkPolicies, and Routes.

    Exit Codes:
    - 0: All tests passed
    - 1: One or more tests failed
    - 2: Critical error (missing directories, invalid parameters)

.PARAMETER Path
    Path to the directory containing k8s/ manifests to test.
    Defaults to current directory.

.PARAMETER FailFast
    Stop testing on first failure instead of running all tests.

.PARAMETER DetailedOutput
    Display detailed output for each test.

.PARAMETER CIMode
    CI/CD pipeline mode - outputs machine-readable format and sets strict exit codes.

.EXAMPLE
    .\test-ocp-security-compliance.ps1
    Test k8s/ in current directory

.EXAMPLE
    .\test-ocp-security-compliance.ps1 -Path "C:\repos\EZ\release-package" -DetailedOutput
    Test specific directory with detailed output

.EXAMPLE
    .\test-ocp-security-compliance.ps1 -CIMode
    Run in CI/CD mode for automated pipelines
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$Path = ".",

    [Parameter(Mandatory=$false)]
    [switch]$FailFast,

    [Parameter(Mandatory=$false)]
    [switch]$DetailedOutput,

    [Parameter(Mandatory=$false)]
    [switch]$CIMode
)

# Test result tracking
$script:TestResults = @()
$script:TotalTests = 0
$script:PassedTests = 0
$script:FailedTests = 0

# ANSI color codes (disabled in CI mode)
$script:UseColors = -not $CIMode
$script:Green = if ($UseColors) { "`e[32m" } else { "" }
$script:Red = if ($UseColors) { "`e[31m" } else { "" }
$script:Yellow = if ($UseColors) { "`e[33m" } else { "" }
$script:Blue = if ($UseColors) { "`e[34m" } else { "" }
$script:Reset = if ($UseColors) { "`e[0m" } else { "" }

# Test helper functions
function Write-TestHeader {
    param([string]$Message)

    if ($CIMode) {
        Write-Output "TEST_SUITE: $Message"
    } else {
        Write-Host ""
        Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
        Write-Host "  $Message" -ForegroundColor Cyan
        Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
    }
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = "",
        [string]$Details = ""
    )

    $script:TotalTests++

    if ($Passed) {
        $script:PassedTests++
        $status = "PASS"
        $color = "Green"
    } else {
        $script:FailedTests++
        $status = "FAIL"
        $color = "Red"
    }

    # Store result
    $script:TestResults += [PSCustomObject]@{
        Name = $TestName
        Status = $status
        Message = $Message
        Details = $Details
    }

    # Output result
    if ($CIMode) {
        Write-Output "TEST: $status | $TestName | $Message"
        if ($Details -and $DetailedOutput) {
            Write-Output "DETAILS: $Details"
        }
    } else {
        $prefix = if ($Passed) { "$script:Green[PASS]$script:Reset" } else { "$script:Red[FAIL]$script:Reset" }
        Write-Host "$prefix $TestName" -NoNewline
        if ($Message) {
            Write-Host " - $Message" -ForegroundColor Gray
        } else {
            Write-Host ""
        }
        if ($Details -and $DetailedOutput) {
            Write-Host "    $Details" -ForegroundColor DarkGray
        }
    }

    # Fail fast if requested
    if (-not $Passed -and $FailFast) {
        Write-Host "$script:Red`nTest failed. Stopping due to -FailFast flag.$script:Reset" -ForegroundColor Red
        exit 1
    }
}

function Test-SecurityContextInFile {
    param(
        [string]$FilePath,
        [int]$MinimumContexts = 2
    )

    if (-not (Test-Path $FilePath)) {
        return @{
            Passed = $false
            Count = 0
            Message = "File not found"
        }
    }

    $content = Get-Content $FilePath -Raw
    $matches = ([regex]::Matches($content, 'securityContext:')).Count

    $passed = $matches -ge $MinimumContexts
    $message = if ($passed) {
        "Found $matches SecurityContext entries (minimum: $MinimumContexts)"
    } else {
        "Found only $matches SecurityContext entries, expected minimum $MinimumContexts"
    }

    return @{
        Passed = $passed
        Count = $matches
        Message = $message
    }
}

function Test-PodLevelSecurityContext {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        return $false
    }

    $content = Get-Content $FilePath -Raw

    # Check for pod-level SecurityContext fields
    $hasPodContext = $content -match '(?m)^\s{2,6}securityContext:\s*$' -and
                     ($content -match 'runAsNonRoot:' -or
                      $content -match 'runAsUser:' -or
                      $content -match 'fsGroup:')

    return $hasPodContext
}

function Test-ContainerLevelSecurityContext {
    param([string]$FilePath)

    if (-not (Test-Path $FilePath)) {
        return $false
    }

    $content = Get-Content $FilePath -Raw

    # Check for container-level SecurityContext fields
    $hasContainerContext = $content -match 'allowPrivilegeEscalation:' -or
                           $content -match 'readOnlyRootFilesystem:' -or
                           ($content -match 'capabilities:' -and $content -match 'drop:')

    return $hasContainerContext
}

# Main test execution
try {
    # Resolve and validate path
    $TestPath = Resolve-Path $Path -ErrorAction Stop
    $K8sPath = Join-Path $TestPath "k8s"

    if (-not (Test-Path $K8sPath)) {
        Write-Host "$script:Red[ERROR] k8s/ directory not found at $TestPath$script:Reset" -ForegroundColor Red
        exit 2
    }

    Write-TestHeader "OCP SecurityContext Compliance Test Suite"

    if (-not $CIMode) {
        Write-Host "Test Path: $TestPath" -ForegroundColor Gray
        Write-Host "Test Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
    }

    # Test Suite 1: Deployment Files SecurityContext
    Write-TestHeader "Test Suite 1: Deployment Files SecurityContext"

    $DeploymentsPath = Join-Path $K8sPath "deployments"
    if (Test-Path $DeploymentsPath) {
        $deploymentFiles = Get-ChildItem $DeploymentsPath -Filter "*.yaml" | Where-Object { $_.Name -notmatch 'pvc|configmap|secret' }

        foreach ($file in $deploymentFiles) {
            $result = Test-SecurityContextInFile -FilePath $file.FullName -MinimumContexts 2

            Write-TestResult `
                -TestName "Deployment: $($file.Name)" `
                -Passed $result.Passed `
                -Message $result.Message
        }
    } else {
        Write-TestResult `
            -TestName "Deployments directory exists" `
            -Passed $false `
            -Message "Directory not found: $DeploymentsPath"
    }

    # Test Suite 2: Infrastructure Files SecurityContext
    Write-TestHeader "Test Suite 2: Infrastructure Files SecurityContext"

    $InfraPath = Join-Path $K8sPath "infrastructure"
    if (Test-Path $InfraPath) {
        $infraFiles = Get-ChildItem $InfraPath -Filter "*.yaml" | Where-Object {
            $_.Name -match '(deployment|statefulset)' -and
            $_.Name -notmatch '(configmap|secret|dashboard|pvc)'
        }

        foreach ($file in $infraFiles) {
            $result = Test-SecurityContextInFile -FilePath $file.FullName -MinimumContexts 2

            Write-TestResult `
                -TestName "Infrastructure: $($file.Name)" `
                -Passed $result.Passed `
                -Message $result.Message
        }
    } else {
        Write-TestResult `
            -TestName "Infrastructure directory exists" `
            -Passed $false `
            -Message "Directory not found: $InfraPath"
    }

    # Test Suite 3: Pod-Level SecurityContext Validation
    Write-TestHeader "Test Suite 3: Pod-Level SecurityContext Validation"

    $allYamlFiles = @()
    $allYamlFiles += Get-ChildItem $DeploymentsPath -Filter "*.yaml" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'deployment' }
    $allYamlFiles += Get-ChildItem $InfraPath -Filter "*.yaml" -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '(deployment|statefulset)' }

    foreach ($file in $allYamlFiles) {
        $hasPodContext = Test-PodLevelSecurityContext -FilePath $file.FullName

        Write-TestResult `
            -TestName "Pod-level context: $($file.Name)" `
            -Passed $hasPodContext `
            -Message $(if ($hasPodContext) { "Pod SecurityContext configured" } else { "Missing pod-level SecurityContext" })
    }

    # Test Suite 4: Container-Level SecurityContext Validation
    Write-TestHeader "Test Suite 4: Container-Level SecurityContext Validation"

    foreach ($file in $allYamlFiles) {
        $hasContainerContext = Test-ContainerLevelSecurityContext -FilePath $file.FullName

        Write-TestResult `
            -TestName "Container-level context: $($file.Name)" `
            -Passed $hasContainerContext `
            -Message $(if ($hasContainerContext) { "Container SecurityContext configured" } else { "Missing container-level SecurityContext" })
    }

    # Test Suite 5: OCP-Specific Resources
    Write-TestHeader "Test Suite 5: OCP-Specific Resources"

    # Test for NetworkPolicies
    $networkPoliciesPath = Join-Path $K8sPath "network-policies.yaml"
    $hasNetworkPolicies = Test-Path $networkPoliciesPath

    Write-TestResult `
        -TestName "NetworkPolicies file exists" `
        -Passed $hasNetworkPolicies `
        -Message $(if ($hasNetworkPolicies) { "Found at: network-policies.yaml" } else { "Missing network-policies.yaml" })

    # Test for OCP Routes
    $ocpRoutesPath = Join-Path $K8sPath "ocp-routes.yaml"
    $hasOcpRoutes = Test-Path $ocpRoutesPath

    Write-TestResult `
        -TestName "OCP Routes file exists" `
        -Passed $hasOcpRoutes `
        -Message $(if ($hasOcpRoutes) { "Found at: ocp-routes.yaml" } else { "Missing ocp-routes.yaml" })

    # Test Suite 6: Helm Charts SecurityContext (if helm/ exists)
    $HelmPath = Join-Path $TestPath "helm"
    if (Test-Path $HelmPath) {
        Write-TestHeader "Test Suite 6: Helm Charts SecurityContext"

        $helmTemplatesPath = Join-Path $HelmPath "ez-platform/templates"
        if (Test-Path $helmTemplatesPath) {
            # Test values.yaml for SecurityContext defaults
            $valuesPath = Join-Path $HelmPath "ez-platform/values.yaml"
            if (Test-Path $valuesPath) {
                $valuesContent = Get-Content $valuesPath -Raw
                $hasSecurityContextDefaults = $valuesContent -match 'securityContext:' -and
                                               $valuesContent -match 'pod:' -and
                                               $valuesContent -match 'container:'

                Write-TestResult `
                    -TestName "Helm values.yaml SecurityContext defaults" `
                    -Passed $hasSecurityContextDefaults `
                    -Message $(if ($hasSecurityContextDefaults) { "SecurityContext defaults configured" } else { "Missing SecurityContext defaults" })
            }

            # Test Helm deployment templates
            $helmDeployments = Get-ChildItem (Join-Path $helmTemplatesPath "deployments") -Filter "*.yaml" -ErrorAction SilentlyContinue
            foreach ($file in $helmDeployments) {
                $content = Get-Content $file.FullName -Raw
                $hasTemplateVars = $content -match '\.Values\.securityContext'

                Write-TestResult `
                    -TestName "Helm template: $($file.Name)" `
                    -Passed $hasTemplateVars `
                    -Message $(if ($hasTemplateVars) { "Uses .Values.securityContext" } else { "Missing .Values.securityContext reference" })
            }
        }
    }

    # Test Summary
    Write-TestHeader "Test Summary"

    $successRate = if ($TotalTests -gt 0) {
        [math]::Round(($PassedTests / $TotalTests) * 100, 2)
    } else {
        0
    }

    if ($CIMode) {
        Write-Output "SUMMARY: Total=$TotalTests | Passed=$PassedTests | Failed=$FailedTests | SuccessRate=$successRate%"
    } else {
        Write-Host ""
        Write-Host "Total Tests:    $TotalTests" -ForegroundColor White
        Write-Host "Passed:         $script:Green$PassedTests$script:Reset" -ForegroundColor Green
        Write-Host "Failed:         $script:Red$FailedTests$script:Reset" -ForegroundColor Red
        Write-Host "Success Rate:   $successRate%" -ForegroundColor $(if ($successRate -eq 100) { "Green" } elseif ($successRate -ge 80) { "Yellow" } else { "Red" })
        Write-Host ""
    }

    # Export results to JSON if in CI mode
    if ($CIMode) {
        $resultsFile = Join-Path $PSScriptRoot "ocp-compliance-test-results.json"
        $script:TestResults | ConvertTo-Json -Depth 10 | Out-File $resultsFile -Encoding UTF8
        Write-Output "RESULTS_FILE: $resultsFile"
    }

    # Exit with appropriate code
    if ($FailedTests -eq 0) {
        if ($CIMode) {
            Write-Output "STATUS: PASS"
        } else {
            Write-Host "$script:Green[SUCCESS] All tests passed!$script:Reset" -ForegroundColor Green
        }
        exit 0
    } else {
        if ($CIMode) {
            Write-Output "STATUS: FAIL"
        } else {
            Write-Host "$script:Red[FAILED] $FailedTests test(s) failed.$script:Reset" -ForegroundColor Red
        }
        exit 1
    }

} catch {
    Write-Host "$script:Red[ERROR] Critical Error: $($_.Exception.Message)$script:Reset" -ForegroundColor Red
    if ($DetailedOutput) {
        Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    }
    exit 2
}
