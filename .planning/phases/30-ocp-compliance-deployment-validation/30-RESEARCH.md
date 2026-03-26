# Phase 30: OCP Compliance & Deployment Validation - Research

**Researched:** 2026-03-26
**Domain:** OpenShift Container Platform (OCP) restricted-v2 SCC compliance
**Confidence:** HIGH

## Summary

This research identifies the MUST-HAVE requirements for deploying Kubernetes workloads on OpenShift with the restricted-v2 Security Context Constraint (SCC). The restricted-v2 SCC is the default for all authenticated users in OCP 4.11+. Pods that violate these constraints are **rejected at admission** -- they never start.

The EZ Platform has already implemented most OCP compliance measures, but this research identified specific gaps in the raw k8s deployment manifests that a verification script must check: hardcoded `runAsUser` values (which may conflict with OCP's namespace-allocated UID ranges), missing `readOnlyRootFilesystem` on most deployments, `:latest` image tags on 2 deployments, and a missing USER directive in the InvalidRecordsService Dockerfile.

**Primary recommendation:** Build the OCP compliance verification script around the 7 hard requirements documented below. For OCP deployment, remove hardcoded `runAsUser`/`runAsGroup`/`fsGroup` from pod specs and let OCP inject namespace-allocated values. For Minikube validation (this phase), verify the fields exist and are non-root.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Hybrid test architecture -- kubectl-based script for OCP infra checks, Playwright for feature sanity
- D-02: Clean deploy pipeline -- full namespace wipe + Helm install from values-dev.yaml
- D-03: 8 new API-based sanity tests (SANITY-12 through SANITY-19)
- D-04: Cross-service event flow deep pipeline validation
- D-05: OCP compliance script verifies (not builds) -- security contexts, ports, network policies, image tags, Dockerfiles
- D-06: Known gap -- InvalidRecordsService Dockerfile missing USER directive, must be fixed
- D-07: readOnlyRootFilesystem inconsistency -- set in Helm but not raw k8s manifests, verify at runtime

### Claude's Discretion
- Script language (bash vs PowerShell vs both)
- Test execution order and parallelization within sanity suite
- Pipeline test timeout thresholds
- Whether to add new tests to existing sanity.spec.ts or a new file

### Deferred Ideas (OUT OF SCOPE)
- UI E2E tests for clone/import/completeness (Phase 31)
- Performance baselines and load testing (Phase 32)
- Backend unit test coverage expansion (future)
- Chaos engineering / pod failure recovery testing (future)
</user_constraints>

## OCP restricted-v2 SCC: Complete Definition (Authoritative Source)

**Source:** [OpenShift cluster-kube-apiserver-operator GitHub](https://github.com/openshift/cluster-kube-apiserver-operator/blob/d373b65cf454fd594b6affd202e5cedb48d88964/bindata/bootkube/scc-manifests/0000_20_kube-apiserver-operator_00_scc-restricted-v2.yaml) (HIGH confidence)

```yaml
allowHostDirVolumePlugin: false
allowHostIPC: false
allowHostNetwork: false
allowHostPID: false
allowHostPorts: false
allowPrivilegeEscalation: false
allowPrivilegedContainer: false
allowedCapabilities:
- NET_BIND_SERVICE
apiVersion: security.openshift.io/v1
defaultAddCapabilities: null
fsGroup:
  type: MustRunAs
kind: SecurityContextConstraints
metadata:
  name: restricted-v2
priority: null
readOnlyRootFilesystem: false
requiredDropCapabilities:
- ALL
runAsUser:
  type: MustRunAsRange
seLinuxContext:
  type: MustRunAs
seccompProfiles:
- runtime/default
supplementalGroups:
  type: RunAsAny
volumes:
- configMap
- downwardAPI
- emptyDir
- persistentVolumeClaim
- projected
- secret
```

## MUST-HAVE Requirements (Will Break Deployment If Missing)

### REQ-1: allowPrivilegeEscalation MUST be false
**Confidence:** HIGH
**What:** Every container MUST have `securityContext.allowPrivilegeEscalation: false`
**Failure mode:** Pod admission rejected with `unable to validate against any security context constraint`
**Verification:**
```bash
kubectl get pods -n ez-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .spec.containers[*]}{.securityContext.allowPrivilegeEscalation}{"\n"}{end}{end}'
# All values must be "false"
```
**EZ Platform status:** All 10 k8s deployment files set this correctly.

### REQ-2: capabilities MUST drop ALL
**Confidence:** HIGH
**What:** Every container MUST have `securityContext.capabilities.drop: ["ALL"]`. The only capability that MAY be added back is `NET_BIND_SERVICE`.
**Failure mode:** Pod admission rejected. The restricted-v2 SCC has `requiredDropCapabilities: [ALL]`.
**Verification:**
```bash
kubectl get pods -n ez-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .spec.containers[*]}{.securityContext.capabilities.drop}{"\n"}{end}{end}'
# All must include "ALL"
```
**EZ Platform status:** All 10 k8s deployment files set this correctly.

### REQ-3: seccompProfile MUST be runtime/default (or omitted)
**Confidence:** HIGH
**What:** Pod or container `seccompProfile` must be either omitted (OCP injects `runtime/default`) or explicitly set to `type: RuntimeDefault`.
**Failure mode:** Pod admission rejected if an unsupported seccomp profile is specified.
**Verification:**
```bash
kubectl get pods -n ez-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext.seccompProfile.type}{"\n"}{end}'
# Must be "RuntimeDefault" or empty
```
**EZ Platform status:** All k8s deployment files set `seccompProfile.type: RuntimeDefault`. Compliant.

### REQ-4: runAsUser -- MustRunAsRange (CRITICAL NUANCE)
**Confidence:** HIGH
**What:** The restricted-v2 SCC uses `runAsUser.type: MustRunAsRange`. On OCP, each namespace gets a pre-allocated UID range via the annotation `openshift.io/sa.scc.uid-range` (e.g., `1000660000/10000`). If `runAsUser` is specified in the pod spec, it MUST fall within that range. If omitted, OCP auto-injects a valid UID from the range.
**Failure mode:** Pod admission rejected with `runAsUser: Invalid value: <uid>: must be in the ranges: [<range>]`

**CRITICAL for EZ Platform:** All 14 k8s deployment files hardcode `runAsUser: 1000` or `runAsUser: 1001`. These UIDs will NOT be in OCP's namespace-allocated range (typically 1000000000+). This is the #1 blocker for real OCP deployment.

**Resolution strategy (two-tier):**
1. **For this phase (Minikube validation):** Verify `runAsNonRoot: true` and `runAsUser > 0` -- sufficient for non-OCP K8s.
2. **For real OCP deployment:** Remove hardcoded `runAsUser`, `runAsGroup`, `fsGroup` from pod specs. Let OCP inject namespace-allocated values. The Helm chart should support this via `ocp.enabled: true` toggling these fields off.

**Verification (Minikube):**
```bash
kubectl get pods -n ez-platform -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext.runAsNonRoot}{"\t"}{.spec.securityContext.runAsUser}{"\n"}{end}'
# runAsNonRoot=true, runAsUser > 0
```

### REQ-5: Volumes -- only 6 types allowed
**Confidence:** HIGH
**What:** restricted-v2 allows ONLY: `configMap`, `downwardAPI`, `emptyDir`, `persistentVolumeClaim`, `projected`, `secret`. Any other volume type (hostPath, nfs, cephfs, etc.) causes pod rejection.
**Failure mode:** Pod admission rejected with `<volumeType> volumes are not allowed to be used`

**EZ Platform status:**
- `fluent-bit.yaml` uses `hostPath` volumes -- **WILL FAIL** on OCP with restricted-v2. Fluent Bit needs a different SCC (e.g., `privileged` or custom) since it must read node-level container logs.
- All application service deployments use only `configMap`, `emptyDir`, `persistentVolumeClaim`, `secret` -- compliant.
- `nfs-pv-dev.yaml` has a commented-out hostPath PV alternative -- no impact (PVs are cluster-scoped, not subject to SCC).

**Verification:**
```bash
# Check for disallowed volume types in running pods
kubectl get pods -n ez-platform -o json | jq -r '.items[].spec.volumes[]?.hostPath // empty'
# Should return nothing for application pods
```

### REQ-6: Non-privileged ports (>1024)
**Confidence:** HIGH
**What:** With `allowHostPorts: false` and running as non-root, containers cannot bind to ports <= 1024.
**Failure mode:** Container crashes at startup with `bind: permission denied` (not an admission error -- a runtime error).

**EZ Platform status:**
- All application services use ports 5001-5009, 8080 -- all > 1024. Compliant.
- RabbitMQ uses 5672, 15672, 15692 -- all > 1024. Compliant.
- Fluent Bit uses 2020 -- > 1024. Compliant.
- All ports verified compliant.

### REQ-7: runAsNonRoot MUST be true (or USER in Dockerfile)
**Confidence:** HIGH
**What:** Containers must not run as root. Either set `runAsNonRoot: true` in the pod spec, or ensure the Dockerfile has a `USER` directive with a non-root UID. If `runAsNonRoot: true` is set but the image defaults to root, the pod fails.
**Failure mode:** Pod rejected with `container has runAsNonRoot and image will run as root`

**EZ Platform status:**
- All k8s deployments set `runAsNonRoot: true` at pod level.
- **GAP: InvalidRecordsService Dockerfile** has NO `USER` directive -- image defaults to root. Combined with `runAsNonRoot: true` in the deployment, this will cause pod rejection. **This is the known D-06 gap.**
- DataSourceManagementService Dockerfile: `USER 1000:1000` -- compliant.
- FileDiscoveryService Dockerfile: `USER 1000:1000` -- compliant.
- Frontend Dockerfile: `USER nginx-user` (UID 1001) -- compliant.

## Additional Compliance Checks (Not SCC, but OCP best practices enforced in D-05)

### Image Tags -- No :latest
**What:** `:latest` tags are a deployment anti-pattern. OCP image streams may reject or warn.
**EZ Platform status:**
- `frontend-deployment.yaml`: `ez-platform/frontend:latest` -- **VIOLATION**
- `otel-collector.yaml`: `otel/opentelemetry-collector-contrib:latest` -- **VIOLATION**
- All other deployments use pinned tags (v0.1.1-rc3, v0.3.0-fileops11, etc.) -- compliant.

### imagePullPolicy -- IfNotPresent
**What:** `:latest` tags default to `Always` pull policy. In air-gapped OCP, this will fail.
**EZ Platform status:** All deployments set `imagePullPolicy: IfNotPresent`. Compliant (but `:latest` tags undermine this).

### Network Policies -- Default deny
**What:** Not an OCP hard requirement, but D-05 requires verification.
**EZ Platform status:** `k8s/network-policies.yaml` has `default-deny-ingress` policy + 11 explicit allow rules. Compliant.

### readOnlyRootFilesystem
**What:** NOT required by restricted-v2 SCC (`readOnlyRootFilesystem: false` in the SCC definition). However, the project's own CLAUDE.md and Helm values.yaml mandate it as a project requirement.
**EZ Platform status:**
- Helm `values.yaml`: `readOnlyRootFilesystem: true` -- set globally.
- Raw k8s deployments: Only `docs-deployment.yaml` sets it. The other 9 app deployments do NOT set it.
- **This is the D-07 gap.** The compliance script should verify at runtime (pod spec), not just file content. When deployed via Helm, it will be set. When deployed via raw k8s manifests, it will NOT be set for most services.
- **Impact:** Not an OCP admission blocker, but a project-level requirement.

## Gap Summary for Verification Script

| # | Gap | Severity | Blocker? | Action |
|---|-----|----------|----------|--------|
| 1 | InvalidRecordsService Dockerfile missing USER | CRITICAL | Yes (pod won't start) | Add `USER 1000:1000` to Dockerfile |
| 2 | frontend-deployment.yaml uses `:latest` tag | HIGH | No (admission OK, but bad practice) | Pin to specific version |
| 3 | otel-collector.yaml uses `:latest` tag | HIGH | No (admission OK, but bad practice) | Pin to specific version |
| 4 | Hardcoded runAsUser:1000/1001 in all deployments | CRITICAL (on real OCP) | Yes on OCP, No on Minikube | Remove for OCP, keep for Minikube |
| 5 | readOnlyRootFilesystem missing from raw k8s deployments | MEDIUM | No (not SCC requirement) | Verify via Helm deploy instead |
| 6 | fluent-bit uses hostPath volumes | HIGH (on real OCP) | Yes on OCP | Needs custom SCC or different approach |

## Architecture Patterns

### OCP Compliance Verification Script Structure
```
scripts/verify-ocp-compliance.sh
├── check_security_contexts()      # REQ-1,2,3,4,7
├── check_ports()                  # REQ-6
├── check_volumes()                # REQ-5
├── check_image_tags()             # No :latest
├── check_image_pull_policy()      # IfNotPresent
├── check_network_policies()       # Default deny exists
├── check_dockerfiles()            # USER directive present
└── generate_report()              # Summary with PASS/FAIL
```

### Verification Approach (D-07 resolution)
The script should check **running pods** (not just YAML files) for security context fields. This correctly handles the Helm template injection that raw YAML inspection would miss:
```bash
# Check actual pod spec (works for both Helm and raw manifests)
kubectl get pods -n ez-platform -o json | jq '.items[] | {
  name: .metadata.name,
  runAsNonRoot: .spec.securityContext.runAsNonRoot,
  runAsUser: .spec.securityContext.runAsUser,
  containers: [.spec.containers[] | {
    name: .name,
    allowPrivilegeEscalation: .securityContext.allowPrivilegeEscalation,
    dropAll: (.securityContext.capabilities.drop // [] | contains(["ALL"])),
    readOnlyRootFilesystem: .securityContext.readOnlyRootFilesystem
  }]
}'
```

## Common Pitfalls

### Pitfall 1: Hardcoded UIDs rejected on OCP
**What goes wrong:** Pod spec sets `runAsUser: 1000` but OCP namespace requires UID in range `1000660000-1000669999`.
**Why it happens:** Works fine on vanilla K8s/Minikube but OCP enforces `MustRunAsRange` against namespace annotations.
**How to avoid:** For OCP, omit `runAsUser`/`runAsGroup`/`fsGroup` and let OCP inject valid values. For dual-use, make these conditional on `ocp.enabled` in Helm.
**Warning signs:** `unable to validate against any security context constraint` in pod events.

### Pitfall 2: Dockerfile USER vs Pod securityContext conflict
**What goes wrong:** Deployment sets `runAsNonRoot: true` but Dockerfile has no USER (defaults to root). Pod is rejected.
**Why it happens:** The aspnet base image runs as root by default. Without explicit USER directive, runAsNonRoot check fails.
**How to avoid:** Every service Dockerfile MUST have `USER <non-root-uid>` before ENTRYPOINT.
**Warning signs:** `container has runAsNonRoot and image will run as root` error.

### Pitfall 3: readOnlyRootFilesystem without emptyDir volumes
**What goes wrong:** App crashes because it cannot write to /tmp, /var/log, or other directories.
**Why it happens:** .NET apps write to /tmp for temp files, ASP.NET may need writable directories.
**How to avoid:** When enabling readOnlyRootFilesystem, add emptyDir volumes for /tmp and any other writable paths.
**Warning signs:** `Read-only file system` errors in container logs.

### Pitfall 4: fluent-bit hostPath volumes on OCP
**What goes wrong:** Fluent Bit DaemonSet uses hostPath to read /var/log/containers -- rejected by restricted-v2.
**Why it happens:** Log collection inherently needs host filesystem access.
**How to avoid:** On OCP, Fluent Bit needs a custom SCC granting hostPath access, or use OCP's built-in log forwarding (ClusterLogForwarder).
**Warning signs:** `hostPath volumes are not allowed` in pod events.

## Route vs Ingress on OCP

**When MUST you use Routes instead of Ingress?**
- OCP supports both Ingress and Routes. Ingress objects are automatically translated to Routes by the OCP Ingress controller.
- Routes are NOT strictly mandatory -- Ingress works. But Routes provide OCP-native features (TLS re-encrypt, edge termination, etc.).
- The project already has Route templates in `release-package/helm/ez-platform-ocp/templates/routes/` gated behind `ocp.enabled: true`.
- **For this phase (Minikube validation):** Ingress is fine. Routes are only needed on actual OCP clusters.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SCC compliance checking | Custom YAML parser | `kubectl get pods -o json` + jq | Runtime pod spec is the source of truth after Helm templating |
| UID range validation | Manual UID checks | OCP admission controller | It enforces MustRunAsRange automatically |
| Network policy testing | Custom TCP probes | `kubectl get networkpolicies` + verify rules exist | Policy existence is what we verify, not enforcement |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| kubectl | OCP compliance script | TBD (check at runtime) | -- | Required, no fallback |
| jq | JSON parsing in script | TBD (check at runtime) | -- | Use kubectl jsonpath instead |
| bash | Script execution | Yes (Git Bash on Windows) | -- | PowerShell alternative |
| Helm | Clean deploy (D-02) | TBD (check at runtime) | -- | Required, no fallback |
| Minikube | K8s cluster | Yes | -- | -- |

## Sources

### Primary (HIGH confidence)
- [OpenShift restricted-v2 SCC source YAML](https://github.com/openshift/cluster-kube-apiserver-operator/blob/d373b65cf454fd594b6affd202e5cedb48d88964/bindata/bootkube/scc-manifests/0000_20_kube-apiserver-operator_00_scc-restricted-v2.yaml) - Authoritative SCC definition from OpenShift source code
- [Red Hat blog: Important OpenShift changes to Pod Security Standards](https://connect.redhat.com/en/blog/important-openshift-changes-pod-security-standards) - v2 vs v1 differences
- [OCP Pod Security Standards discussion](https://github.com/redhat-openshift-ecosystem/community-operators-prod/discussions/1417) - Detailed restricted-v2 behavior
- Project files: `docs/OCP-COMPLIANCE-REPORT.md`, `k8s/deployments/*.yaml`, `helm/ez-platform/values.yaml`

### Secondary (MEDIUM confidence)
- [Andreas Karis SCC blog](https://andreaskaris.github.io/blog/openshift/scc/) - SCC matching mechanics (OCP 3.11 focused but mechanics still apply)
- [OpenShift Cookbook: Run as set user ID](https://cookbook.openshift.org/users-and-role-based-access-control/how-can-i-enable-an-image-to-run-as-a-set-user-id.html) - UID range behavior

## Metadata

**Confidence breakdown:**
- SCC requirements: HIGH - verified against OpenShift source code YAML
- Gap identification: HIGH - verified by grepping actual project files
- UID range behavior: HIGH - confirmed by multiple authoritative sources
- readOnlyRootFilesystem: HIGH - confirmed NOT required by restricted-v2 SCC definition (`readOnlyRootFilesystem: false`)

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (OCP SCC definitions are stable across minor versions)
