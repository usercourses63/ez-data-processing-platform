---
phase: "05-cicd-foundation"
plan: "03"
subsystem: "cicd"
tags: ["docusaurus", "docker", "version-injection", "documentation"]

dependency-graph:
  requires: ["05-02"]
  provides: ["docusaurus-docker-build", "docs-versioning"]
  affects: ["05-04", "06-deployment", "09-frontend"]

tech-stack:
  added: []
  patterns: ["version-injection-sed", "docusaurus-nginx"]

key-files:
  created:
    - docker/Docusaurus.Dockerfile
  modified:
    - scripts/build-all-images.ps1
    - .github/workflows/ci.yml

decisions: []

metrics:
  duration: "2 min 29 sec"
  completed: "2026-02-02"
---

# Phase 5 Plan 3: Docusaurus Build & Version Injection Summary

**One-liner:** Docusaurus documentation portal Docker build with sed-based version injection in title.

## What Was Done

### Task 1: Docusaurus Dockerfile with Version Injection
- Created `docker/Docusaurus.Dockerfile` for building documentation portal
- Multi-stage build: Node.js 20 Alpine for build, Nginx Alpine for production
- Version injection via sed into docusaurus.config.js title field
- ARG VERSION and ARG COMMIT_SHA for build-time configuration
- OCI labels for image metadata (version, revision, title, description, vendor)
- OCP-compliant: non-root user (1001), port 8080, writable temp directories
- Health check on /health endpoint
- Uses existing nginx.conf and nginx-main.conf from docs-docusaurus

### Task 2: Build Script Update
- Added docusaurus to services array in build-all-images.ps1
- Now builds 10 services total (9 backend/frontend + Docusaurus)
- Generates ez-platform/docusaurus:version, :latest, :sha tags

### Task 3: CI Workflow Update
- Updated docker job summary to show 10 services
- Added Services section listing all images built
- Added docusaurus as "documentation portal" in the list

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| 4bcbeaa | feat(05-03): add Docusaurus Dockerfile with version injection | docker/Docusaurus.Dockerfile |
| efd9ee9 | feat(05-03): add Docusaurus to Docker build script | scripts/build-all-images.ps1 |
| 667a5b1 | feat(05-03): update CI workflow docker summary for Docusaurus | .github/workflows/ci.yml |

## Key Patterns Established

### Version Injection Pattern
```dockerfile
ARG VERSION=0.0.0
RUN sed -i "s/title: 'EZ Platform v[^']*'/title: 'EZ Platform ${VERSION}'/" docusaurus.config.js
```
This pattern replaces the hardcoded version in the config with the build-time VERSION argument.

### OCP-Compliant Nginx Pattern
```dockerfile
# Create non-root user
RUN addgroup -g 1001 -S nginx-group && \
    adduser -u 1001 -S nginx-user -G nginx-group

# Port 8080 (non-privileged)
EXPOSE 8080

# Run as non-root
USER nginx-user
```

## Requirements Addressed

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| CD-07 | Complete | Version injection via ARG + sed |
| CD-09 | Complete | Docusaurus integrated in CI pipeline |

## Verification Results

All success criteria verified:
- [x] docker/Docusaurus.Dockerfile exists
- [x] Docusaurus Dockerfile has ARG VERSION and ARG COMMIT_SHA
- [x] Docusaurus Dockerfile uses sed to inject version into docusaurus.config.js title
- [x] Docusaurus Dockerfile uses port 8080 (OCP compliant)
- [x] Docusaurus Dockerfile has OCI labels
- [x] scripts/build-all-images.ps1 includes Docusaurus in services array
- [x] scripts/build-all-images.ps1 now has 10 services total
- [x] .github/workflows/ci.yml docker summary mentions Docusaurus
- [x] .github/workflows/ci.yml docker summary shows 10 services

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 05-04-PLAN.md (Deployment Preparation) which will:
- Configure container registry
- Set up deployment scripts
- Add push steps to CI workflow
