# Persistent Frontend Port Forward
$ErrorActionPreference = "SilentlyContinue"

# Kill existing kubectl processes
Get-Process kubectl -ErrorAction SilentlyContinue | Stop-Process -Force

Start-Sleep -Seconds 2

# Start port forward on port 7000 (port 8080 blocked by Windows Hyper-V)
Write-Host "Starting frontend port forward: localhost:7000 -> frontend:80"
kubectl port-forward -n ez-platform svc/frontend 7000:80

# If it exits, try again
Write-Host "Port forward ended. Press Ctrl+C to stop."
