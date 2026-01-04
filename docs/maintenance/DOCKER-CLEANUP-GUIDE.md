# Docker Cleanup Guide - Task Orchestrator

**Problem:** Multiple task-orchestrator Docker containers accumulate over time, consuming system resources.

**Root Cause:** The task-orchestrator MCP server creates Docker containers for each session/operation but doesn't automatically clean them up.

---

## Quick Cleanup

### Clean All Task-Orchestrator Containers

```powershell
# Stop and remove all task-orchestrator containers
docker stop $(docker ps -a --filter "ancestor=ghcr.io/jpicklyk/task-orchestrator:latest" -q)
docker rm $(docker ps -a --filter "ancestor=ghcr.io/jpicklyk/task-orchestrator:latest" -q)
```

### Verify Cleanup

```powershell
# Check remaining containers
docker ps -a

# Should only show: minikube, github-mcp-server, and other essential containers
```

---

## Using the Cleanup Script

We've created an automated cleanup script:

```powershell
# Run the cleanup script
powershell.exe -ExecutionPolicy Bypass -File "C:\Users\UserC\source\repos\EZ\scripts\cleanup-docker-containers.ps1"
```

**Features:**
- Shows current task-orchestrator containers
- Asks for confirmation before cleanup
- Stops and removes containers safely
- Displays remaining containers

---

## Docker System Commands

### Remove Stopped Containers (All Images)

```bash
# Remove all stopped containers
docker container prune

# With confirmation bypass
docker container prune -f
```

### Remove Unused Images

```bash
# Remove unused images
docker image prune

# Remove all unused images (not just dangling)
docker image prune -a
```

### Full System Cleanup

```bash
# Remove:
# - All stopped containers
# - All networks not used by at least one container
# - All dangling images
# - All dangling build cache
docker system prune

# Add volumes cleanup
docker system prune --volumes

# Force cleanup without confirmation
docker system prune -af --volumes
```

---

## Monitoring Container Growth

### Check Container Count

```bash
# Total containers
docker ps -a | wc -l

# Running containers
docker ps | wc -l

# Task-orchestrator containers
docker ps -a --filter "ancestor=ghcr.io/jpicklyk/task-orchestrator:latest" | wc -l
```

### Check Resource Usage

```bash
# Disk usage by containers
docker system df

# Detailed disk usage
docker system df -v

# Container resource consumption
docker stats --no-stream
```

---

## Preventing Future Buildup

### Option 1: Configure MCP Server with `--rm` Flag

If you have access to the MCP server configuration, add the `--rm` flag to Docker run commands:

```json
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "docker",
      "args": [
        "run",
        "--rm",  // <- Add this flag
        "-i",
        "ghcr.io/jpicklyk/task-orchestrator:latest"
      ]
    }
  }
}
```

The `--rm` flag automatically removes containers when they exit.

### Option 2: Scheduled Cleanup Task

Create a Windows scheduled task to run cleanup weekly:

```powershell
# Create scheduled task (run as Administrator)
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Users\UserC\source\repos\EZ\scripts\cleanup-docker-containers.ps1"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 2am
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Register-ScheduledTask -TaskName "Docker Cleanup - Task Orchestrator" -Action $action -Trigger $trigger -Principal $principal
```

### Option 3: Manual Weekly Cleanup

Set a reminder to run cleanup weekly:
- **Day:** Every Sunday
- **Time:** After work or before shutdown
- **Command:** Run `cleanup-docker-containers.ps1`

---

## When to Clean Up

### Immediate Cleanup Needed When:
- ✗ Docker Desktop shows high memory usage
- ✗ System performance degrades
- ✗ More than 10 task-orchestrator containers exist
- ✗ Disk space warning appears

### Regular Maintenance Schedule:
- **Weekly:** Run cleanup script (automated or manual)
- **Monthly:** Full Docker system cleanup with `docker system prune`
- **Quarterly:** Review and remove unused images

---

## Troubleshooting

### Containers Won't Stop

```bash
# Force stop
docker kill $(docker ps -a --filter "ancestor=ghcr.io/jpicklyk/task-orchestrator:latest" -q)
```

### Containers Won't Remove

```bash
# Force remove
docker rm -f $(docker ps -a --filter "ancestor=ghcr.io/jpicklyk/task-orchestrator:latest" -q)
```

### Permission Denied

```bash
# Run PowerShell as Administrator
# Right-click PowerShell -> Run as Administrator
```

### Docker Daemon Not Running

```bash
# Start Docker Desktop
# Wait for Docker to fully start
# Try cleanup again
```

---

## Current Status (After Cleanup)

**Containers Removed:** 17 task-orchestrator containers
**Date:** January 4, 2026
**Remaining Containers:**
- `minikube` - Kubernetes development environment
- `github-mcp-server` - GitHub MCP integration
- Other essential containers

**Freed Resources:**
- Memory: ~2-3 GB (estimated)
- Disk: ~500 MB - 1 GB (estimated)

---

## Best Practices

1. **Monitor Weekly:** Check container count every week
2. **Clean Regularly:** Run cleanup script or Docker prune monthly
3. **Watch Resources:** Monitor Docker Desktop memory usage
4. **Update MCP Config:** Add `--rm` flag if possible
5. **Document Issues:** Note any recurring container buildup patterns

---

## Related Files

- **Cleanup Script:** [`scripts/cleanup-docker-containers.ps1`](../../scripts/cleanup-docker-containers.ps1)
- **Project Config:** [`CLAUDE.md`](../../CLAUDE.md)

---

## Quick Reference

```bash
# View all containers
docker ps -a

# Stop task-orchestrator containers
docker stop $(docker ps -a -q --filter ancestor=ghcr.io/jpicklyk/task-orchestrator:latest)

# Remove task-orchestrator containers
docker rm $(docker ps -a -q --filter ancestor=ghcr.io/jpicklyk/task-orchestrator:latest)

# One-liner cleanup
docker rm -f $(docker ps -a -q --filter ancestor=ghcr.io/jpicklyk/task-orchestrator:latest)

# Full system cleanup
docker system prune -af --volumes
```

---

**Last Updated:** January 4, 2026
**Status:** ✅ Cleanup Completed
