# Phase 35: MinIO MVP Flow — End-to-End Through the UI — Context

**Gathered:** 2026-06-08
**Status:** Ready for planning
**Source:** Live UI/codebase mapping performed during the Phase-34 session (forms driven via Playwright + backend verified live)
**Mode:** mvp (vertical slice)

<domain>
## Phase Boundary

Prove the platform works by completing the **MVP flow entirely through the UI**:
1. Create a **MinIO input server** (System Settings → Input Servers).
2. Create a **MinIO output server** (System Settings → Output Servers).
3. Create a **data source** wired to that MinIO input + MinIO output.
4. **Run** the data source and confirm a CSV from the MinIO input bucket flows through the full
   pipeline (FileDiscovery → FileProcessor CSV→JSON → Validation → Output) and a converted **JSON
   object is written to the MinIO output bucket**.

**In scope:** the three UI forms, the create/update DTO→Mongo mapping for S3 input+output, the
S3 connector + S3 output handler behavior needed for the round-trip, the trigger/run path, and the
test coverage (unit + integration + E2E + webapp-testing) that proves it. **Out of scope:** non-MinIO
protocols beyond what's needed for defaults, observability/trace tests, rate-limit test tuning,
and a full rewrite of the Kafka-topic-based pipeline integration tests (see Deferred).

**Authoritative proof = a fresh converted JSON object in the MinIO output bucket** — NOT an
intermediate Kafka topic (the live pipeline runs over the RabbitMQ base bus; see decisions).
</domain>

<decisions>
## Implementation Decisions (locked)

### Verification approach
- The pipeline runs over the **RabbitMQ** base bus (MassTransit), not the plain Kafka topics the
  current integration tests subscribe to (`record-validated` etc. → "Unknown topic or partition").
  Integration/E2E assertions for the flow MUST verify the **output object in the MinIO output
  bucket** (list + fetch + content), not Kafka topics.
- Proven once already (D2, 2026-06-08): `s3://ez-phase34-output/processed/e2e-proof-20260608-175659.csv`
  → `[{"id":901,"name":"proof-alpha","amount":1001,"date":"2026-06-08"}, …]`.

### MinIO / S3 specifics
- file-simulator MinIO: endpoint `http://172.24.80.23:30900` (**S3 API port**), path-style, plaintext
  HTTP, creds `appuser` / `Appsecret123` (readwrite). **Console is `:30901` — never use it for S3.**
- **Region must be omitted** on S3 input AND output config — setting a real region makes the AWS SDK
  override the custom endpoint and hit real AWS (403 / "Access Key Id does not exist"). The permanent
  fix (G6) is already applied in `S3Connector.cs` + `S3OutputHandler.cs` (set ServiceURL +
  ForcePathStyle + AuthenticationRegion; do NOT set RegionEndpoint when Endpoint is present).
- MinIO object data is ephemeral (emptyDir) — re-seed input CSVs if the `s3` pod restarted.
- Operate file-simulator MinIO **only via the S3 API** (consuming); never run kubectl/minikube/helm
  against the `file-simulator` profile (Session B owns it — see CLUSTER-COORDINATION.md).

### Known gaps mapped this session (bugs-must-fix seed register)
| ID | Status | Description |
|----|--------|-------------|
| G1 | FIXED, deployed | New-data-source form defaulted protocol to `NFS` (not a dropdown option, no `protocolToServerType` map entry) → input-server list always empty → "can't allocate input". Default changed to `FTP` in `constants.ts`; regression test added. |
| G2 | FIXED, deploy-pending verify | Edit form wrote the saved bucket into a phantom `connectionPath` while the rendered field + completeness check are `filePath` → "file path missing" with the (empty) Bucket/Prefix box, and the typed bucket wasn't saved on create either. Unified ALL plumbing (hydrate/save/validate/connection-string/clone) to `filePath`. |
| G3 | FIXED, deployed | Connection config lost when editing a datasource's schema — lazy Connection tab not hydrated → empty `inputServerId` overwrote stored value. Merge hardened (`mergeConnectionConfig`, `||` + `dataSource.FileServerId` fallback) + Vitest. |
| **G4** | **OPEN** | MinIO **input-server** form accepts the **Console port (30901)**; Test Connection then fails "S3 API Requests must be made to API port". Needs the form to default/validate/guide to the **API port (30900)**. Reproduced live: server `minio` had Port=30901. |
| **G5** | **OPEN — primary blocker** | The data-source **create flow does not persist the S3 *output* destination `S3Config`** (bucket came out `null` in Mongo → output write fails / had to be hand-populated). The output destination editor → request → entity mapping drops the S3 bucket/endpoint/creds. This is THE gap that blocks "output is MinIO via the UI". |
| G6 | FIXED, deployed | S3 region-override bug in `S3Connector.cs` (input, 403) + `S3OutputHandler.cs` (output). Permanent fix applied + `filediscovery`/`output` redeployed (`s3regionfix-20260608`). |

### Methodology (per user)
Map forms → file every gap/loose end as **bugs-must-fix** → close gaps with unit tests + updated
integration tests + live E2E → review-and-fix loop until the flow works. Iterate.
</decisions>

<form_maps>
## UI Form Maps (observed live, 2026-06-08)

### A. MinIO Input/Output Server form — `ServerModal` (`src/Frontend/src/components/admin/...`/`pages/admin/components/ServerModal.tsx`)
- S3 branch fields (Phase 34): Access Key, Secret Key (masked `********`, write-only), **Bucket**,
  **Region**, **path-style** toggle, packed into PascalCase `TypeSpecificConfig`.
- **Host / Port:** the endpoint is built from Host:Port. **Loose end (G4):** nothing stops/clarifies
  the Console port 30901 vs API port 30900 → cryptic MinIO error on Test Connection.
- Direction: input servers `Direction=0`, output `Direction=1`, both `Direction=2`. S3 servers seen
  as `Direction=2`. **Check:** does the form let you create a dedicated output (Direction=1) S3 server,
  and does `getOutputServers` return it?

### B. New Data Source form — create (`DataSourceFormEnhanced.tsx`) + edit (`DataSourceEditEnhanced.tsx`)
Tabs: Basic Info · Input Settings · File Settings · Schema · Schedule · Validation Rules · Alerts · Output.
- **Input Settings tab** (`ConnectionTab.tsx`): Protocol Type select (FTP/SFTP/HTTP/Kafka/S3/NAS — **no
  NFS**, no Local in dropdown), Input Server select (filtered by `protocolToServerType[type]`), and for
  file-based protocols a **Bucket / Prefix** input named `filePath` (required) + File Pattern + Test
  Connection. S3 selection showed "4 servers available" + Test Connection → CONNECTION SUCCESSFUL.
- **Output tab** (`OutputTab.tsx` + `DestinationEditorModal.tsx`): add an output destination; for S3 it
  filters `getOutputServers` by type and should pack an S3Config. **Loose end (G5):** the S3 output
  config isn't persisted.
- **Completeness tracker** (`completeness/completenessConfig.ts` + `completenessUtils.ts`): requires
  `filePath` for FTP/SFTP/S3/Local, `inputServerId` for non-NAS, etc. Field-name consistency matters
  (G2). `completeness.schemaErrors.noSchema` i18n key did not resolve (showed raw key) — minor.

### Backend mapping (`DataSourceManagementService`)
- Create/update extract `FileServerId` + path + NAS fields from `ConfigurationSettings` JSON
  (`DataSourceService.cs` ~826 overwrite, ~1004 FileServerId guard). **G5 lives in the OUTPUT
  destination → `Output.Destinations[].S3Config` mapping** (request DTO → entity → Mongo).
</form_maps>

<canonical_refs>
## Canonical References — downstream agents MUST read these before planning/implementing

### Frontend forms
- `src/Frontend/src/pages/admin/components/ServerModal.tsx` — MinIO input/output server form (G4 lives here).
- `src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx` — input protocol + server + `filePath`.
- `src/Frontend/src/components/datasource/tabs/OutputTab.tsx` + `modals/DestinationEditorModal.tsx` — output destination (G5 lives here).
- `src/Frontend/src/pages/datasources/DataSourceFormEnhanced.tsx` (create) + `DataSourceEditEnhanced.tsx` (edit) — orchestration, hydration, save merge.
- `src/Frontend/src/components/datasource/shared/helpers.ts` — `mergeConnectionConfig`, `buildConnectionString` (now `filePath`).
- `src/Frontend/src/components/datasource/shared/constants.ts` — `DEFAULT_FORM_VALUES` (default protocol).
- `src/Frontend/src/components/datasource/completeness/completenessConfig.ts` + `completenessUtils.ts` — required-field rules.
- `src/Frontend/src/services/servers-api-client.ts` — `getInputServers`/`getOutputServers` endpoints.

### Backend
- `src/Services/DataSourceManagementService/Services/DataSourceService.cs` — create/update mapping (G5 output S3Config).
- `src/Services/DataSourceManagementService/Models/Requests/*DataSourceRequest.cs` — output destination DTO.
- `src/Services/Shared/Connectors/S3Connector.cs` + `src/Services/OutputService/Handlers/S3OutputHandler.cs` — S3 client (region fix G6 — keep it).

### Tests
- `tests/IntegrationTests/Connectors/S3ConnectorTests.cs`, `tests/IntegrationTests/Pipeline/*`, `TestConfiguration.cs` (RabbitMQ note).
- `src/Frontend/tests/e2e/protocols/s3.spec.ts`, `s3-server.spec.ts`, `p0-datasource-creation.spec.ts`.
- `src/Frontend/tests/webapp-testing/s3_server_comprehensive_test.py`.

### Coordination / history
- `.planning/phases/34-s3-minio-connector-iam-credentials-bug-fix/deferred-items.md` — TASK A/B, T1-T4, S3-output region bug, 34-06 chart defects.
- `C:\Users\Brian\.claude\shared\CLUSTER-COORDINATION.md` — file-simulator MinIO creds/ports, lane rules.
</canonical_refs>

<specifics>
## Specific Ideas / known-good fixtures
- Working datasource from D2: `minio-e2e` (id `6a25590617166353695842bc`) — S3 input `ez-phase34-input` → S3 output `ez-phase34-output/processed`. Its output `S3Config` had to be hand-populated in Mongo (proof of G5).
- Buckets: input `ez-phase34-input` (sample CSVs `id,name,amount,date`), output `ez-phase34-output`.
- Redeploy pattern: surgical `docker build -f docker/<Service>.Dockerfile -t ez-platform/<svc>:<tag> .` (frontend uses **`src/Frontend/Dockerfile`**, NOT `docker/Frontend.Dockerfile` which is broken) → `minikube image load -p minikube` → `kubectl --context=minikube -n ez-platform set image`. Preserve env overrides (`Hazelcast__Server`, `FileDiscovery__DeduplicationTTLHours`).
- Port-forwards: DSM 5001, validation 5003, output 5009, frontend 7000, Mongo 27017, Kafka 9094, Hazelcast 5701 (`scripts/start-port-forwards.ps1`, Hazelcast svc name fixed to `hazelcast-service`).
- Hazelcast dedup (`file-hashes-<dsId>`, TTL ~1h) blocks re-runs of the same file — clear it or use a fresh filename when re-proving.
</specifics>

<deferred>
## Deferred Ideas (out of this MVP phase)
- Full rewrite of the Kafka-topic pipeline integration tests to drive RabbitMQ (the MVP verifies via the MinIO output object instead).
- Observability `CorrelationIdTests` (trace/log contract) and `GlobalAlerts` 429 rate-limit test — pre-existing, non-MVP.
- Durable seed sidecars for FTP/SFTP MinIO sample data (S3 already covered).
- Non-MinIO protocol UX polish beyond the `NFS`-default fix.
</deferred>

---
*Phase: 35-minio-mvp-flow-end-to-end-ui*
*Context gathered: 2026-06-08 via live UI/codebase mapping (Phase-34 session)*
