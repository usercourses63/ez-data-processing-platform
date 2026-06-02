# Phase 34: S3/MinIO Connector — IAM Credentials Bug Fix - Research

**Researched:** 2026-06-02
**Domain:** .NET S3-compatible storage connector (AWSSDK.S3 + MinIO), MongoDB-persisted server config, React/Ant Design admin form
**Confidence:** HIGH (root cause confirmed by direct code trace; live MinIO behavior pending Session-B coordination)

## Summary

The S3/MinIO connector **already exists and works** — `S3Connector.cs` is fully implemented for both AWS S3 and MinIO (path-style, custom endpoint), and a passing integration test (`S3ConnectorTests.cs`) proves it authenticates against the file-simulator MinIO using an explicit Access Key / Secret Key. The bug is **not** in the connector; it is a **broken configuration path in the UI and the create/update DTO mapping**. An S3 input source is configured through the **AdminServer** model (System Settings → Input Servers → `ServerModal.tsx`), but that form exposes only `Host`, `Port`, and `CredentialSecretRef` — it never collects an Access Key, Secret Key, Bucket, Region, or path-style flag, and it never sends a `TypeSpecificConfig` block. As a result the stored S3 `AdminServer` has empty credentials, and at connection-establish time `S3Connector.CreateS3Client` falls through to `FallbackCredentialsFactory.GetCredentials()`, which throws the AWS SDK credential-discovery error surfaced to the user as **"IAM credentials is missing."**

The literal string `"IAM credentials is missing"` does **not** exist anywhere in the codebase (verified by grep across all files). It originates inside **AWSSDK.Core's** credential resolution chain (`FallbackCredentialsFactory` / `DefaultInstanceProfileAWSCredentials`) when no static keys, environment variables, profile, or EC2/ECS instance metadata can be found. This confirms the fix is to **deliver real keys to the connector**, not to add a new error path.

The minimal, codebase-aligned fix: add Access Key / Secret Key (masked) + Bucket / Region / path-style inputs to the **S3 branch of `ServerModal.tsx`**, serialize them into `CreateServerRequest.TypeSpecificConfig` / `UpdateServerRequest.TypeSpecificConfig` (the request DTOs and `AdminServer.TypeSpecificConfig` already carry an arbitrary `BsonDocument`), and ensure the secret is **write-only on read-back** (mask in the GET response) and **never logged**. The connection-establish path (`ServerService.TestConnectionAsync` → `ServerCredentials.FromBsonDocument(TypeSpecificConfig)` → `S3Connector.TestConnectionAsync(server, credentials)`) already consumes these keys correctly and needs no change.

**Primary recommendation:** Treat this as a UI + DTO-serialization fix on the **AdminServer S3 path** (not the datasource ConnectionTab, and not the connector). Add masked AccessKey/SecretKey + Bucket/Region/UsePathStyle to `ServerModal.tsx`'s S3 branch, round-trip them through `TypeSpecificConfig`, mask the secret on read, request a MinIO bucket + key from Session B via CLUSTER-COORDINATION.md, and validate against the existing `S3ConnectorTests.cs` pattern plus a new E2E (create S3 server → test connection → success).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Root-cause first:** RESEARCH must document how the S3/MinIO input resource gets its config, where/how the S3 connection is established (the connection-establish function), and the exact code path that raises "IAM credentials is missing". (Done — see Root Cause section.)
- **UI data-source form:** add **Access Key** and **Secret Key** inputs, shown when connection type = S3/MinIO. Technical fields stay LTR; the secret is masked (password-style).
- **Backend DTO:** create/update request DTO + response DTO carry `AccessKey` / `SecretKey`. Secret is **write-only** — never echoed back in plaintext in responses.
- **Persistence:** the DataSource entity (MongoDB) stores the credentials; the secret is **secured at rest** (encrypted or otherwise protected) and **never logged**.
- **Connection flow:** the S3 connection-establish function reads the stored Access Key/Secret Key and uses them to authenticate (the fix for "IAM credentials is missing").
- **Live validation target:** file-simulator MinIO S3 API `172.24.80.23:30900`, Console `:30901` (Session B). Bucket + access/secret key must be **requested via `C:\Users\Brian\.claude\shared\CLUSTER-COORDINATION.md`** — do NOT touch the file-simulator cluster directly.
- **Testing (all three tiers required):** Unit (credential mapping/validation DTO↔entity↔connector config); Integration (controller↔Mongo + connector↔MinIO); E2E (UI create S3 → enter keys → Test Connection → success).
- **Delivery workflow:** Plan every feature, then develop. Run simulation + backends → run E2E. Final end-to-end validation (S3 source discovered/pulled with new credentials).

### Claude's Discretion
- Exact secret-at-rest mechanism (env-key encryption vs k8s secret vs existing platform pattern) — pick what matches existing codebase conventions, surfaced in RESEARCH. **(See "Secret Handling" — recommendation: keep keys in `TypeSpecificConfig` to match the working integration-test pattern, add field-level encryption + read-mask; the K8s-Secret `CredentialSecretRef` path remains an optional advanced fallback.)**
- Whether the S3 connector already exists vs needs creation. **(Confirmed: it EXISTS and works — reuse, do not recreate.)**
- Whether to use a real MinIO Testcontainer for integration vs the live file-simulator endpoint. **(Recommendation: reuse the existing `FileSimulatorFixture` live-endpoint pattern with `Skip.If(!available)`; a Testcontainer is optional for CI isolation.)**

### Deferred Ideas (OUT OF SCOPE)
- Credential rotation / full secrets-vault integration — store one access/secret key securely.
- Other connector types' credential gaps (FTP/SFTP/Kafka/HTTP) — out of scope unless the fix is shared infrastructure.
</user_constraints>

<phase_requirements>
## Phase Requirements (from ROADMAP.md Success Criteria)

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-01 | Root cause documented (config source, connection-establish, why "IAM credentials is missing" fires) | This document — Root Cause section + flow trace |
| SC-02 | UI exposes Access Key + Secret Key when S3/MinIO (LTR technical fields; secret masked) | `ServerModal.tsx` S3 branch (currently only `CredentialSecretRef`); add `Input.Password` |
| SC-03 | Create/update request + response DTOs carry AccessKey/SecretKey (secret write-only, never echoed) | `CreateServerRequest`/`UpdateServerRequest` already have `TypeSpecificConfig`; add read-mask in `ServersController` GETs + `ServerService` |
| SC-04 | DataSource/server entity persists credentials (secret secured at rest, never logged) | `AdminServer.TypeSpecificConfig` (BsonDocument); `ServerCredentials.ToString()` already redacts |
| SC-05 | Connection-establish uses stored keys; "IAM credentials is missing" no longer occurs | `ServerService.TestConnectionAsync` → `S3Connector.GetS3ConfigFromServer` → `CreateS3Client` (already correct once keys present) |
| SC-06 | Live MinIO request succeeds against file-simulator S3 endpoint | `S3ConnectorTests.cs` already green; extend to controller→Mongo→connector→MinIO |
| SC-07 | Unit + integration + E2E all pass | Validation Architecture section |
| SC-08 | End-to-end run confirms S3 source discovered/pulled with new credentials | FileDiscovery uses same connector via `IConnectorFactory`/`IServerConnector` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Collect S3 Access/Secret Key from admin | Frontend (ServerModal.tsx) | — | Admin-server config UI is where every connector's connection settings live; the datasource ConnectionTab only *selects* a pre-configured server |
| Serialize keys into request | Frontend → API DTO | — | `CreateServerRequest.TypeSpecificConfig` carries arbitrary config; no schema change required |
| Persist keys (secured at rest) | API/Backend (ServerService + Mongo) | — | `AdminServer.TypeSpecificConfig` BsonDocument; field-level encryption + read-mask added here |
| Mask secret on read-back | API/Backend (ServersController GET) | — | Write-only contract: never echo `SecretKey` plaintext |
| Establish S3 connection w/ keys | API/Backend (S3Connector) | — | `CreateS3Client` builds `BasicAWSCredentials`; already correct |
| Discover/pull files at runtime | FileDiscoveryService (via IConnectorFactory) | — | Same `IServerConnector` path; benefits automatically once keys persist |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| AWSSDK.S3 | 3.7.411.7 (pinned in `Directory.Packages.props`) | S3 + S3-compatible (MinIO) client | Already in use by `S3Connector` and `S3OutputHandler`; official AWS package [VERIFIED: NuGet api.nuget.org/v3-flatcontainer/awssdk.s3] |
| AWSSDK.Core | transitive via AWSSDK.S3 | `BasicAWSCredentials`, `FallbackCredentialsFactory` (origin of the error) | Pulled by AWSSDK.S3 |
| MongoDB.Entities | (existing) | `AdminServer` / `DataProcessingDataSource` persistence | Project ORM per CLAUDE.md |

### Supporting (Frontend)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| antd `Input.Password` | Ant Design 5.x (existing) | Masked Secret Key input | The masked secret field in `ServerModal.tsx` S3 branch |
| @tanstack/react-query | existing | `createServer`/`updateServer` mutations | Already wired in `ServerModal.tsx` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keys in `TypeSpecificConfig` (BsonDocument) | K8s Secret via `CredentialSecretRef` + `KubernetesCredentialResolver` | K8s-Secret path is "purer" (DB stores only a ref) and already implemented, but requires the user to pre-create a Secret and have RBAC; CONTEXT explicitly wants the keys entered in the form and stored. Recommend `TypeSpecificConfig` (matches the passing integration test) + field encryption, keep `CredentialSecretRef` as optional advanced override (it already takes precedence in `ServerService.TestConnectionAsync`). |
| Live file-simulator endpoint | MinIO Testcontainer | Testcontainer gives CI isolation but adds Docker dependency; existing `FileSimulatorFixture` + `Skip.If` is the established pattern. |

**Installation:** No new packages required. AWSSDK.S3 already referenced in `src/Services/Shared/DataProcessing.Shared.csproj` and `src/Services/OutputService/DataProcessing.Output.csproj`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| AWSSDK.S3 | NuGet | 10+ yrs (3.x line) | billions (official AWS) | github.com/aws/aws-sdk-net | n/a (NuGet; slopcheck targets npm/PyPI) | Approved — already in use, version 3.7.411.7 confirmed on NuGet registry |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
No **new** dependencies are introduced by this phase. AWSSDK.S3 is the official AWS .NET SDK package, already pinned and in production use.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── INPUT-SERVER CONFIG (admin) ───────────────────────────┐
│                                                                                    │
│  Admin UI: System Settings → Input Servers → "Create Server" (ServerType = s3)     │
│     ServerModal.tsx  ──[CreateServerRequest]──▶  POST /api/v1/servers              │
│        (TODAY: Host, Port, CredentialSecretRef only — NO keys, NO TypeSpecificCfg) │
│        (FIX:   + AccessKey, SecretKey(masked), Bucket, Region, UsePathStyle        │
│                 → packed into request.TypeSpecificConfig)                           │
│                                   │                                                 │
│                                   ▼                                                 │
│  ServersController.Create  ──▶  ConvertToBsonDocument(TypeSpecificConfig)           │
│                                   │                                                 │
│                                   ▼                                                 │
│  ServerService.CreateServerAsync ──▶  AdminServer.TypeSpecificConfig (MongoDB)      │
│        { AccessKey, SecretKey(encrypted), Bucket, Region, ForcePathStyle, UseHttp } │
└────────────────────────────────────────────────────────────────────────────────────┘
                                    │
       (user creates datasource, picks this S3 server in ConnectionTab → FileServerId)
                                    │
┌──────────────────── CONNECTION ESTABLISH / TEST / DISCOVERY ──────────────────────┐
│                                                                                    │
│  POST /api/v1/servers/{id}/test-connection   (or FileDiscovery poll at runtime)    │
│     ServersController.TestConnection ──▶ ServerService.TestConnectionAsync          │
│        1. credentials = CredentialResolver.Resolve(CredentialSecretRef)  [if set]  │
│        2. else credentials = ServerCredentials.FromBsonDocument(TypeSpecificConfig) │
│           → reads AccessKey / SecretKey keys                                        │
│        3. connector = ConnectorFactory.GetConnector("s3")  → S3Connector            │
│        4. (S3Connector is IServerConnector) → TestConnectionAsync(server, creds)    │
│              GetS3ConfigFromServer(server, creds):                                  │
│                 AccessKey = creds?.AccessKey ?? typeConfig["AccessKey"]             │
│              CreateS3Client(config):                                                │
│                 keys present → new BasicAWSCredentials(...)   ✅                     │
│                 keys EMPTY   → FallbackCredentialsFactory.GetCredentials()          │
│                               → AWS SDK throws "IAM credentials is missing"  ❌      │
│              GetBucketLocationAsync(bucket)  ──▶  MinIO 172.24.80.23:30900           │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Pattern 1: Credentials via TypeSpecificConfig (the proven path)
**What:** Store S3 keys as keys inside `AdminServer.TypeSpecificConfig`; the connection layer reads them via `ServerCredentials.FromBsonDocument`.
**When to use:** This is exactly what `S3ConnectorTests.cs` (passing) does and what `ServerService.TestConnectionAsync` falls back to when `CredentialSecretRef` is empty.
**Example (from the passing integration test):**
```csharp
// Source: tests/IntegrationTests/Connectors/S3ConnectorTests.cs (CreateAdminServer + CreateCredentials)
var server = new AdminServer {
    ServerType = "s3", Host = ip, Port = 30900, BasePath = "ez-data",
    TypeSpecificConfig = new BsonDocument {
        ["Bucket"] = "ez-data", ["Region"] = "us-east-1",
        ["ForcePathStyle"] = true, ["UseHttp"] = true
    }
};
var credentials = new ServerCredentials { AccessKey = "minioadmin", SecretKey = "minioadmin123" };
var result = await connector.TestConnectionAsync(server, credentials);  // IsSuccess == true
```
Note the key-name contract that `ServerCredentials.FromBsonDocument` expects: **`AccessKey`**, **`SecretKey`**, optionally **`SessionToken`** (PascalCase). `S3Connector.GetS3ConfigFromServer` reads `Endpoint` (or builds `http://Host:Port` from `UseHttp`), `Bucket`, `Region`, and `ForcePathStyle`/`UsePathStyle`.

### Pattern 2: Client construction for MinIO (path-style + custom endpoint)
**Source:** `src/Services/Shared/Connectors/S3Connector.cs` → `CreateS3Client`
- Static keys → `new BasicAWSCredentials(accessKey, secretKey)`.
- Custom endpoint set → `clientConfig.ServiceURL = endpoint; clientConfig.ForcePathStyle = true` (MinIO requires path-style; virtual-host addressing fails for raw IP/hostnames).
- No keys → `FallbackCredentialsFactory.GetCredentials()` ← **the exact line that throws the user-facing error**.

### Anti-Patterns to Avoid
- **Adding keys to the datasource ConnectionTab.** `ConnectionTab.tsx` only *selects* a server (`inputServerId`). Per-server credentials belong in `ServerModal.tsx`. Putting them on the datasource would duplicate state and diverge from the AdminServer architecture.
- **Recreating the S3 connector.** It already exists and is tested — modifying it risks regressions in `OutputService`'s `S3OutputHandler` which shares the AWSSDK.S3 path.
- **Logging the secret.** `ServerCredentials.ToString()` already redacts (`S3Auth(key=mini***)`). Any new log statement must use that redacted form, never `SecretKey` directly. The current `ServerService` logs `server.Name`/`ServerType` only — keep it that way.
- **Echoing the secret on GET.** `ServersController.GetById`/`GetAll` currently return the full `AdminServer` including `TypeSpecificConfig`. Once a secret lives there, the GET responses must mask/strip `SecretKey` (write-only contract, SC-03).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| S3/MinIO auth + signing | Custom AWS Sig-V4 signer | `BasicAWSCredentials` + `AmazonS3Client` (already wired) | Signing edge cases (path-style, region, presign) are deep; SDK handles them |
| Path-style vs virtual-host addressing | URL string munging | `AmazonS3Config.ForcePathStyle = true` + `ServiceURL` | Already correctly set for custom endpoints in `CreateS3Client` |
| Credential redaction in logs | Manual substring masking inline | `ServerCredentials.ToString()` redacted form | Centralized, already used by `KubernetesCredentialResolver` |
| BsonDocument ↔ DTO conversion | Manual parsing | `ServersController.ConvertToBsonDocument` (handles `JsonElement`) | Already handles System.Text.Json `JsonElement` coercion |

**Key insight:** Every piece of plumbing this phase needs already exists. The phase is wiring (UI fields → DTO → BsonDocument keys) plus two new guards (encrypt-at-rest, mask-on-read), not new infrastructure.

## Runtime State Inventory

> This is a bug-fix with a small config-schema addition (new keys in `TypeSpecificConfig`). Inventory of runtime state that an in-repo grep would miss:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing S3 `AdminServer` documents in MongoDB (`ez-platform` DB) may have empty/partial `TypeSpecificConfig` and no keys. Any S3 server created before this fix is non-functional. | No destructive migration needed; admin re-enters keys via the new form (UpdateServer overwrites `TypeSpecificConfig`). Document this in the plan. If field-level encryption is added, decide whether existing plaintext-in-config values (if any) need a one-time encrypt pass. |
| Live service config | **MinIO bucket + access/secret key live on the Session-B `file-simulator` cluster, NOT in this repo.** Test fixture hardcodes `minioadmin`/`minioadmin123` + bucket `ez-data`, but the live bucket/keys must be **requested via CLUSTER-COORDINATION.md** (do not touch the file-simulator cluster). | Request bucket name + access/secret key from Session B before live validation. Confirm S3 API reachable at `172.24.80.23:30900` (IP drifts on host reboot — prefer `*.file-simulator.local` hostname). |
| OS-registered state | None — verified: no scheduled tasks / pm2 / systemd units reference S3 credentials. | None |
| Secrets/env vars | Optional `CredentialSecretRef` path resolves a K8s Secret in namespace `ez-platform` (default from `Credentials__SecretNamespace`). Keys expected in Secret: `accessKey`, `secretKey`, `sessionToken` (lowercase, per `KubernetesCredentialResolver.MapSecretToCredentials`). No `.env` change required for the chosen `TypeSpecificConfig` approach. | If field-level encryption is chosen, a new encryption key (env var / ConfigMap) must be provisioned and injected into DataSourceManagementService + FileDiscoveryService + OutputService (all three construct S3 clients). |
| Build artifacts | None — no generated clients or codegen for S3. | None |

**The canonical question — after every repo file is updated, what still has the old/empty state?** Existing S3 `AdminServer` records in MongoDB (created with empty creds) remain broken until re-saved through the fixed form; and the live MinIO bucket/keys must be obtained from Session B out-of-band.

## Common Pitfalls

### Pitfall 1: "Fixing" the connector instead of the config path
**What goes wrong:** Time spent editing `S3Connector.cs` looking for the error string.
**Why it happens:** The error *surfaces* from the connector's `CreateS3Client`, but the string is thrown by AWSSDK.Core, and the *cause* is upstream (empty keys from UI/DTO).
**How to avoid:** Verify keys reach `GetS3ConfigFromServer` first. The connector is already correct (proven by `S3ConnectorTests`).
**Warning signs:** Grep for the literal string returns zero hits in the repo (confirmed) — that means it's an SDK message, not ours.

### Pitfall 2: Key-name casing mismatch
**What goes wrong:** Frontend writes `accessKey`/`secretKey` (camelCase) into `TypeSpecificConfig`, but `ServerCredentials.FromBsonDocument` and `GetS3ConfigFromServer` (server path) read **PascalCase** `AccessKey`/`SecretKey`/`Bucket`/`Region`/`ForcePathStyle`.
**Why it happens:** The legacy `DataProcessingDataSource` path (`GetS3Config`) uses camelCase `accessKey`/`secretKey`; the AdminServer path uses PascalCase. Two different casings coexist.
**How to avoid:** For the AdminServer/`TypeSpecificConfig` path used by the UI, write **PascalCase** keys: `AccessKey`, `SecretKey`, `SessionToken`, `Bucket`, `Region`, `ForcePathStyle`/`UsePathStyle`, `UseHttp`, optional `Endpoint`. Add a unit test asserting the exact key names round-trip.
**Warning signs:** Connection test still returns "IAM credentials is missing" even after keys are entered → keys landed under the wrong casing and `FromBsonDocument` saw nothing.

### Pitfall 3: Secret echoed back on edit
**What goes wrong:** `GetById` returns `TypeSpecificConfig.SecretKey` in plaintext; the edit form repopulates it; it appears in browser/network logs.
**Why it happens:** `ServersController` GETs return the raw `AdminServer`.
**How to avoid:** Mask `SecretKey` (e.g., to `"********"` or omit) in all server GET responses; on update, treat an unchanged/masked value as "keep existing" rather than overwriting with the mask.
**Warning signs:** Network tab shows the secret in the `/api/v1/servers` response body.

### Pitfall 4: MinIO virtual-host addressing
**What goes wrong:** Bucket-in-hostname addressing fails against a raw IP / non-DNS MinIO.
**How to avoid:** Always `ForcePathStyle = true` for custom endpoints (already enforced in `CreateS3Client` when `ServiceURL` is set). Ensure the UI defaults `UsePathStyle`/`ForcePathStyle` to true for MinIO and `UseHttp` to true for the http-only file-simulator endpoint.
**Warning signs:** `AmazonS3Exception` with host-resolution / `NoSuchBucket` despite a valid bucket.

### Pitfall 5: file-simulator IP drift
**What goes wrong:** Live test fails because `172.24.80.23` changed after a host reboot/sleep (Hyper-V DHCP drift, documented in CLUSTER-COORDINATION.md).
**How to avoid:** Use `*.file-simulator.local` hostnames; re-read CLUSTER-COORDINATION.md status row before live validation; `FileSimulatorFixture` already supports `FILE_SIMULATOR_IP` env override.

## Code Examples

### Reading S3 server config + building the client (the establish path)
```csharp
// Source: src/Services/Shared/Connectors/S3Connector.cs (GetS3ConfigFromServer + CreateS3Client)
AccessKey = credentials?.AccessKey ?? typeConfig.GetValue("AccessKey", string.Empty).AsString;
// ...
if (!string.IsNullOrEmpty(config.AccessKey) && !string.IsNullOrEmpty(config.SecretKey))
    awsCredentials = new BasicAWSCredentials(config.AccessKey, config.SecretKey);
else
    awsCredentials = FallbackCredentialsFactory.GetCredentials(); // ← throws "IAM credentials is missing"
if (!string.IsNullOrEmpty(config.Endpoint)) {
    clientConfig.ServiceURL = config.Endpoint;
    clientConfig.ForcePathStyle = true;        // MinIO
}
```

### Frontend: where to add the masked fields (S3 branch of ServerModal)
```tsx
// Source: src/Frontend/src/pages/admin/components/ServerModal.tsx
// requiresHostPort === true for ['ftp','sftp','s3','http']; add an isS3 branch:
//   <Input.Password className="ltr-field" name="AccessKey" .../>   (LTR technical field)
//   <Input.Password className="ltr-field" name="SecretKey" .../>   (masked, write-only)
//   <Input name="Bucket" .../>  <Input name="Region" .../>  <Switch name="UsePathStyle" defaultChecked/>
// In handleSubmit, for ServerType === 's3', pack into requestData.TypeSpecificConfig:
//   { AccessKey, SecretKey, Bucket, Region, ForcePathStyle: true, UseHttp: true }
```
(Today `handleSubmit` only sets `TypeSpecificConfig` for Kafka via `KafkaConfig`; S3 sends none — this is the gap.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Legacy `DataProcessingDataSource.AdditionalConfiguration` with camelCase `accessKey`/`secretKey` (`S3Connector.GetS3Config`) | `AdminServer.TypeSpecificConfig` + `ServerCredentials` with PascalCase keys (`GetS3ConfigFromServer`) | v0.2.0 (server-centralization) | Use the AdminServer path; legacy path is marked DEPRECATED and slated for removal |
| Credentials only via K8s Secret (`CredentialSecretRef`, "Credentials are NOT stored in the database") | This phase adds in-form keys stored in `TypeSpecificConfig` | Phase 34 | Aligns with CONTEXT decision; must add encrypt-at-rest + read-mask to honor the spirit of the original "no plaintext creds in DB" design |

**Deprecated/outdated:**
- `DataProcessingDataSource.AdditionalConfiguration` (DEPRECATED in v0.2.0 per entity XML doc) — do not build new behavior on it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact user-facing string "IAM credentials is missing" is emitted by AWSSDK.Core `FallbackCredentialsFactory`/instance-profile resolution (string not in repo — confirmed absent by grep). The precise SDK wording may differ slightly by version (3.7.411.7). | Root Cause | Low — even if wording differs, the trigger (empty static keys → fallback chain → throw) is confirmed by code trace; fix is identical |
| A2 | The live file-simulator bucket name is `ez-data` and creds `minioadmin`/`minioadmin123` (from test fixture). | Runtime State / Validation | Medium — live values must be confirmed via Session B; fixture values may not match the current live bucket/keys |
| A3 | Recommended secret-at-rest = field-level encryption of `SecretKey` within `TypeSpecificConfig` (vs. forcing the K8s-Secret path). | User Constraints / Don't Hand-Roll | Medium — if the team prefers the existing `CredentialSecretRef`/K8s-Secret mechanism, the UI/DTO plan changes (collect a secret-ref, not raw keys). Needs a planning decision. |
| A4 | `nyquist_validation` is enabled (key absent in `.planning/config.json` → treated as enabled). | Validation Architecture | Low |

## Open Questions

1. **Secret-at-rest mechanism (encrypt in `TypeSpecificConfig` vs. K8s Secret)?**
   - What we know: Both paths exist; `TypeSpecificConfig` is what the passing test uses; `CredentialSecretRef` takes precedence when set and stores nothing in DB.
   - What's unclear: CONTEXT wants keys entered in the form and "secured at rest" — that implies DB storage with encryption, not a K8s-Secret ref.
   - Recommendation: Store in `TypeSpecificConfig` with field-level encryption of `SecretKey` + read-mask; keep `CredentialSecretRef` as an optional advanced override. Surface for planner decision (A3).

2. **Live MinIO bucket + keys from Session B.**
   - What we know: S3 API at `172.24.80.23:30900`, console `:30901`; fixture uses `ez-data` / `minioadmin`.
   - What's unclear: The actual bucket/keys to use for live validation.
   - Recommendation: Request via CLUSTER-COORDINATION.md before the live-validation task; do not assume fixture values.

3. **Existing broken S3 servers in MongoDB.**
   - What we know: Any S3 `AdminServer` created via the current form has no keys.
   - Recommendation: No migration; admin re-saves through the fixed form. Note in plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| AWSSDK.S3 | S3Connector / build | ✓ | 3.7.411.7 (pinned) | — |
| file-simulator MinIO (S3 API) | Integration + E2E live validation (SC-06/08) | ✗ to confirm | endpoint `172.24.80.23:30900` (IP drifts) | `Skip.If(!IsAvailable)` already in `S3ConnectorTests`; integration tests no-op when unreachable |
| MongoDB (`ez-platform`) | controller↔Mongo integration (SC-03) | ✗ to confirm | — | Existing test infra targets live/replica-set Mongo |
| ez-platform backends running | E2E (server create → test connection) | ✗ to confirm | — | Per CLUSTER-COORDINATION: ez-platform backends currently CrashLoop (kafka clusterId + missing RabbitMQ) — see blocker below |
| Playwright | E2E (SC-07) | ✓ | config `src/Frontend/playwright.config.ts`, baseURL `http://localhost:7000` | — |

**Missing dependencies with no fallback:**
- **ez-platform backends must be runnable for E2E + live validation.** Per CLUSTER-COORDINATION.md (2026-06-02), the `ez-platform` cluster's .NET backends were CrashLooping (Kafka `InconsistentClusterIdException` + RabbitMQ not deployed). The plan must include a "bring backends up" step (or run DataSourceManagementService locally against Mongo) before SC-06/07/08 can pass. This is a real execution gate.

**Missing dependencies with fallback:**
- Live MinIO unreachable → integration tests Skip (green-but-skipped); unit tests + the credential round-trip integration (controller↔Mongo, secret-not-echoed) still run without MinIO.

## Validation Architecture

> `nyquist_validation` treated as enabled (key absent in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | xUnit + FluentAssertions + Xunit.SkippableFact (`tests/IntegrationTests/`) |
| Backend config | `tests/IntegrationTests/TestConfiguration.cs`, `[Collection("Integration")]`, `FileSimulatorFixture` |
| Backend run command | `dotnet test tests/IntegrationTests` (filter `--filter "Protocol=S3"`) |
| Frontend unit | Vitest (per CLAUDE.md `/gsd:add-tests`) |
| Frontend E2E | Playwright (`src/Frontend/playwright.config.ts`, baseURL `http://localhost:7000`); helpers `antTabClick`, `extractId` in `tests/e2e/sanity.spec.ts` |
| Comprehensive UI | `webapp-testing` skill — `src/Frontend/tests/webapp-testing/*.py` (recon-first) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-02 | S3 server form renders masked AccessKey/SecretKey (LTR) | unit (Vitest) + E2E | `npx vitest run ServerModal` ; `npx playwright test s3-server` | ❌ Wave 0 |
| SC-03 | Create/update round-trips keys into `TypeSpecificConfig`; GET masks `SecretKey` | integration | `dotnet test --filter "FullyQualifiedName~Server&Category=S3Credentials"` | ❌ Wave 0 |
| SC-03 | `ServerCredentials.FromBsonDocument` reads PascalCase `AccessKey`/`SecretKey` | unit (xUnit) | `dotnet test --filter "FullyQualifiedName~ServerCredentials"` | ❌ Wave 0 |
| SC-04 | Secret never appears in logs (redacted `ToString`) | unit | `dotnet test --filter "FullyQualifiedName~Redact"` | ❌ Wave 0 |
| SC-05/06 | S3Connector authenticates to MinIO, lists/reads | integration (live) | `dotnet test --filter "Protocol=S3"` | ✅ `S3ConnectorTests.cs` (extend) |
| SC-06 | controller → Mongo → connector → MinIO end-to-end test-connection | integration (live) | `dotnet test --filter "Category=S3EndToEnd"` | ❌ Wave 0 |
| SC-07 | E2E: create S3 server → enter keys → Test Connection → success | E2E | `npx playwright test --headed s3-server` | ❌ Wave 0 |
| SC-08 | FileDiscovery pulls a file from the S3 source with new creds | integration/manual | run sim + backends, observe discovery | ❌ Wave 0 (manual final check) |

### Sampling Rate
- **Per task commit:** affected unit suite (`dotnet test --filter` for backend slice; `npx vitest run` for frontend slice).
- **Per wave merge:** `dotnet test tests/IntegrationTests --filter "Protocol=S3"` + Playwright S3 spec.
- **Phase gate:** full backend integration + full Playwright e2e green; manual SC-08 discovery run.

### Wave 0 Gaps
- [ ] `tests/IntegrationTests/Connectors/S3ConnectorTests.cs` — extend with a controller→Mongo→connector test (`Category=S3EndToEnd`) and a "secret not echoed on GET" assertion.
- [ ] New xUnit unit test for `ServerCredentials.FromBsonDocument` PascalCase key contract + redaction.
- [ ] New backend integration test: POST `/api/v1/servers` (s3) then GET → assert `SecretKey` masked, `AccessKey` present, keys persisted in Mongo `TypeSpecificConfig`.
- [ ] `src/Frontend/tests/e2e/s3-server.spec.ts` — create S3 server, enter keys, Test Connection success (reuse `antTabClick`/`extractId`).
- [ ] Vitest unit for `ServerModal` S3 branch field rendering + `handleSubmit` TypeSpecificConfig packing.
- [ ] (Optional) `webapp-testing` Python script for comprehensive S3-form edge cases (masking, edit-keep-secret, cancel).
- [ ] Pre-req task: bring ez-platform backends up (resolve Kafka clusterId + RabbitMQ per CLUSTER-COORDINATION) so E2E/live tests can run.

## Project Constraints (from CLAUDE.md)
- **Cluster coordination (READ FIRST):** This project is Session A → owns `minikube`/`ez-platform` only. **Never touch the `file-simulator` profile.** Always pin context (`kubectl --context=minikube`); never `kubectl config use-context`. Request MinIO bucket/keys from Session B via `C:\Users\Brian\.claude\shared\CLUSTER-COORDINATION.md`.
- **Task Orchestrator MCP (mandatory):** Use `task-orchestrator` via `mcp-exec` for task management; git commit + push after each completed task.
- **SignalR real-time sync (mandatory):** CRUD controllers broadcast `EntityChanged`. `ServersController` already broadcasts `EntityType="AdminServer"` on create/update/delete — preserve this.
- **RTL/Hebrew:** Technical fields (keys, endpoints, regex, paths) use `className="ltr-field"`. UI strings need he/en i18n keys (`src/Frontend/src/i18n/locales/he.json` + `en.json`).
- **Testing (mandatory for UI work):** run both `/gsd:add-tests {phase}` (unit + E2E) **and** the `webapp-testing` skill (comprehensive UI verification).
- **OCP:** non-privileged ports, no `:latest`, non-root. (No deployment topology change expected this phase.)
- **API response shape:** `ApiResponse<T>` wrapper pattern; frontend service-layer clients under `src/Frontend/src/services/`.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (to MinIO) | `BasicAWSCredentials` (AWSSDK) — never hand-roll signing |
| V3 Session Management | no | — |
| V4 Access Control | partial | Admin-only server config (existing admin route); no new endpoint authz introduced |
| V5 Input Validation | yes | Validate AccessKey/SecretKey/Bucket non-empty; required-field rules in form + DTO |
| V6 Cryptography | yes | Secret-at-rest: field-level encryption of `SecretKey` in `TypeSpecificConfig` (use a vetted .NET symmetric primitive, not custom); key from env/ConfigMap. Never log secret (use redacted `ToString`). |
| V7 Error Handling & Logging | yes | Do not leak `SecretKey` in logs or error/response bodies; mask on GET |

### Known Threat Patterns for .NET S3-connector + admin form
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret echoed in API GET / logs | Information Disclosure | Write-only secret: mask `SecretKey` on read; redact in logs (`ServerCredentials.ToString`) |
| Plaintext secret at rest in Mongo | Information Disclosure | Field-level encryption of `SecretKey` in `TypeSpecificConfig`; or use `CredentialSecretRef` K8s Secret |
| Credential stuffing / wrong creds masked as "IAM missing" | — | Surface AWS `ErrorCode` from `AmazonS3Exception` (connector already returns `Code: {ex.ErrorCode}`) so auth failures are distinguishable from "no creds" |
| SSRF via attacker-controlled S3 endpoint | Tampering | Endpoint is admin-configured (trusted role); restrict to admin server-config surface (existing) |

## Sources

### Primary (HIGH confidence — direct code trace this session)
- `src/Services/Shared/Connectors/S3Connector.cs` — connection-establish path, `CreateS3Client`, `FallbackCredentialsFactory` fallback (root cause)
- `src/Services/Shared/Connectors/IConnectorFactory.cs` — `IServerConnector`, `ConnectionTestResult`, `DiscoveredFile`
- `src/Services/Shared/Connectors/ConnectorFactory.cs` — `s3`/`s3compat` → `S3Connector` mapping + DI registration
- `src/Services/Shared/Services/ICredentialResolver.cs` — `ServerCredentials` (PascalCase key contract, redacted `ToString`, `FromBsonDocument`)
- `src/Services/Shared/Services/KubernetesCredentialResolver.cs` + `Configuration/CredentialResolverConfiguration.cs` — K8s Secret path + NoOp fallback
- `src/Services/Shared/Entities/AdminServer.cs`, `DataProcessingDataSource.cs` — `TypeSpecificConfig`, `FileServerId`, deprecated `AdditionalConfiguration`
- `src/Services/DataSourceManagementService/Services/ServerService.cs` — `TestConnectionAsync` establish flow (cred resolve → FromBsonDocument → connector)
- `src/Services/DataSourceManagementService/Controllers/ServersController.cs` — create/update/get, `ConvertToBsonDocument`, SignalR broadcast
- `src/Services/DataSourceManagementService/Models/Requests/CreateDataSourceRequest.cs`; `servers-api-client.ts` (`CreateServerRequest.TypeSpecificConfig`)
- `src/Frontend/src/pages/admin/components/ServerModal.tsx` — **the gap** (S3 branch lacks key/TypeSpecificConfig fields)
- `src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx` — datasource selects server (no creds here)
- `tests/IntegrationTests/Connectors/S3ConnectorTests.cs` + `Fixtures/FileSimulatorFixture.cs` — proven working pattern, fixture creds/ports
- `Directory.Packages.props` — `AWSSDK.S3` 3.7.411.7 pin
- `C:\Users\Brian\.claude\shared\CLUSTER-COORDINATION.md` — file-simulator MinIO endpoint, IP drift, backend CrashLoop blocker

### Secondary (MEDIUM)
- NuGet flat-container index for `awssdk.s3` — confirms package legitimacy/3.x line [api.nuget.org/v3-flatcontainer/awssdk.s3/index.json]

### Tertiary (LOW)
- Exact AWS SDK wording "IAM credentials is missing" — inferred from `FallbackCredentialsFactory` behavior (string not present in repo); see Assumption A1

## Metadata

**Confidence breakdown:**
- Root cause: HIGH — full code trace from UI → DTO → entity → connector → SDK fallback; error string confirmed absent from repo
- Standard stack: HIGH — no new packages; AWSSDK.S3 in use and version-confirmed on NuGet
- Architecture/patterns: HIGH — proven by passing `S3ConnectorTests.cs`
- Live MinIO values: MEDIUM — fixture values known; live bucket/keys pending Session B
- Exact SDK error string: LOW — see Assumption A1

**Research date:** 2026-06-02
**Valid until:** ~2026-07-02 (stable internal code; re-confirm file-simulator IP/bucket immediately before live validation)
