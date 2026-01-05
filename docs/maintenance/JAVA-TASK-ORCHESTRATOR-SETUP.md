# Java Task-Orchestrator Native Installation Guide

**Version:** v1.0.1
**Repository:** [jpicklyk/task-orchestrator](https://github.com/jpicklyk/task-orchestrator)
**Status:** Step-by-step installation guide

---

## Prerequisites

### Step 1: Install Java 17 or Higher

You have **3 options** for installing Java:

#### Option A: Using winget (Recommended - Automated)

```powershell
# Install Java 21 JDK
winget install EclipseAdoptium.Temurin.21.JDK

# Or Java 17 JDK
winget install EclipseAdoptium.Temurin.17.JDK
```

**Note:** If installation prompts appear, click through them to complete.

#### Option B: Manual Download (Alternative)

1. Visit [Adoptium.net](https://adoptium.net/)
2. Download **Temurin JDK 21** for Windows x64
3. Run the installer (.msi file)
4. Accept defaults and complete installation

#### Option C: Using Chocolatey

```powershell
# If you have Chocolatey installed
choco install temurin21
```

### Step 2: Verify Java Installation

```powershell
# Check Java version (should show 17+ or 21+)
java -version

# Check JAVA_HOME environment variable
echo %JAVA_HOME%

# If JAVA_HOME is not set, add it manually:
# 1. Open System Properties > Environment Variables
# 2. Add JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot
# 3. Add %JAVA_HOME%\bin to PATH
```

**Expected Output:**
```
openjdk version "21.0.9" 2024-10-15 LTS
OpenJDK Runtime Environment Temurin-21.0.9+10 (build 21.0.9+10-LTS)
OpenJDK 64-Bit Server VM Temurin-21.0.9+10 (build 21.0.9+10-LTS, mixed mode, sharing)
```

---

## Installation: Task-Orchestrator JAR

You have **2 options** for getting the JAR file:

### Option A: Download Pre-built JAR (Easiest)

#### 1. Download from GitHub Releases

Visit: [jpicklyk/task-orchestrator/releases](https://github.com/jpicklyk/task-orchestrator/releases)

**Latest Version:** v1.0.1 (June 13, 2024)

**Direct Link:**
```
https://github.com/jpicklyk/task-orchestrator/releases/tag/v1.0.1
```

**Download:**
- Click on "Assets" dropdown
- Download the JAR file (likely named: `mcp-task-orchestrator-1.0.1.jar` or similar)

#### 2. Save to a Permanent Location

```powershell
# Create directory for MCP servers
mkdir C:\MCP-Servers\task-orchestrator

# Move downloaded JAR there
move %USERPROFILE%\Downloads\mcp-task-orchestrator-*.jar C:\MCP-Servers\task-orchestrator\

# Verify
dir C:\MCP-Servers\task-orchestrator\
```

### Option B: Build from Source (Advanced)

#### 1. Install Gradle (if not installed)

```powershell
# Using winget
winget install Gradle.Gradle

# Or using Chocolatey
choco install gradle

# Or download manually from: https://gradle.org/install/
```

#### 2. Clone and Build

```bash
# Clone repository
git clone https://github.com/jpicklyk/task-orchestrator.git
cd task-orchestrator

# Build with Gradle
./gradlew build

# Or on Windows
gradlew.bat build

# JAR will be created in: build/libs/
```

#### 3. Copy JAR to Permanent Location

```powershell
# Copy built JAR
copy build\libs\mcp-task-orchestrator-*.jar C:\MCP-Servers\task-orchestrator\

# Rename for simplicity
ren C:\MCP-Servers\task-orchestrator\mcp-task-orchestrator-*.jar task-orchestrator.jar
```

---

## Configuration: Claude Code MCP

### Step 1: Locate Claude Code Configuration

**Configuration File Location:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Full Path:**
```
C:\Users\UserC\AppData\Roaming\Claude\claude_desktop_config.json
```

### Step 2: Edit Configuration

**If file doesn't exist, create it with:**

```json
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "java",
      "args": [
        "-jar",
        "C:\\MCP-Servers\\task-orchestrator\\task-orchestrator.jar"
      ],
      "env": {
        "TASK_ORCHESTRATOR_DB": "C:\\Users\\UserC\\.task-orchestrator\\tasks.db"
      }
    }
  }
}
```

**If file exists, add task-orchestrator section:**

```json
{
  "mcpServers": {
    "existing-server": {
      ...
    },
    "task-orchestrator": {
      "command": "java",
      "args": [
        "-jar",
        "C:\\MCP-Servers\\task-orchestrator\\task-orchestrator.jar"
      ],
      "env": {
        "TASK_ORCHESTRATOR_DB": "C:\\Users\\UserC\\.task-orchestrator\\tasks.db"
      }
    }
  }
}
```

### Step 3: Enable Debug Mode (Optional)

For troubleshooting, add debug environment variable:

```json
{
  "mcpServers": {
    "task-orchestrator": {
      "command": "java",
      "args": [
        "-jar",
        "C:\\MCP-Servers\\task-orchestrator\\task-orchestrator.jar"
      ],
      "env": {
        "TASK_ORCHESTRATOR_DB": "C:\\Users\\UserC\\.task-orchestrator\\tasks.db",
        "MCP_DEBUG": "true"
      }
    }
  }
}
```

---

## Testing the Installation

### Step 1: Test JAR Directly

```powershell
# Navigate to JAR location
cd C:\MCP-Servers\task-orchestrator

# Run JAR (should show MCP server starting)
java -jar task-orchestrator.jar

# Press Ctrl+C to stop
```

**Expected Output:**
```
MCP Task Orchestrator v1.0.1
Starting server on stdio...
Ready for MCP protocol messages
```

### Step 2: Restart Claude Code

1. **Close Claude Code completely**
2. **Restart Claude Code**
3. Check logs/settings to verify MCP server loaded

### Step 3: Test MCP Tools

In Claude Code, try these commands:

```
# Get overview of tasks and features
Can you run get_overview()?

# Create a test task
Create a task with title "Test Java Installation" and summary "Testing native Java task-orchestrator"

# List all tasks
Can you search for tasks?
```

---

## Features Available

### 37 MCP Tools
- Task management (CRUD)
- Feature management
- Project management
- Dependencies and relationships
- Sections and templates
- Bulk operations (70-95% token savings)

### 9 Built-in Templates
- Task Implementation Workflow
- Bug Investigation Workflow
- Technical Approach
- Requirements Specification
- Context & Background
- Testing Strategy
- Definition of Done
- Local Git Branching Workflow
- GitHub PR Workflow

### Database
- **Type:** SQLite
- **Location:** `C:\Users\UserC\.task-orchestrator\tasks.db`
- **Backup:** `copy C:\Users\UserC\.task-orchestrator\tasks.db tasks_backup.db`

---

## Troubleshooting

### Java Not Found After Installation

```powershell
# Restart PowerShell/Terminal
# Or add to PATH manually:

# 1. Find Java installation
dir "C:\Program Files\Eclipse Adoptium\"

# 2. Add to PATH
# System Properties > Environment Variables > Path
# Add: C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot\bin
```

### JAR Won't Run

```powershell
# Check Java installation
java -version

# Check JAR file
dir C:\MCP-Servers\task-orchestrator\

# Try with full path
java -jar "C:\MCP-Servers\task-orchestrator\task-orchestrator.jar"

# Check for errors
```

### Claude Code Doesn't Load MCP Server

1. **Verify config syntax** - JSON must be valid
2. **Check file path** - Use double backslashes: `C:\\path\\to\\file.jar`
3. **Restart Claude Code** - Complete shutdown and restart
4. **Check logs** - Look for MCP server errors in Claude Code logs
5. **Test JAR manually** - Run from command line first

### Database Permission Issues

```powershell
# Ensure directory exists
mkdir C:\Users\UserC\.task-orchestrator

# Check permissions
icacls C:\Users\UserC\.task-orchestrator

# Reset if needed
icacls C:\Users\UserC\.task-orchestrator /grant %USERNAME%:F
```

### Port Conflicts

If you get port binding errors:

```powershell
# Task-orchestrator uses stdio (no port conflicts)
# But if issues occur, check:
netstat -ano | findstr :XXXX
```

---

## Performance Expectations

### Startup Time
- **First Launch:** ~3-5 seconds (JVM startup + database init)
- **Subsequent:** ~2-3 seconds (JVM startup)

### Memory Usage
- **Idle:** ~300-500 MB
- **Active:** ~500 MB - 1 GB
- **Database:** <10 MB for typical usage

### Operation Speed
- **Task Creation:** <100ms
- **Bulk Operations:** ~50ms per item
- **Database Queries:** <50ms

---

## Maintenance

### Updates

```powershell
# Check current version
java -jar C:\MCP-Servers\task-orchestrator\task-orchestrator.jar --version

# Download new version from releases
# https://github.com/jpicklyk/task-orchestrator/releases

# Replace JAR file
copy new-version.jar C:\MCP-Servers\task-orchestrator\task-orchestrator.jar

# Restart Claude Code
```

### Database Backup

```powershell
# Manual backup
copy C:\Users\UserC\.task-orchestrator\tasks.db C:\Backups\tasks_backup_2026-01-04.db

# Scheduled backup (add to Task Scheduler)
$date = Get-Date -Format "yyyy-MM-dd"
copy C:\Users\UserC\.task-orchestrator\tasks.db "C:\Backups\tasks_backup_$date.db"
```

### Uninstallation

```powershell
# 1. Remove from Claude Code config
# Edit: %APPDATA%\Claude\claude_desktop_config.json
# Remove task-orchestrator section

# 2. Delete JAR file
rmdir /s C:\MCP-Servers\task-orchestrator

# 3. Delete database (if desired)
rmdir /s C:\Users\UserC\.task-orchestrator

# 4. Restart Claude Code
```

---

## Comparison with Docker Version

| Aspect | Native Java | Docker |
|--------|-------------|--------|
| **Installation** | Download JAR | Docker pull |
| **Startup** | 2-3 seconds | 5-10 seconds |
| **Memory** | 500 MB | 3 GB |
| **Containers** | 0 | 17+ (accumulate) |
| **Cleanup** | None needed | Weekly required |
| **Updates** | Replace JAR | Pull new image |
| **Features** | Same (37 tools) | Same (37 tools) |

**Winner:** Native Java (no containers, less memory, same features)

---

## Quick Start Checklist

- [ ] Install Java 17+ (Adoptium recommended)
- [ ] Verify Java: `java -version`
- [ ] Download JAR from releases or build from source
- [ ] Save JAR to `C:\MCP-Servers\task-orchestrator\`
- [ ] Configure Claude Code MCP settings
- [ ] Restart Claude Code
- [ ] Test with `get_overview()` command
- [ ] Create test task to verify functionality

---

## Alternative: If Java Installation Issues Persist

### Fallback Option 1: Use Docker (Temporary)

```bash
# Pull image (already cleaned up earlier)
docker pull ghcr.io/jpicklyk/task-orchestrator:latest

# Use existing Docker MCP configuration
# Run weekly cleanup script to prevent buildup
```

### Fallback Option 2: Try Python Version

```bash
# Build from source (if pip version had issues)
git clone https://github.com/EchoingVesper/mcp-task-orchestrator.git
cd mcp-task-orchestrator
pip install -e .
```

### Fallback Option 3: No Task-Orchestrator

Continue using Claude Code without MCP task orchestration:
- Manual task tracking
- No container overhead
- Simpler setup

---

## Support Resources

### Documentation
- [GitHub Repository](https://github.com/jpicklyk/task-orchestrator)
- [Latest Release](https://github.com/jpicklyk/task-orchestrator/releases/tag/v1.0.1)
- [MCP Servers Directory](https://mcpservers.org/servers/jpicklyk/task-orchestrator)

### Local Guides
- Complete Cleanup: [`TASK-ORCHESTRATOR-COMPLETE-CLEANUP.md`](./TASK-ORCHESTRATOR-COMPLETE-CLEANUP.md)
- Docker Cleanup: [`DOCKER-CLEANUP-GUIDE.md`](./DOCKER-CLEANUP-GUIDE.md)
- Native Setup: [`TASK-ORCHESTRATOR-NATIVE-SETUP.md`](./TASK-ORCHESTRATOR-NATIVE-SETUP.md)

---

## Next Steps

1. **Install Java** using one of the methods above
2. **Verify installation** with `java -version`
3. **Download JAR** from GitHub releases
4. **Configure Claude Code** MCP settings
5. **Test functionality** with basic task operations

**Current Status:** Ready to install Java ⏳

---

**Last Updated:** January 4, 2026
**Installation Status:** Pending Java installation
**Recommended Java Version:** Adoptium Temurin JDK 21
