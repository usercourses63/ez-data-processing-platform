---
last-verified: 2026-02-02
status: current
---
# Task Orchestrator - Native Installation (No Docker)

**Goal:** Install task-orchestrator MCP server directly on Windows without Docker containers

**Problem:** Docker containers accumulate and consume resources unnecessarily

**Solution:** Run task-orchestrator natively using Python or Java

---

## Option 1: Python Task Orchestrator (RECOMMENDED - Easiest)

**Repository:** [EchoingVesper/mcp-task-orchestrator](https://github.com/EchoingVesper/mcp-task-orchestrator)

### Prerequisites

```powershell
# Check Python version (3.10+ required)
python --version

# Check pip
pip --version
```

### Installation Steps

#### 1. Install via pip (Recommended)

```bash
# Install the package
pip install mcp-task-orchestrator

# Or with uv (faster)
uvx mcp-task-orchestrator
```

#### 2. Manual Installation from Source

```bash
# Clone the repository
git clone https://github.com/EchoingVesper/mcp-task-orchestrator.git
cd mcp-task-orchestrator

# Install dependencies
pip install -e .

# Or using uv
uv pip install -e .
```

### Configuration

Add to your Claude Code MCP configuration file:

**Location:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "python",
      "args": ["-m", "mcp_task_orchestrator"]
    }
  }
}
```

Or if installed with uvx:

```json
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "uvx",
      "args": ["mcp-task-orchestrator"]
    }
  }
}
```

### Verification

```bash
# Test the server
python -m mcp_task_orchestrator

# Should output MCP server information
```

### Features

- ✅ Zero Docker containers
- ✅ Fast Python execution
- ✅ SQLite database (local file)
- ✅ Full MCP tools available
- ✅ Easy updates: `pip install --upgrade mcp-task-orchestrator`

---

## Option 2: Java/Kotlin Task Orchestrator (Advanced)

**Repository:** [jpicklyk/task-orchestrator](https://github.com/jpicklyk/task-orchestrator)

This is the same one currently running in Docker, but can be built and run natively.

### Prerequisites

```powershell
# Install Java 17+ (if not installed)
# Download from: https://adoptium.net/

# Check Java version
java -version

# Install Gradle (if building from source)
# Download from: https://gradle.org/install/
```

### Installation Steps

#### 1. Download Pre-built JAR

```bash
# Visit releases page
# https://github.com/jpicklyk/task-orchestrator/releases

# Download latest .jar file
# Example: mcp-task-orchestrator-1.0.0.jar
```

#### 2. Build from Source

```bash
# Clone repository
git clone https://github.com/jpicklyk/task-orchestrator.git
cd task-orchestrator

# Build with Gradle
./gradlew build

# JAR will be in: build/libs/mcp-task-orchestrator-*.jar
```

### Configuration

Add to Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "java",
      "args": [
        "-jar",
        "C:\\path\\to\\mcp-task-orchestrator.jar"
      ]
    }
  }
}
```

### Running with Debug Mode

```bash
# Set environment variable and run
set MCP_DEBUG=true
java -jar build/libs/mcp-task-orchestrator-*.jar
```

### Verification

```bash
# Run the JAR
java -jar mcp-task-orchestrator.jar

# Should start the MCP server
```

### Features

- ✅ No Docker containers
- ✅ Native Java performance
- ✅ SQLite database
- ✅ 37 MCP tools
- ✅ 9 built-in templates
- ✅ Token optimization (70-95% savings)

---

## Comparison: Docker vs Native

| Feature | Docker | Python Native | Java Native |
|---------|--------|---------------|-------------|
| **Installation** | Easy | Easiest | Moderate |
| **Container Buildup** | ❌ Yes (17+ containers) | ✅ No | ✅ No |
| **Memory Usage** | High (~3GB) | Low (~100MB) | Medium (~500MB) |
| **Startup Time** | Slow (~5s) | Fast (~1s) | Medium (~2s) |
| **Updates** | Pull image | `pip install -U` | Rebuild/download |
| **Dependencies** | Docker Desktop | Python 3.10+ | Java 17+ |
| **Best For** | Isolation | Quick setup | Full features |

---

## Recommended Setup: Python Native

For most users, **Python native installation is recommended** because:

1. ✅ **No Docker** - Eliminates container management overhead
2. ✅ **Simple Install** - One pip command
3. ✅ **Low Resources** - ~100MB memory vs 3GB with Docker
4. ✅ **Easy Updates** - Standard pip workflow
5. ✅ **Native Performance** - Direct Python execution

---

## Installation Guide: Step-by-Step

### Step 1: Remove Docker Version (Optional)

```bash
# Stop and remove Docker containers
docker rm -f $(docker ps -a -q --filter ancestor=ghcr.io/jpicklyk/task-orchestrator:latest)

# Remove from Docker images (optional)
docker rmi ghcr.io/jpicklyk/task-orchestrator:latest
```

### Step 2: Install Python Version

```bash
# Install via pip
pip install mcp-task-orchestrator

# Verify installation
python -m mcp_task_orchestrator --version
```

### Step 3: Configure Claude Code

**Find config file:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Or: `C:\Users\UserC\AppData\Roaming\Claude\claude_desktop_config.json`

**Edit configuration:**

```json
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "python",
      "args": ["-m", "mcp_task_orchestrator"],
      "env": {
        "TASK_ORCHESTRATOR_DB": "C:\\Users\\UserC\\.task-orchestrator\\tasks.db"
      }
    }
  }
}
```

### Step 4: Restart Claude Code

```bash
# Close Claude Code completely
# Restart Claude Code

# Verify MCP server is loaded
# Check Claude Code settings/logs
```

### Step 5: Test Functionality

Try these commands in Claude Code:

```
# Create a test task
create_task(title="Test Native Installation", summary="Testing native task-orchestrator")

# Get overview
get_overview()

# List tasks
search_tasks()
```

---

## Troubleshooting

### Python Version Not Found

```bash
# Install Python 3.10+
# Download from: https://www.python.org/downloads/

# Verify installation
python --version
```

### pip Command Not Found

```bash
# Reinstall Python with "Add to PATH" option
# Or use full path:
C:\Python313\Scripts\pip.exe install mcp-task-orchestrator
```

### Module Not Found Error

```bash
# Reinstall package
pip uninstall mcp-task-orchestrator
pip install mcp-task-orchestrator

# Try with user flag
pip install --user mcp-task-orchestrator
```

### Claude Code Not Loading MCP Server

1. Check config file location and syntax
2. Verify JSON is valid (no trailing commas)
3. Check Claude Code logs for errors
4. Restart Claude Code completely
5. Try running server manually: `python -m mcp_task_orchestrator`

### Permission Denied

```bash
# Run PowerShell as Administrator
# Or install with user flag
pip install --user mcp-task-orchestrator
```

---

## Database Location

### Python Version

Default database location:
- **Windows:** `%USERPROFILE%\.task-orchestrator\tasks.db`
- **Full Path:** `C:\Users\UserC\.task-orchestrator\tasks.db`

Custom location (in config):
```json
{
  "env": {
    "TASK_ORCHESTRATOR_DB": "C:\\custom\\path\\tasks.db"
  }
}
```

### Java Version

Default: `./task-orchestrator.db` (current directory)

Custom location:
```bash
java -jar mcp-task-orchestrator.jar --db-path C:\custom\path\tasks.db
```

---

## Migrating from Docker to Native

### Export Existing Tasks (if needed)

```bash
# Docker version - export data
docker exec <container-id> sqlite3 /app/tasks.db ".dump" > tasks_backup.sql

# Native version - import data
sqlite3 ~/.task-orchestrator/tasks.db < tasks_backup.sql
```

### Starting Fresh

The native installation creates a new SQLite database, so you'll start with a clean slate. Previous Docker tasks won't be accessible unless migrated.

---

## Performance Comparison

### Startup Time
- **Docker:** ~5 seconds (container startup + JVM)
- **Java Native:** ~2 seconds (JVM only)
- **Python Native:** ~1 second (Python interpreter)

### Memory Usage
- **Docker:** 2-3 GB (container + Java + overhead)
- **Java Native:** 500 MB - 1 GB (JVM only)
- **Python Native:** 50-150 MB (Python interpreter)

### Operation Speed
- All versions have similar operation speeds
- Database is SQLite in all cases
- Network overhead eliminated with native

---

## Maintenance

### Updating Python Version

```bash
# Check current version
pip show mcp-task-orchestrator

# Update to latest
pip install --upgrade mcp-task-orchestrator

# Verify new version
pip show mcp-task-orchestrator
```

### Updating Java Version

```bash
# Download new JAR from releases
# Replace old JAR file
# Restart Claude Code
```

### Database Backup

```bash
# Python version
copy %USERPROFILE%\.task-orchestrator\tasks.db tasks_backup.db

# Java version
copy .\task-orchestrator.db tasks_backup.db
```

---

## Recommended: Python Native Installation

**Command:**
```bash
pip install mcp-task-orchestrator
```

**Configuration:**
```json
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "python",
      "args": ["-m", "mcp_task_orchestrator"]
    }
  }
}
```

**Benefits:**
- ✅ No Docker containers
- ✅ No resource waste
- ✅ Simple installation and updates
- ✅ Native Windows performance
- ✅ Same functionality as Docker version

---

## Sources

- [EchoingVesper/mcp-task-orchestrator (Python)](https://github.com/EchoingVesper/mcp-task-orchestrator)
- [jpicklyk/task-orchestrator (Java/Kotlin)](https://github.com/jpicklyk/task-orchestrator)
- [MCP Task Orchestrator - Awesome MCP Servers](https://mcpservers.org/servers/jpicklyk/task-orchestrator)

---

**Last Updated:** January 4, 2026
**Status:** Native Installation Guide
**Recommendation:** Python version for simplicity
