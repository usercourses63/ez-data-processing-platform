---
phase: 34-s3-minio-connector-iam-credentials-bug-fix
plan: 03
subsystem: frontend-server-modal
tags: [s3, minio, credentials, frontend, react, antd, i18n, rtl]
requires:
  - Documented PascalCase S3 TypeSpecificConfig key contract (34-01)
  - MaskedSecretSentinel / write-only SecretKey masking (34-02)
provides:
  - S3/MinIO credential UI in ServerModal (Access Key, masked Secret Key, Bucket, Region)
  - UsePathStyle / UseHttp switches (MinIO path-style + http defaults)
  - PascalCase TypeSpecificConfig packing on submit
  - Masked-secret edit pre-fill (sentinel kept unchanged = keep existing secret)
affects:
  - src/Frontend/src/pages/admin/components/ServerModal.tsx
tech-stack:
  added: []
  patterns:
    - Ant Design Input.Password for write-only secret field (masked, visibilityToggle)
    - className="ltr-field" on all technical inputs (CLAUDE.md RTL rule)
    - Masked sentinel "********" pre-fill on edit; unchanged value sent back to keep stored secret
    - serverType?.toLowerCase() === 's3' branch mirroring the existing Kafka branch
key-files:
  created:
    - .planning/phases/34-s3-minio-connector-iam-credentials-bug-fix/34-03-SUMMARY.md
  modified:
    - src/Frontend/src/pages/admin/components/ServerModal.tsx
    - src/Frontend/src/i18n/locales/he.json
    - src/Frontend/src/i18n/locales/en.json
decisions:
  - "Added a dedicated {isS3 && ...} section (S3 divider) for the credential fields rather than overloading requiresHostPort, while still reusing the shared Host/Port block (S3 keeps endpoint host/port)"
  - "Frontend-local MASKED_SECRET_SENTINEL const ('********') — no shared frontend constant existed; mirrors the backend 34-02 sentinel"
  - "ForcePathStyle is the contract key sent to the backend; the form field is named UsePathStyle for UI clarity and mapped at submit"
metrics:
  duration: ~8m
  completed: 2026-06-02
---

# Phase 34 Plan 03: ServerModal S3/MinIO Credential Fields Summary

Frontend guard closing the configuration gap behind "IAM credentials is missing": `ServerModal` now exposes masked Access/Secret Key plus Bucket/Region/path-style fields for S3/MinIO servers and serializes them into a PascalCase `TypeSpecificConfig` that matches the backend `ServerCredentials.FromBsonDocument` contract — so the connector receives real keys instead of an empty config.

## What Was Built

**Task 1 — S3 credential fields (masked, LTR, path-style):**
- Added `const isS3 = serverType?.toLowerCase() === 's3'`.
- A dedicated `{isS3 && (...)}` section under an "S3 / MinIO Settings" divider renders:
  - `Access Key` — `<Input className="ltr-field" autoComplete="off" />` (name `AccessKey`, required).
  - `Secret Key` — `<Input.Password className="ltr-field" visibilityToggle autoComplete="new-password" />` (name `SecretKey`, masked/write-only, required) → mitigates T-34-08.
  - `Bucket` (required) + `Region` (default `us-east-1`) as LTR inputs.
  - `UsePathStyle` switch (default checked) and `UseHttp` switch (default checked) for the http-only MinIO file-simulator endpoint → mitigates T-34-10 (Pitfall 4).
- All technical inputs carry `className="ltr-field"` per the CLAUDE.md RTL rule.
- The shared Host/Port block (`requiresHostPort` already includes `s3`) is reused for the endpoint, so the S3 section only adds the credential/bucket/region/switch fields.
- Added he/en i18n keys under `admin.servers.fields` (`accessKey`, `secretKey`, `bucket`, `region`, `usePathStyle`, `useHttp`) and `admin.servers.sections.s3`.
- Did NOT touch the datasource ConnectionTab (anti-pattern avoided).

**Task 2 — PascalCase TypeSpecificConfig packing + masked-secret edit:**
- `handleSubmit`: when `values.ServerType?.toLowerCase() === 's3'`, sets
  `requestData.TypeSpecificConfig = { AccessKey, SecretKey, Bucket, Region, ForcePathStyle: UsePathStyle ?? true, UseHttp: UseHttp ?? true }`
  with exact PascalCase keys per the 34-01 contract → mitigates T-34-09 (Pitfall 2: no camelCase drift).
- `useEffect` open-prefill: on editing an s3 server, flattens `server.TypeSpecificConfig` back onto the form (`AccessKey`/`Bucket`/`Region`/`UsePathStyle`←`ForcePathStyle`/`UseHttp`) and seeds `SecretKey` with the masked sentinel `"********"`. If the admin leaves the sentinel unchanged, it is posted back as-is and the backend 34-02 keep-existing logic retains the stored secret. A real secret is never echoed (the API never returns one).
- Added a frontend-local `MASKED_SECRET_SENTINEL` const ('********').

## Verification

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` (src/Frontend) after Task 1 | 0 errors |
| `npx tsc --noEmit` (src/Frontend) after Task 2 | 0 errors |

Field rendering + TypeSpecificConfig packing are additionally asserted by the Vitest unit test scheduled in plan 34-05.

## Deviations from Plan

None — plan executed as written.

Minor naming note (not a deviation): the form field for path-style is named `UsePathStyle` (per the plan's `<action>`), and it is mapped to the contract key `ForcePathStyle` at submit (also per the plan's `<action>`). Both the plan field name and the contract key are honored.

## Threat Model Coverage

- **T-34-08 (SecretKey shown in plaintext):** mitigated — `Input.Password` masks the field; edit pre-fills the masked sentinel, never a real secret.
- **T-34-09 (camelCase keys → empty creds):** mitigated — submit packs exact PascalCase keys matching the 34-01 contract.
- **T-34-10 (MinIO virtual-host addressing fails on raw IP):** mitigated — `ForcePathStyle`/`UseHttp` default to `true`.

## Known Stubs

None. All fields are wired to `TypeSpecificConfig` and to the create/update mutations; no placeholder/empty data paths introduced.

## Notes for Downstream Plans

- 34-05 Vitest unit test should assert: (a) the masked sentinel left unchanged is posted back verbatim, and (b) the submitted `TypeSpecificConfig` keys are exactly `AccessKey`/`SecretKey`/`Bucket`/`Region`/`ForcePathStyle`/`UseHttp`.
- The `useEffect` prefill relies on the API returning `TypeSpecificConfig` on the AdminServer GET with the SecretKey already masked (34-02). If a downstream change stops returning `TypeSpecificConfig`, the edit pre-fill of Access Key/Bucket/Region would go blank.

## Self-Check: PASSED

All modified files present; both task commits (75ac638, f9f735a) found in history.
