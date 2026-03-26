# Phase 28: Polish, i18n & Release - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Finalize v0.4.0: audit Hebrew translations, rebuild all 9 service images, add clone E2E tests, completely redesign Docusaurus documentation (especially Hebrew user guide with screenshots/graphics), assemble deployment package, verify fresh install + sanity tests.

</domain>

<decisions>
## Implementation Decisions

### i18n Completeness Audit
- **D-01:** Gap sweep only — scan all React components in clone/import/completeness features for hardcoded English strings and missing translation keys
- **D-02:** Most Hebrew translations were already added during Phase 25-27 development. Only fix what's missing.
- **D-03:** No RTL visual audit or manual rendering checks required — Ant Design RTL was verified in prior phases

### Deployment Package
- **D-04:** Full rebuild of ALL 9 service images from source with v0.4.0 tags (not just changed services)
- **D-05:** Use existing `build-all-images.sh` pattern from v0.3.0 release
- **D-06:** Assemble full deployment package at `dist/deployment-v0.4.0-{timestamp}/` with Helm chart, images, install scripts
- **D-07:** Fresh install verification using `install.ps1` on clean cluster

### Playwright E2E Tests
- **D-08:** Keep existing 51 archive + 10 comprehensive + sanity tests
- **D-09:** Add clone feature E2E tests: clone → verify all fields preserved → edit clone → save
- **D-10:** Target ~65 total E2E tests
- **D-11:** All tests must pass --headed before release

### Docusaurus Documentation
- **D-12:** TOTAL REDESIGN of Docusaurus documentation site — not incremental updates
- **D-13:** Hebrew user guide must be completely refactored with detailed step-by-step coverage of ALL 3 new features (clone, import, completeness)
- **D-14:** User guide must include graphics: screenshots, workflow diagrams, annotated UI captures
- **D-15:** After plan mode discussion, documentation plans will be created as separate GSD plans
- **D-16:** Scope includes: changelog, component docs, admin guide, Hebrew user guide, architecture diagrams

### Claude's Discretion
- i18n gap detection method (grep for hardcoded strings vs. AST analysis)
- Image tag naming convention (v0.4.0 vs v0.4.0-rc1)
- Screenshot capture tool/method for documentation
- Docusaurus theme/layout changes (if needed for redesign)

</decisions>

<specifics>
## Specific Ideas

- User explicitly wants the documentation to be a "total refresh / refactor / redesign" — not incremental patches
- Hebrew user guide should be the primary focus of docs work, with step-by-step guides for each feature
- Graphics are mandatory: screenshots, workflow diagrams, annotated UI captures
- Documentation planning will happen in Claude plan mode first, then converted to GSD plans

</specifics>

<canonical_refs>
## Canonical References

### Release packaging (v0.3.0 pattern)
- `.planning/phases/24-v030-release-package-and-deploy/` — Prior release packaging plans, deployment scripts
- `scripts/build-all-images.sh` — Image build script (if exists, or Dockerfile locations in src/Services/*)
- `helm/ez-platform/` — Helm chart with values-dev.yaml

### Existing Docusaurus site
- `docs/` — Current documentation root
- `docs/docusaurus/` — Docusaurus config and content (if exists)
- `src/Frontend/src/i18n/locales/he.json` — Hebrew translation file (reference for user guide terminology)

### Test infrastructure
- `src/Frontend/playwright.config.ts` — Playwright config, baseURL localhost:7000
- `src/Frontend/tests/e2e/` — Existing E2E tests
- `src/Frontend/test-comprehensive.mjs` — Comprehensive test suite
- `src/Frontend/test-data/` — Test fixtures (CSV, JSON, XML, archives)

### Feature code (for documentation screenshots)
- `src/Frontend/src/pages/datasources/DataSourceList.tsx` — Clone + import buttons, completeness indicators
- `src/Frontend/src/pages/datasources/DataSourceFormEnhanced.tsx` — Create form with completeness sidebar
- `src/Frontend/src/pages/datasources/DataSourceEditEnhanced.tsx` — Edit form with completeness
- `src/Frontend/src/components/datasource/completeness/` — Completeness panel components
- `src/Frontend/src/components/datasource/import/` — Import from file components

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/start-port-forwards.ps1` — Port forwarding for all 18 services (needed for screenshot capture)
- Phase 24 deployment scripts — Release packaging pattern for v0.3.0 can be replicated
- Playwright test infrastructure — Already configured for headed mode + CI

### Established Patterns
- Hebrew translations in `src/Frontend/src/i18n/locales/he.json` — flat key structure with nested namespaces
- Docker images: each service has Dockerfile in its directory, built from repo root context
- Minikube image tags must use new tag names (caching issue with same tag)

### Integration Points
- Helm chart needs image tag updates for all 9 services
- Docusaurus site needs npm build + deploy to GitHub Pages (or local preview)
- Sanity tests run against deployed K8s cluster via port-forward or NodePort

</code_context>

<deferred>
## Deferred Ideas

- Automated screenshot capture pipeline (Playwright screenshots for docs) — could be v0.5.0
- CI/CD pipeline for automated E2E on every push — infrastructure phase
- Performance benchmarks and load testing documentation — v0.5.0

</deferred>

---

*Phase: 28-polish-i18n-release*
*Context gathered: 2026-03-26*
