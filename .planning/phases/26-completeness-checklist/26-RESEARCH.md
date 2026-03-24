# Phase 26: Completeness Checklist - Research

**Researched:** 2026-03-24
**Domain:** React form completeness tracking, Ant Design Form API, sidebar layout
**Confidence:** HIGH

## Summary

This phase adds a real-time completeness sidebar to the datasource create and edit forms. The sidebar shows a progress ring, per-tab completion status with color coding, and enables click-to-navigate. It also adds field-level colored left borders and enforces that incomplete datasources cannot be enabled.

The primary technical challenge is tracking completeness of fields across 9 lazy-loaded tabs where most Form.Items are unmounted at any given time. Ant Design's `Form.useWatch` re-renders the entire component on every keystroke, making it unsuitable for watching all fields simultaneously. The recommended approach is `onValuesChange` callback on the Form, which fires on every change without re-rendering the parent component. For non-form state (jsonSchema, outputConfig), direct state tracking via existing React state setters is sufficient.

**Primary recommendation:** Use `Form.onValuesChange` combined with a completeness calculation hook (`useCompletenessTracker`) that maintains its own state. Define required/recommended field lists as static configuration per tab. For unmounted lazy-loaded tab fields, read initial/clone/edit values from the data source and merge with form values to compute completeness without requiring tab visits.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Persistent sidebar panel to the left of the form (right side in RTL), always visible
- **D-02:** Sidebar shows all 9 tabs with completion status icons: Basic Info, Connection, File Settings, Schema, Schedule, Validation, Notifications, Output, Metrics
- **D-03:** Circular progress ring (Ant Design Progress circle) at the top of the sidebar showing overall required-fields percentage
- **D-04:** Secondary text below the ring showing recommended-fields completion (e.g., "40% recommended")
- **D-05:** Sidebar behaves identically in create and edit modes -- always visible and expanded
- **D-06:** Clicking a tab item in the sidebar navigates to that tab in the form (satisfies CHECK-03)
- **D-07:** Active tab highlighted in the sidebar to show current position
- **D-08:** Required tabs (red if incomplete): Basic Info, Connection, File Settings, Schema
- **D-09:** Recommended tabs (yellow in sidebar if empty): Schedule, Metrics, Output
- **D-10:** Optional tabs (gray in sidebar): Validation, Notifications
- **D-11:** Schema tab counts as complete when: at least 1 property with a type defined AND the schema passes JSON Schema 2020-12 validation
- **D-12:** Empty schema or schema with untyped properties = incomplete (red in sidebar)
- **D-13:** Each Form.Item in required tabs gets a colored left border: red for required-empty, green for filled, gray for optional
- **D-14:** Borders appear immediately on form load -- no touch-based progressive reveal
- **D-15:** Recommended tabs (Schedule, Metrics, Output) show gray borders inside the tab -- yellow status appears only in the sidebar, not on individual fields
- **D-16:** If a datasource is saved with missing required fields, its status is auto-set to disabled
- **D-17:** Only datasources with all required fields complete can be set to enabled
- **D-18:** Attempting to enable an incomplete datasource shows a message explaining what's missing
- **D-19:** Move enable/disable from the status column to the actions area (inline with View/Edit, or in the overflow dropdown)
- **D-20:** Status column becomes read-only display -- shows enabled/disabled badge without toggle interaction
- **D-21:** Enable action checks completeness and blocks with message if required fields are missing

### Claude's Discretion
- Sidebar width and responsive breakpoint behavior
- Exact progress ring size and color theme (green/red gradient vs fixed colors)
- Animation/transition when percentage updates
- Sidebar scroll behavior when form is long
- How the "what's missing" message is presented (tooltip, modal, inline warning)
- Enable/disable placement: inline button vs overflow dropdown item

### Deferred Ideas (OUT OF SCOPE)
- Metrics tab cloning -- Phase 28
- Bulk enable/disable from list page (select multiple datasources) -- backlog
- Completeness enforcement on backend API (reject enable if incomplete server-side) -- future hardening
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHECK-01 | Create form shows real-time completeness percentage and per-tab status | Sidebar with Progress circle + onValuesChange tracking. Completeness config maps fields to tiers. |
| CHECK-02 | Edit form shows real-time completeness percentage and per-tab status | Same sidebar component shared between create/edit. Edit form initializes completeness from loaded data. |
| CHECK-03 | Clicking an incomplete tab item navigates to that tab | Sidebar items call `setActiveTab(tabKey)` on click (D-06). Existing `activeTab` state in both forms. |
| CHECK-04 | Required vs recommended fields distinguished with color-coded indicators | Three-tier system (D-08/D-09/D-10) with CSS left borders (D-13) and sidebar status icons. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| antd | 5.29.1 (installed) | Progress circle, Form, Layout.Sider, Menu | Already in project; provides all needed components |
| React 19 | 19.x (installed) | Hooks, state management | Already in project |
| @tanstack/react-query | 5.90.2 (installed) | Data fetching in tabs | Already in project; no new dependency needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv | 8.17.1 (installed) | Schema completeness validation (D-11) | Reuse existing schemaValidator.ts for checking if schema is valid |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom sidebar | Ant Design Steps (vertical) | Steps component is too rigid for custom status icons; use a custom sidebar with Ant Design primitives (Menu or styled divs) |
| Form.useWatch for all fields | onValuesChange callback | useWatch re-renders entire component per keystroke; onValuesChange is event-based with no re-render cost |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/datasource/
  completeness/
    CompletenessPanel.tsx          # Sidebar component (progress ring + tab list)
    CompletenessFieldWrapper.tsx   # Wrapper for Form.Item with colored left border
    useCompletenessTracker.ts      # Hook: computes completeness from form + non-form state
    completenessConfig.ts          # Static config: which fields per tab, required/recommended/optional
    types.ts                       # TabCompleteness, FieldStatus, CompletenessState types
```

### Pattern 1: onValuesChange-Based Completeness Tracking
**What:** Use Form's `onValuesChange` callback to trigger completeness recalculation without re-rendering the parent component on every keystroke.
**When to use:** When tracking many fields across a form with lazy-loaded tabs.
**Example:**
```typescript
// In useCompletenessTracker.ts
export function useCompletenessTracker(
  form: FormInstance,
  jsonSchema: JSONSchema,
  outputConfig: OutputConfiguration
) {
  const [completeness, setCompleteness] = useState<CompletenessState>(initialState);

  // Called from Form's onValuesChange - does NOT cause parent re-render
  const recalculate = useCallback((changedValues: any, allValues: any) => {
    const newState = computeCompleteness(allValues, jsonSchema, outputConfig, fieldConfig);
    setCompleteness(newState);
  }, [jsonSchema, outputConfig]);

  // Also recalculate when non-form state changes (schema, output)
  useEffect(() => {
    const allValues = form.getFieldsValue(true); // true = include unmounted fields with preserve
    const newState = computeCompleteness(allValues, jsonSchema, outputConfig, fieldConfig);
    setCompleteness(newState);
  }, [jsonSchema, outputConfig]);

  return { completeness, recalculate };
}
```

### Pattern 2: Static Field Configuration
**What:** Define which fields belong to which tab and which tier (required/recommended/optional) in a static config object.
**When to use:** To decouple completeness logic from UI components.
**Example:**
```typescript
// completenessConfig.ts
export const TAB_FIELD_CONFIG: Record<string, TabFieldConfig> = {
  basic: {
    tier: 'required',
    fields: [
      { name: 'name', required: true },
      { name: 'supplierName', required: true },
      { name: 'category', required: true },
      { name: 'description', required: false },
      { name: 'retentionDays', required: false },
      { name: 'isActive', required: false },
    ]
  },
  connection: {
    tier: 'required',
    fields: [
      { name: 'connectionType', required: true },
      // Dynamic: depends on connectionType (inputServerId for non-NAS, nasDeviceId for NAS)
      { name: 'connectionPath', required: true, when: (v) => ['Local','FTP','SFTP'].includes(v.connectionType) },
      { name: 'connectionUrl', required: true, when: (v) => v.connectionType === 'HTTP' },
      { name: 'inputServerId', required: true, when: (v) => v.connectionType !== 'NAS' },
      { name: 'nasDeviceId', required: true, when: (v) => v.connectionType === 'NAS' },
      { name: 'kafkaBrokers', required: true, when: (v) => v.connectionType === 'Kafka' },
      { name: 'kafkaTopic', required: true, when: (v) => v.connectionType === 'Kafka' },
    ]
  },
  file: {
    tier: 'required',
    fields: [
      { name: 'fileType', required: true },
      { name: 'encoding', required: false },
    ]
  },
  schema: {
    tier: 'required',
    // Special: completeness determined by jsonSchema state, not form fields
    nonFormCheck: (jsonSchema) => {
      if (!jsonSchema?.properties) return false;
      const props = Object.values(jsonSchema.properties);
      return props.length > 0 && props.every(p => p.type !== undefined);
    }
  },
  schedule: { tier: 'recommended', fields: [...] },
  metrics: { tier: 'recommended', nonFormCheck: ... },
  output: { tier: 'recommended', nonFormCheck: (_, outputConfig) => (outputConfig?.destinations?.length || 0) > 0 },
  validation: { tier: 'optional', fields: [...] },
  notifications: { tier: 'optional', fields: [...] },
};
```

### Pattern 3: Sidebar Layout with Ant Design
**What:** Use CSS flexbox to place sidebar alongside the existing Card/Tabs layout.
**When to use:** To create the persistent sidebar without breaking existing form structure.
**Example:**
```typescript
// Layout structure in DataSourceFormEnhanced.tsx
<div style={{ display: 'flex', gap: 16 }}>
  {/* Sidebar */}
  <div style={{ width: 260, flexShrink: 0 }}>
    <CompletenessPanel
      completeness={completeness}
      activeTab={activeTab}
      onTabClick={setActiveTab}
    />
  </div>
  {/* Main form area */}
  <div style={{ flex: 1, minWidth: 0 }}>
    <Card>
      <Form ... onValuesChange={recalculate}>
        <Tabs .../>
      </Form>
    </Card>
  </div>
</div>
```

### Pattern 4: Colored Left Border on Form.Item
**What:** Use CSS to add a 3-4px colored left border (right border in RTL) to Form.Item containers.
**When to use:** For field-level completeness indicators (D-13).
**Example:**
```css
/* completeness.css */
.completeness-field-required-empty .ant-form-item {
  border-inline-start: 4px solid #ff4d4f; /* red */
  padding-inline-start: 12px;
}
.completeness-field-filled .ant-form-item {
  border-inline-start: 4px solid #52c41a; /* green */
  padding-inline-start: 12px;
}
.completeness-field-optional .ant-form-item {
  border-inline-start: 4px solid #d9d9d9; /* gray */
  padding-inline-start: 12px;
}
```
**Key:** Using `border-inline-start` and `padding-inline-start` ensures correct behavior in both LTR and RTL modes. In RTL, `inline-start` maps to the right side.

### Anti-Patterns to Avoid
- **Form.useWatch on all fields:** Each useWatch call re-renders the parent component on every keystroke. With 30+ fields, this creates severe performance degradation. Use `onValuesChange` instead.
- **Requiring tab visits for completeness:** Users should see accurate completeness without visiting every tab. Use `form.getFieldsValue(true)` with `preserve={true}` and/or merge with initial data.
- **Coupling completeness logic to tab components:** Tab components should be unaware of completeness. The wrapper/hook should handle it externally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circular progress ring | Custom SVG circle | `<Progress type="circle" percent={n} />` from antd | Handles animation, RTL, theming automatically |
| JSON Schema validation | Custom parser | Existing `schemaValidator.ts` (uses ajv 8.17.1) | Already handles RTL pattern reversal, draft 2020-12 |
| RTL-aware borders | Manual direction checks | CSS `border-inline-start` / `padding-inline-start` | CSS logical properties handle RTL automatically |
| Tab navigation | Custom routing | Existing `setActiveTab` state setter | Already wired to Tabs `activeKey` in both forms |

**Key insight:** The completeness system is purely a read-side overlay on the existing form. It does not change how data flows or is saved. It observes form state and non-form state, computes a derived view, and renders a sidebar. Keep it decoupled.

## Common Pitfalls

### Pitfall 1: Lazy-Loaded Tab Fields Not Registered
**What goes wrong:** Form.Item fields on unmounted tabs are not registered in the form store. `form.getFieldsValue()` returns `undefined` for them.
**Why it happens:** Ant Design Form.Item only registers when mounted. With `Suspense + lazy()`, tabs not yet visited have no Form.Items.
**How to avoid:** The form already uses `preserve={true}`, which preserves field values after unmount. However, fields must be mounted at least once. For create mode with no initial data, fields on unvisited tabs will be `undefined`. The completeness config must treat `undefined` fields on unvisited required tabs as "incomplete" (which is correct behavior). For edit mode and clone mode, `form.setFieldsValue` is called on mount with all values, and `preserve={true}` retains them even for unmounted fields -- but ONLY if the field was previously mounted. **Solution:** For fields that have never been mounted, fall back to the initial data (cloneData or fetched datasource) to determine if they have values. The completeness tracker should accept `initialValues` as a parameter.
**Warning signs:** Completeness shows 0% for tabs the user hasn't visited, even in edit mode with data.

### Pitfall 2: Non-Form State Not Tracked by onValuesChange
**What goes wrong:** `jsonSchema` and `outputConfig` are stored as React state, not as Ant Design Form fields. `onValuesChange` does not fire when they change.
**Why it happens:** Schema is edited in Monaco Editor (SchemaBuilderNew component). Output destinations are managed by OutputTab with its own state.
**How to avoid:** The `useCompletenessTracker` hook must also take `jsonSchema` and `outputConfig` as dependencies and recalculate in a `useEffect` when they change. Already shown in Pattern 1.
**Warning signs:** Schema tab always shows "incomplete" even after user defines properties.

### Pitfall 3: Connection Tab Fields Are Dynamic
**What goes wrong:** The required fields on the Connection tab depend on `connectionType`. FTP needs host/port/path, HTTP needs url, Kafka needs brokers/topic, NAS needs nasDeviceId.
**Why it happens:** Different protocols have different field sets.
**How to avoid:** Use conditional field requirements in the config (`when` function). The completeness calculation must evaluate which fields are actually required based on current `connectionType` value.
**Warning signs:** Connection tab shows 100% complete when only connectionType is selected but no server/path.

### Pitfall 4: FileSettings Tab Dynamic Fields
**What goes wrong:** CSV-specific fields (delimiter, hasHeaders) only render when fileType=CSV. Excel-specific fields (excelSheet) only render when fileType=Excel.
**Why it happens:** Conditional rendering in FileSettingsTab.
**How to avoid:** Only count fileType and encoding as required for completeness. CSV/Excel-specific fields have defaults (delimiter=',', hasHeaders=true) so they are pre-filled. Treat them as optional for completeness purposes.
**Warning signs:** File Settings shows incomplete after switching from CSV to JSON (stale CSV fields counted).

### Pitfall 5: Metrics Tab Only in Edit Mode
**What goes wrong:** MetricsTab only exists in DataSourceEditEnhanced, not in DataSourceFormEnhanced (create). The create form has 8 tabs, edit has 9.
**Why it happens:** Metrics require an existing datasource ID.
**How to avoid:** The completeness config must handle the absence of the Metrics tab in create mode. Either skip it entirely or show it grayed out with "Available after saving" text.
**Warning signs:** Sidebar shows 9 tabs in create mode but metrics is always empty/broken.

### Pitfall 6: Enable/Disable Status Change Requires Full Datasource Payload
**What goes wrong:** The existing `handleStatusChange` in DataSourceList fetches the full datasource and sends a PUT with all fields. Adding completeness check means we need to parse ConfigurationSettings and check required fields.
**Why it happens:** The backend PUT API requires the full payload.
**How to avoid:** Create a `checkCompletenessFromDataSource(dataSource)` utility that can evaluate completeness from a fetched API response (parsing ConfigurationSettings JSON). Reuse the same field config used by the sidebar.
**Warning signs:** Enable button works but doesn't actually check completeness; or completeness check logic is duplicated between form and list page.

## Code Examples

### Progress Ring Component
```typescript
// Source: Ant Design docs - Progress component
import { Progress, Typography } from 'antd';

<Progress
  type="circle"
  percent={completeness.requiredPercent}
  size={120}
  strokeColor={{
    '0%': '#ff4d4f',   // red at 0%
    '100%': '#52c41a',  // green at 100%
  }}
  format={(percent) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 'bold' }}>{percent}%</div>
      <div style={{ fontSize: 12, color: '#999' }}>required</div>
    </div>
  )}
/>
```

### onValuesChange Wiring
```typescript
// Source: Ant Design Form API
<Form
  form={form}
  layout="vertical"
  onFinish={handleSubmit}
  onValuesChange={recalculate}  // <-- add this
  preserve={true}
  initialValues={DEFAULT_FORM_VALUES}
>
```

### CSS Logical Properties for RTL-Safe Borders
```css
/* Source: MDN CSS Logical Properties */
.completeness-border {
  border-inline-start: 4px solid transparent;
  padding-inline-start: 12px;
  transition: border-color 0.2s;
}
.completeness-border--required-empty {
  border-inline-start-color: #ff4d4f;
}
.completeness-border--filled {
  border-inline-start-color: #52c41a;
}
.completeness-border--optional {
  border-inline-start-color: #d9d9d9;
}
```

### Completeness Check from API Response (for list page enable/disable)
```typescript
// Reusable utility for both form sidebar and list page
export function checkDataSourceCompleteness(ds: DataSource): {
  isComplete: boolean;
  missingFields: string[];
} {
  const config = ds.ConfigurationSettings ? JSON.parse(ds.ConfigurationSettings) : {};
  const missing: string[] = [];

  // Basic Info
  if (!ds.Name) missing.push('name');
  if (!ds.SupplierName) missing.push('supplierName');
  if (!ds.Category) missing.push('category');

  // Connection (check based on type)
  const conn = config.connectionConfig || {};
  if (!conn.type) missing.push('connectionType');
  // ... (type-specific checks)

  // File Settings
  const file = config.fileConfig || {};
  if (!file.type) missing.push('fileType');

  // Schema
  const schema = ds.JsonSchema;
  if (!schema?.properties || Object.keys(schema.properties).length === 0) {
    missing.push('jsonSchema');
  }

  return { isComplete: missing.length === 0, missingFields: missing };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Form.useWatch per field | onValuesChange callback | Ant Design 5.x optimization guidance | Avoid re-render storm with many watched fields |
| margin-left / padding-left | border-inline-start / padding-inline-start | CSS Logical Properties (widely supported) | Automatic RTL support without direction checks |

**Deprecated/outdated:**
- `Form.useWatch` for many fields simultaneously: Still works but causes performance issues. Official Ant Design blog recommends Field renderProps or onValuesChange for bulk field monitoring.

## Open Questions

1. **Metrics Tab in Create Mode**
   - What we know: MetricsTab only renders in edit mode (needs dataSourceId). Create form has 8 tabs.
   - What's unclear: Should sidebar show Metrics tab in create mode?
   - Recommendation: Show it grayed out with tooltip "Available after saving" -- consistent with D-02 (show all 9 tabs). It is a recommended tab so it won't affect the required percentage.

2. **Schema Validation Depth for Completeness**
   - What we know: D-11 says "at least 1 property with a type defined AND passes JSON Schema 2020-12 validation"
   - What's unclear: Should we run full AJV validation (expensive) or just check structure?
   - Recommendation: Check structure only (has properties, each has type). Full AJV compilation is already done in SchemaBuilderNew; the completeness check just needs a quick structural check. Reserve full validation for save time.

3. **Enable/Disable Placement on List Page**
   - What we know: D-19 says move to actions area. D-21 says check completeness on enable.
   - What's unclear: Inline icon button vs. in the overflow dropdown (MoreOutlined)?
   - Recommendation: Add as an inline toggle icon (like a power button) next to the View/Edit/Clone buttons. It's a frequent action and should be visible, not hidden in a dropdown. Use `PoweroffOutlined` or custom icon with green/red coloring.

## Sources

### Primary (HIGH confidence)
- Ant Design Form API docs (https://ant.design/components/form/) - onValuesChange, useWatch, preserve prop
- Ant Design Progress docs (https://ant.design/components/progress/) - circle type, strokeColor gradient
- Codebase analysis of DataSourceFormEnhanced.tsx, DataSourceEditEnhanced.tsx, all 9 tab components
- Codebase analysis of DataSourceList.tsx (current enable/disable implementation)

### Secondary (MEDIUM confidence)
- Ant Design blog on Form.useWatch performance (https://nanxiaobei.medium.com/watch-a-more-elegant-way-to-monitor-antd-form-field-changes-7c9b12457d67) - performance comparison of useWatch vs onValuesChange

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components already installed, no new dependencies
- Architecture: HIGH - patterns verified against existing codebase structure and Ant Design API
- Pitfalls: HIGH - lazy-loaded tab issue is well-documented in project MEMORY.md; connection type dynamics visible in codebase

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable - no external dependency changes expected)
