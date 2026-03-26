# Phase 30: OCP Compliance & Deployment Validation - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Production release gate for v0.5.0. Verify OCP security compliance (already implemented — needs automated verification), execute clean Helm deployment from scratch, expand sanity test suite with v0.5.0 feature tests, and validate full cross-service event pipeline end-to-end.

This phase does NOT build new features — it proves the existing v0.5.0 release is production-ready for OCP deployment.

</domain>

<decisions>
## Implementation Decisions

### D-01: Test Automation Architecture — Hybrid approach
- OCP infrastructure compliance checks: standalone kubectl-based script (bash/PowerShell)
- Feature sanity tests: Playwright test suite extension (SANITY-12 through SANITY-19)
- Each tool does what it's best at — kubectl for infra, Playwright for feature validation

### D-02: Clean Deploy Pipeline — Full wipe + Helm install
- Delete ez-platform namespace entirely
- Recreate namespace, helm install from `helm/ez-platform/values-dev.yaml`
- Seed data with DemoDataGenerator after fresh deploy
- Run full sanity suite against fresh install
- MongoDB data loss is expected and acceptable (validation scenario)

### D-03: Feature Sanity Tests — 8 new API-based tests
All new tests are API-based (no UI/Playwright tab interactions) for speed and reliability:

**Auto-revalidation (v0.5.0):**
- SANITY-12: Revalidate-all endpoint returns success with count
- SANITY-13: SchemaVersion increments on schema update
- SANITY-14: TTL field saves and persists via API

**Clone (v0.4.0):**
- SANITY-15: Clone datasource via API, verify copy created with name prefix
- SANITY-16: Clone preserves schema and output destinations

**Import from file (v0.4.0):**
- SANITY-17: Import CSV creates datasource with inferred schema
- SANITY-18: Import archive (ZIP) extracts and previews

**Completeness (v0.4.0):**
- SANITY-19: Completeness API returns correct percentage for incomplete datasource

### D-04: Cross-Service Event Flow — Deep pipeline validation
- Place a CSV file on file-simulator NAS source
- Trigger FileDiscovery via scheduling or manual poll
- Wait for full pipeline: FileDiscovery → FileProcessor → Validation → Output
- Verify output file/record exists at destination
- ~2-3 minutes execution time
- File-simulator available at `http://file-simulator.local:30080/`

### D-05: OCP Compliance Script Scope
Codebase scout found OCP compliance already implemented. Script verifies (not builds):
- Security contexts: runAsNonRoot, runAsUser, fsGroup, seccompProfile on all pods
- Container security: allowPrivilegeEscalation=false, capabilities drop ALL
- Non-privileged ports (>1024) on all services
- Network policies: default deny-all exists, explicit allow rules for each service
- Image tags: no :latest, all pinned to specific versions
- imagePullPolicy: IfNotPresent on all deployments
- Dockerfiles: non-root USER directive on all service images

### D-06: Known gap — InvalidRecordsService Dockerfile
Missing explicit USER directive (runs as root by default). Must be fixed in this phase.

### D-07: readOnlyRootFilesystem inconsistency
Set in Helm values.yaml globally but NOT in raw k8s deployment YAML templates. Script should verify at runtime (pod spec) not just file content.

### Claude's Discretion
- Script language (bash vs PowerShell vs both)
- Test execution order and parallelization within sanity suite
- Pipeline test timeout thresholds
- Whether to add the new tests to existing sanity.spec.ts or a new file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OCP Compliance
- `docs/OCP-COMPLIANCE-REPORT.md` — Last verified 2026-02-02, comprehensive audit results
- `CLAUDE.md` §OCP Compatibility Requirements — Security context, port, image requirements

### Kubernetes & Helm
- `k8s/network-policies.yaml` — 11 NetworkPolicy resources, default deny-all
- `helm/ez-platform/values.yaml` — Global security context (lines 9-31), OCP toggle
- `helm/ez-platform/values-dev.yaml` — Development environment overrides
- `k8s/deployments/` — All 15 deployment manifests with security contexts

### Dockerfiles (verify non-root USER)
- `src/Services/DataSourceManagementService/Dockerfile` — Has USER 1000:1000
- `src/Services/InvalidRecordsService/Dockerfile` — MISSING USER directive (D-06)
- `src/Frontend/Dockerfile` — Has USER nginx-user
- `release-package/docs-docusaurus/Dockerfile` — Has USER nginx-user

### Existing Tests
- `src/Frontend/tests/e2e/sanity.spec.ts` — 11 existing sanity tests (SANITY-01 through SANITY-11)
- `src/Frontend/playwright.config.ts` — Multi-project test config with sanity project

### Deploy & Seed
- `helm/ez-platform/` — Helm chart for deployment
- `tools/DemoDataGenerator/` — Seeding tool (use --direct-connection for localhost MongoDB)
- `scripts/start-port-forwards.ps1` — Port forwarding after deploy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `antTabClick()` helper in sanity.spec.ts — RTL tab click workaround for Playwright
- `antSelect()` helper in sanity.spec.ts — Ant Design select interaction helper
- `apiContext` pattern in sanity.spec.ts — Playwright APIRequestContext for API-level tests
- OCP compliance report template at `docs/OCP-COMPLIANCE-REPORT.md`
- Helm chart with OCP toggle at `helm/ez-platform/values.yaml`

### Established Patterns
- Sanity tests use PascalCase for API requests (backend expects PascalCase)
- Delete endpoint requires `?deletedBy=` query parameter
- API response format: `{ Data: { Items: [...] }, IsSuccess: true }` for lists
- File-simulator NAS devices pre-provisioned with nfs-input-data as primary input

### Integration Points
- New sanity tests extend `src/Frontend/tests/e2e/sanity.spec.ts`
- OCP script is standalone — new file in `scripts/` or `tools/`
- Pipeline test needs: file-simulator running, NAS devices provisioned, port-forwards active

</code_context>

<specifics>
## Specific Ideas

- OCP compliance script should be reusable for any future release validation
- Pipeline test should use the file-simulator's existing NAS input device (nfs-input-data)
- All new SANITY tests are API-only — no UI interaction — for speed and reliability
- Clean deploy should use the same Helm chart that production would use

</specifics>

<deferred>
## Deferred Ideas

- UI E2E tests for clone/import/completeness (Phase 31)
- Performance baselines and load testing (Phase 32)
- Backend unit test coverage expansion (future)
- Chaos engineering / pod failure recovery testing (future)

</deferred>

---

*Phase: 30-ocp-compliance-deployment-validation*
*Context gathered: 2026-03-26*
