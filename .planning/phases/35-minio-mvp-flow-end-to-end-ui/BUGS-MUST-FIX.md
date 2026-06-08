# Phase 35 — Bugs-Must-Fix Register

**Created:** 2026-06-08
**Purpose:** The single source of truth for every bug / loose end blocking the MinIO MVP flow
(UI: create MinIO input server → create MinIO output server → create data source → run → fresh
JSON object in the MinIO output bucket). The phase closes only when **zero MVP-blocking bugs**
remain `OPEN` in this register. This is the iterate review→fix backlog (per the user methodology:
map forms → file every gap → close with tests + live E2E → re-review until the flow works).

## Status legend

- `OPEN` — not fixed, blocks the MVP flow.
- `FIX-IN-CODE` — code fix landed, not yet verified live against the running cluster.
- `VERIFIED` — fixed AND proven live (UI repro or asserted MinIO output object / persisted Mongo).
- `WONTFIX-MVP` — out of MVP scope (recorded for traceability; must NOT block phase closure).

## Severity legend

- `BLOCKER` — the MVP flow cannot complete until this is closed.
- `MAJOR` — UX/correctness gap that degrades the flow but has a workaround.
- `MINOR` — cosmetic / non-blocking.

---

## Seed register (G1–G6, mapped during the Phase-34 session)

| ID | Sev | Status | Area | Description | Closing plan |
|----|-----|--------|------|-------------|--------------|
| G1 | BLOCKER | VERIFIED | FE create form | New-data-source form defaulted protocol to `NFS` (unmapped in `protocolToServerType`) → input-server list always empty → "can't allocate input". Default changed to `FTP` in `constants.ts` + `DataSourceFormEnhanced.tsx` fallbacks; regression test added. Deployed `frontend:inputfix-20260608`. Re-verify in the live create flow. | 35-03 (re-verify) |
| G2 | BLOCKER | FIX-IN-CODE | FE edit form | Edit form wrote the bucket into a phantom `connectionPath` while the rendered field + completeness check use `filePath` → "file path missing" + bucket not saved on create. Unified ALL plumbing (hydrate/save/validate/connection-string/clone) to `filePath`. Deploy-pending live verify. | 35-03 (re-verify) |
| G3 | BLOCKER | FIX-IN-CODE | FE edit merge | Connection config lost when editing a datasource's schema — lazy Connection tab not hydrated → empty `inputServerId` overwrote stored value. Hardened `mergeConnectionConfig` (`||` + `dataSource.FileServerId` fallback) + Vitest. Re-verify: edit schema → save → reopen → connection still set. | 35-03 (re-verify) |
| G4 | MAJOR | FIX-IN-CODE | FE input-server form | `ServerModal` S3 branch accepts the **Console port 30901**; Test Connection then fails "S3 API Requests must be made to API port". The form must default/validate/guide to the **API port 30900**. **Fixed (35-01):** S3-only Port validator rejects 30901 naming the API port 30900 + inline API-port hint under the S3 divider + `admin.servers.s3.consolePortError`/`apiPortHint` i18n (he/en); Vitest `ServerModal.s3port.test.tsx` 3/3. Live re-verify (Test Connection) in 35-03. | 35-01 (live re-verify 35-03) |
| G5 | BLOCKER | FIX-IN-CODE | FE+BE output mapping | **PRIMARY BLOCKER.** The data-source create flow did **not persist the S3 output destination `S3Config`** (`bucket` came out `null` in Mongo → output write fails). **Fixed (35-02):** FE — added `S3OutputConfig` type + `OutputDestination.s3Config`; `DestinationEditorModal` S3 branch now builds `s3Config` (bucket/keyPrefix split from the "Bucket / Prefix" path, `usePathStyle=true`, creds/endpoint/region left for the backend) instead of `folderConfig`-only; edit hydrates + OutputTab shows the bucket; Vitest `DestinationEditorModal.s3.test.tsx` 6/6. BE — `PopulateOutputDestinationS3Async` bridges the output `OutputServerId` AdminServer into `Output.Destinations[].S3Config` (endpoint `http(s)://host:port`, decrypted SecretKey, `usePathStyle`, bucket-fallback, **Region omitted** per G6), called from BOTH `CreateAsync` and `UpdateAsync`; xUnit `DataSourceServiceOutputS3Tests` 4/4. Live write proof (a MinIO output object) is **35-03**. | 35-02 (live write proof 35-03) |
| G6 | BLOCKER | VERIFIED | BE S3 region | S3 region-override bug (region beats custom endpoint) in `S3Connector.cs` + `S3OutputHandler.cs`. Permanent fix applied (set `ServiceURL`+`ForcePathStyle`+`AuthenticationRegion`, do NOT set `RegionEndpoint` when Endpoint present); `filediscovery`/`output` redeployed `s3regionfix-20260608`. Regression-guard in tests; do not regress. | 35-04 (regression guard) |

---

## Newly discovered bugs (append during execution)

> Executors append a row here whenever a new gap/loose end is found while mapping forms or running
> the flow. Every new BLOCKER/MAJOR must be assigned a closing plan (or split into a new plan) and
> driven to `VERIFIED` before phase closure. Reference the plan + commit that closes it.

| ID | Sev | Status | Area | Description | Closing plan |
|----|-----|--------|------|-------------|--------------|
| G7 | BLOCKER | FIX-IN-CODE | FE edit round-trip | Output S3 "Bucket / Prefix" rendered **blank on reopen** even though `Output.Destinations[].S3Config` was correctly persisted in Mongo (looked like "not saved"). Root cause: the edit-page PascalCase→camelCase loader in `DataSourceEditEnhanced.tsx` mapped `kafkaConfig`/`folderConfig`/`sftpConfig`/`httpConfig` per destination but **omitted `S3Config`**, so `destination.s3Config` was `undefined` and `s3ConfigToPath()` returned `''`. **Fixed (35-03 loop):** added `s3Config` mapping (`S3Config.Bucket/KeyPrefix/Endpoint/Region/AccessKeyId/UsePathStyle/KeyPattern` → camelCase). Discovered at the 35-03 live checkpoint. Live re-verify: edit S3 output datasource → reopen → bucket/prefix shows. | 35-03 (loop) |
| G8 | BLOCKER | FIX-IN-CODE | BE S3 input prefix | **Run produced no output object.** The S3 input "Bucket / Prefix" field (placeholder `bucket-name/prefix/`) was stored verbatim as the in-bucket key prefix while the bucket comes separately from the AdminServer — so typing the bucket name (per the MVP runbook) plus a stray leading space yielded `FilePath=" ez-phase34-input"`, a prefix matching **zero** objects → FileDiscovery found nothing → no pipeline → no output. **Fixed (35-03 loop):** `PopulateFileServerConnectionAsync` S3 block now `Trim()`s the path and strips a leading bucket segment (`bucket` or `bucket/…`) so only the true object-key prefix remains (empty ⇒ whole bucket). Discovered at the 35-03 live checkpoint. Live re-verify: run datasource → fresh JSON object lands in `ez-phase34-output`. | 35-03 (loop) |

> **Executors:** append a row above whenever mapping a form or running the flow surfaces a new
> gap/loose end. Every new BLOCKER/MAJOR must be assigned a closing plan and driven to `VERIFIED`
> (with plan + commit ref) before phase closure.

---

## Closure gate (SC-7)

Phase 35 may close ONLY when:
- Every `BLOCKER` and `MAJOR` row is `VERIFIED` or `WONTFIX-MVP`.
- The MVP proof (SC-8) ran end-to-end through the UI and produced a fresh MinIO output object.
- The closure review (plan 35-05) recorded the final status of every row here.
