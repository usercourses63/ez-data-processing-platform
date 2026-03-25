---
status: gaps_found
phase: 26-completeness-checklist
verified: 2026-03-25
score: 18/26
---

# Phase 26: Completeness Checklist - Verification

## Passed (18/26 decisions)

D-01 through D-10, D-12, D-14 through D-17, D-19 through D-26: All implemented and verified via Playwright E2E (10/10 pass) and webapp-testing (30/31 pass).

## Gaps Found (8 items)

### GAP-01: D-11 Schema validation is structural only
**Severity:** Medium
**Decision:** Schema must pass JSON Schema 2020-12 validation
**Actual:** Only checks properties have `type` defined. Does NOT run full JSON Schema validation (malformed required arrays, invalid $schema, etc.)
**Fix:** Add AJV or schemaValidator.ts validation call in the schema `nonFormCheck`

### GAP-02: D-13 Per-field borders inconsistent across tabs
**Severity:** High
**Decision:** Each Form.Item in required tabs gets colored left border
**Actual:** Borders work on BasicInfo tab (Input controls) but NOT on other tabs. Does not handle Select, Switch, DatePicker, or other non-Input controls. The `data-completeness-status` DOM injection only targets parent `.ant-form-item` elements but CSS selectors don't match all control types.
**Fix:** Ensure border CSS applies to all Form.Item wrappers regardless of inner control type. Verify on every tab (Connection, File, Schedule, etc.)

### GAP-03: D-18 Missing fields not visible on sidebar card
**Severity:** High
**Decision:** Show what's missing when blocking enable
**Actual:** Missing fields only shown in modal.warning when clicking PoweroffOutlined. The sidebar card itself only shows "Missing required fields" text at bottom — no field-level detail.
**Fix:** Add a collapsible "Missing fields" section to the CompletenessPanel showing the actual field names that need filling. Users should see at a glance what to fix while filling the form.

### GAP-04: D-27 (NEW) No save feedback for incomplete forms
**Severity:** High
**Decision:** Create/Update buttons must show clear feedback when completeness fails
**Actual:** Auto-disable on save works silently (D-16) but user sees no message explaining WHY the datasource was disabled or what fields are missing. The `message.info('autoDisabled')` toast is easy to miss. No inline validation summary near the Save/Update button.
**Fix:** Before submitting, if not fully complete: show a visible Alert or inline error near the Save button listing missing fields. The save should still proceed (D-16 auto-disables) but user MUST understand what happened and why.

### GAP-05: D-28 (NEW) No per-row completeness indicator on list page
**Severity:** Medium
**Decision:** Status column should show completeness indicator per datasource row
**Actual:** Status column only shows "Active"/"Inactive" tag. No visual indication of HOW complete each datasource is.
**Fix:** Add a mini Progress ring or percentage text in the status column cell alongside the active/inactive tag. Use `checkDataSourceCompleteness()` to compute per-row.

### GAP-06: D-29 (NEW) DemoDataGenerator creates inconsistent demo data
**Severity:** Medium
**Decision:** Demo datasources must have consistent completeness status
**Actual:** DemoDataGenerator was built before the completeness feature. Generated datasources may have missing required fields (no schema, no output destinations) but are set to IsActive=true.
**Fix:** Either update DemoDataGenerator to create datasources with all required fields filled, OR after generation, run completeness check and set IsActive based on actual completeness.

### GAP-07: Testing coverage gaps
**Severity:** Medium
**Items not tested:**
- Full JSON Schema validation in completeness check
- Per-field borders on ALL tabs (Connection, File, Schedule, etc.)
- Select/Switch/DatePicker border handling
- Save feedback (Create + Update)
- Missing fields display on sidebar card
- List page mini completion indicator
- DemoDataGenerator data consistency
**Fix:** Add comprehensive Playwright + webapp-testing tests covering all gap fixes

### GAP-08: Production deployment not verified
**Severity:** High
**Detail:** All testing done against Vite dev server (localhost:7000). Not yet deployed to Kubernetes production environment. Must verify: build, deploy, all tests pass at 100% against production.
**Fix:** Build frontend, deploy to K8s, run full test suite against production URL

## Requirement Coverage

| Requirement | Status | Gaps |
|-------------|--------|------|
| CHECK-01 | Partial | GAP-02 (borders), GAP-04 (save feedback) |
| CHECK-02 | Partial | GAP-02 (borders), GAP-04 (save feedback) |
| CHECK-03 | Pass | Click-to-navigate working |
| CHECK-04 | Partial | GAP-02 (borders inconsistent), GAP-03 (missing fields display) |
