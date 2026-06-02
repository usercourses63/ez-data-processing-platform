---
phase: 34-s3-minio-connector-iam-credentials-bug-fix
plan: 02
subsystem: backend-credentials
tags: [s3, minio, credentials, secret-masking, write-only, server-api]
requires:
  - ServerCredentialProtector (AES-256 field encryption of S3 SecretKey) [34-01]
  - Encrypt-at-rest of SecretKey on AdminServer create/update [34-01]
provides:
  - SecretKey masked to "********" on all five AdminServer GET endpoints (write-only, SC-03)
  - MaskedSecretSentinel const shared by controller, update path, and frontend
  - Keep-existing-secret on update when the mask sentinel (or empty) is re-submitted
affects:
  - src/Services/DataSourceManagementService/Controllers/ServersController.cs
  - src/Services/DataSourceManagementService/Services/ServerService.cs
tech-stack:
  added: []
  patterns:
    - Write-only secret contract: secret never echoed in GET; mask sentinel re-post means "keep existing"
    - Mask on a deep-cloned BsonDocument so the persisted document is never mutated
key-files:
  created: []
  modified:
    - src/Services/DataSourceManagementService/Controllers/ServersController.cs
    - src/Services/DataSourceManagementService/Services/ServerService.cs
decisions:
  - "MaskedSecretSentinel is an internal const on ServersController so the service update path and frontend reference one canonical value"
  - "Masking returns a shallow-copied AdminServer with a deep-cloned TypeSpecificConfig — never mutates the tracked/persisted MongoDB document (T-34-07)"
  - "Keep-existing logic lives in ServerService.UpdateServerAsync (PreserveExistingSecret), not the controller, so it runs after the controller's encrypt step from 34-01"
metrics:
  duration: ~8m
  completed: 2026-06-02
---

# Phase 34 Plan 02: Write-Only Secret Masking Summary

SecretKey is now write-only end-to-end on the AdminServer API: every GET response masks it to `"********"` on a deep copy (never echoing plaintext or ciphertext), and an update that re-submits the mask retains the previously stored encrypted secret instead of clobbering it — closing the network-tab disclosure and the edit-form secret-wipe (Pitfall 3).

## What Was Built

**Task 1 — Mask SecretKey on all AdminServer GET responses (`ServersController.cs`):**
- Added `internal const string MaskedSecretSentinel = "********"` — the single canonical value referenced by the update path (Task 2) and the frontend.
- Added `MaskSecret(AdminServer?)` and a `List<AdminServer>` overload: when `TypeSpecificConfig` carries a non-empty `SecretKey`, returns a shallow-copied `AdminServer` whose `TypeSpecificConfig` is a `DeepClone()` with `SecretKey` replaced by the sentinel. When no secret is present the original instance is returned unchanged.
- Applied to the return value of `GetAll`, `GetInputServers`, `GetOutputServers`, `GetById`, and `GetByType` before `Ok(...)`.
- `AccessKey`, `Bucket`, `Region`, `ForcePathStyle`, `UseHttp` remain visible — only `SecretKey` is write-only (SC-03).
- The persisted/tracked MongoDB document is never mutated — masking happens on the deep copy only (T-34-07).

**Task 2 — Keep-existing-secret on update (`ServerService.cs`):**
- Added `PreserveExistingSecret(incoming, existing)`, invoked in `UpdateServerAsync` immediately before assigning `existing.TypeSpecificConfig`.
- When the inbound `SecretKey` equals `ServersController.MaskedSecretSentinel` (or is empty/absent) **and** a real secret already exists on the stored document, the stored (already-encrypted) `SecretKey` is retained on the inbound config.
- When the client supplies a genuinely new `SecretKey`, it flows through unchanged (the controller's 34-01 encrypt step already protected it).
- This prevents an edit-without-changing-secret from overwriting the stored credential with the mask (Pitfall 3, T-34-06).

## Verification

| Gate | Result |
|------|--------|
| `dotnet build src/Services/DataSourceManagementService` (Task 1) | Build succeeded |
| `dotnet build src/Services/DataSourceManagementService` (Task 2) | Build succeeded |

Behavioral assertions (GET masks the secret; update with the mask keeps the existing secret) are exercised by the integration test delivered in plan 34-04 — this plan provides the implementation those tests target.

## Deviations from Plan

None — plan executed as written.

Note: the plan listed `ServersController.cs` under Task 2's `<files>`, but the only controller change needed (the shared `MaskedSecretSentinel` const) was already added in Task 1. Task 2's keep-existing logic lives entirely in `ServerService.UpdateServerAsync`, which is correct because it must run after the controller's encrypt step. No additional controller edit was required.

## Threat Model Coverage

- **T-34-05 (SecretKey echoed in GET response / network tab):** mitigated — Task 1 masks `SecretKey` to `"********"` on all five GET endpoints.
- **T-34-06 (edit form re-posts mask → stored secret overwritten):** mitigated — Task 2 keep-existing-secret retains the stored encrypted value when the mask/empty secret is submitted.
- **T-34-07 (masking corrupts the persisted document):** mitigated — Task 1 masks on a `DeepClone()` of `TypeSpecificConfig` inside a shallow-copied `AdminServer`; the tracked document is never mutated.

## Notes for Downstream Plans

- The frontend edit form must send `SecretKey = "********"` (or omit/empty it) when the admin does not change the secret, so the backend keep-existing path engages. When the admin enters a new secret, send the new plaintext value (the backend encrypts it).
- `MaskedSecretSentinel` (`"********"`) is the contract value shared across controller, service, and frontend — keep them in sync.

## Self-Check: PASSED

Both modified files present with the expected symbols (`MaskSecret`, `MaskedSecretSentinel`, `PreserveExistingSecret`); both task commits (85664ec, 38afceb) found in history; both builds succeeded.
