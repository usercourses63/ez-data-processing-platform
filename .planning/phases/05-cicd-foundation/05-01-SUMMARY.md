---
phase: 05-cicd-foundation
plan: 01
subsystem: build-automation
tags: [docker, powershell, version-injection, ci-cd]

dependency-graph:
  requires: []
  provides:
    - parallel-docker-build-script
    - dockerfile-version-injection
    - frontend-version-placeholder
  affects:
    - 05-02 (GitHub Actions CI workflow)
    - 05-03 (test quality gates)
    - 06-XX (deployment phases)

tech-stack:
  added:
    - PowerShell 7+ ForEach-Object -Parallel
    - System.Collections.Concurrent.ConcurrentBag
  patterns:
    - Docker multi-stage ARG redeclaration
    - OCI image version labels
    - sed-based version placeholder injection

key-files:
  created:
    - scripts/build-all-images.ps1
    - src/Frontend/src/version.ts
  modified:
    - docker/DataSourceManagementService.Dockerfile
    - docker/ValidationService.Dockerfile
    - docker/FileProcessorService.Dockerfile
    - docker/FileDiscoveryService.Dockerfile
    - docker/SchedulingService.Dockerfile
    - docker/OutputService.Dockerfile
    - docker/MetricsConfigurationService.Dockerfile
    - docker/InvalidRecordsService.Dockerfile
    - docker/Frontend.Dockerfile

decisions:
  - id: "05-01-01"
    description: "ThrottleLimit 5 for parallel Docker builds"
    rationale: "Balance between parallelism and resource usage (4-core CI runners)"
  - id: "05-01-02"
    description: "Triple tagging: version, latest, short SHA"
    rationale: "Enable version rollback, latest for dev, SHA for traceability"
  - id: "05-01-03"
    description: "ARG redeclaration per Dockerfile stage"
    rationale: "Docker multi-stage builds require ARG redeclaration after FROM"

metrics:
  duration: 3 min
  completed: 2026-02-02
---

# Phase 5 Plan 1: Docker Build Script & Version Injection Summary

**One-liner:** PowerShell parallel Docker build with ARG-based version injection for all 9 services

## What Was Built

### scripts/build-all-images.ps1
Parallel Docker build script with version injection capabilities:

```powershell
# Usage
pwsh -File scripts/build-all-images.ps1 -Version "v0.2.0" -CommitSha "abc1234"

# Or via environment variables (GitHub Actions)
$env:VERSION = "v0.2.0"
$env:COMMIT_SHA = "abc1234"
pwsh -File scripts/build-all-images.ps1
```

**Features:**
- PowerShell 7+ ForEach-Object -Parallel with ThrottleLimit 5
- ConcurrentBag for thread-safe error tracking
- Builds all 9 services (8 backend + 1 frontend)
- Tags: version, latest, short SHA (first 7 chars)
- Passes --build-arg VERSION and --build-arg COMMIT_SHA
- Exit code 1 on failure with detailed summary

### Dockerfile Version Injection Pattern

All 9 Dockerfiles updated with consistent version injection:

```dockerfile
# Global ARGs (before first FROM)
ARG VERSION=0.0.0
ARG COMMIT_SHA=unknown

# Build stage - redeclare for dotnet publish
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG VERSION
ARG COMMIT_SHA
RUN dotnet publish ... /p:Version=${VERSION} /p:InformationalVersion=${VERSION}+${COMMIT_SHA}

# Runtime stage - redeclare for labels
FROM mcr.microsoft.com/dotnet/aspnet:10.0
ARG VERSION
ARG COMMIT_SHA
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${COMMIT_SHA}"
```

### src/Frontend/src/version.ts
Version placeholder file for frontend:

```typescript
export const APP_VERSION = '__VERSION__';
export const COMMIT_SHA = '__COMMIT_SHA__';
```

Replaced by sed during Docker build for runtime version display.

## Verification Results

| Check | Status |
|-------|--------|
| Script syntax validation | PASS |
| ForEach-Object -Parallel usage | PASS |
| ConcurrentBag error tracking | PASS |
| --build-arg VERSION/COMMIT_SHA | PASS |
| Exit code 1 on failure | PASS |
| 9 Dockerfiles with ARG VERSION | PASS (27 declarations) |
| OCI version labels | PASS (18 labels) |
| Frontend sed injection | PASS |
| version.ts placeholders | PASS |

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 81f3bb9 | Parallel build script with version injection |
| 2 | 8d69ae4 | Backend Dockerfile version injection (8 files) |
| 3 | d457990 | Frontend Dockerfile and version.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Key Integration Points

### For GitHub Actions CI (05-02):
```yaml
- name: Build Docker images
  env:
    VERSION: ${{ steps.version.outputs.VERSION }}
    COMMIT_SHA: ${{ github.sha }}
  run: pwsh -File scripts/build-all-images.ps1
```

### For Local Development:
```powershell
# Quick build with defaults
pwsh -File scripts/build-all-images.ps1

# Release build
pwsh -File scripts/build-all-images.ps1 -Version "v0.2.0" -CommitSha (git rev-parse HEAD)
```

### For Frontend Version Display:
```typescript
import { APP_VERSION, COMMIT_SHA } from './version';

// In component
<span>v{APP_VERSION} ({COMMIT_SHA.substring(0, 7)})</span>
```

## Next Phase Readiness

Phase 5 Plan 2 (GitHub Actions CI workflow) can proceed:
- Build script ready for CI integration
- All Dockerfiles support version injection
- Environment variable integration for GitHub Actions
