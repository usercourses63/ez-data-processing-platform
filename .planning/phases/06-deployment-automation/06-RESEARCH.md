# Phase 6: Deployment Automation - Research

**Researched:** 2026-02-03
**Domain:** Helm packaging, OCP deployment, smoke tests, rollback procedures
**Confidence:** HIGH

## Summary

This phase implements deployment automation for the EZ Platform using Helm as the packaging and deployment mechanism. Research confirms that the project already has a well-structured Helm chart foundation (`helm/ez-platform/` and `release-package/helm/ez-platform-ocp/`) that needs enhancement for smoke testing, rollback procedures, and consolidated deployment workflow.

The key gaps to address are:
1. Helm test hooks for smoke testing (templates/tests/ directory is empty)
2. Chart versioning aligned with app versioning (currently 1.1.0 vs v0.1.1-rc3)
3. Documented rollback procedures with database state handling
4. Tarball export workflow for offline OCP deployment
5. Docusaurus documentation workflow integration

**Primary recommendation:** Extend existing Helm charts with test hooks, align versioning to v0.2.0, document pure Helm commands for deployment/rollback, and create tarball export scripts for air-gapped deployment.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Helm | 3.12+ | Chart packaging and deployment | Industry standard K8s package manager |
| kubectl | 1.28+ | Kubernetes CLI | Required for OCP/K8s operations |
| Docker | 24+ | Image tarball export | docker save/load for air-gapped deployments |
| oc | 4.12+ | OpenShift CLI | Required for OCP Routes and SCC management |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| helm-docs | 1.11+ | Auto-generate chart docs | Optional, for README generation |
| curl/wget | - | Health check probes | Smoke tests in test hooks |
| jq | 1.6+ | JSON processing | Parsing health endpoint responses |

### Existing Project Assets
| Asset | Location | Status |
|-------|----------|--------|
| Vanilla K8s Chart | `helm/ez-platform/` | Functional, needs test hooks |
| OCP Chart | `release-package/helm/ez-platform-ocp/` | Functional, has Routes |
| Image Export Script | `scripts/export-images-rc3.ps1` | Template for tarball export |
| Helm Test Script | `scripts/test-helm-charts.ps1` | Validates chart rendering |
| Install Script | `release-package/install.ps1` | Helm-based installation |

## Architecture Patterns

### Recommended Chart Structure
```
helm/ez-platform/
├── Chart.yaml                    # Chart metadata (version aligned to app)
├── values.yaml                   # Default values
├── values-dev.yaml               # Development overrides
├── values-prod.yaml              # Production overrides (OCP)
├── templates/
│   ├── _helpers.tpl              # Template helpers (exists)
│   ├── deployments/              # Service deployments (exists)
│   ├── statefulsets/             # MongoDB, Kafka, Hazelcast (exists)
│   ├── services/                 # Service definitions (exists)
│   ├── configmaps/               # Configuration (exists)
│   ├── network-policies/         # Zero-trust networking (exists)
│   ├── ingress/                  # K8s Ingress (exists)
│   ├── tests/                    # Helm test hooks (TO ADD)
│   │   └── smoke-test.yaml       # Health endpoint verification
│   └── hooks/                    # Pre/post install/upgrade hooks (TO ADD)
│       └── db-migration-job.yaml # Init container alternative
└── README.md                     # Chart documentation (exists)
```

### Pattern 1: Helm Test Hook for Smoke Testing
**What:** Pod that runs `helm test <release>` to verify deployment health
**When to use:** After every helm install/upgrade
**Example:**
```yaml
# Source: https://helm.sh/docs/topics/chart_tests/
apiVersion: v1
kind: Pod
metadata:
  name: {{ include "ez-platform.fullname" . }}-smoke-test
  annotations:
    "helm.sh/hook": test
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  containers:
  - name: curl
    image: curlimages/curl:8.5.0
    command:
    - /bin/sh
    - -c
    - |
      set -e
      # Test all backend services health endpoints
      for svc in datasource-management:5001 validation:5003 fileprocessor:5008 \
                 filediscovery:5007 scheduling:5004 output:5009 \
                 metrics-configuration:5002 invalidrecords:5006; do
        name=$(echo $svc | cut -d: -f1)
        port=$(echo $svc | cut -d: -f2)
        echo "Testing $name..."
        curl -sf http://$name:$port/health || exit 1
      done
      # Test frontend
      curl -sf http://frontend:8080/health || exit 1
      # Test docs
      curl -sf http://ezplatform-docs:8080/health || exit 1
      echo "All health checks passed!"
  restartPolicy: Never
```

### Pattern 2: Environment-Specific Values Files
**What:** Separate values files per environment with overrides
**When to use:** Multi-environment deployments (dev, staging, prod)
**Example:**
```bash
# Development
helm install dev-ez-platform ./helm/ez-platform \
  -n ez-platform-dev --create-namespace \
  -f values.yaml -f values-dev.yaml

# Production (OCP)
helm install prod-ez-platform ./release-package/helm/ez-platform-ocp \
  -n ez-platform --create-namespace \
  -f values.yaml -f values-prod.yaml
```

### Pattern 3: Database Migration via Pre-Upgrade Hook
**What:** Kubernetes Job with helm hook annotations runs before pods start
**When to use:** Schema migrations, index creation, data fixes
**Example:**
```yaml
# Source: https://itnext.io/database-migrations-on-kubernetes-using-helm-hooks-fb80c0d97805
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Release.Name }}-db-init
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-1"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  template:
    spec:
      containers:
      - name: mongo-init
        image: mongo:8.0
        command:
        - mongosh
        - --eval
        - |
          // Create indexes, ensure collections exist
          db = db.getSiblingDB('ezplatform');
          db.datasources.createIndex({ "name": 1 }, { unique: true });
          db.nasdevices.createIndex({ "name": 1 }, { unique: true });
      restartPolicy: Never
  backoffLimit: 3
```

### Pattern 4: Air-Gapped Tarball Export
**What:** Export all images to tar files for offline deployment
**When to use:** Disconnected/air-gapped OCP environments
**Example:**
```powershell
# Export service images
$images = @(
    "ez-platform/datasource-management:v0.2.0",
    "ez-platform/validation:v0.2.0",
    # ... all 10 services
)

foreach ($img in $images) {
    $safeName = $img -replace "[:/]", "-"
    docker save $img -o "images/$safeName.tar"
}

# On target (air-gapped):
for img in images/*.tar; do
    docker load -i "$img"
    # Tag and push to internal registry
done
```

### Anti-Patterns to Avoid
- **Wrapper scripts around Helm:** Decision was "pure Helm commands" - document commands, don't script them
- **Init containers for migrations:** Use Helm hooks (pre-install/pre-upgrade) instead - they run once, not per pod
- **Hardcoded image tags:** Use `{{ .Values.services.*.image.tag }}` from values files
- **Single values.yaml for all environments:** Use environment-specific overlays

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service health aggregation | Custom health checker script | Helm test hooks with curl | Built into Helm lifecycle |
| Version history tracking | Custom version database | `helm history <release>` | Helm tracks all revisions |
| Rollback mechanism | Custom undo scripts | `helm rollback <release> <revision>` | Atomic rollback with state |
| Chart linting | Manual YAML validation | `helm lint ./chart` | Catches issues pre-deploy |
| Template debugging | Print statements | `helm template --debug` | Shows rendered YAML |
| Namespace creation | Separate kubectl apply | `helm install --create-namespace` | Single command |

**Key insight:** Helm provides rollback, history, and testing capabilities out of the box. The phase should document proper usage rather than build custom automation.

## Common Pitfalls

### Pitfall 1: Version Mismatch Between Chart and App
**What goes wrong:** Chart.yaml version 1.1.0 but appVersion v0.1.1-rc3 causes confusion
**Why it happens:** Independent versioning seems flexible but creates tracking problems
**How to avoid:** Decision from CONTEXT.md: "Chart version tracks app version (v0.2.0 = chart version 0.2.0)"
**Warning signs:** `helm list` shows chart version different from deployed image tags

### Pitfall 2: Database State Not Considered in Rollback
**What goes wrong:** Helm rollback succeeds but app fails because schema/data is forward-only
**Why it happens:** Helm only rolls back K8s resources, not database state
**How to avoid:**
- Document that rollback may require manual DB intervention
- Use additive-only migrations (add columns, never remove)
- MongoDB is schema-less, but indexes/collections may need cleanup
**Warning signs:** App errors after rollback referencing missing/changed fields

### Pitfall 3: Smoke Test Timeouts
**What goes wrong:** `helm test` times out waiting for services
**Why it happens:** Services not ready, test runs too early, default timeouts too short
**How to avoid:**
- Add `--timeout` flag to `helm test` (default 5m0s)
- Use readiness probes on services before testing
- Add retry logic with sleep in test pod
**Warning signs:** Intermittent test failures, tests pass manually

### Pitfall 4: Air-Gap Image Registry Mismatch
**What goes wrong:** Helm values reference public registry but OCP uses internal
**Why it happens:** values.yaml has `docker.io` but OCP registry is `image-registry.openshift-image-registry.svc:5000`
**How to avoid:**
- Use `global.imageRegistry` value consistently
- Override in values-prod.yaml for OCP
- Document image re-tagging procedure
**Warning signs:** ImagePullBackOff errors on OCP

### Pitfall 5: OCP SCC Blocks Pods
**What goes wrong:** Pods fail with security context errors on OCP
**Why it happens:** restricted-v2 SCC requirements not met
**How to avoid:**
- All pods use runAsNonRoot: true (already configured)
- All containers use allowPrivilegeEscalation: false (already configured)
- Leave runAsUser empty for OCP to assign from range
**Warning signs:** "cannot set user ID" or "security context" in pod events

### Pitfall 6: Helm History Fills Up
**What goes wrong:** Too many revisions consume etcd storage
**Why it happens:** Default keeps 10 revisions, upgrades accumulate
**How to avoid:** Use `--history-max 3` on upgrade commands (per CONTEXT.md decision)
**Warning signs:** Slow helm operations, etcd storage warnings

## Code Examples

Verified patterns from official sources:

### Helm Install with Environment Values
```bash
# Source: https://helm.sh/docs/helm/helm_install/
# Development deployment
helm install dev-ez-platform ./helm/ez-platform \
  --namespace ez-platform-dev \
  --create-namespace \
  --values values.yaml \
  --values values-dev.yaml \
  --timeout 10m \
  --wait

# Production OCP deployment
helm install prod-ez-platform ./release-package/helm/ez-platform-ocp \
  --namespace ez-platform \
  --create-namespace \
  --values values.yaml \
  --values values-prod.yaml \
  --timeout 15m \
  --wait \
  --history-max 3
```

### Helm Upgrade with History Limit
```bash
# Source: https://helm.sh/docs/helm/helm_upgrade/
helm upgrade prod-ez-platform ./release-package/helm/ez-platform-ocp \
  --namespace ez-platform \
  --values values.yaml \
  --values values-prod.yaml \
  --timeout 15m \
  --wait \
  --history-max 3 \
  --atomic  # Auto-rollback on failure
```

### Helm Test Execution
```bash
# Source: https://helm.sh/docs/helm/helm_test/
# Run smoke tests after deployment
helm test prod-ez-platform \
  --namespace ez-platform \
  --timeout 5m \
  --logs  # Show test pod logs
```

### Helm Rollback
```bash
# Source: https://helm.sh/docs/helm/helm_rollback/
# View history first
helm history prod-ez-platform --namespace ez-platform

# Rollback to previous revision
helm rollback prod-ez-platform 1 \
  --namespace ez-platform \
  --timeout 10m \
  --wait
```

### Air-Gapped Image Load
```bash
# Source: https://kubernetes.io/blog/2023/10/12/bootstrap-an-air-gapped-cluster-with-kubeadm/
# Load images on air-gapped OCP node
for img in images/services/*.tar; do
  docker load -i "$img"
done

# Tag for internal registry (OCP)
docker tag ez-platform/frontend:v0.2.0 \
  image-registry.openshift-image-registry.svc:5000/ez-platform/frontend:v0.2.0

# Push to internal registry
docker push image-registry.openshift-image-registry.svc:5000/ez-platform/frontend:v0.2.0
```

### OCP Route Creation (Already in Chart)
```yaml
# Source: release-package/helm/ez-platform-ocp/templates/routes/
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: frontend
  namespace: {{ .Values.global.namespace }}
spec:
  to:
    kind: Service
    name: frontend
    weight: 100
  port:
    targetPort: 8080
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Helm 2 + Tiller | Helm 3 (no Tiller) | 2019 | Simpler security, no cluster-wide daemon |
| Custom deploy scripts | Pure Helm commands | Helm 3.x | Consistent, documented, portable |
| Ingress on OCP | Routes on OCP | Always | Routes are OCP-native, more features |
| Kubernetes SCC | OpenShift restricted-v2 | OCP 4.11 | Pod security standards alignment |
| Manual version injection | Chart.yaml + values.yaml | Standard | Single source of truth |

**Current best practice:**
- Umbrella chart with subcharts (infrastructure as optional dependencies)
- Environment-specific values files (values-{env}.yaml pattern)
- Helm test hooks for smoke testing
- `--atomic` flag for auto-rollback on upgrade failure
- `--history-max 3` for release cleanup

## Open Questions

Things that couldn't be fully resolved:

1. **Exact infrastructure subchart toggle behavior**
   - What we know: Can use `mongodb.enabled: false` in values
   - What's unclear: Whether external infra (cloud MongoDB) needs different ConfigMap values
   - Recommendation: Document both self-hosted and external infrastructure patterns in deployment guide

2. **OCP internal registry authentication**
   - What we know: Need to push images to internal registry
   - What's unclear: Exact steps vary by OCP cluster configuration
   - Recommendation: Provide generic steps, note that ops team may need to adapt

3. **Smoke test retry logic**
   - What we know: Services may take time to become healthy
   - What's unclear: Optimal retry count and interval
   - Recommendation: Start with 3 retries, 10-second intervals, adjust based on testing

4. **Docusaurus baseUrl for /docs path**
   - What we know: Docusaurus deployed at /docs path via Route
   - What's unclear: Whether Docusaurus config needs baseUrl adjustment
   - Recommendation: Research in plan 06-04, may need build-time config

## Sources

### Primary (HIGH confidence)
- Helm official documentation - [Chart Tests](https://helm.sh/docs/topics/chart_tests/), [Rollback](https://helm.sh/docs/helm/helm_rollback/)
- Existing project charts - `helm/ez-platform/`, `release-package/helm/ez-platform-ocp/`
- Existing project scripts - `scripts/export-images-rc3.ps1`, `scripts/test-helm-charts.ps1`

### Secondary (MEDIUM confidence)
- [Helm Subcharts and Global Values](https://helm.sh/docs/chart_template_guide/subcharts_and_globals/)
- [Kubernetes Ingress vs OpenShift Route](https://www.redhat.com/en/blog/kubernetes-ingress-vs-openshift-route)
- [Database migrations on Kubernetes using Helm hooks](https://itnext.io/database-migrations-on-kubernetes-using-helm-hooks-fb80c0d97805)
- [OpenShift restricted-v2 SCC](https://docs.redhat.com/en/documentation/openshift_container_platform/4.12/html/authentication_and_authorization/managing-pod-security-policies)
- [Air-Gap Install with kubeadm](https://kubernetes.io/blog/2023/10/12/bootstrap-an-air-gapped-cluster-with-kubeadm/)

### Tertiary (LOW confidence)
- Community blog posts on Helm best practices
- Stack Overflow discussions on air-gapped deployments

## Recommendations for Claude's Discretion Items

Based on research, recommendations for items marked as Claude's Discretion in CONTEXT.md:

| Item | Recommendation | Rationale |
|------|----------------|-----------|
| Values file organization | `values-{env}.yaml` pattern (values-dev.yaml, values-prod.yaml) | Industry standard, clean separation |
| Namespace creation | Chart creates via `--create-namespace` | Simplest, documented in Helm |
| Resource limits/requests | Already defined in existing values.yaml | Use existing OCP-compliant settings |
| Health probe config | Hardcoded in templates, timeouts in values | Balance between flexibility and simplicity |
| Service startup order | No initContainers needed | Services are resilient to dependency unavailability |
| Downtime tolerance | Zero downtime via RollingUpdate (already configured) | maxUnavailable: 0 ensures availability |
| Helm deployment timeout | 15 minutes | Allows infrastructure to fully start |
| Smoke test failure handling | Report-only (not auto-rollback) | Allow operator decision on next steps |
| Smoke test wait time | 60 seconds after install | Services need time after readiness |
| Smoke test output format | Console logs (--logs flag) | Simple, operator can review |
| Smoke test retry logic | 3 retries, 10-second intervals | Balance between patience and speed |
| Rollback trigger mechanism | Manual via `helm rollback` | Decision per CONTEXT.md |
| Database state handling | Document as manual intervention | Helm can't rollback DB state |
| Rollback documentation | Full runbook with common scenarios | Critical for production |
| Notification on rollback | Not in scope (CI/CD handles) | Phase focuses on Helm, not notification |
| Post-rollback verification | Re-run `helm test` | Validates rollback success |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on existing project patterns and official Helm docs
- Architecture: HIGH - Existing charts provide strong foundation
- Pitfalls: MEDIUM - Based on WebSearch and community patterns
- Code examples: HIGH - From official Helm documentation and existing project code

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - Helm is stable)
