---
phase: 34-s3-minio-connector-iam-credentials-bug-fix
plan: 06
type: live-validation
status: passed
validated: 2026-06-07
requirements: [SC-03, SC-04, SC-05, SC-06, SC-08]
---

# Phase 34 — Live End-to-End Validation (SC-08)

Live validation of the S3/MinIO "IAM credentials is missing" fix against the
**file-simulator MinIO** (owned by Session B), driven from the `ez-platform`
side only. The original bug is fixed end-to-end: an admin can configure an S3
server with an Access Key + Secret Key through the UI and the connector
authenticates to MinIO.

## Environment

| Item | Value |
|------|-------|
| MinIO S3 endpoint | `http://172.24.80.23:30900` (HTTP, **path-style**) |
| Credential | MinIO service account `appuser` (readwrite) — secret redacted (T-34-16) |
| Test bucket | `ez-phase34-input` (created by Session A via appuser) + `ez-data` |
| Sample objects | `sample1.csv`, `sample2.csv` |
| ez-platform DSM | `ez-platform/datasource-management:phase34-s3creds` (pod 1/1) |
| ez-platform frontend | `frontend:phase34-r2` (pod 1/1) |

> ⚠️ Pre-flight cluster recovery: the `minikube` control plane was wedged on
> **expired kubeadm certs** (controller-manager / apiserver-kubelet-client /
> scheduler certs expired 2026-06-04). Renewed via
> `kubeadm certs renew all --cert-dir /var/lib/minikube/certs` + control-plane
> restart before the deployment rollout could proceed. See CLUSTER-COORDINATION.md.

## Results

### Backend tier (deployed DSM pod, via API `:5001`)

| Criterion | Evidence | Result |
|-----------|----------|--------|
| SC-03 write-only masking | GET `/api/v1/servers/{id}` → `SecretKey == "********"`, `AccessKey`/`Bucket` visible | ✅ PASS |
| SC-04 encrypt-at-rest | Mongo `AdminServer.TypeSpecificConfig.SecretKey` has `enc:v1:` prefix (not plaintext) | ✅ PASS |
| SC-05 decrypt-on-read → keys reach connector | Test Connection authenticates (would fail if ciphertext were passed) | ✅ PASS |
| SC-06 live MinIO request succeeds | POST `/api/v1/servers/{id}/test-connection` → `Success=true`, 495 ms, no error | ✅ PASS |

### Frontend tier (deployed frontend, via UI `:7011`)

| Criterion | Evidence | Result |
|-----------|----------|--------|
| 34-03 S3 fields render | ServerModal (type=S3/MinIO) shows Access Key, Secret Key (masked), Bucket, Region, Path-Style (on), Use HTTP (on) | ✅ PASS |
| 34-03 PascalCase packing | UI-created `phase34-ui-test` persisted `TypeSpecificConfig` keys: `AccessKey, SecretKey, Bucket, Region, ForcePathStyle, UseHttp` | ✅ PASS |
| SC-03 masking (UI-created) | GET shows `SecretKey == "********"`, `AccessKey == appuser` | ✅ PASS |
| **SC-08 UI → backend → MinIO** | Server created through ServerModal; Test Connection → `Success=true`, 409 ms, **no "IAM credentials is missing"** | ✅ PASS |

### Connector / discovery tier (integration tests vs live MinIO)

`dotnet test IntegrationTests --filter FullyQualifiedName~S3Connector`
(with `FILE_SIMULATOR_IP=172.24.80.23`) → **5/5 passed**:

- S3: Test connection returns success ✅
- S3: Write and read file round-trips ✅
- **S3: List files returns matching files** (discovery/listing of bucket objects) ✅
- S3: empty credentials fail to connect (IAM-missing regression) ✅
- **S3 (S3EndToEnd): credentials from `TypeSpecificConfig` authenticate to MinIO** ✅

## Gap closed during validation

Live validation surfaced a real wiring gap: Phase 34 wired **encrypt-on-write**
but never invoked the matching **decrypt-on-read** helper
(`ServerCredentialProtector.DecryptSecretInPlace` had zero callers), so the
deployed Test Connection handed the `enc:v1:` ciphertext to the connector and
would have failed. Fixed in commit `476f946` — `ServerService.TestConnectionAsync`
and `FileOperationsService` now decrypt the at-rest SecretKey (on a clone) before
`ServerCredentials.FromBsonDocument`. Verified live above.

## Residual / out of scope

- **Async discovery pipeline (FileDiscovery worker → poll → pull):** gated by the
  `rabbitmq` pod flapping (MassTransit base bus, ~900 restarts) on this cluster.
  The credential fix itself is proven at the connector level (live `ListFiles`
  returns the bucket's sample CSVs); the end-to-end async poll was not exercised
  because the broker is unhealthy — a pre-existing infra issue unrelated to the
  S3 credential change.
- MinIO object data is on `emptyDir` (ephemeral, per Session B) — fine for these
  connector tests; uploaded objects do not survive an `s3` pod restart.

## Verdict

**PASS** — SC-03, SC-04, SC-05, SC-06, and SC-08 (UI create → Test Connection)
all verified live against real MinIO with username/password credentials. The
"IAM credentials is missing" bug is resolved end-to-end.
