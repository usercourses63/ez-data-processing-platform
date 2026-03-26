---
phase: 26-completeness-checklist
plan: 03
status: completed
completed_at: "2026-03-25"
---

## Summary

Implemented enable/disable action as inline PoweroffOutlined icon button in the datasource list actions column. Status column shows read-only Tag (active/inactive) with completeness mini-ring. Attempting to enable an incomplete datasource shows a blocking message with missing fields list. All Hebrew translations added.

## Artifacts
- `src/Frontend/src/pages/datasources/DataSourceList.tsx` — PoweroffOutlined action, completeness tooltip
- `src/Frontend/src/i18n/locales/he.json` — enable/disable action labels
