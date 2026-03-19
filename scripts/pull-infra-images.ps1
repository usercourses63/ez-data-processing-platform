# Pull EZ Platform infrastructure images and save as .tar files
#
# Usage:
#   pwsh -File scripts/pull-infra-images.ps1 [-OutputDir <path>]
#
# Default output: dist/images/infrastructure

param(
    [string]$OutputDir = "dist/images/infrastructure"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

# Resolve relative to repo root
if (-not [System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir = Join-Path $RepoRoot $OutputDir
}

Write-Host "Pulling EZ Platform infrastructure images" -ForegroundColor Cyan
Write-Host "Output: $OutputDir" -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# 11 infrastructure images matching IMAGE-MANIFEST.txt
$Images = @(
    "mongo:8.0",
    "rabbitmq:3.12-management-alpine",
    "confluentinc/cp-kafka:7.5.0",
    "confluentinc/cp-zookeeper:7.5.0",
    "hazelcast/hazelcast:5.6",
    "docker.elastic.co/elasticsearch/elasticsearch:8.17.0",
    "prom/prometheus:v2.51.0",
    "grafana/grafana:10.4.0",
    "jaegertracing/all-in-one:1.54",
    "otel/opentelemetry-collector-contrib:0.96.0",
    "fluent/fluent-bit:3.0"
)

$Failed = @()

foreach ($image in $Images) {
    # Derive safe filename: replace / and : with -
    $safeName = $image -replace '[/:]', '-'
    $tarFile = Join-Path $OutputDir "$safeName.tar"

    Write-Host "[infra] Pulling $image ..." -ForegroundColor Yellow
    docker pull $image
    if ($LASTEXITCODE -ne 0) {
        $Failed += $image
        Write-Host "[infra] FAILED to pull $image" -ForegroundColor Red
        continue
    }

    Write-Host "[infra] Saving to $tarFile ..." -ForegroundColor Yellow
    docker save $image -o $tarFile
    if ($LASTEXITCODE -ne 0) {
        $Failed += $image
        Write-Host "[infra] FAILED to save $image" -ForegroundColor Red
        continue
    }

    Write-Host "[infra] Saved $image -> $safeName.tar" -ForegroundColor Green
}

if ($Failed.Count -gt 0) {
    Write-Host "FAILED images: $($Failed -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host "All $($Images.Count) infrastructure images saved to $OutputDir" -ForegroundColor Green
Get-ChildItem $OutputDir | Format-Table Name, @{N='Size';E={[math]::Round($_.Length/1MB,1).ToString()+'MB'}}
