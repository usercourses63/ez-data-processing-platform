#Requires -Version 7.0
<#
.SYNOPSIS
    NAS Device Integration Verification Script

.DESCRIPTION
    Tests the complete NAS/NFS architecture:
    - Prerequisites check (kubectl, namespace, RBAC)
    - API endpoint verification
    - Create/provision/verify/cleanup cycle
    - K8s resource verification (PV/PVC binding)

.PARAMETER ApiBaseUrl
    Base URL for the DataSourceManagement API

.PARAMETER SkipCleanup
    Skip cleanup phase (leave test resources in place)

.PARAMETER Verbose
    Enable verbose output

.EXAMPLE
    .\verify-nas-integration.ps1 -Verbose

.EXAMPLE
    .\verify-nas-integration.ps1 -ApiBaseUrl "http://localhost:5001" -SkipCleanup

.NOTES
    Phase: 02-nas-nfs-architecture
    Plan: 02-06
    Created: 2026-02-02
#>

param(
    [string]$ApiBaseUrl = "http://localhost:5001",
    [switch]$SkipCleanup,
    [switch]$VerboseOutput
)

$ErrorActionPreference = "Stop"
$script:TestResults = @{
    Passed = 0
    Failed = 0
    Skipped = 0
    Details = @()
}
$script:TestNasDeviceId = $null

#region Helper Functions

function Write-Step {
    param([string]$Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
    $script:TestResults.Passed++
    $script:TestResults.Details += @{ Status = "PASS"; Message = $Message }
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
    $script:TestResults.Failed++
    $script:TestResults.Details += @{ Status = "FAIL"; Message = $Message }
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Verbose-Info {
    param([string]$Message)
    if ($VerboseOutput) {
        Write-Host "[DEBUG] $Message" -ForegroundColor DarkGray
    }
}

function Write-Skip {
    param([string]$Message)
    Write-Host "[SKIP] $Message" -ForegroundColor Yellow
    $script:TestResults.Skipped++
    $script:TestResults.Details += @{ Status = "SKIP"; Message = $Message }
}

function Test-Prerequisite {
    param(
        [string]$Name,
        [scriptblock]$Check,
        [string]$FailMessage
    )

    try {
        $result = & $Check
        if ($result) {
            Write-Step "Prerequisite: $Name"
            return $true
        }
        else {
            Write-Fail "Prerequisite: $Name - $FailMessage"
            return $false
        }
    }
    catch {
        Write-Fail "Prerequisite: $Name - Error: $_"
        return $false
    }
}

function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [int]$TimeoutSec = 30
    )

    $uri = "$ApiBaseUrl$Endpoint"
    Write-Verbose-Info "API Request: $Method $uri"

    $params = @{
        Method = $Method
        Uri = $uri
        ContentType = "application/json"
        TimeoutSec = $TimeoutSec
    }

    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
        Write-Verbose-Info "Request Body: $($params.Body)"
    }

    try {
        $response = Invoke-RestMethod @params
        Write-Verbose-Info "Response: $($response | ConvertTo-Json -Depth 5)"
        return @{ Success = $true; Data = $response }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Verbose-Info "API Error: StatusCode=$statusCode, Message=$($_.Exception.Message)"
        return @{ Success = $false; Error = $_; StatusCode = $statusCode }
    }
}

function Wait-ForPvcBound {
    param(
        [string]$PvcName,
        [string]$Namespace = "ez-platform",
        [int]$TimeoutSeconds = 60
    )

    Write-Info "Waiting for PVC '$PvcName' to bind (timeout: ${TimeoutSeconds}s)..."
    $startTime = Get-Date

    while ((Get-Date) - $startTime -lt [TimeSpan]::FromSeconds($TimeoutSeconds)) {
        $pvcStatus = kubectl get pvc $PvcName -n $Namespace -o jsonpath='{.status.phase}' 2>$null

        if ($pvcStatus -eq "Bound") {
            Write-Step "PVC '$PvcName' is Bound"
            return $true
        }

        Write-Verbose-Info "PVC status: $pvcStatus - waiting..."
        Start-Sleep -Seconds 2
    }

    Write-Fail "Timeout waiting for PVC '$PvcName' to bind"
    return $false
}

#endregion

#region Test Functions

function Test-Prerequisites {
    Write-Host "`n=== Prerequisites Check ===" -ForegroundColor Magenta

    # Check kubectl
    $kubectlOk = Test-Prerequisite -Name "kubectl available" -Check {
        $null = kubectl version --client 2>&1
        $LASTEXITCODE -eq 0
    } -FailMessage "kubectl not found or not working"

    if (-not $kubectlOk) {
        return $false
    }

    # Check ez-platform namespace
    Test-Prerequisite -Name "ez-platform namespace exists" -Check {
        $ns = kubectl get namespace ez-platform -o name 2>$null
        $ns -eq "namespace/ez-platform"
    } -FailMessage "Namespace ez-platform not found"

    # Check RBAC resources
    Test-Prerequisite -Name "ServiceAccount nas-device-manager exists" -Check {
        $sa = kubectl get serviceaccount nas-device-manager -n ez-platform -o name 2>$null
        $sa -eq "serviceaccount/nas-device-manager"
    } -FailMessage "ServiceAccount nas-device-manager not found"

    Test-Prerequisite -Name "ClusterRole nas-pv-manager exists" -Check {
        $cr = kubectl get clusterrole nas-pv-manager -o name 2>$null
        $cr -eq "clusterrole/nas-pv-manager"
    } -FailMessage "ClusterRole nas-pv-manager not found"

    Test-Prerequisite -Name "Role nas-resource-manager exists" -Check {
        $role = kubectl get role nas-resource-manager -n ez-platform -o name 2>$null
        $role -eq "role/nas-resource-manager"
    } -FailMessage "Role nas-resource-manager not found"

    # Check file-simulator cluster (optional)
    $fileSimCheck = kubectl get ns file-simulator 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Step "Prerequisite: file-simulator namespace accessible (optional)"
    }
    else {
        Write-Skip "Prerequisite: file-simulator namespace (not required for basic tests)"
    }

    return $true
}

function Test-ApiEndpoints {
    Write-Host "`n=== API Endpoint Verification ===" -ForegroundColor Magenta

    # Test GET /api/v1/nasdevices
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/api/v1/nasdevices"

    if ($result.Success) {
        Write-Step "GET /api/v1/nasdevices responds with 200"
        Write-Verbose-Info "Found $(@($result.Data).Count) existing NAS devices"
        return $true
    }
    else {
        Write-Fail "GET /api/v1/nasdevices failed: $($result.Error.Exception.Message)"

        if ($result.StatusCode -eq 0) {
            Write-Warn "API may not be running. Ensure DataSourceManagement service is accessible at $ApiBaseUrl"
        }

        return $false
    }
}

function Test-CreateNasDevice {
    Write-Host "`n=== Create Test NAS Device ===" -ForegroundColor Magenta

    $testDevice = @{
        Name = "test-nas-integration"
        Host = "file-sim-nas-input-1.file-simulator.svc.cluster.local"
        Port = 2049
        ExportPath = "/data"
        Role = "Input"
        StorageCapacity = "1Gi"
        MountOptions = @("nfsvers=3", "tcp", "hard", "intr")
    }

    Write-Info "Creating NAS device: $($testDevice.Name)"
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/api/v1/nasdevices" -Body $testDevice

    if ($result.Success -and $result.Data.ID) {
        $script:TestNasDeviceId = $result.Data.ID
        Write-Step "Created NAS device with ID: $($script:TestNasDeviceId)"

        # Verify fields
        if ($result.Data.Name -eq $testDevice.Name) {
            Write-Step "NAS device Name correct"
        }
        else {
            Write-Fail "NAS device Name mismatch"
        }

        if ($result.Data.Host -eq $testDevice.Host) {
            Write-Step "NAS device Host correct"
        }
        else {
            Write-Fail "NAS device Host mismatch"
        }

        return $true
    }
    else {
        Write-Fail "Failed to create NAS device: $($result.Error.Exception.Message)"
        return $false
    }
}

function Test-ProvisionKubernetesResources {
    Write-Host "`n=== Provision K8s Resources ===" -ForegroundColor Magenta

    if (-not $script:TestNasDeviceId) {
        Write-Skip "Skipping provisioning - no NAS device ID"
        return $false
    }

    Write-Info "Provisioning K8s resources for NAS device: $($script:TestNasDeviceId)"
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/api/v1/nasdevices/$($script:TestNasDeviceId)/provision"

    if ($result.Success) {
        Write-Step "Provision API call succeeded"

        # Check response fields
        if ($result.Data.PvCreated -eq $true) {
            Write-Step "PV created successfully"
        }
        else {
            Write-Fail "PV not created"
        }

        if ($result.Data.PvcBound -eq $true -or $result.Data.PvcCreated -eq $true) {
            Write-Step "PVC created/bound"
        }
        else {
            Write-Warn "PVC status unclear - checking via kubectl"
        }

        return $true
    }
    else {
        Write-Fail "Failed to provision: $($result.Error.Exception.Message)"
        return $false
    }
}

function Test-VerifyKubernetesResources {
    Write-Host "`n=== Verify K8s Resources ===" -ForegroundColor Magenta

    if (-not $script:TestNasDeviceId) {
        Write-Skip "Skipping K8s verification - no NAS device ID"
        return $false
    }

    $pvName = "test-nas-integration-pv"
    $pvcName = "test-nas-integration-pvc"

    # Check PV exists
    Write-Info "Checking PV: $pvName"
    $pvResult = kubectl get pv $pvName -o json 2>$null | ConvertFrom-Json

    if ($pvResult) {
        Write-Step "PV '$pvName' exists"

        # Verify NFS configuration
        if ($pvResult.spec.nfs) {
            Write-Step "PV has NFS configuration"
            Write-Verbose-Info "NFS Server: $($pvResult.spec.nfs.server)"
            Write-Verbose-Info "NFS Path: $($pvResult.spec.nfs.path)"
        }
        else {
            Write-Fail "PV missing NFS configuration"
        }

        # Check labels
        if ($pvResult.metadata.labels.'managed-by' -eq 'ez-platform') {
            Write-Step "PV has correct managed-by label"
        }
        else {
            Write-Warn "PV missing managed-by label"
        }
    }
    else {
        Write-Fail "PV '$pvName' not found"
        return $false
    }

    # Check PVC exists
    Write-Info "Checking PVC: $pvcName"
    $pvcResult = kubectl get pvc $pvcName -n ez-platform -o json 2>$null | ConvertFrom-Json

    if ($pvcResult) {
        Write-Step "PVC '$pvcName' exists"

        # Wait for bound status
        if ($pvcResult.status.phase -ne "Bound") {
            $bound = Wait-ForPvcBound -PvcName $pvcName
            if (-not $bound) {
                return $false
            }
        }
        else {
            Write-Step "PVC is already Bound"
        }
    }
    else {
        Write-Fail "PVC '$pvcName' not found"
        return $false
    }

    return $true
}

function Test-Cleanup {
    Write-Host "`n=== Cleanup ===" -ForegroundColor Magenta

    if ($SkipCleanup) {
        Write-Skip "Cleanup skipped (SkipCleanup flag set)"
        Write-Info "Test resources left in place:"
        Write-Info "  - NAS Device ID: $($script:TestNasDeviceId)"
        Write-Info "  - PV: test-nas-integration-pv"
        Write-Info "  - PVC: test-nas-integration-pvc"
        return $true
    }

    if (-not $script:TestNasDeviceId) {
        Write-Info "No test resources to clean up"
        return $true
    }

    # Deprovision K8s resources
    Write-Info "Deprovisioning K8s resources..."
    $deprovisionResult = Invoke-ApiRequest -Method "DELETE" -Endpoint "/api/v1/nasdevices/$($script:TestNasDeviceId)/provision"

    if ($deprovisionResult.Success) {
        Write-Step "K8s resources deprovisioned"
    }
    else {
        Write-Warn "Deprovision may have failed: $($deprovisionResult.Error.Exception.Message)"
    }

    # Delete NAS device
    Write-Info "Deleting NAS device..."
    $deleteResult = Invoke-ApiRequest -Method "DELETE" -Endpoint "/api/v1/nasdevices/$($script:TestNasDeviceId)"

    if ($deleteResult.Success) {
        Write-Step "NAS device deleted"
    }
    else {
        Write-Fail "Failed to delete NAS device: $($deleteResult.Error.Exception.Message)"
    }

    # Verify cleanup
    Start-Sleep -Seconds 2

    $pvExists = kubectl get pv test-nas-integration-pv 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Step "PV successfully removed"
    }
    else {
        Write-Warn "PV may still exist - check manually"
    }

    $pvcExists = kubectl get pvc test-nas-integration-pvc -n ez-platform 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Step "PVC successfully removed"
    }
    else {
        Write-Warn "PVC may still exist - check manually"
    }

    return $true
}

#endregion

#region Main Execution

function Show-Summary {
    Write-Host "`n========================================" -ForegroundColor White
    Write-Host "         TEST SUMMARY" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor White

    $passColor = if ($script:TestResults.Passed -gt 0) { "Green" } else { "Gray" }
    $failColor = if ($script:TestResults.Failed -gt 0) { "Red" } else { "Gray" }
    $skipColor = if ($script:TestResults.Skipped -gt 0) { "Yellow" } else { "Gray" }

    Write-Host "  Passed:  $($script:TestResults.Passed)" -ForegroundColor $passColor
    Write-Host "  Failed:  $($script:TestResults.Failed)" -ForegroundColor $failColor
    Write-Host "  Skipped: $($script:TestResults.Skipped)" -ForegroundColor $skipColor
    Write-Host "----------------------------------------" -ForegroundColor White

    $total = $script:TestResults.Passed + $script:TestResults.Failed
    if ($total -gt 0) {
        $successRate = [math]::Round(($script:TestResults.Passed / $total) * 100, 1)
        Write-Host "  Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } elseif ($successRate -ge 50) { "Yellow" } else { "Red" })
    }

    Write-Host "========================================`n" -ForegroundColor White
}

# Main
try {
    Write-Host "`n" -NoNewline
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  NAS Device Integration Verification" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  API Base URL: $ApiBaseUrl" -ForegroundColor Gray
    Write-Host "  Skip Cleanup: $SkipCleanup" -ForegroundColor Gray
    Write-Host "  Verbose: $VerboseOutput" -ForegroundColor Gray
    Write-Host "========================================`n" -ForegroundColor Cyan

    # Run test phases
    $prereqOk = Test-Prerequisites

    if (-not $prereqOk) {
        Write-Warn "Prerequisites not met - some tests may fail"
    }

    $apiOk = Test-ApiEndpoints

    if ($apiOk) {
        $createOk = Test-CreateNasDevice

        if ($createOk) {
            $provisionOk = Test-ProvisionKubernetesResources

            if ($provisionOk) {
                Test-VerifyKubernetesResources
            }
        }

        Test-Cleanup
    }
    else {
        Write-Warn "Skipping create/provision tests - API not accessible"
    }

    Show-Summary

    # Exit code based on results
    if ($script:TestResults.Failed -gt 0) {
        Write-Host "Tests failed. Exit code: 1" -ForegroundColor Red
        exit 1
    }
    else {
        Write-Host "All tests passed. Exit code: 0" -ForegroundColor Green
        exit 0
    }
}
catch {
    Write-Host "`n[FATAL] Unexpected error: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
    exit 1
}

#endregion
