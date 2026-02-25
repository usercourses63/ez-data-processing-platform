# verify-file-simulator.ps1
# Verifies cross-cluster connectivity from EZ Platform to file-simulator
#
# Usage:
#   .\verify-file-simulator.ps1              # Update ConfigMap and test connectivity
#   .\verify-file-simulator.ps1 -Apply       # Update ConfigMap, apply to cluster, and test
#   .\verify-file-simulator.ps1 -TestOnly    # Only test connectivity (no ConfigMap changes)
#
# Prerequisites:
#   - file-simulator Minikube profile running
#   - kubectl configured with ez-platform context
#   - PowerShell 5.1 or later

param(
    [switch]$Apply,      # Apply ConfigMap after updating IP
    [switch]$TestOnly    # Only test connectivity, don't update ConfigMap
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== File Simulator Connectivity Verification ===" -ForegroundColor Cyan
Write-Host ""

# Get file-simulator Minikube IP
Write-Host "Getting file-simulator Minikube IP..." -ForegroundColor Cyan
try {
    $simulatorIp = (minikube ip -p file-simulator 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "minikube command failed"
    }
    # Validate IP format
    if ($simulatorIp -notmatch '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
        throw "Invalid IP format: $simulatorIp"
    }
    Write-Host "File-simulator IP: $simulatorIp" -ForegroundColor Green
} catch {
    Write-Host "ERROR: file-simulator cluster not running or not accessible." -ForegroundColor Red
    Write-Host ""
    Write-Host "To start file-simulator:" -ForegroundColor Yellow
    Write-Host "  minikube start --profile file-simulator --driver=hyperv --memory=8192 --cpus=4" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "If using Docker driver:" -ForegroundColor Yellow
    Write-Host "  minikube start --profile file-simulator --driver=docker --memory=8192 --cpus=4" -ForegroundColor Yellow
    exit 1
}

if (-not $TestOnly) {
    # Update ConfigMap with actual IP
    Write-Host ""
    Write-Host "=== Updating ConfigMap ===" -ForegroundColor Cyan

    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $configMapPath = Join-Path $scriptDir "..\k8s\configmaps\file-simulator-config.yaml"
    $configMapPath = (Resolve-Path $configMapPath).Path

    if (-not (Test-Path $configMapPath)) {
        Write-Host "ERROR: ConfigMap not found at $configMapPath" -ForegroundColor Red
        exit 1
    }

    $content = Get-Content $configMapPath -Raw
    $updated = $content -replace '\{\{FILE_SIMULATOR_IP\}\}', $simulatorIp

    # Write to temp file for applying
    $tempPath = Join-Path $env:TEMP "file-simulator-config-resolved.yaml"
    $updated | Out-File -FilePath $tempPath -Encoding utf8 -NoNewline
    Write-Host "ConfigMap updated with IP: $simulatorIp"
    Write-Host "Resolved ConfigMap saved to: $tempPath"

    if ($Apply) {
        Write-Host ""
        Write-Host "=== Applying ConfigMap to ez-platform ===" -ForegroundColor Cyan

        # Try to apply to the default minikube context (ez-platform)
        $result = kubectl --context=minikube apply -f $tempPath -n ez-platform 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "ConfigMap applied successfully" -ForegroundColor Green
        } else {
            Write-Host "Failed to apply ConfigMap: $result" -ForegroundColor Red
            Write-Host ""
            Write-Host "Troubleshooting:" -ForegroundColor Yellow
            Write-Host "  1. Ensure ez-platform cluster is running: minikube status" -ForegroundColor Yellow
            Write-Host "  2. Ensure namespace exists: kubectl create namespace ez-platform" -ForegroundColor Yellow
            Write-Host "  3. Try manual apply: kubectl apply -f $tempPath -n ez-platform" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "ConfigMap NOT applied (use -Apply flag to apply to cluster)" -ForegroundColor Yellow
    }
}

# Test connectivity
Write-Host ""
Write-Host "=== Testing Protocol Connectivity ===" -ForegroundColor Cyan
Write-Host ""

$tests = @(
    @{ Name = "FTP";      Port = 30021; Description = "FTP Server" },
    @{ Name = "SFTP";     Port = 30022; Description = "SFTP Server" },
    @{ Name = "S3/MinIO"; Port = 30900; Description = "S3-compatible API" },
    @{ Name = "HTTP";     Port = 30088; Description = "HTTP Server" },
    @{ Name = "WebDAV";   Port = 30089; Description = "WebDAV Server" },
    @{ Name = "NFS-1";    Port = 32150; Description = "NFS Input Server 1" },
    @{ Name = "NFS-2";    Port = 32151; Description = "NFS Input Server 2" },
    @{ Name = "NFS-Out";  Port = 32154; Description = "NFS Output Server" }
)

$results = @()
foreach ($test in $tests) {
    try {
        $result = Test-NetConnection -ComputerName $simulatorIp -Port $test.Port -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
        $success = $result.TcpTestSucceeded
    } catch {
        $success = $false
    }

    $status = if ($success) { "OK  " } else { "FAIL" }
    $color = if ($success) { "Green" } else { "Red" }

    $portStr = $test.Port.ToString().PadRight(5)
    Write-Host "  $($test.Name.PadRight(10)) : $status - Port $portStr - $($test.Description)" -ForegroundColor $color
    $results += @{ Test = $test.Name; Port = $test.Port; Success = $success }
}

# Test S3 health endpoint
Write-Host ""
Write-Host "=== Testing S3/MinIO Health ===" -ForegroundColor Cyan
try {
    $s3Response = Invoke-WebRequest -Uri "http://${simulatorIp}:30900/minio/health/live" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    if ($s3Response.StatusCode -eq 200) {
        Write-Host "  S3 Health  : OK   - MinIO responding" -ForegroundColor Green
        $results += @{ Test = "S3 Health"; Port = 30900; Success = $true }
    }
} catch {
    Write-Host "  S3 Health  : FAIL - MinIO not responding or not healthy" -ForegroundColor Red
    $results += @{ Test = "S3 Health"; Port = 30900; Success = $false }
}

# Summary
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_.Success }).Count
$total = $results.Count
$color = if ($passed -eq $total) { "Green" } elseif ($passed -gt 0) { "Yellow" } else { "Red" }
Write-Host "Results: $passed/$total tests passed" -ForegroundColor $color
Write-Host ""

if ($passed -lt $total) {
    Write-Host "Troubleshooting failed endpoints:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Verify file-simulator is deployed:" -ForegroundColor Yellow
    Write-Host "   helm list --kube-context=file-simulator -n file-simulator" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Check pods are running:" -ForegroundColor Yellow
    Write-Host "   kubectl --context=file-simulator get pods -n file-simulator" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Verify NodePort services:" -ForegroundColor Yellow
    Write-Host "   kubectl --context=file-simulator get svc -n file-simulator" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Check specific service logs:" -ForegroundColor Yellow
    Write-Host "   kubectl --context=file-simulator logs -l app=<service-name> -n file-simulator" -ForegroundColor Gray
    Write-Host ""

    # List failed tests
    Write-Host "Failed endpoints:" -ForegroundColor Red
    $results | Where-Object { -not $_.Success } | ForEach-Object {
        Write-Host "  - $($_.Test) (port $($_.Port))" -ForegroundColor Red
    }
    exit 1
}

Write-Host "File-simulator connectivity verified successfully!" -ForegroundColor Green
Write-Host ""
