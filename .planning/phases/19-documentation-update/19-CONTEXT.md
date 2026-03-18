# Phase 19: Documentation Update - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Update Docusaurus documentation for v0.2.0 release. This includes: updating all doc content to reflect phases 11-18 features, restructuring sidebar navigation, building and deploying the Docusaurus container, and verifying the frontend help link opens the running documentation portal. No new features — documentation of existing implemented functionality only.

</domain>

<decisions>
## Implementation Decisions

### Content scope & accuracy
- Match existing documentation style and depth (TypeScript interfaces, API tables, architecture descriptions, practical examples — see admin.md and components/nas-devices.mdx as reference)
- Update admin.md with new sections for SignalR real-time monitoring, device health monitoring, OTEL observability
- Update system-architecture.md in-place with v0.2 architecture changes (SignalR hub, OTEL pipeline, device health)
- Rewrite v0.2.0 changelog.md and release-notes.md sections from scratch — current entries are incomplete (missing phases 14-18 features)
- Add new component documentation pages for System Monitoring (SignalR-based) and Device Health features, matching existing component doc style (datasource-forms.mdx, nas-devices.mdx)
- Update Hebrew user guide (user-guide-he.mdx) with all v0.2.0 features — monitoring, device health, etc.

### Sidebar & navigation structure
- Remove "(Legacy)" labels from Architecture and Deployment sidebar sections — content is still valid, just needs updating
- Add new "Monitoring" sidebar category with system-monitoring.mdx and device-health.mdx pages
- Guides category: Claude's discretion on whether to uncomment the consolidated "Guides" category or keep Architecture/Deployment as separate top-level categories — pick the cleanest organization

### Container build & deployment
- Pin nginx version in Dockerfile to specific nginx:1.x-alpine version (OCP compliance — no unpinned images)
- Move Docusaurus k8s deployment from release-package/docs-docusaurus/k8s-deployment.yaml into main k8s/deployments/ for unified deployment
- Image tag: docs-docusaurus:v0.2.0 — matches platform release version
- Keep Dockerfile OCP-compatible (non-root user, port 8080, readOnlyRootFilesystem)

### Help link connectivity
- Fix docs-url.ts dev detection to cover all RFC1918 private IP ranges (add 172.16-31.x and 10.x patterns alongside existing 192.168.x) — Claude's discretion on exact implementation
- Dev mode docs URL: point to K8s-deployed NodePort (not localhost:3000) — developers test against the actual deployed container
- Verify and fix k8s ingress rules for /docs path routing to Docusaurus service — add routing if missing
- Verify help button opens docs portal in both dev (NodePort) and production (/docs path) environments

### Claude's Discretion
- Exact sidebar category organization (Guides consolidated vs separate Architecture/Deployment)
- Dev detection IP pattern implementation approach (regex vs array of ranges)
- Whether to create a testing.md doc page for the Guides section
- Exact nginx version to pin to (latest stable 1.x-alpine at implementation time)
- Loading/error states for help link when docs container is unavailable

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Docusaurus project
- `release-package/docs-docusaurus/docusaurus.config.js` — Site configuration, i18n, sidebar, navbar, footer, search plugin
- `release-package/docs-docusaurus/sidebars.js` — Current sidebar structure with legacy sections and commented-out Guides
- `release-package/docs-docusaurus/Dockerfile` — OCP-compatible Docker build (needs nginx pin)
- `release-package/docs-docusaurus/k8s-deployment.yaml` — K8s deployment manifest (to be moved to k8s/deployments/)

### Documentation content to update
- `release-package/docs-docusaurus/docs/admin.md` — Admin guide (add monitoring sections)
- `release-package/docs-docusaurus/docs/architecture/system-architecture.md` — Architecture doc (add v0.2 changes)
- `release-package/docs-docusaurus/docs/changelog.md` — Changelog (rewrite v0.2.0 section)
- `release-package/docs-docusaurus/docs/release-notes.md` — Release notes (rewrite v0.2.0 section)
- `release-package/docs-docusaurus/docs/user-guide-he.mdx` — Hebrew user guide (add v0.2.0 features)
- `release-package/docs-docusaurus/docs/components/` — Component docs (add monitoring components)

### Frontend help link
- `src/Frontend/src/utils/docs-url.ts` — Documentation URL utility (fix dev detection)
- `src/Frontend/src/components/layout/AppHeader.tsx` — Help button implementation

### Requirements
- `.planning/REQUIREMENTS.md` — DOC-06 (content update), DOC-07 (container build), DOC-08 (help link)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs-url.ts`: Full URL utility with environment detection, path building, and `openDocsInNewTab()` — needs IP detection fix only
- `AppHeader.tsx`: Help button already wired with tooltip, RTL support, and aria-label — just needs URL to work
- Docusaurus project: Complete setup with search plugin, i18n (en/he), dark mode, and custom CSS
- Component doc templates: `nas-devices.mdx`, `datasource-forms.mdx`, `schema-editor.mdx` — use as templates for new monitoring component docs

### Established Patterns
- Component docs use `.mdx` format with `@theme/Tabs` imports for code examples
- Admin guide uses pure Markdown with API tables, architecture diagrams, and config snippets
- Sidebar uses `sidebar_position` frontmatter for ordering within categories
- Docs use `last_verified` frontmatter to track accuracy

### Integration Points
- Ingress routing: `/docs` path must route to Docusaurus service (check k8s/ingress/)
- Helm chart: May need to add Docusaurus deployment to helm/ez-platform/ if it exists there
- Frontend build: docs-url.ts changes require frontend image rebuild
- Deploy script: k8s/deploy-all.sh may need updating to include docs deployment

</code_context>

<specifics>
## Specific Ideas

- User wants dev mode to use NodePort URL (deployed container) rather than localhost:3000 — tests against real deployment
- Content depth should match existing docs — analyze admin.md and component docs for the exact level of detail
- Hebrew user guide must include all v0.2.0 features, not just English docs

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-documentation-update*
*Context gathered: 2026-03-17*
