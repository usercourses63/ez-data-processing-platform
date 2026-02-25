---
last-verified: 2026-02-02
status: current
---
# Task Orchestrator MCP Usage Guide

## Overview

This document describes the correct pattern for using the task-orchestrator MCP tools via the MCP Docker gateway.

**Date Created:** January 26, 2026
**Issue Discovered:** Tool name format confusion when using mcp-exec

---

## Problem

When using `mcp__MCP_DOCKER__mcp-exec` to call task-orchestrator tools, the tool names must be the **simple tool names** without any prefix.

### Common Mistakes

| WRONG (will fail) | CORRECT (will work) |
|---|---|
| `task-orchestrator_manage_container` | `update_task` |
| `task-orchestrator__query_container` | `get_overview` |
| `task-orchestrator_create_task` | `create_task` |

---

## Correct Usage Pattern

### Step 1: Add the task-orchestrator server

```
mcp__MCP_DOCKER__mcp-add(name="task-orchestrator", activate=true)
```

This registers 42 tools with their simple names.

### Step 2: Use tools with simple names via mcp-exec

**Get Overview:**
```json
mcp__MCP_DOCKER__mcp-exec(
  name="get_overview",
  arguments={}
)
```

**Create Task:**
```json
mcp__MCP_DOCKER__mcp-exec(
  name="create_task",
  arguments={
    "featureId": "808f01f8-...",
    "title": "Task Title",
    "summary": "Task summary",
    "status": "pending",
    "priority": "high",
    "complexity": 5,
    "tags": "backend,api"
  }
)
```

**Update Task:**
```json
mcp__MCP_DOCKER__mcp-exec(
  name="update_task",
  arguments={
    "id": "561a38df-...",
    "status": "completed"
  }
)
```

---

## Available Tool Names

After running `mcp-add`, these tools are available:

| Tool Name | Purpose |
|-----------|---------|
| `get_overview` | Get overview of features, tasks, and orphaned tasks |
| `create_task` | Create a new task |
| `update_task` | Update an existing task (status, priority, etc.) |
| `create_feature` | Create a new feature |
| `query_container` | Query features/tasks with filters |
| `manage_sections` | Add/update sections on features/tasks |
| `create_dependency` | Create task dependencies |
| `list_templates` | List available templates |
| `apply_template` | Apply a template to a feature/task |

---

## Session Persistence

**Important:** The mcp-add registration may expire between conversation turns or after compaction. If you get "Tool not found" errors:

1. Re-run `mcp-add` with `activate=true`
2. Then retry your tool call

---

## Example Workflow

```
1. mcp__MCP_DOCKER__mcp-add(name="task-orchestrator", activate=true)
   → "Successfully added 42 tools..."

2. mcp__MCP_DOCKER__mcp-exec(name="get_overview", arguments={})
   → Returns features and tasks

3. mcp__MCP_DOCKER__mcp-exec(name="update_task", arguments={"id":"...", "status":"completed"})
   → "Task updated successfully"
```

---

## Troubleshooting

### Error: "Tool 'X' not found in current session"

**Cause:** Either the server was never added, or the session expired.

**Solution:** Run `mcp-add` again:
```
mcp__MCP_DOCKER__mcp-add(name="task-orchestrator", activate=true)
```

### Error: Using wrong tool name format

**Cause:** Using prefixed names like `task-orchestrator_update_task`

**Solution:** Use simple names: `update_task`, `create_task`, `get_overview`

---

## Reference

- CLAUDE.md mandates using task-orchestrator for all task management
- Task orchestrator provides 42 tools for features, tasks, sections, dependencies, templates
- Status values: `pending`, `in-progress`, `completed`, `cancelled`, `deferred`
