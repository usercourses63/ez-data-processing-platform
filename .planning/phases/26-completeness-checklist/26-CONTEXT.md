# Phase 26: Completeness Checklist - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add real-time form completeness guidance to the datasource create and edit forms. Users see a persistent sidebar checklist showing per-tab completion status, a circular progress ring, and color-coded field indicators. Also includes: enforce that incomplete datasources cannot be enabled, and redesign the enable/disable toggle on the list page from status column to action icon. Requirements: CHECK-01, CHECK-02, CHECK-03, CHECK-04.

</domain>

<decisions>
## Implementation Decisions

### Checklist Placement
- **D-01:** Persistent **sidebar panel** to the left of the form (right side in RTL), always visible
- **D-02:** Sidebar shows all **9 tabs** with completion status icons: Basic Info, Connection, File Settings, Schema, Schedule, Validation, Notifications, Output, Metrics
- **D-03:** Circular **progress ring** (Ant Design Progress circle) at the top of the sidebar showing overall required-fields percentage
- **D-04:** Secondary text below the ring showing recommended-fields completion (e.g., "40% recommended")
- **D-05:** Sidebar behaves **identically in create and edit modes** — always visible and expanded

### Sidebar Navigation
- **D-06:** Clicking a tab item in the sidebar **navigates to that tab** in the form (satisfies CHECK-03)
- **D-07:** Active tab highlighted in the sidebar to show current position

### Completeness Tiers (Three-Tier System)
- **D-08:** **Required** tabs (red if incomplete): Basic Info, Connection, File Settings, Schema
  - These fields must be filled for the main percentage ring to reach 100%
- **D-09:** **Recommended** tabs (yellow in sidebar if empty): Schedule, Metrics, Output
  - Tracked by the secondary "recommended" indicator, not the main percentage
- **D-10:** **Optional** tabs (gray in sidebar): Validation, Notifications
  - Never counted in any percentage — purely informational

### Schema Completeness Criteria
- **D-11:** Schema tab counts as complete when: at least 1 property with a type defined AND the schema passes JSON Schema 2020-12 validation
- **D-12:** Empty schema or schema with untyped properties = incomplete (red in sidebar)

### Schema-FileType Alignment Check
- **D-22:** Schema structure must be compatible with the selected file type. This is a completeness condition on the Schema tab — if the schema is structurally incompatible with the file type, the Schema tab shows as incomplete (red).
- **D-23:** CSV/Excel rules (always produce flat arrays of objects):
  - PASS: All schema properties are primitive types (string, number, integer, boolean)
  - FAIL: Schema has any property with `type: "object"` (nesting impossible in CSV/Excel)
  - FAIL: Schema has any property with `type: "array"` (arrays impossible in CSV/Excel)
  - INFO (soft warning, not a blocker): CSV with `hasHeaders: false` shows an informational message: "CSV files without headers will use schema field names by position order (1st schema field = 1st column, etc.)"
- **D-24:** XML rules (can have nesting + arrays):
  - PASS: Any valid schema structure (nested objects, arrays all OK)
  - No structural restrictions — XML converter preserves nesting
- **D-25:** JSON rules (passthrough, any structure):
  - PASS: Any valid schema structure
  - No structural restrictions — JSON is passed through as-is
- **D-26:** The alignment check runs reactively whenever fileType OR schema changes. Warning message in sidebar explains WHY the schema is incompatible (e.g., "CSV files produce flat records — schema cannot contain nested objects")

### Field-Level Indicators
- **D-13:** Each Form.Item in required tabs gets a **colored left border**: red for required-empty, green for filled, gray for optional
- **D-14:** Borders appear **immediately on form load** — no touch-based progressive reveal
- **D-15:** Recommended tabs (Schedule, Metrics, Output) show **gray borders** inside the tab — yellow status appears **only in the sidebar**, not on individual fields

### Completeness Enforcement
- **D-16:** If a datasource is saved with missing required fields, its status is auto-set to **disabled**
- **D-17:** Only datasources with all required fields complete can be set to **enabled**
- **D-18:** Attempting to enable an incomplete datasource shows a message explaining what's missing

### List Page Enable/Disable Redesign
- **D-19:** Move enable/disable from the status column **to the actions area** (inline with View/Edit, or in the overflow dropdown)
- **D-20:** Status column becomes **read-only display** — shows enabled/disabled badge without toggle interaction
- **D-21:** Enable action checks completeness and blocks with message if required fields are missing

### Claude's Discretion
- Sidebar width and responsive breakpoint behavior
- Exact progress ring size and color theme (green/red gradient vs fixed colors)
- Animation/transition when percentage updates
- Sidebar scroll behavior when form is long
- How the "what's missing" message is presented (tooltip, modal, inline warning)
- Enable/disable placement: inline button vs overflow dropdown item

</decisions>

<specifics>
## Specific Ideas

- The sidebar should feel like a form wizard progress tracker — clear at a glance which steps are done
- Color language: red = required missing, green = filled, yellow = recommended missing, gray = optional/untouched
- The percentage ring is the hero element of the sidebar — should be prominent
- Schema validation uses Corvus.Json.Validator on the backend, but this check is frontend-only (real-time as user edits)

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Codebase References
- `src/Frontend/src/pages/datasources/DataSourceFormEnhanced.tsx` — Main create form (must add sidebar layout)
- `src/Frontend/src/pages/datasources/DataSourceEditEnhanced.tsx` — Edit form (must add same sidebar)
- `src/Frontend/src/pages/datasources/DataSourceList.tsx` — List page (enable/disable redesign)
- `src/Frontend/src/components/datasource/tabs/` — All 9 tab components
- `src/Frontend/src/components/datasource/shared/types.ts` — DataSource, OutputConfiguration types
- `src/Frontend/src/components/datasource/shared/constants.ts` — DEFAULT_FORM_VALUES, options
- `src/Frontend/src/components/datasource/shared/helpers.ts` — Utility functions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Ant Design `Progress` component (circle type) — ready to use for the ring
- Ant Design `Form.useWatch()` — can observe field changes for real-time percentage updates
- Ant Design `Menu` or `Steps` component — could be used for the sidebar tab list
- `schemaValidator.ts` — existing schema validation utility, can be reused for schema completeness check
- Phase 25 overflow dropdown pattern (MoreOutlined) — reuse for enable/disable action placement

### Established Patterns
- `form.getFieldsValue()` for bulk field reads
- `form.setFieldsValue()` with `savedFieldValues` prop for lazy-loaded tab values
- Lazy tab loading via `Suspense + lazy()` — checklist must handle unmounted tab fields
- `useEntitySync` hook for real-time multi-user sync (already handles enable/disable broadcasts)
- SignalR `EntityChanged` broadcast on all CRUD operations

### Integration Points
- Form layout must change from full-width tabs to sidebar + tabs side-by-side
- `jsonSchema` and `outputConfig` stored outside Ant Design Form — checklist must read these separately
- Lazy-loaded tabs: fields not registered until tab visited — must use `savedFieldValues` or equivalent to track completeness of unvisited tabs
- List page actions column (Phase 25 redesign): add enable/disable to existing overflow dropdown

</code_context>

<deferred>
## Deferred Ideas

- Metrics tab cloning — Phase 28
- Bulk enable/disable from list page (select multiple datasources) — backlog
- Completeness enforcement on backend API (reject enable if incomplete server-side) — future hardening
- **CsvToJsonConverter headerless fix:** When `hasHeaders: false`, the backend currently assigns generic `Column1, Column2...` names. It should instead use schema field names by position order (1st schema property → 1st CSV column, 2nd → 2nd, etc.). This requires passing the JSON schema to the converter. Backend fix — not in scope for Phase 26 (frontend-only).

</deferred>

---

*Phase: 26-completeness-checklist*
*Context gathered: 2026-03-24*
