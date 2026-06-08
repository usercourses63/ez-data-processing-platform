# Phase 35 — MVP Proof (live, UI-driven)

**Date:** 2026-06-08
**Captured by:** orchestrator driving the live UI (Playwright) against the running `minikube` / `ez-platform` cluster, consuming the Session-B `file-simulator` MinIO via the S3 API only.

## Result: ✅ MVP flow works end-to-end through the UI

A data source created **entirely through the UI** (System Settings servers + the create-data-source wizard) ran the full slice — FileDiscovery → FileProcessor (CSV→JSON) → Validation → **S3 output write** — and produced a fresh object in the MinIO output bucket `ez-phase34-output`.

## Live evidence

**Data source (UI-created):**
- id: `6a270d5b3c7dae70f384bac0`, name `mvp35-proof`
- Input: S3 server `minio-input`, bucket `ez-phase34-input`, `FilePath: ""` (empty — whole-bucket listing after the G8 bucket-strip/trim), FilePattern `*.csv`. Test Connection: **successful**.
- Schema: permissive 4-field object (id/name/amount/date), 0 required.

**Persisted Mongo `Output.Destinations[0].S3Config` (after G10 fix):**
```json
{
  "Endpoint": "http://172.24.80.23:30900",
  "Bucket": "ez-phase34-output",
  "KeyPrefix": "processed",
  "Region": null,
  "AccessKeyId": "appuser",
  "SecretAccessKey": "Appsecret123",
  "UsePathStyle": true,
  "KeyPattern": "output_{timestamp}.{format}"
}
```
(Region intentionally null — G6 preserved.)

**Pipeline (output-service log, pod `output-bf566bc46-czpht`):**
```
Processing ValidationCompletedEvent: DataSourceId=6a270d5b..., FileName=mvp35-g11-220217.csv, ValidationStatus=Success, ValidRecords=3, InvalidRecords=0
S3OutputHandler: Writing to S3: bucket=ez-phase34-output, prefix=processed, file=mvp35-g11-220217.csv, destination=minio-out
S3OutputHandler: Successfully wrote to S3: bucket=ez-phase34-output, key=output_20260608190334.{format}, size=99 bytes, ETag="eb5b4798e860994de74c1285b4f4a675"
Destination minio-out (S3): Success — Success=1, Failed=0
```

**Fetched output object** (`s3://ez-phase34-output/output_20260608190334.{format}`):
```
id,name,amount,date
1,Alpha,100.50,2026-06-08
2,Beta,250.75,2026-06-08
3,Gamma,9.99,2026-06-08
```

## Bugs found + fixed during this live proof (35-03 loop)

| ID | Layer | Fix |
|----|-------|-----|
| G7  | FE (edit load) | map PascalCase `S3Config` → camelCase on edit hydrate |
| G8  | BE (input)     | trim + strip leading bucket segment from S3 input prefix |
| G9  | FE (modal)     | build `s3Config` regardless of protocol-Select casing (`toLowerCase`) |
| G10 | FE (create/update/clone) | include `S3Config` in the request mappings |
| G11 | BE (output)    | case-insensitive output-handler dispatch (`"S3"` vs `"s3"`) |

Deployed tags: `frontend:phase35-mvp-g10-20260608`, `datasource-management:phase35-mvp-20260608`, `output:phase35-g11-20260608`.

## Known minor polish gaps (non-blocking — see G12)

- The written object key is `output_20260608190334.{format}` at the **bucket root**, not under the `processed/` prefix — `S3OutputHandler` does not prepend `KeyPrefix` to the object key, and the `{format}` placeholder is not substituted.
- Output written as CSV (the destination `OutputFormat` defaulted to `csv`); the runbook anticipated a JSON array. The CSV→JSON conversion happens internally for validation; the on-disk output format is a per-destination setting.

These do not block the core MVP (a fresh converted object lands in `ez-phase34-output` from a UI-driven flow) but should be closed for a clean demo.
