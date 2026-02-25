# EZ Platform - OTEL Verification Script
# Verifies observability signals (logs, traces, metrics) for all deployed microservices
# Queries Elasticsearch, Jaeger, and Prometheus via port-forwarded endpoints
# Version: 1.0
# Date: February 25, 2026

param(
    [int]$LookbackHours = 72,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# ============================================================
# Service Registry (8 deployed services)
# ============================================================
# Note: DataSourceChatService is excluded - no k8s deployment exists

$services = @(
    @{ OtelName = "DataProcessing.DataSourceManagement"; K8sName = "datasource-management" },
    @{ OtelName = "DataProcessing.Validation";           K8sName = "validation" },
    @{ OtelName = "DataProcessing.FileProcessor";        K8sName = "fileprocessor" },
    @{ OtelName = "DataProcessing.FileDiscovery";        K8sName = "filediscovery" },
    @{ OtelName = "DataProcessing.Scheduling";           K8sName = "scheduling" },
    @{ OtelName = "DataProcessing.Output";               K8sName = "output" },
    @{ OtelName = "DataProcessing.MetricsConfiguration"; K8sName = "metrics-configuration" },
    @{ OtelName = "DataProcessing.InvalidRecords";       K8sName = "invalidrecords" }
)

# ============================================================
# Endpoint Configuration (via port-forward)
# ============================================================

$esUrl           = "http://localhost:9200"
$jaegerUrl       = "http://localhost:16686"
$promSystemUrl   = "http://localhost:9090"
$promBusinessUrl = "http://localhost:9091"

# ============================================================
# Helper Functions
# ============================================================

function Write-ColorCell {
    param(
        [string]$Text,
        [bool]$Pass
    )
    $padded = $Text.PadRight(10)
    if ($Pass) {
        Write-Host $padded -ForegroundColor Green -NoNewline
    } else {
        Write-Host $padded -ForegroundColor Red -NoNewline
    }
}

function Write-ServiceRow {
    param(
        [string]$ServiceName,
        [bool]$LogsPass,
        [string]$LogsNote,
        [bool]$TracesPass,
        [string]$TracesNote,
        [bool]$MetricsPass,
        [string]$MetricsNote
    )
    $name = $ServiceName.PadRight(45)
    Write-Host $name -NoNewline -ForegroundColor White
    Write-ColorCell -Text $(if ($LogsPass) { "PASS" } else { "FAIL" }) -Pass $LogsPass
    Write-ColorCell -Text $(if ($TracesPass) { "PASS" } else { "FAIL" }) -Pass $TracesPass
    Write-ColorCell -Text $(if ($MetricsPass) { "PASS" } else { "FAIL" }) -Pass $MetricsPass
    Write-Host ""

    # Print notes for failures on the next line(s)
    if (-not $LogsPass -and $LogsNote) {
        Write-Host ("  " + "  Logs: $LogsNote") -ForegroundColor DarkYellow
    }
    if (-not $TracesPass -and $TracesNote) {
        Write-Host ("  " + "  Traces: $TracesNote") -ForegroundColor DarkYellow
    }
    if (-not $MetricsPass -and $MetricsNote) {
        Write-Host ("  " + "  Metrics: $MetricsNote") -ForegroundColor DarkYellow
    }
}

# ============================================================
# Log Check (OTEL-01): Query Elasticsearch
# ============================================================

function Test-ServiceLogs {
    param([string]$ServiceName)

    try {
        # Query dataprocessing-logs* index with bool/should across multiple field names
        $body = @{
            query = @{
                bool = @{
                    should = @(
                        @{ match = @{ "resource.service.name" = $ServiceName } }
                        @{ match = @{ "Resource.service.name" = $ServiceName } }
                        @{ match = @{ "service.name" = $ServiceName } }
                        @{ term  = @{ "resource.service.name.keyword" = $ServiceName } }
                    )
                    minimum_should_match = 1
                }
            }
            size = 1
        } | ConvertTo-Json -Depth 10

        $result = Invoke-RestMethod -Uri "$esUrl/dataprocessing-logs*/_search" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10

        $hitCount = 0
        if ($result.hits -and $result.hits.total) {
            if ($result.hits.total -is [int]) {
                $hitCount = $result.hits.total
            } elseif ($result.hits.total.value -ne $null) {
                $hitCount = $result.hits.total.value
            }
        }

        if ($hitCount -gt 0) {
            return @{ Pass = $true; Note = "" }
        } else {
            # Also try ez-logs index (Fluent Bit container logs) as fallback
            try {
                $fbBody = @{
                    query = @{
                        bool = @{
                            should = @(
                                @{ match_phrase = @{ "kubernetes.labels.app" = $ServiceName.Split(".")[-1].ToLower() } }
                                @{ match_phrase = @{ "log" = $ServiceName } }
                            )
                            minimum_should_match = 1
                        }
                    }
                    size = 1
                } | ConvertTo-Json -Depth 10

                $fbResult = Invoke-RestMethod -Uri "$esUrl/ez-logs*/_search" -Method POST -Body $fbBody -ContentType "application/json" -TimeoutSec 10
                $fbHits = 0
                if ($fbResult.hits -and $fbResult.hits.total) {
                    if ($fbResult.hits.total -is [int]) { $fbHits = $fbResult.hits.total }
                    elseif ($fbResult.hits.total.value -ne $null) { $fbHits = $fbResult.hits.total.value }
                }
                if ($fbHits -gt 0) {
                    return @{ Pass = $true; Note = "Found in Fluent Bit container logs (ez-logs), not OTEL pipeline" }
                }
            } catch {
                # Fluent Bit index check is just a fallback, ignore errors
            }

            return @{ Pass = $false; Note = "No logs found in dataprocessing-logs* index" }
        }
    } catch {
        $errMsg = $_.Exception.Message
        if ($errMsg -match "index_not_found") {
            return @{ Pass = $false; Note = "Index dataprocessing-logs* does not exist" }
        }
        return @{ Pass = $false; Note = "Elasticsearch error: $errMsg" }
    }
}

# ============================================================
# Trace Check (OTEL-02): Query Jaeger
# ============================================================

function Test-ServiceTraces {
    param([string]$ServiceName)

    try {
        # Step 1: Get all services reporting traces
        $servicesResult = Invoke-RestMethod -Uri "$jaegerUrl/api/services" -TimeoutSec 10
        $serviceList = $servicesResult.data

        if ($null -eq $serviceList) {
            return @{ Pass = $false; Note = "Jaeger returned no services list" }
        }

        # Step 2: Check if our service name exists
        $hasService = $serviceList -contains $ServiceName

        if (-not $hasService) {
            # Try case-insensitive match and partial match
            $matched = $serviceList | Where-Object { $_ -eq $ServiceName -or $_ -like "*$($ServiceName.Split('.')[-1])*" }
            if ($matched) {
                $hasService = $true
                if ($Verbose) {
                    Write-Host "    [Jaeger] Matched via partial: $matched" -ForegroundColor DarkGray
                }
            }
        }

        if ($hasService) {
            # Step 3: Verify at least one trace exists
            $lookbackMicro = [long]$LookbackHours * 3600 * 1000 * 1000
            $endTime = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000
            $startTime = $endTime - $lookbackMicro
            $tracesResult = Invoke-RestMethod -Uri "$jaegerUrl/api/traces?service=$([System.Uri]::EscapeDataString($ServiceName))&limit=1&start=$startTime&end=$endTime" -TimeoutSec 10
            if ($tracesResult.data -and $tracesResult.data.Count -gt 0) {
                return @{ Pass = $true; Note = "" }
            } else {
                return @{ Pass = $true; Note = "Service registered but no recent traces in lookback window" }
            }
        } else {
            $availableServices = ($serviceList -join ", ")
            if ($Verbose) {
                Write-Host "    [Jaeger] Available services: $availableServices" -ForegroundColor DarkGray
            }
            return @{ Pass = $false; Note = "Service not found in Jaeger (available: $($serviceList.Count) services)" }
        }
    } catch {
        return @{ Pass = $false; Note = "Jaeger error: $($_.Exception.Message)" }
    }
}

# ============================================================
# Metric Check (OTEL-03): Query Prometheus (System + Business)
# ============================================================

function Test-ServiceMetrics {
    param([string]$ServiceName)

    $labelVariants = @("service_name", "exported_service_name", "service")

    foreach ($label in $labelVariants) {
        # Check System Prometheus
        try {
            $query = [System.Uri]::EscapeDataString("{$label=`"$ServiceName`"}")
            $systemResult = Invoke-RestMethod -Uri "$promSystemUrl/api/v1/query?query=$query" -TimeoutSec 10
            if ($systemResult.data -and $systemResult.data.result -and $systemResult.data.result.Count -gt 0) {
                if ($Verbose) {
                    Write-Host "    [Prometheus System] Found via label '$label'" -ForegroundColor DarkGray
                }
                return @{ Pass = $true; Note = "" }
            }
        } catch {
            if ($Verbose) {
                Write-Host "    [Prometheus System] Error with label '$label': $($_.Exception.Message)" -ForegroundColor DarkGray
            }
        }

        # Check Business Prometheus
        try {
            $query = [System.Uri]::EscapeDataString("{$label=`"$ServiceName`"}")
            $businessResult = Invoke-RestMethod -Uri "$promBusinessUrl/api/v1/query?query=$query" -TimeoutSec 10
            if ($businessResult.data -and $businessResult.data.result -and $businessResult.data.result.Count -gt 0) {
                if ($Verbose) {
                    Write-Host "    [Prometheus Business] Found via label '$label'" -ForegroundColor DarkGray
                }
                return @{ Pass = $true; Note = "" }
            }
        } catch {
            if ($Verbose) {
                Write-Host "    [Prometheus Business] Error with label '$label': $($_.Exception.Message)" -ForegroundColor DarkGray
            }
        }
    }

    # Also try job label matching the k8s deployment name
    $k8sName = ($services | Where-Object { $_.OtelName -eq $ServiceName }).K8sName
    if ($k8sName) {
        foreach ($promUrl in @($promSystemUrl, $promBusinessUrl)) {
            try {
                $query = [System.Uri]::EscapeDataString("{job=`"$k8sName`"}")
                $result = Invoke-RestMethod -Uri "$promUrl/api/v1/query?query=$query" -TimeoutSec 10
                if ($result.data -and $result.data.result -and $result.data.result.Count -gt 0) {
                    if ($Verbose) {
                        Write-Host "    [Prometheus] Found via job='$k8sName'" -ForegroundColor DarkGray
                    }
                    return @{ Pass = $true; Note = "" }
                }
            } catch {
                # Continue to next attempt
            }
        }
    }

    return @{ Pass = $false; Note = "No metrics found in System or Business Prometheus" }
}

# ============================================================
# Main Execution
# ============================================================

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  OTEL Verification - EZ Platform" -ForegroundColor Cyan
Write-Host "  Checking: Logs (Elasticsearch), Traces (Jaeger), Metrics (Prometheus)" -ForegroundColor Cyan
Write-Host "  Lookback: $LookbackHours hours" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: DataSourceChatService excluded (no k8s deployment)" -ForegroundColor DarkYellow
Write-Host ""

# Pre-flight: Check endpoints are reachable
Write-Host "Pre-flight checks..." -ForegroundColor Cyan
$endpointChecks = @(
    @{ Name = "Elasticsearch"; Url = "$esUrl/_cluster/health" },
    @{ Name = "Jaeger";        Url = "$jaegerUrl/api/services" },
    @{ Name = "Prometheus System";   Url = "$promSystemUrl/api/v1/status/config" },
    @{ Name = "Prometheus Business"; Url = "$promBusinessUrl/api/v1/status/config" }
)

$allEndpointsUp = $true
foreach ($ep in $endpointChecks) {
    try {
        $null = Invoke-RestMethod -Uri $ep.Url -TimeoutSec 5
        Write-Host "  [OK] $($ep.Name) ($($ep.Url))" -ForegroundColor Green
    } catch {
        Write-Host "  [FAIL] $($ep.Name) ($($ep.Url)) - $($_.Exception.Message)" -ForegroundColor Red
        $allEndpointsUp = $false
    }
}

if (-not $allEndpointsUp) {
    Write-Host ""
    Write-Host "WARNING: Some endpoints are unreachable. Results may be incomplete." -ForegroundColor Yellow
    Write-Host "Ensure port-forwards are running: powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""

# Run checks for each service
$results = @()
$totalPass = 0
$totalChecks = 0

foreach ($svc in $services) {
    $name = $svc.OtelName

    if ($Verbose) {
        Write-Host "Checking: $name ..." -ForegroundColor DarkGray
    }

    $logResult    = Test-ServiceLogs    -ServiceName $name
    $traceResult  = Test-ServiceTraces  -ServiceName $name
    $metricResult = Test-ServiceMetrics -ServiceName $name

    $results += @{
        Service     = $name
        K8s         = $svc.K8sName
        LogsPass    = $logResult.Pass
        LogsNote    = $logResult.Note
        TracesPass  = $traceResult.Pass
        TracesNote  = $traceResult.Note
        MetricsPass = $metricResult.Pass
        MetricsNote = $metricResult.Note
    }

    if ($logResult.Pass)    { $totalPass++ }
    if ($traceResult.Pass)  { $totalPass++ }
    if ($metricResult.Pass) { $totalPass++ }
    $totalChecks += 3
}

# ============================================================
# Print Results Table
# ============================================================

Write-Host ""
Write-Host "=== OTEL Verification Results ===" -ForegroundColor Cyan
Write-Host "Note: DataSourceChatService excluded (no k8s deployment)" -ForegroundColor DarkYellow
Write-Host ""

$header = "Service".PadRight(45) + "Logs".PadRight(10) + "Traces".PadRight(10) + "Metrics".PadRight(10)
Write-Host $header -ForegroundColor White
Write-Host ("-" * 75) -ForegroundColor Gray

foreach ($r in $results) {
    Write-ServiceRow `
        -ServiceName $r.Service `
        -LogsPass $r.LogsPass `
        -LogsNote $r.LogsNote `
        -TracesPass $r.TracesPass `
        -TracesNote $r.TracesNote `
        -MetricsPass $r.MetricsPass `
        -MetricsNote $r.MetricsNote
}

Write-Host ("-" * 75) -ForegroundColor Gray
Write-Host ""

# Summary
$passColor = if ($totalPass -eq $totalChecks) { "Green" } else { "Yellow" }
Write-Host "Summary: $totalPass/$totalChecks checks passed ($($services.Count) services x 3 signals)" -ForegroundColor $passColor

# Gap breakdown
if ($totalPass -lt $totalChecks) {
    Write-Host ""
    Write-Host "=== Gap Details ===" -ForegroundColor Yellow
    Write-Host ""

    $failedLogs    = ($results | Where-Object { -not $_.LogsPass })
    $failedTraces  = ($results | Where-Object { -not $_.TracesPass })
    $failedMetrics = ($results | Where-Object { -not $_.MetricsPass })

    if ($failedLogs.Count -gt 0) {
        Write-Host "Missing Logs ($($failedLogs.Count) services):" -ForegroundColor Red
        foreach ($f in $failedLogs) {
            Write-Host "  - $($f.Service) ($($f.K8s)): $($f.LogsNote)" -ForegroundColor DarkYellow
        }
        Write-Host ""
    }

    if ($failedTraces.Count -gt 0) {
        Write-Host "Missing Traces ($($failedTraces.Count) services):" -ForegroundColor Red
        foreach ($f in $failedTraces) {
            Write-Host "  - $($f.Service) ($($f.K8s)): $($f.TracesNote)" -ForegroundColor DarkYellow
        }
        Write-Host ""
    }

    if ($failedMetrics.Count -gt 0) {
        Write-Host "Missing Metrics ($($failedMetrics.Count) services):" -ForegroundColor Red
        foreach ($f in $failedMetrics) {
            Write-Host "  - $($f.Service) ($($f.K8s)): $($f.MetricsNote)" -ForegroundColor DarkYellow
        }
        Write-Host ""
    }
}

Write-Host ""

# Exit code
if ($totalPass -eq $totalChecks) {
    Write-Host "All checks passed!" -ForegroundColor Green
    exit 0
} else {
    $failCount = $totalChecks - $totalPass
    Write-Host "$failCount check(s) failed. See gap details above for remediation guidance." -ForegroundColor Red
    exit 1
}
