# Phase 19: Documentation Update - Research

**Researched:** 2026-03-17
**Domain:** Docusaurus documentation, Kubernetes deployment, frontend integration
**Confidence:** HIGH

## Summary

Phase 19 is a content update and deployment hardening phase for the existing Docusaurus documentation portal. The Docusaurus project is already fully set up at `release-package/docs-docusaurus/` with working search, i18n (en/he), dark mode, and OCP-compatible Docker build. The primary work is: (1) updating doc content to cover phases 11-18 features (SignalR monitoring, device health, OTEL, file-simulator integration), (2) fixing the k8s deployment manifest (already exists at `k8s/deployments/docs-deployment.yaml` -- needs image tag update and nginx version pinning in Dockerfile), and (3) fixing the frontend `docs-url.ts` to cover all RFC1918 IP ranges and point dev mode to the NodePort URL instead of localhost:3000.

The existing k8s deployment at `k8s/deployments/docs-deployment.yaml` already uses the `ez-platform` namespace, OCP security context, and NodePort 30800. The release-package version at `release-package/docs-docusaurus/k8s-deployment.yaml` is outdated (uses separate namespace `ez-platform-docs`, port 80, image `ez-platform-docs:v0.1.1-rc2`) and should be considered superseded. The ingress at `k8s/ingress/ez-platform-ingress.yaml` is missing a `/docs` path rule -- this must be added before the frontend catch-all `/` rule.

**Primary recommendation:** Focus on content accuracy and completeness first (Plan 19-01), then container/deployment/help-link integration second (Plan 19-02). No new libraries or tools needed -- this is pure content and configuration work.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Match existing documentation style and depth (TypeScript interfaces, API tables, architecture descriptions, practical examples -- see admin.md and components/nas-devices.mdx as reference)
- Update admin.md with new sections for SignalR real-time monitoring, device health monitoring, OTEL observability
- Update system-architecture.md in-place with v0.2 architecture changes (SignalR hub, OTEL pipeline, device health)
- Rewrite v0.2.0 changelog.md and release-notes.md sections from scratch -- current entries are incomplete (missing phases 14-18 features)
- Add new component documentation pages for System Monitoring (SignalR-based) and Device Health features, matching existing component doc style (datasource-forms.mdx, nas-devices.mdx)
- Update Hebrew user guide (user-guide-he.mdx) with all v0.2.0 features -- monitoring, device health, etc.
- Remove "(Legacy)" labels from Architecture and Deployment sidebar sections -- content is still valid, just needs updating
- Add new "Monitoring" sidebar category with system-monitoring.mdx and device-health.mdx pages
- Pin nginx version in Dockerfile to specific nginx:1.x-alpine version (OCP compliance -- no unpinned images)
- Move Docusaurus k8s deployment from release-package/docs-docusaurus/k8s-deployment.yaml into main k8s/deployments/ for unified deployment
- Image tag: docs-docusaurus:v0.2.0 -- matches platform release version
- Keep Dockerfile OCP-compatible (non-root user, port 8080, readOnlyRootFilesystem)
- Fix docs-url.ts dev detection to cover all RFC1918 private IP ranges (add 172.16-31.x and 10.x patterns alongside existing 192.168.x)
- Dev mode docs URL: point to K8s-deployed NodePort (not localhost:3000) -- developers test against the actual deployed container
- Verify and fix k8s ingress rules for /docs path routing to Docusaurus service -- add routing if missing
- Verify help button opens docs portal in both dev (NodePort) and production (/docs path) environments

### Claude's Discretion
- Exact sidebar category organization (Guides consolidated vs separate Architecture/Deployment)
- Dev detection IP pattern implementation approach (regex vs array of ranges)
- Whether to create a testing.md doc page for the Guides section
- Exact nginx version to pin to (latest stable 1.x-alpine at implementation time)
- Loading/error states for help link when docs container is unavailable

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-06 | Docusaurus content updated for v0.2.0 release (all docs current) | Content update plan covering admin.md, system-architecture.md, changelog.md, release-notes.md, new component docs (system-monitoring.mdx, device-health.mdx), Hebrew user guide, sidebar restructuring |
| DOC-07 | Docusaurus built and deployed as container in release-package alongside other services | Dockerfile nginx pin to 1.28-alpine, image tag docs-docusaurus:v0.2.0, k8s deployment already at k8s/deployments/docs-deployment.yaml (update image tag), remove outdated release-package manifest |
| DOC-08 | Frontend help link opens running Docusaurus -- analyze existing implementation, verify connectivity, fix gaps | docs-url.ts RFC1918 fix, dev mode NodePort URL (minikube IP:30800), ingress /docs path rule addition, help button already wired in AppHeader.tsx |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @docusaurus/core | ^3.1.0 | Documentation site generator | Already installed and configured |
| @docusaurus/preset-classic | ^3.1.0 | Default theme and plugins | Standard Docusaurus preset |
| @easyops-cn/docusaurus-search-local | ^0.44.0 | Offline search plugin | Already configured with en/he language support |
| nginx | 1.28-alpine | Static file serving in Docker | Latest stable alpine -- use `nginx:1.28-alpine` for OCP pinning |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @mdx-js/react | ^3.0.0 | MDX component support | Already installed, used for component docs (.mdx files) |
| prism-react-renderer | ^2.3.0 | Code syntax highlighting | Already configured for bash, powershell, csharp, yaml, json |

No new packages need to be installed. All dependencies are already in place.

## Architecture Patterns

### Existing Docusaurus Project Structure
```
release-package/docs-docusaurus/
├── docs/                          # All documentation content
│   ├── index.md                   # Landing page
│   ├── admin.md                   # Admin guide (UPDATE)
│   ├── changelog.md               # Changelog (REWRITE v0.2.0 section)
│   ├── release-notes.md           # Release notes (REWRITE v0.2.0 section)
│   ├── user-guide-he.mdx          # Hebrew user guide (UPDATE)
│   ├── installation.md            # Installation guide
│   ├── installation/              # Installation sub-docs
│   ├── architecture/              # Architecture docs (UPDATE, remove Legacy label)
│   │   ├── system-architecture.md # System architecture (UPDATE)
│   │   └── he/                    # Hebrew architecture
│   ├── components/                # Component docs
│   │   ├── index.md               # Components overview
│   │   ├── datasource-forms.mdx   # Template for new docs
│   │   ├── schema-editor.mdx      # Template for new docs
│   │   ├── nas-devices.mdx        # Template for new docs
│   │   ├── system-monitoring.mdx  # NEW - to create
│   │   └── device-health.mdx      # NEW - to create
│   ├── deployment/                # Deployment docs (UPDATE, remove Legacy label)
│   ├── development/               # Development guides
│   └── monitoring/                # NEW category (optional if using components/)
├── docusaurus.config.js           # Site config (no changes needed)
├── sidebars.js                    # Sidebar structure (UPDATE)
├── Dockerfile                     # Docker build (PIN nginx version)
├── nginx.conf                     # Server config (no changes needed)
├── nginx-main.conf                # Main nginx config (no changes needed)
└── package.json                   # Dependencies (no changes needed)
```

### Pattern: Documentation Page Style (from existing docs)

**Admin guide style (admin.md):**
- Markdown format (.md)
- `sidebar_position` frontmatter
- Table of Contents section
- API tables with columns: Endpoint, Method, Description
- Architecture descriptions with bullet points
- Configuration snippets in yaml/bash code blocks
- Troubleshooting section at bottom

**Component doc style (nas-devices.mdx):**
- MDX format (.mdx)
- `sidebar_position`, `title`, `description`, `last_verified` frontmatter
- `import Tabs from '@theme/Tabs'` for code examples
- TypeScript interface definitions in code blocks
- Props, Features, Internal State, Data Model sections
- API reference tables

### Pattern: Sidebar Category Structure
```javascript
// sidebars.js pattern
{
  type: 'category',
  label: 'Category Name',   // No "(Legacy)" suffix
  collapsed: false,          // or true for secondary categories
  items: [
    'path/to/doc',           // References docs/ relative paths
  ],
}
```

### Pattern: Dev URL Detection (docs-url.ts)
```typescript
// Current (incomplete):
const devPatterns = ['localhost', '127.0.0.1', '192.168.'];

// Fixed (all RFC1918 ranges):
const isPrivateIP = (hostname: string): boolean => {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)
  );
};
```

### Anti-Patterns to Avoid
- **Separate namespace for docs:** The old k8s-deployment.yaml used `ez-platform-docs` namespace. The current deployment correctly uses `ez-platform`. Do not create a separate namespace.
- **Port 80 in container:** Must use port 8080 for OCP compatibility. The Dockerfile already does this correctly.
- **localhost:3000 for dev docs URL:** User explicitly wants dev mode to use the deployed NodePort container, not a local dev server.
- **Unpinned base images:** `nginx:alpine` without version is not OCP-compliant. Must pin to `nginx:1.28-alpine`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Search functionality | Custom search | @easyops-cn/docusaurus-search-local (already configured) | Offline search with Hebrew support already working |
| Static site generation | Custom build pipeline | `npm run build` (Docusaurus CLI) | Standard Docusaurus build, outputs to `build/` directory |
| i18n/RTL | Custom RTL handling | Docusaurus i18n config (already configured) | en/he locales with direction support already set up |
| Nginx OCP config | Custom container setup | Existing nginx.conf + nginx-main.conf | Already handles PID in /tmp, non-root user, port 8080 |

## Common Pitfalls

### Pitfall 1: Ingress /docs Path Ordering
**What goes wrong:** Adding `/docs` path after the `/` catch-all means the frontend catches all requests, docs never reached.
**Why it happens:** Kubernetes Ingress evaluates paths in order; the catch-all `/` matches everything.
**How to avoid:** Add `/docs` path rule BEFORE the `/` catch-all in `ez-platform-ingress.yaml`.
**Warning signs:** Help button opens frontend instead of docs portal.

### Pitfall 2: Docusaurus baseUrl Mismatch
**What goes wrong:** Docusaurus generates links with `/docs/` prefix but the ingress strips or doesn't preserve the path.
**Why it happens:** `baseUrl: '/docs/'` in docusaurus.config.js must match the ingress path.
**How to avoid:** Ensure ingress forwards `/docs` to the docs service without rewriting. The nginx.conf already has `try_files $uri $uri/ /docs/index.html` which handles SPA routing correctly.
**Warning signs:** 404 errors on docs sub-pages after navigation.

### Pitfall 3: readOnlyRootFilesystem with Nginx
**What goes wrong:** Nginx needs writable directories for PID, temp files, and logs.
**Why it happens:** OCP requires `readOnlyRootFilesystem: true` but nginx writes to several paths.
**How to avoid:** The existing nginx-main.conf already puts PID in `/tmp/nginx.pid` and temp dirs in `/tmp/`. The Dockerfile creates these with correct ownership. Keep this pattern. Note: the current k8s deployment does NOT set `readOnlyRootFilesystem: true` -- adding it requires emptyDir volume mounts for `/tmp`, `/var/cache/nginx`, `/var/log/nginx`.
**Warning signs:** CrashLoopBackOff with "permission denied" or "read-only file system" errors.

### Pitfall 4: Image Name Mismatch
**What goes wrong:** The Dockerfile builds `docs-docusaurus:v0.2.0` but the k8s deployment references `ezplatform-docs:v0.1.1-rc3`.
**Why it happens:** Different naming conventions between release-package and k8s manifests.
**How to avoid:** Standardize on `docs-docusaurus:v0.2.0` as the CONTEXT.md specifies. Update both Dockerfile build tag and k8s deployment image reference.
**Warning signs:** ImagePullBackOff or ErrImageNeverPull.

### Pitfall 5: Minikube NodePort for Dev Docs URL
**What goes wrong:** Hardcoding minikube IP in docs-url.ts breaks when IP changes.
**Why it happens:** Minikube IP is dynamic (currently 172.30.22.206 per MEMORY.md, but was 172.17.80.157 before).
**How to avoid:** Use `window.location.hostname` (same host) with the NodePort. Since the frontend is already accessed via the minikube IP, the docs URL should use the same hostname with port 30800.
**Warning signs:** Help button opens wrong URL or connection refused.

### Pitfall 6: Changelog/Release Notes Content Gaps
**What goes wrong:** The current changelog.md and release-notes.md only cover phases up to ~13 (NAS, protocol testing, CI/CD). Phases 14-18 features are missing.
**Why it happens:** Docs were written during phase 7 (v0.1 milestone) and partially updated.
**How to avoid:** Systematically review STATE.md decisions for phases 14-18 to capture all features: OTEL verification (14), Device Health monitoring (15), Protocol file operations testing (15.1), SignalR real-time updates (16), File-simulator integration (17), E2E validation (18).
**Warning signs:** Users find undocumented features.

## Code Examples

### Ingress Rule for /docs Path (must be added)
```yaml
# In k8s/ingress/ez-platform-ingress.yaml
# Add BEFORE the frontend catch-all "/" rule:
- path: /docs
  pathType: Prefix
  backend:
    service:
      name: ezplatform-docs
      port:
        number: 80
```

### Fixed docs-url.ts Dev Detection
```typescript
// Source: Existing docs-url.ts with RFC1918 fix per CONTEXT.md
const isPrivateNetwork = (hostname: string): boolean => {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.startsWith('192.168.')) return true;
  if (hostname.startsWith('10.')) return true;
  // 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) return true;
  return false;
};

export const isDevelopment = (): boolean => {
  return isPrivateNetwork(window.location.hostname);
};

export const getDocsBaseUrl = (): string => {
  if (isDevelopment()) {
    // Dev: use same hostname (minikube IP) with docs NodePort
    return `http://${window.location.hostname}:30800/docs`;
  }
  // Production: path-based routing via ingress
  return '/docs';
};
```

### Dockerfile Nginx Pin
```dockerfile
# Pin to specific stable alpine version (OCP compliance)
FROM nginx:1.28-alpine
```

### New Component Doc Template (system-monitoring.mdx)
```mdx
---
sidebar_position: 5
title: System Monitoring
description: Real-time system monitoring with SignalR integration
last_verified: 2026-03-17
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# System Monitoring Component

Real-time system monitoring dashboard with SignalR WebSocket updates for live cluster status.

## Features

- **Real-Time Updates**: SignalR WebSocket connection for live data (5s/30s broadcast intervals)
- **Service Status**: Pod health, replica counts, resource utilization
- **Kafka Monitoring**: Topic status, consumer lag, partition details
- **Connection Status**: Visual indicator showing SignalR connection state
- **Fallback Polling**: React Query polling when SignalR unavailable

## Data Model

```typescript
interface SystemStatus {
  Services: ServiceStatus[];
  Kafka: KafkaStatus;
  // ... additional fields
}
```
```

### Updated Sidebar Structure
```javascript
// sidebars.js - recommended structure
const sidebars = {
  tutorialSidebar: [
    'index',
    { type: 'category', label: 'Getting Started', collapsed: false,
      items: ['installation', 'installation/helm-installation'] },
    { type: 'category', label: 'Administration', collapsed: false,
      items: ['admin'] },
    { type: 'category', label: 'User Guide', collapsed: false,
      items: ['user-guide-he'] },
    { type: 'category', label: 'Components', collapsed: false,
      items: [
        'components/index',
        'components/datasource-forms',
        'components/schema-editor',
        'components/nas-devices',
        'components/system-monitoring',  // NEW
        'components/device-health',      // NEW
      ] },
    { type: 'category', label: 'Monitoring', collapsed: false,
      items: [
        'components/system-monitoring',
        'components/device-health',
      ] },
    { type: 'category', label: 'Development', collapsed: false,
      items: ['development/index', 'development/api-coordination', 'development/react19-patterns'] },
    { type: 'category', label: 'Architecture', collapsed: true,  // No "(Legacy)"
      items: ['architecture/system-architecture', 'architecture/he/system-architecture-he'] },
    { type: 'category', label: 'Deployment', collapsed: true,    // No "(Legacy)"
      items: ['deployment/deployment-plan', 'deployment/deployment-success-summary', 'deployment/deployment-troubleshooting-guide'] },
    { type: 'category', label: 'Reference', collapsed: false,
      items: ['release-notes', 'changelog'] },
  ],
};
```

**Note on sidebar discretion:** A separate "Monitoring" category duplicating component docs creates ambiguity. Recommendation: add the two new monitoring docs to the existing Components category only (no separate Monitoring category), and add a brief "Monitoring" heading in the components/index.md. This keeps things clean.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `nginx:alpine` (unpinned) | `nginx:1.28-alpine` (pinned) | OCP compliance req | Must pin for production |
| Separate `ez-platform-docs` namespace | `ez-platform` namespace (unified) | k8s/deployments/docs-deployment.yaml already correct | Old release-package manifest is outdated |
| `localhost:3000` dev docs URL | `${hostname}:30800/docs` via NodePort | Phase 19 decision | Devs test against real deployed container |
| `192.168.` only dev detection | All RFC1918 ranges | Phase 19 decision | Covers Hyper-V IPs (172.x) |

## Existing Infrastructure Findings

### Already Done (no work needed)
- k8s deployment exists at `k8s/deployments/docs-deployment.yaml` with OCP security context, NodePort 30800
- Docusaurus site fully configured with search, i18n, dark mode
- Help button wired in AppHeader.tsx with openDocsInNewTab()
- nginx.conf handles SPA routing and health check at /health
- OCP-compatible Dockerfile structure (non-root user, port 8080)
- Network policy `allow-docs-ingress` exists
- OCP route with `/docs` path exists in `k8s/ocp-routes.yaml`

### Needs Updating
- `k8s/deployments/docs-deployment.yaml`: image tag `ezplatform-docs:v0.1.1-rc3` -> `docs-docusaurus:v0.2.0`
- `release-package/docs-docusaurus/Dockerfile`: `nginx:alpine` -> `nginx:1.28-alpine`
- `k8s/ingress/ez-platform-ingress.yaml`: missing `/docs` path rule
- `src/Frontend/src/utils/docs-url.ts`: incomplete RFC1918 detection, wrong dev URL
- `release-package/docs-docusaurus/sidebars.js`: "(Legacy)" labels, missing monitoring docs
- Doc content: admin.md, system-architecture.md, changelog.md, release-notes.md, user-guide-he.mdx

### Content Gap Analysis (v0.2.0 Changelog)
Current changelog covers: NAS device management, protocol testing, CI/CD, documentation portal.
Missing from changelog/release-notes:
- **Phase 14 (OTEL):** All services verified with structured logs, traces, metrics via OTEL collector
- **Phase 15 (Device Health):** Quartz.NET health check jobs, degraded/down thresholds, device health UI tab
- **Phase 15.1 (Protocol File Ops Testing):** File operation proxy endpoints, protocol x format matrix testing
- **Phase 16 (SignalR):** MonitoringBroadcaster hosted service, SignalR hub, real-time dashboard updates, connection status indicator, React Query fallback
- **Phase 17 (File-Simulator):** DemoDataGenerator --use-simulator mode, multi-protocol upload, dynamic server creation
- **Phase 18 (E2E):** Playwright test infrastructure, protocol-aware fixtures, E2E validation report

## Open Questions

1. **Monitoring category vs Components sub-section**
   - What we know: CONTEXT.md says "Add new Monitoring sidebar category with system-monitoring.mdx and device-health.mdx pages"
   - What's unclear: Whether these docs should also appear in Components category (duplication) or only in Monitoring
   - Recommendation: Create the pages in `docs/components/` directory (matching existing pattern), add a "Monitoring" category in sidebar that references them. Docusaurus allows the same doc in multiple sidebar categories.

2. **readOnlyRootFilesystem for docs container**
   - What we know: CONTEXT.md says keep OCP-compatible. Current deployment does NOT set readOnlyRootFilesystem.
   - What's unclear: Whether to add it now (requires emptyDir mounts for /tmp, /var/cache/nginx, /var/log/nginx)
   - Recommendation: Add readOnlyRootFilesystem with emptyDir mounts for full OCP compliance, matching the pattern used by the frontend deployment.

3. **Outdated release-package k8s-deployment.yaml**
   - What we know: There are two k8s manifests -- one at `release-package/docs-docusaurus/k8s-deployment.yaml` (outdated) and one at `k8s/deployments/docs-deployment.yaml` (current).
   - CONTEXT.md says: "Move Docusaurus k8s deployment from release-package into main k8s/deployments/"
   - Recommendation: The move is already done. Delete the outdated `release-package/docs-docusaurus/k8s-deployment.yaml` or add a note that it's superseded.

## Sources

### Primary (HIGH confidence)
- Direct file reads of all Docusaurus project files, k8s manifests, and frontend source code
- CONTEXT.md decisions from user discussion
- REQUIREMENTS.md for DOC-06, DOC-07, DOC-08 specifications
- STATE.md for phases 14-18 decision history

### Secondary (MEDIUM confidence)
- [Docker Hub nginx tags](https://hub.docker.com/_/nginx/tags) - nginx:1.28-alpine as latest stable

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all dependencies already installed and verified via file reads
- Architecture: HIGH - existing project structure fully examined, patterns documented
- Pitfalls: HIGH - identified from direct analysis of k8s manifests, Dockerfile, and docs-url.ts
- Content gaps: HIGH - systematic comparison of changelog vs STATE.md phase decisions

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable -- documentation tooling rarely changes)
