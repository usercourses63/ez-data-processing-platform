# Phase 25: Clone Datasource - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add "Clone" capability to datasources — users can duplicate an existing datasource configuration to quickly create similar ones. Clone is available from the list page and details page. The cloned datasource opens as a pre-filled create form. Requirements: CLONE-01, CLONE-02, CLONE-03.

</domain>

<decisions>
## Implementation Decisions

### Actions Column Redesign (List Page)
- **D-01:** Redesign the list page actions column from 4 inline text+icon buttons to **Pattern 1: Primary Inline + Overflow Dropdown**
  - View and Edit remain as inline `Button type="link"` (always visible)
  - Clone, Manual Trigger, and Delete move into a "⋯" (`MoreOutlined`) overflow `Dropdown`
  - Delete gets a `Divider` separator above it in the dropdown (destructive action)
  - Column width can shrink from 240px to ~120-140px
  - Delete still uses confirmation (Popconfirm or Modal.confirm inside dropdown)

### Details Page Clone Button
- **D-02:** Clone button appears as a visible button **next to Edit** in the details page header
  - Header layout: `Back | Manual Trigger | Clone | Edit`
  - All buttons visible — no dropdown on details page

### Confirmation Flow
- **D-03:** Cloning shows a **confirmation modal** before navigating
  - Modal text: "Clone [datasource name]?" with note about schedule being disabled
  - Confirm → navigate to `/datasources/new` with cloned data
  - Cancel → stay on current page

### Clone Data Transformation
- **D-04:** What gets **cloned** (carried over):
  - All connection settings (type, server ID, NAS device ID, path, credentials, Kafka config)
  - File settings (type, delimiter, hasHeaders, encoding)
  - JSON Schema (full copy)
  - Validation rules (skipInvalidRecords, maxErrorsAllowed)
  - Notification settings including recipients (same team monitors clone)
  - Output destinations (with **new UUIDs** via `crypto.randomUUID()`)
  - Archive settings including password (full copy)
  - Category, description, retentionDays

- **D-05:** What gets **reset/changed**:
  - Name → prefixed with "העתק של " (Hebrew) or "Copy of " (English) based on current language
  - ID → none (new entity, created on save)
  - Version → none (new entity)
  - Schedule → `scheduleEnabled: false` (force disabled to prevent immediate polling)
  - Connection test status → reset to untested (user must re-test)
  - Statistics → cleared (TotalFilesProcessed, TotalErrorRecords, LastProcessedAt)
  - isActive → true (default)

### Claude's Discretion
- Loading state/spinner while fetching full datasource on list page clone
- Exact modal styling and layout
- Error handling if datasource fetch fails
- Whether to scroll to top of form after clone navigation

</decisions>

<specifics>
## Specific Ideas

- The actions column redesign should be done as part of this phase since we're already modifying the actions area
- Use Ant Design `Dropdown` with `menu` prop (not deprecated `overlay`) for the overflow menu
- Confirmation modal should be a simple `Modal.confirm()` call, not a full component

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Implementation Plan
- `C:\Users\UserC\.claude\plans\shimmering-tumbling-kettle.md` — Detailed implementation plan with file paths, code patterns, and approach for all 3 features

### Codebase References
- `src/Frontend/src/pages/datasources/DataSourceList.tsx` lines 362-416 — Current actions column implementation
- `src/Frontend/src/pages/datasources/DataSourceDetailsEnhanced.tsx` — Details page header buttons
- `src/Frontend/src/pages/datasources/DataSourceFormEnhanced.tsx` — Create form (must read `location.state`)
- `src/Frontend/src/pages/datasources/DataSourceEditEnhanced.tsx` lines 465-468 — `savedFieldValues` pattern for lazy tabs
- `src/Frontend/src/components/datasource/shared/helpers.ts` — Shared utility functions
- `src/Frontend/src/components/datasource/shared/types.ts` — DataSource, OutputConfiguration types

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `helpers.ts`: Contains `humanizeCron`, `frequencyToCron`, `buildConnectionString` — add `prepareCloneData()` here
- `types.ts`: Contains `DataSource`, `OutputConfiguration`, `OutputDestination` — add `ClonePayload` interface
- `DataSourceEditEnhanced.tsx`: Has the `savedFieldValues` pattern for restoring `inputServerId`/`nasDeviceId` after lazy tab mount — clone must use the same pattern
- `constants.ts`: `DEFAULT_FORM_VALUES` for fallback values

### Established Patterns
- `navigate('/datasources/new', { state: { ... } })` — React Router state passing (not yet used but standard pattern)
- `useLocation()` for reading navigation state
- `form.setFieldsValue()` for bulk form population
- `Popconfirm` for destructive actions (existing Delete pattern)
- PascalCase in API responses, camelCase in frontend state
- i18n via `t('key')` for all user-facing text

### Integration Points
- `DataSourceFormEnhanced` must read `location.state?.cloneData` on mount
- `DataSourceFormEnhanced` must pass `savedFieldValues` to `ConnectionTab` (same as edit page)
- List page clone needs to fetch full datasource via `GET /api/v1/datasource/{id}` (list only has summary)
- Details page already has full `dataSource` and `parsedConfig` in state — no extra fetch needed

</code_context>

<deferred>
## Deferred Ideas

- Bulk clone (clone multiple datasources at once) — captured as DS-FUTURE-02
- Export datasource config as JSON — captured as DS-FUTURE-01

</deferred>

---

*Phase: 25-clone-datasource*
*Context gathered: 2026-03-24*
