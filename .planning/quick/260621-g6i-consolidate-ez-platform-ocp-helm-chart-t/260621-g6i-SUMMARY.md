---
phase: quick-260621-g6i
plan: 01
subsystem: release-package/helm/ez-platform-ocp
tags: [helm, openshift, scc, restricted-v2, values-consolidation, docsUrl]
requires: []
provides:
  - "ez-platform-ocp chart with exactly two values files (values.yaml + values-production.yaml)"
  - "restricted-v2-compliant pod securityContext (UID/GID assigned by SCC) across all app + infra workloads"
  - "frontend EZ_DOCS_URL wiring from services.frontend.config.docsUrl"
affects:
  - "OpenShift deployments of ez-platform-ocp"
tech-stack:
  added: []
  patterns:
    - "Guarded securityContext fields via {{- with .Values.securityContext.pod.<field> }} (emit only when explicitly set)"
    - "Single production overlay; Helm auto-loads base values.yaml first"
key-files:
  created: []
  modified:
    - release-package/helm/ez-platform-ocp/values.yaml
    - release-package/helm/ez-platform-ocp/values-production.yaml
    - release-package/helm/ez-platform-ocp/templates/deployments/frontend-deployment.yaml
    - "release-package/helm/ez-platform-ocp/templates/deployments/*-deployment.yaml (16 app/infra deployments)"
    - "release-package/helm/ez-platform-ocp/templates/statefulsets/{mongodb,kafka,hazelcast}-statefulset.yaml"
    - release-package/helm/ez-platform-ocp/README.md
    - release-package/helm/ez-platform-ocp/docs/UPGRADE.md
    - release-package/helm/ez-platform-ocp/docs/TESTING.md
    - release-package/helm/ez-platform-ocp/docs/OBSERVABILITY.md
  deleted:
    - release-package/helm/ez-platform-ocp/values-prod.yaml
    - release-package/helm/ez-platform-ocp/values-dev.yaml
decisions:
  - "readOnlyRootFilesystem=false (user-locked): nginx writes config.js into html dir, .NET writes DataProtection keys under /app"
  - "Unpin extended to mongodb/kafka/hazelcast statefulsets (same shared pattern; acceptance gate requires zero pins anywhere); rabbitmq hardcoded 999 left untouched"
metrics:
  duration: ~15m
  completed: 2026-06-21
---

# Quick 260621-g6i: Consolidate ez-platform-ocp Helm Chart + restricted-v2 SCC Fixes Summary

Collapsed the `ez-platform-ocp` chart to a single self-describing `values-production.yaml` (+ base `values.yaml`), refreshed all 10 app/docs image tags to `ocp-20260621`, made the pod securityContext OpenShift restricted-v2 compliant by unpinning UID/GID via `{{- with }}` guards across all 16 deployment templates **and** the 3 infra statefulsets, set `readOnlyRootFilesystem: false`, and wired the frontend `docsUrl` as `EZ_DOCS_URL`.

## What Was Done

### Task 1 — Consolidate to a single production values file (commit 94fe39f)
- Rewrote `values-production.yaml` as the sole production overlay: header usage comment, note that Helm auto-loads base `values.yaml` first, and the out-of-scope infra caveat (mongo/kafka/elasticsearch/rabbitmq may still need a more permissive SCC / operator install).
- `ocp.enabled: true`, `ocp.domain: apps.<your-cluster-domain>` placeholder.
- `services:` block sets `image.tag: ocp-20260621` for all 10 app/docs services (filediscovery, fileprocessor, validation, output, datasourceManagement, metricsConfiguration, invalidrecords, scheduling, frontend, docs) — all stale `v0.2.0` dropped.
- `services.frontend.config.docsUrl: "https://ezdocs.apps.<your-cluster-domain>"` placeholder with auto-detect note.
- `securityContext.container.readOnlyRootFilesystem: false` (only) with rationale comment; no pod UID/GID pins reintroduced.
- Merged production config (`environment: Production`, `logLevel: Information`, `fileDiscovery.deduplicationTTLHours: "4"`) plus all existing HA/observability/alert overrides.
- Base `values.yaml`: added `services.frontend.config.docsUrl: ""` with the non-OCP 3-line comment block.
- `frontend-deployment.yaml`: added `EZ_DOCS_URL` env mirroring the non-OCP chart (`| default "" | quote`) with the two explanatory comment lines.
- `git rm` of `values-prod.yaml` and `values-dev.yaml`.
- Repointed all dev/prod doc references to `values-production.yaml` (README, UPGRADE, TESTING, OBSERVABILITY); collapsed dev-vs-prod examples to single production / base usage.

### Task 2 — Unpin UID/GID for restricted-v2 SCC (commit a15e864)
- Replaced the `runAsUser/runAsGroup/fsGroup | default 1000` pins with `{{- with .Values.securityContext.pod.<field> }} ... {{- end }}` guards (emit only when explicitly set) across all 16 deployment templates.
- Extended the same unpin to the `mongodb`, `kafka` (×2 blocks: broker + zookeeper), and `hazelcast` statefulsets — see Deviation below.
- Base `values.yaml` `securityContext.pod`: removed the three UID/GID keys (replaced with an explanatory comment), kept `runAsNonRoot: true` + `seccompProfile.type: RuntimeDefault`. `docs-deployment.yaml`, `hooks/db-init-job.yaml`, and `tests/smoke-test.yaml` use `toYaml .Values.securityContext.pod` and render clean automatically.
- `rabbitmq-deployment.yaml` hardcoded `999` left untouched (infra, out of scope).

### Task 3 — Full render verification (pure gate, no commit)
All acceptance assertions passed against `helm template ez ./ez-platform-ocp -f values-production.yaml`:
- (a) Zero `runAsUser/runAsGroup/fsGroup: 1000` anywhere; the only `runAsUser:` line in the whole render is rabbitmq's retained `999`.
- (b) `readOnlyRootFilesystem: false` present (24 occurrences; `true` count = 0 under the production overlay).
- (c) `runAsNonRoot: true` retained (24 occurrences).
- (d) `ocp-20260621` image tags = 10.
- (e) Frontend renders `EZ_DOCS_URL` = `https://ezdocs.apps.<your-cluster-domain>`.
- Repo hygiene: `values-prod.yaml` / `values-dev.yaml` absent; no template or doc references them.
- `helm lint` clean; `helm template` exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan scope gap] Unpinned UID/GID in the 3 infra statefulsets**
- **Found during:** Task 2 verification.
- **Issue:** The plan's pre-discovered fact enumerated "16 deployment templates" with the `| default 1000` pins, but `mongodb-statefulset.yaml`, `kafka-statefulset.yaml` (2 blocks), and `hazelcast-statefulset.yaml` use the **identical** `.Values.securityContext.pod.*` shared pattern in `templates/statefulsets/`. After Task 2 nulled those keys in `values.yaml`, the statefulsets fell back to `| default 1000`, re-pinning UID/GID 1000 on 4 infra pods. Both the Task 2 and Task 3 acceptance scripts grep the entire render and require zero `1000` pins anywhere — and true restricted-v2 compliance (the stated objective) rejects any pinned UID/GID.
- **Fix:** Applied the same `{{- with }}` guard transformation to the 4 statefulset securityContext blocks. Kept rabbitmq's hardcoded `999` untouched per guardrails (it does not use the shared pattern).
- **Files modified:** `templates/statefulsets/{mongodb,kafka,hazelcast}-statefulset.yaml`.
- **Commit:** a15e864 (committed as part of Task 2).
- **Note:** The infra *images* themselves running on restricted-v2 may still need a more permissive SCC / operator install — that remains out of scope and is documented as a caveat comment in `values-production.yaml`.

## Self-Check: PASSED
- FOUND: release-package/helm/ez-platform-ocp/values-production.yaml
- FOUND: release-package/helm/ez-platform-ocp/values.yaml (docsUrl + unpinned securityContext)
- MISSING (intentional, git rm): values-prod.yaml, values-dev.yaml
- FOUND commit: 94fe39f (Task 1)
- FOUND commit: a15e864 (Task 2)
- helm lint exit 0; helm template exit 0; all 5 acceptance assertions + repo-hygiene checks pass.
