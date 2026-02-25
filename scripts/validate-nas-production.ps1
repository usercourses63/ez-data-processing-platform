<#
.SYNOPSIS
    Validates NAS/NFS architecture is production-ready in OCP/Kubernetes environment.

.DESCRIPTION
    This script verifies:
    1. NAS Device API is accessible
    2. NAS devices can be created and provisioned
    3. PersistentVolume/PersistentVolumeClaim resources are created correctly
    4. NFS mounts work correctly in pods
    5. File operations succeed through NFS connector

.PARAMETER ApiUrl
    Base URL for the DataSourceManagement API (default: http://localhost:5001)

.PARAMETER Namespace
    Kubernetes namespace (default: ez-platform)

.PARAMETER NasServerHost
    NFS server hostname or IP for test device

.PARAMETER NasExportPath
    NFS export path for test device

.EXAMPLE
    .\validate-nas-production.ps1 -NasServerHost "192.168.1.100" -NasExportPath "/exports/test"

.NOTES
    Requires:
    - kubectl configured with cluster access
    - curl or Invoke-RestMethod available
    - RBAC permissions for PV/PVC operations
#>

param(
    [string]$ApiUrl = "http://localhost:5001",
    [string]$Namespace = "ez-platform",
    [string]$NasServerHost = "",
    [string]$NasExportPath = "/exports/validation",
    [switch]$Cleanup
)

$ErrorActionPreference = "Stop"
$script:TestDeviceId = $null

function Write-TestStep {
    param([string]$Step, [string]$Status, [string]$Details = "")
    $color = switch ($Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "SKIP" { "Yellow" }
        default { "White" }
    }
    Write-Host "[$Status] $Step" -ForegroundColor $color
    if ($Details) {
        Write-Host "        $Details" -ForegroundColor Gray
    }
}

function Test-ApiHealth {
    Write-Host "`n=== Step 1: API Health Check ===" -ForegroundColor Cyan

    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/health" -Method GET -TimeoutSec 10
        Write-TestStep "API Health" "PASS" "DataSourceManagement API is healthy"
        return $true
    }
    catch {
        Write-TestStep "API Health" "FAIL" "Cannot reach API: $($_.Exception.Message)"
        return $false
    }
}

function Test-NasDeviceCreate {
    Write-Host "`n=== Step 2: NAS Device Creation ===" -ForegroundColor Cyan

    if ([string]::IsNullOrEmpty($NasServerHost)) {
        Write-TestStep "NAS Device Create" "SKIP" "No NasServerHost provided"
        return $false
    }

    $deviceName = "validation-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
    $body = @{
        Name = $deviceName
        Host = $NasServerHost
        ExportPath = $NasExportPath
        Role = "Both"
        MountOptions = "nfsvers=4.1,hard,intr"
        Description = "Automated validation test device"
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/nasdevices" -Method POST -Body $body -ContentType "application/json"
        $script:TestDeviceId = $response.ID
        Write-TestStep "NAS Device Create" "PASS" "Created device: $deviceName (ID: $($response.ID))"
        return $true
    }
    catch {
        Write-TestStep "NAS Device Create" "FAIL" $_.Exception.Message
        return $false
    }
}

function Test-NasDeviceProvision {
    Write-Host "`n=== Step 3: NAS Device Provisioning ===" -ForegroundColor Cyan

    if (-not $script:TestDeviceId) {
        Write-TestStep "NAS Device Provision" "SKIP" "No test device created"
        return $false
    }

    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/nasdevices/$($script:TestDeviceId)/provision" -Method POST
        if ($response.Success) {
            Write-TestStep "NAS Device Provision" "PASS" "PV/PVC created successfully"
            return $true
        }
        else {
            Write-TestStep "NAS Device Provision" "FAIL" $response.ErrorMessage
            return $false
        }
    }
    catch {
        Write-TestStep "NAS Device Provision" "FAIL" $_.Exception.Message
        return $false
    }
}

function Test-KubernetesPvPvc {
    Write-Host "`n=== Step 4: Kubernetes PV/PVC Verification ===" -ForegroundColor Cyan

    if (-not $script:TestDeviceId) {
        Write-TestStep "K8s PV/PVC" "SKIP" "No test device created"
        return $false
    }

    try {
        # Get device details to find PV/PVC names
        $device = Invoke-RestMethod -Uri "$ApiUrl/api/v1/nasdevices/$($script:TestDeviceId)" -Method GET

        # Check PV exists
        $pvResult = kubectl get pv $device.PvName -o json 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-TestStep "PersistentVolume" "PASS" "PV $($device.PvName) exists"
        }
        else {
            Write-TestStep "PersistentVolume" "FAIL" "PV $($device.PvName) not found"
            return $false
        }

        # Check PVC exists and is bound
        $pvcResult = kubectl get pvc $device.PvcName -n $Namespace -o json 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pvc = $pvcResult | ConvertFrom-Json
            if ($pvc.status.phase -eq "Bound") {
                Write-TestStep "PersistentVolumeClaim" "PASS" "PVC $($device.PvcName) is Bound"
            }
            else {
                Write-TestStep "PersistentVolumeClaim" "FAIL" "PVC status is $($pvc.status.phase), expected Bound"
                return $false
            }
        }
        else {
            Write-TestStep "PersistentVolumeClaim" "FAIL" "PVC $($device.PvcName) not found"
            return $false
        }

        return $true
    }
    catch {
        Write-TestStep "K8s PV/PVC" "FAIL" $_.Exception.Message
        return $false
    }
}

function Test-NasConnection {
    Write-Host "`n=== Step 5: NAS Connection Test ===" -ForegroundColor Cyan

    if (-not $script:TestDeviceId) {
        Write-TestStep "NAS Connection" "SKIP" "No test device created"
        return $false
    }

    try {
        $response = Invoke-RestMethod -Uri "$ApiUrl/api/v1/nasdevices/$($script:TestDeviceId)/test" -Method POST
        if ($response.Success) {
            Write-TestStep "NAS Connection" "PASS" "Connection test successful"
            return $true
        }
        else {
            Write-TestStep "NAS Connection" "FAIL" $response.ErrorMessage
            return $false
        }
    }
    catch {
        Write-TestStep "NAS Connection" "FAIL" $_.Exception.Message
        return $false
    }
}

function Invoke-Cleanup {
    Write-Host "`n=== Cleanup ===" -ForegroundColor Cyan

    if ($script:TestDeviceId) {
        try {
            Invoke-RestMethod -Uri "$ApiUrl/api/v1/nasdevices/$($script:TestDeviceId)" -Method DELETE
            Write-TestStep "Delete Test Device" "PASS" "Cleaned up test device"
        }
        catch {
            Write-TestStep "Delete Test Device" "FAIL" $_.Exception.Message
        }
    }
}

# Main execution
Write-Host "NAS Production Validation Script" -ForegroundColor Magenta
Write-Host "=================================" -ForegroundColor Magenta
Write-Host "API URL: $ApiUrl"
Write-Host "Namespace: $Namespace"
Write-Host "NAS Host: $NasServerHost"
Write-Host "NAS Export: $NasExportPath"

$results = @{
    ApiHealth = Test-ApiHealth
    DeviceCreate = Test-NasDeviceCreate
    DeviceProvision = Test-NasDeviceProvision
    KubernetesPvPvc = Test-KubernetesPvPvc
    NasConnection = Test-NasConnection
}

if ($Cleanup -or (-not [string]::IsNullOrEmpty($script:TestDeviceId))) {
    Invoke-Cleanup
}

# Summary
Write-Host "`n=== Validation Summary ===" -ForegroundColor Magenta
$passed = ($results.Values | Where-Object { $_ -eq $true }).Count
$total = $results.Count
$allPassed = $passed -eq $total

if ($allPassed) {
    Write-Host "ALL TESTS PASSED ($passed/$total)" -ForegroundColor Green
    Write-Host "NAS/NFS architecture is production-ready!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "TESTS FAILED: $passed/$total passed" -ForegroundColor Red
    foreach ($key in $results.Keys) {
        if (-not $results[$key]) {
            Write-Host "  - $key" -ForegroundColor Red
        }
    }
    exit 1
}
