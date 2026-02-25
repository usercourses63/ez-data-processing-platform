# Phase 6: Deployment Automation - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

One-command deployment to OCP with automated validation, rollback, and Docusaurus portal deployment. This phase delivers Helm packaging, deployment automation for offline OCP, post-deployment smoke tests, rollback procedures, and Docusaurus portal deployment with documentation workflow.

Requirements: CD-02, CD-04, CD-05, CD-06, CD-10, CD-11

</domain>

<decisions>
## Implementation Decisions

### Helm Chart Structure
- Single umbrella chart with all 10 services (9 backend/frontend + Docusaurus)
- Chart version tracks app version (v0.2.0 = chart version 0.2.0)
- Infrastructure (MongoDB, Kafka, Prometheus) as optional subcharts — enable/disable per environment
- Secrets managed via values file placeholders, replaced at deploy time
- OCP Routes instead of Kubernetes Ingress — OCP native approach

### Deployment Execution
- Pure Helm commands — no wrapper scripts, standard tooling with documented steps
- Tarball export for offline/air-gapped OCP — docker save images to tar, load on target
- Manual deployment trigger only — CI builds images, deployment is separate manual step
- Rolling update strategy — Kubernetes default, gradual replacement
- Init container for database migrations — migration runs before service starts
- Environment-prefixed release names — dev-ez-platform, prod-ez-platform
- Version tags for images — use v0.2.0 format (not commit SHA)

### Validation & Smoke Tests
- Health endpoints only — /health on each service, minimal fast verification
- Helm test hook for execution — helm test ez-platform, runs in cluster
- All services must be healthy for deployment success — strict all-or-nothing
- Services only (not infrastructure) — trust K8s health probes for MongoDB/Kafka

### Rollback Strategy
- 3 versions retained for rollback history
- Helm rollback command documented for manual trigger

### Claude's Discretion
- Values file organization (values-{env}.yaml pattern vs single with overrides)
- Namespace creation handling (chart creates vs pre-existing)
- Resource limits/requests in chart (OCP best practices)
- Health probe configuration (hardcoded vs configurable)
- Service startup order (initContainers if needed)
- Downtime tolerance during deployment
- Helm deployment timeout setting
- Smoke test failure handling (report-only vs auto-rollback)
- Smoke test wait time for service readiness
- Smoke test output format (console vs structured)
- Smoke test retry logic
- Rollback trigger mechanism
- Database state handling during rollback
- Rollback documentation depth
- Notification on rollback
- Post-rollback verification

</decisions>

<specifics>
## Specific Ideas

- OCP Routes are preferred over Ingress for OpenShift native deployment
- Tarball export enables fully offline deployment without registry access
- Environment-prefixed release names allow multiple deployments per cluster
- Init containers handle any MongoDB index or collection setup before services start

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-deployment-automation*
*Context gathered: 2026-02-02*
