# Phase 34: S3/MinIO Connector — IAM Credentials Bug Fix - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning
**Source:** User brief (captured directly from /gsd-plan-phase invocation)

<domain>
## Phase Boundary

A user configuring an **S3 / MinIO input data source** hits a **"IAM credentials is missing"** error. The S3 connector currently has no way to supply credentials. This phase adds **Access Key + Secret Key** support end-to-end — UI form → backend request/response DTOs → MongoDB persistence → the S3 connection-establish function — so the connector authenticates against the S3 endpoint, and validates it live against the **file-simulator MinIO** (S3 API).

In scope: the S3/MinIO connector credential path only. Out of scope: other connector types (Local/FTP/SFTP/Kafka/HTTP) beyond reusing their patterns; broader secrets-management infrastructure beyond what's needed to store one access/secret key securely.
</domain>

<decisions>
## Implementation Decisions (locked from user brief)

### Root-cause first
- Before coding, RESEARCH must document: how the new S3/MinIO input resource gets its config, where/how the S3 connection is established (the connection-establish function), and the exact code path that raises "IAM credentials is missing".

### Credential fields added across the stack
- **UI data-source form:** add **Access Key** and **Secret Key** inputs, shown when connection type = S3/MinIO. Technical fields stay LTR; the secret is masked (password-style).
- **Backend DTO:** create/update request DTO + response DTO carry `AccessKey` / `SecretKey`. Secret is **write-only** — never echoed back in plaintext in responses.
- **Persistence:** the DataSource entity (MongoDB) stores the credentials; the secret is **secured at rest** (encrypted or otherwise protected) and **never logged**.
- **Connection flow:** the S3 connection-establish function reads the stored Access Key/Secret Key and uses them to authenticate (the fix for "IAM credentials is missing").

### Live validation target
- Validate against the **file-simulator MinIO**: S3 API `172.24.80.23:30900`, Console `:30901` (owned by **Session B**). A bucket + access/secret key must be **requested via `C:\Users\Brian\.claude\shared\CLUSTER-COORDINATION.md`** — do NOT touch the file-simulator cluster directly.

### Testing (all three tiers required)
- **Unit:** credential mapping/validation (DTO ↔ entity ↔ connector config).
- **Integration:** controller ↔ MongoDB (credential persisted, secret not echoed) and connector ↔ MinIO (authenticated request).
- **E2E:** UI create S3 data source → enter Access/Secret Key → Test Connection → success.

### Delivery workflow (user-specified)
- Plan every feature, then develop the features.
- Run simulation + run the backends → run E2E testing.
- Final validation check (end-to-end: an S3 source can be discovered/pulled with the new credentials).

### Claude's Discretion
- Exact secret-at-rest mechanism (env-key encryption vs k8s secret vs existing platform pattern) — pick what matches existing codebase conventions, surfaced in RESEARCH.
- Whether the S3 connector already exists vs needs creation — RESEARCH determines; reuse the existing connector pattern (Local/FTP/SFTP/Kafka/HTTP) as the analog.
- Whether to use a real MinIO Testcontainer for integration vs the live file-simulator endpoint.
</decisions>

<specifics>
## Specific Ideas

- Error string to eliminate: **"IAM credentials is missing"**.
- Connector code lives under `src/Services/Shared/Connectors/` (Local, FTP, SFTP, Kafka, HTTP today — S3/MinIO is the subject).
- Data-source form UI under `src/Frontend/src/components/datasource/` (7 tabs incl. Connection).
- DataSource entity inherits `DataProcessingBaseEntity`; connection settings carried on the data source.
- MinIO/S3 SDK: AWS S3-compatible (MinIO endpoint + path-style addressing typical for MinIO).
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Connectors / connection flow
- `src/Services/Shared/Connectors/` — existing connector implementations + the connection-establish/test pattern to mirror for S3.

### Data source model + API
- `src/Services/DataSourceManagementService/` — controller, request/response DTOs, repository for data sources (connection testing lives here).
- `src/Services/Shared/Entities/` — `DataProcessingBaseEntity` + DataSource entity/connection-settings model.

### Frontend form
- `src/Frontend/src/components/datasource/tabs/` — the Connection tab where the S3 credential fields are added.

### Cross-session coordination
- `C:\Users\Brian\.claude\shared\CLUSTER-COORDINATION.md` — request the MinIO bucket + access/secret key from Session B here; do not touch the `file-simulator` cluster.
</canonical_refs>

<deferred>
## Deferred Ideas

- Credential rotation / full secrets-vault integration — out of scope; store one access/secret key securely.
- Other connector types' credential gaps — out of scope unless the fix is shared infrastructure.
</deferred>

---

*Phase: 34-s3-minio-connector-iam-credentials-bug-fix*
*Context captured: 2026-06-02 from user brief*
