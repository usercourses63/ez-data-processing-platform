# Phase 9: Frontend Development Workflow - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish frontend development tooling, testing strategy, coordination patterns, and Docusaurus portal integration for the existing React 19 + Ant Design 5 frontend. This phase creates processes and documentation, not new features.

Requirements: FE-01, FE-02, FE-03, FE-04, FE-05, FE-06, FE-07

</domain>

<decisions>
## Implementation Decisions

### Component Documentation
- Scope: Critical path components only (data source forms, schema editor, NAS device tab)
- Depth: Full documentation — props, variants, accessibility notes, do's/don'ts, multiple examples
- RTL examples: Side-by-side LTR and RTL variants for each documented component
- Design tokens: Skip — Ant Design theme handles colors, spacing, typography
- Tool and interactive playground: Claude's discretion based on codebase patterns

### E2E Test Coverage
- User journeys: Data source CRUD + Schema validation management
- Backend dependency: Real backend via port-forward (not mocked)
- RTL verification in E2E: Visual regression screenshots only (not functional assertions)
- CI integration: Skip in CI — E2E tests run locally/staging, not blocking PRs

### Help/Docs Portal Integration
- Help button behavior: Always link to /docs portal (opens new tab)
- Context-aware links: Claude's discretion on mapping pages to doc sections
- URL determination: Runtime detection — check window.location.hostname, use localhost:3000 in dev
- Help visibility: Global header/footer — always visible in app layout

### Hebrew/RTL Verification
- Scope: All pages must render correctly in Hebrew RTL mode
- Method: Automated layout assertions via Playwright (direction, text-align, margin/padding)
- Technical content: Always LTR (code snippets, file paths, URLs, regex patterns)
- Docusaurus Hebrew: Separate verification from React app RTL testing

### Claude's Discretion
- Component documentation tool (Storybook vs Docusaurus MDX vs other)
- Whether component docs include interactive playground
- Context-aware Help link mapping (page → doc section)
- React 19 patterns documentation depth
- API change coordination process format

</decisions>

<specifics>
## Specific Ideas

- Component docs should show LTR and RTL variants side-by-side for visual comparison
- E2E tests use real backend via port-forward script (already exists: scripts/start-port-forwards.ps1)
- Help button uses runtime hostname detection: `window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/docs'`
- Technical content stays LTR even in Hebrew context — use existing `.ltr-field` CSS class pattern

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-frontend-development-workflow*
*Context gathered: 2026-02-03*
