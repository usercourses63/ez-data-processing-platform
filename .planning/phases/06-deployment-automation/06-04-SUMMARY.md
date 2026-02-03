---
phase: 06-deployment-automation
plan: 04
subsystem: documentation-portal
tags: [docusaurus, helm, ingress, ocp-route, documentation]

dependency-graph:
  requires: ["06-01"]
  provides: ["docusaurus-path-routing", "documentation-workflow"]
  affects: ["09-frontend-integration"]

tech-stack:
  added: []
  patterns: ["path-based-routing", "baseUrl-configuration", "dual-environment-routing"]

key-files:
  created:
    - docs/deployment/documentation-workflow.md
  modified:
    - release-package/docs-docusaurus/docusaurus.config.js
    - release-package/helm/ez-platform-ocp/templates/routes/docs-route.yaml
    - helm/ez-platform/templates/ingress/ez-platform-ingress.yaml

decisions:
  - id: D-0604-01
    decision: "baseUrl: '/docs/' for Docusaurus path-based deployment"
    rationale: "All assets and routes must be prefixed with /docs/ when deployed at subdirectory path"
    context: "Docusaurus requires baseUrl to match deployment path for correct asset loading"

  - id: D-0604-02
    decision: "Path-based routing over subdomain routing for docs"
    rationale: "Single domain with /docs path is simpler than managing docs.domain.com"
    context: "OCP Route changed from subdomain to path-based routing"

  - id: D-0604-03
    decision: "/docs path before / catch-all in Ingress rules"
    rationale: "Path matching is order-dependent; /docs must be evaluated before / catches all"
    context: "K8s Ingress path order is critical for correct routing"

metrics:
  duration: 4 min
  completed: 2026-02-03
---

# Phase 6 Plan 04: Docusaurus Portal Deployment Summary

**One-liner:** Configured Docusaurus baseUrl for /docs path deployment with K8s Ingress and OCP Route routing, plus comprehensive documentation workflow guide.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Configure Docusaurus baseUrl | 8c1f3fa | docusaurus.config.js |
| 2 | Configure OCP Route for /docs | 76fc366 | docs-route.yaml |
| 3 | Reorder K8s Ingress paths | 56a2267 | ez-platform-ingress.yaml |
| 4 | Create documentation workflow | 2d771d0 | documentation-workflow.md |

## What Was Built

### 1. Docusaurus Configuration Updates

Updated `release-package/docs-docusaurus/docusaurus.config.js`:

- Changed `baseUrl` from `/` to `/docs/` for subdirectory deployment
- Updated title to `v0.2.0` matching release version
- Added `trailingSlash: false` for consistent URL handling
- Made `url` configurable via `DOCS_URL` environment variable
- Updated footer links to be relative to baseUrl (removed /docs prefix)

### 2. OCP Route Path Configuration

Updated `release-package/helm/ez-platform-ocp/templates/routes/docs-route.yaml`:

- Changed from subdomain routing (`docs.domain`) to path routing (`/docs`)
- Added `haproxy.router.openshift.io/rewrite-target: /docs` annotation
- Updated service name to `ezplatform-docs` for consistency
- Same host as frontend, different path (shared domain)

### 3. K8s Ingress Path Ordering

Updated `helm/ez-platform/templates/ingress/ez-platform-ingress.yaml`:

- Moved `/docs` path rule BEFORE catch-all `/` rule (critical for routing)
- Updated service name to `ezplatform-docs`
- Updated port to 8080 (OCP-compliant non-privileged)
- Removed nginx rewrite-target annotation (not needed)
- Added clear comments explaining path ordering rationale

### 4. Documentation Workflow Guide

Created `docs/deployment/documentation-workflow.md` (398 lines):

**Content includes:**
- GSD to Docusaurus mapping (source/target structure)
- Pre-release checklist (7 steps)
- Content guidelines (markdown format, links, images)
- Hebrew/RTL content handling (file organization, testing)
- Deployment integration (routing, CI/CD)
- Troubleshooting section (broken links, RTL issues, asset loading)
- Release schedule with milestone tasks

## Routing Configuration

| Environment | URL Pattern | Service | Port |
|-------------|-------------|---------|------|
| Vanilla K8s | `https://host/docs/*` | ezplatform-docs | 8080 |
| OpenShift | `https://host/docs/*` | ezplatform-docs | 8080 |

**Path Priority (K8s Ingress):**
1. `/docs` - Docusaurus documentation
2. `/api` - Backend API
3. `/grafana` - Monitoring dashboard
4. `/` - Frontend catch-all (last)

## Hebrew/RTL Support

The documentation workflow guide covers:

- File organization for Hebrew content (`docs/*/he/` or i18n structure)
- RTL direction via Docusaurus i18n config
- Mixed LTR/RTL content handling (code blocks, paths)
- Testing Hebrew locale (`npm run start -- --locale he`)

## Verification Results

```
Docusaurus baseUrl: '/docs/'     -- PASS
OCP Route path: /docs            -- PASS
K8s Ingress /docs path: Present  -- PASS
Workflow doc: 398 lines          -- PASS (>60 required)
Helm lint (both charts): 0 failures
```

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for:**
- 06-02: Deployment validation (if not already complete)
- Phase 9: Frontend integration (docs link in header)

**Prerequisites met:**
- Docusaurus baseUrl configured
- Path-based routing configured for both K8s and OCP
- Documentation workflow documented for pre-release sync
