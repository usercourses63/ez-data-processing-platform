# Docker Container Cleanup Script for Task Orchestrator
# Removes old/stale task-orchestrator containers to free up resources

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host "Docker Container Cleanup - Task Orchestrator" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
$dockerRunning = docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Get task-orchestrator containers
Write-Host "Checking for task-orchestrator containers..." -ForegroundColor Yellow
$containers = docker ps -a --filter "ancestor=ghcr.io/jpicklyk/task-orchestrator:latest" -q

if ($containers) {
    $containerCount = ($containers | Measure-Object).Count
    Write-Host "Found $containerCount task-orchestrator container(s)" -ForegroundColor Yellow
    Write-Host ""

    # Show container details
    Write-Host "Container Details:" -ForegroundColor Cyan
    docker ps -a --filter "ancestor=ghcr.io/jpicklyk/task-orchestrator:latest" --format "table {{.ID}}\t{{.Status}}\t{{.CreatedAt}}\t{{.Names}}"
    Write-Host ""

    # Ask for confirmation
    $confirmation = Read-Host "Do you want to stop and remove these containers? (y/n)"

    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        Write-Host ""
        Write-Host "Stopping containers..." -ForegroundColor Yellow
        docker stop $containers 2>$null

        Write-Host "Removing containers..." -ForegroundColor Yellow
        docker rm $containers 2>$null

        Write-Host ""
        Write-Host "✓ Cleanup complete!" -ForegroundColor Green
        Write-Host ""

        # Show freed resources
        Write-Host "Remaining containers:" -ForegroundColor Cyan
        docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
    } else {
        Write-Host ""
        Write-Host "Cleanup cancelled." -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ No task-orchestrator containers found." -ForegroundColor Green
}

Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 79) -ForegroundColor Cyan
Write-Host ""

# Optionally clean up stopped containers from all images
Write-Host "Additional Cleanup Options:" -ForegroundColor Cyan
Write-Host "  1. Remove all stopped containers: docker container prune" -ForegroundColor Gray
Write-Host "  2. Remove unused images: docker image prune" -ForegroundColor Gray
Write-Host "  3. Full cleanup: docker system prune" -ForegroundColor Gray
Write-Host ""
