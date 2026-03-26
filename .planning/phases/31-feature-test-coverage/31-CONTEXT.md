# Phase 31: Feature Test Coverage - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

UI E2E Playwright tests for v0.4.0/v0.5.0 features: completeness checklist, clone datasource, import from file, i18n/RTL regression. Builds on Phase 30's API-level sanity tests with deeper browser-based workflow coverage.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User deferred all gray areas — Claude has full discretion on:
- Test depth (happy-path smoke vs exhaustive)
- Clone workflow test scope and edge cases
- Import from file test approach (file injection method)
- i18n/RTL regression scope
- Test file organization (extend sanity.spec.ts vs separate files)

### Carrying Forward from Phase 30
- D-01: Use `extractId()` / `extractData()` helpers for API response handling
- D-02: PascalCase for API requests, `?deletedBy=SanityTest` for cleanup
- D-03: `antTabClick()` helper for RTL Ant Design tab navigation
- D-04: API-based verification preferred over UI pagination for assertions

</decisions>

<canonical_refs>
## Canonical References

### Existing Tests
- `src/Frontend/tests/e2e/sanity.spec.ts` — 19 sanity tests with established patterns
- `src/Frontend/playwright.config.ts` — Multi-project config
- `src/Frontend/tests/e2e/` — 30+ existing test files

### Feature Code
- `src/Frontend/src/components/datasource/shared/prepareCloneData.ts` — Clone utility
- `src/Frontend/src/utils/fileAnalyzer.ts` — Import file analysis
- `src/Frontend/src/hooks/useCompletenessTracker.ts` — Completeness hook
- `src/Frontend/src/i18n/locales/he.json` — Hebrew translations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- antTabClick, antSelect, extractId, extractData helpers in sanity.spec.ts
- Playwright multi-project config with sanity, chromium, protocols projects
- API fallback pattern for UI operations that fail in headless mode

### Established Patterns
- API-first verification with UI interaction for workflow testing
- Cleanup via DELETE API with deletedBy parameter
- RTL viewport 1440x900 for Hebrew UI tests

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 31-feature-test-coverage*
*Context gathered: 2026-03-27*
