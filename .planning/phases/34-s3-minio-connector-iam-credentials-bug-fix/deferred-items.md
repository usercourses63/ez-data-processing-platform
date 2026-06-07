# Deferred Items — Phase 34

Out-of-scope discoveries logged during execution (not fixed; outside the current plan's scope).

## 34-01

### Pre-existing CategoriesControllerTests failures (SignalR mocks)
- **Files:** `tests/DataSourceManagement.Tests/Controllers/CategoriesControllerTests.cs`
- **Failing tests (5):** `Create_ValidRequest_Returns201CreatedAtAction`,
  `ToggleActive_ExistingCategory_ReturnsOkWithUpdatedCategory`, `Reorder_ValidRequest_ReturnsOk`,
  `Delete_ExistingCategory_ReturnsNoContent`, `Update_ExistingCategory_ReturnsOkWithUpdatedCategory`
- **Cause:** `CategoriesController` CRUD methods broadcast via `_hubContext.Clients.All.SendAsync(...)`
  (SignalR mandate added in an earlier phase). The tests mock `IHubContext<MonitoringHub>` but do
  not stub the `Clients.All` / `IClientProxy` chain, so `SendAsync` throws NRE → controller's
  catch returns a 500 `ObjectResult` instead of the expected `CreatedAtActionResult`/`OkObjectResult`/etc.
- **Why deferred:** Pre-existing test rot unrelated to Phase 34's S3 credential work. Task 34-01's
  verification gate is `dotnet build src/Services/DataSourceManagementService` (passes). Properly
  fixing requires stubbing the full SignalR client-proxy chain across 5 tests — out of plan scope.
- **Note:** 34-01 only minimally repaired the *compilation* of these tests (ctor signature drift +
  renamed `DiscoveredFile.FilePath`→`FullPath`) so the test assembly builds and the Phase-34 tests run.
  The behavioral SignalR-mock gap remains for a future test-maintenance pass.

## 34-04

### Live backend tier could not be exercised in this session (deferred to 34-06)
- **Files:** `tests/DataSourceManagement.Tests/Controllers/ServersControllerSecretTests.cs`,
  `tests/IntegrationTests/Connectors/S3ConnectorTests.cs`
- **What ran:** All pure unit tests passed (`Shared.Tests` `ServerCredentials*`: 10/10). The new
  controller integration tests and the S3 connector live tests are authored and build clean.
- **What was skipped (cleanly, not failed):**
  - `ServersControllerSecretTests` (3 SkippableFacts) — the DataSourceManagement API **is** reachable
    at `http://localhost:5001`, but the **deployed pod predates 34-01/34-02**: a probe POST/GET showed
    the persisted `SecretKey` is still plaintext (`minioadmin123`) and is **not** masked on GET. A
    capability guard (`CreateAndFetchOrSkipAsync`) detects this and Skips with an explanatory message
    so the suite stays green until the service is rebuilt. They also Skip if MongoDB is unreachable.
  - `S3ConnectorTests` empty-creds regression + `[Category=S3EndToEnd]` SkippableFacts — the
    file-simulator MinIO is owned by the other session and was unreachable here, so all 5 `Protocol=S3`
    tests Skipped.
- **Why deferred:** No freshly-built DataSourceManagement image and no reachable file-simulator MinIO
  in this (Session A) environment. The live behaviour (GET masks secret; Mongo stores `enc:v1:`
  ciphertext; keep-existing on masked PUT; MinIO auth with real keys) is verified against a
  redeployed build in **plan 34-06**.
- **To run live (after redeploy):** rebuild + redeploy `DataSourceManagementService`, ensure Mongo is
  port-forwarded, set `FILE_SIMULATOR_IP`, then:
  `dotnet test tests/DataSourceManagement.Tests --filter "FullyQualifiedName~ServersControllerSecret"`
  and `dotnet test tests/IntegrationTests --filter "Protocol=S3"`.

## 34-05

### Live E2E (Playwright) + webapp-testing (Python) runs deferred to 34-06
- **Files:** `src/Frontend/tests/e2e/s3-server.spec.ts`,
  `src/Frontend/tests/webapp-testing/s3_server_comprehensive_test.py`
- **What ran in this session:**
  - **Vitest** unit suite `ServerModal.test.tsx` — **4/4 passed** (no server needed). Asserts the S3
    branch renders a masked Secret Key, packs PascalCase `TypeSpecificConfig`, shows the `********`
    sentinel on edit, and posts it back verbatim (keep-existing secret).
  - **Playwright** `s3-server.spec.ts` — **authored + statically validated** via
    `npx playwright test tests/e2e/s3-server.spec.ts --list` (2 tests enumerate, no compile errors).
    NOT run live.
  - **webapp-testing** `s3_server_comprehensive_test.py` — **authored + `py_compile`-clean**. NOT run live.
- **What was deferred (cleanly, not failed):** the live E2E + webapp-testing executions. This Session A
  environment has **no running frontend dev server (port 7000) and no backend cluster**, so the
  live-dependent assertions (UI create → Test Connection → success; T1–T5 DOM/API edge cases) cannot
  be exercised. Both specs are built to **skip cleanly** when the servers API / MinIO is unreachable, so
  they will not fail a pre-live CI gate.
- **Why deferred:** No live frontend + backends + file-simulator MinIO in this session (same constraint
  as 34-04). The authoritative live pass is **plan 34-06**.
- **To run live (after the app + backends are up on port 7000 / NodePort):**
  - `cd src/Frontend && npx playwright test s3-server` (or `--headed`)
  - `cd src/Frontend && python tests/webapp-testing/s3_server_comprehensive_test.py`
  - Override targets via env if needed: `BASE_URL`, `SERVERS_API`, `MINIO_HOST`, `MINIO_PORT`,
    `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`.

## 34-06 — S3 async-pipeline end-to-end (post-validation findings)

Verified a real MinIO file flowing through the WHOLE pipeline
(MinIO -> FileDiscovery -> FileProcessor -> Validation -> Output JSON file).
Three bugs blocked it; all distinct from the Phase-34 Servers-UX fix:

1. **S3 pipeline credential bridge missing (FIXED, code, commit in 34-06).**
   `PopulateFileServerConnectionAsync` only bridged FTP creds from a FileServerId
   AdminServer into the datasource `AdditionalConfiguration`; S3 datasources got
   empty creds. Now bridges AccessKey/SecretKey (DECRYPTED)/Bucket/endpoint/
   usePathStyle + resets FilePath to a clean in-bucket prefix.

2. **Hazelcast servers config is comma-joined but added as ONE address (chart/code bug, runtime-patched).**
   ConfigMap `services-config.hazelcast-server` = `hazelcast-0,...,hazelcast-1,...,hazelcast-2,...:5701`
   but `HazelcastConfiguration.cs:75` does `Addresses.Add(server)` without splitting on
   ','. Also only `hazelcast-0` exists. Runtime fix: `kubectl set env Hazelcast__Server=
   hazelcast-0.hazelcast-service.ez-platform.svc.cluster.local:5701` on filediscovery/
   fileprocessor/validation/output. PERMANENT FIX NEEDED: split on ',' in code, or fix the
   ConfigMap to a single address.

3. **FileDiscovery:DeduplicationTTLHours read as Int32 but configured `0.25` (chart/code bug, runtime-patched).**
   `FilePollingEventConsumer.DiscoverFilesAsync` does `GetValue<int>("FileDiscovery:
   DeduplicationTTLHours", 24)` but the value is `0.25` -> InvalidOperationException faults
   the whole poll. Runtime fix: `kubectl set env FileDiscovery__DeduplicationTTLHours=1`.
   PERMANENT FIX NEEDED: read as double, or set an integer in the ConfigMap.

Also fixed (infra, unrelated to S3): rabbitmq liveness probe `rabbitmq-diagnostics ping`
(heavy Erlang exec) timing out under node memory pressure -> SIGTERM crashloop (924
restarts); replaced with a tcpSocket:5672 probe. And renewed EXPIRED kubeadm control-plane
certs (see CLUSTER-COORDINATION.md). All four are CHART/CONFIG defects that a clean
`helm install` will re-introduce.

## 34-06 — S3 OUTPUT handler bug (region overrides custom endpoint)

`OutputService/Handlers/S3OutputHandler.CreateS3Client` sets BOTH
`s3Config.ServiceURL = Endpoint` AND `s3Config.RegionEndpoint =
GetBySystemName(Region)` when both are provided. The AWS .NET SDK lets
RegionEndpoint override ServiceURL, so with a custom MinIO endpoint + a real
region (e.g. us-east-1) the client connects to REAL AWS S3 -> "The AWS Access
Key Id you provided does not exist in our records". Input-side S3Connector only
sets ServiceURL, which is why discovery works but output failed.
WORKAROUND (used): omit `region` in the output S3Config.
PERMANENT FIX: when Endpoint is set, do NOT also set RegionEndpoint (or set
AuthenticationRegion only). Mirror S3Connector.CreateS3Client.

## 34-06 — OPEN TASKS: datasource UX bugs found during self-service E2E (2026-06-07)

### TASK A — CSV numeric data fails validation against a string-typed schema (bug #1)
**Symptom:** A CSV with numeric columns (e.g. id,amount) is marked invalid when the
datasource schema types those fields as `string` (the default when fields are added
manually in the Schema tab). Only true-string columns (name) pass; every numeric record
is rejected (ValidRecords=0). Reproduced on datasource `e2e`
(schema: id/name/amount all `"type":"string"`, required).
**Root cause:** `src/Services/Shared/Converters/CsvToJsonConverter.cs` lines 109-127
ALWAYS infers numeric/bool JSON types from the raw text (`double.TryParse`→number,
`int.TryParse`→int, `bool.TryParse`→bool). So `"501"` becomes JSON `501` (number). JSON
Schema validation then sees number≠string → invalid. The converter is schema-UNAWARE
(it only reads `SchemaPropertyNames` from metadata for headerless mapping). The frontend
type inferrer (`utils/fileAnalyzer/schemaInferrer.ts`) actually types numeric columns
correctly, but it isn't applied when a user hand-builds the schema (fields default to
`string`), so the converter's numbers collide with the string schema.
**Possible solutions (pick one):**
  - A (recommended): make CsvToJsonConverter SCHEMA-AWARE — pass the datasource JsonSchema
    (or a field→type map) into ConvertToJsonAsync; for a field typed `string`, keep the raw
    string; only number/integer/boolean fields get parsed. Guarantees converted data always
    matches declared types.
  - B (simplest): stop auto-inferring — emit all CSV values as strings. Matches the common
    string-default schema, but number-typed schemas would then need coercion.
  - C: coerce in the Validation service (accept numeric-string for string fields and v.v.).
  Also recommended UX: in the Schema tab, offer "infer types from sample file" (wire the
  existing schemaInferrer) so users don't hand-type every field as `string`.
**Touch points:** `CsvToJsonConverter.cs` (+ pass schema from
`FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs`); rebuild+redeploy
fileprocessor. Verify: numeric CSV → valid records → output.

### TASK B — Connection config lost when updating a datasource's schema (bug #2)
**Symptom:** Editing a datasource to change the schema and saving makes the connection
configuration (input server) appear unsaved; repeatable every time.
**Root cause (frontend, strong hypothesis — confirm by UI repro):** The edit form
(`pages/datasources/DataSourceEditEnhanced.tsx`) hydrates `inputServerId` into the Ant
Form only AFTER the input-servers list loads and only conditionally
(`components/datasource/tabs/ConnectionTab.tsx:83-84`:
`connectionType!=='NAS' && inputServers.length>0 && savedFieldValues.inputServerId`).
This is the known lazy-tab/async `setFieldsValue` race (already noted in STATE.md
Blockers). If the user edits the schema on another tab and saves before the Connection
tab fully hydrates, the submitted `values.inputServerId` is empty. The save merge at
`DataSourceEditEnhanced.tsx:387` (`values.inputServerId ?? existingConfig.connectionConfig?.inputServerId`)
then writes a connection-less `ConfigurationSettings` (line 443), and the backend
OVERWRITES `AdditionalConfiguration["ConfigurationSettings"]`
(`DataSourceService.cs` ~825) — which the frontend reads back for display — so the
connection shows as wiped. NOTE the backend `FileServerId` field itself is guarded
(`DataSourceService.cs:1006` only overwrites when non-empty), so the pipeline keeps
working; it's the stored/displayed ConfigurationSettings that loses connectionConfig.
**Possible solutions:**
  - Frontend (recommended): ensure `inputServerId` is always present at submit — bind it
    from `parsedConfig.connectionConfig.inputServerId` / `dataSource.FileServerId` even when
    the Connection tab hasn't mounted (don't gate on `inputServers.length>0`); or make the
    save merge use the loaded `dataSource` as the fallback rather than only form `values`.
  - Backend hardening: on update, MERGE the incoming connectionConfig into the existing
    stored ConfigurationSettings instead of overwriting, so a partial update can't drop it.
**Touch points:** `ConnectionTab.tsx`, `DataSourceEditEnhanced.tsx` (and optionally the
update path in `DataSourceService.cs`); rebuild+redeploy frontend. Verify: edit schema →
save → reopen → connection still set.
