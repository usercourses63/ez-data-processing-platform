# OCP SecurityContext Compliance Test Suite

## Overview

Automated test suite for verifying OpenShift Container Platform (OCP) security compliance in Kubernetes manifests and Helm charts.

**Script:** `test-ocp-security-compliance.ps1`

**Purpose:** Ensures all Kubernetes manifests meet OCP security requirements including SecurityContext configurations, NetworkPolicies, and Routes.

---

## Features

✅ **Comprehensive Testing:**
- Deployment files SecurityContext (pod + container level)
- Infrastructure files SecurityContext (StatefulSets, DaemonSets)
- Pod-level SecurityContext validation
- Container-level SecurityContext validation
- OCP-specific resources (NetworkPolicies, Routes)
- Helm chart SecurityContext templates

✅ **CI/CD Integration:**
- Machine-readable output in CI mode
- Exit codes: 0 (pass), 1 (fail), 2 (error)
- JSON results export for reporting
- Fail-fast mode for quick feedback

✅ **Flexible Execution:**
- Verbose mode for detailed output
- Custom path specification
- Color-coded terminal output

---

## Exit Codes

| Code | Status | Description |
|------|--------|-------------|
| 0 | Success | All tests passed |
| 1 | Failure | One or more tests failed |
| 2 | Error | Critical error (missing directories, invalid parameters) |

---

## Usage

### Basic Usage (Current Directory)

```powershell
cd C:\Users\UserC\source\repos\EZ
.\scripts\test-ocp-security-compliance.ps1
```

### Test Specific Directory

```powershell
.\scripts\test-ocp-security-compliance.ps1 -Path "C:\repos\EZ\release-package"
```

### Verbose Mode (Detailed Output)

```powershell
.\scripts\test-ocp-security-compliance.ps1 -Verbose
```

### CI/CD Pipeline Mode

```powershell
.\scripts\test-ocp-security-compliance.ps1 -CIMode
```

**CI Mode Features:**
- No color codes (machine-readable)
- Structured output format
- Exports JSON results to `ocp-compliance-test-results.json`
- Strict exit codes for pipeline integration

### Fail Fast Mode

```powershell
.\scripts\test-ocp-security-compliance.ps1 -FailFast
```

Stops testing on first failure for quick feedback during development.

---

## Test Suites

### Suite 1: Deployment Files SecurityContext

Verifies all deployment YAML files in `k8s/deployments/` have:
- At least 2 SecurityContext entries (pod-level + container-level)
- Proper SecurityContext configuration

**Example Output:**
```
Test Suite 1: Deployment Files SecurityContext
══════════════════════════════════════════
[✓] Deployment: fileprocessor-deployment.yaml - Found 2 SecurityContext entries (minimum: 2)
[✓] Deployment: validation-deployment.yaml - Found 2 SecurityContext entries (minimum: 2)
```

### Suite 2: Infrastructure Files SecurityContext

Verifies all infrastructure YAML files in `k8s/infrastructure/` have:
- At least 2 SecurityContext entries
- Covers StatefulSets, DaemonSets, and infrastructure deployments

**Example Output:**
```
Test Suite 2: Infrastructure Files SecurityContext
══════════════════════════════════════════
[✓] Infrastructure: mongodb-statefulset.yaml - Found 2 SecurityContext entries (minimum: 2)
[✓] Infrastructure: kafka-statefulset.yaml - Found 2 SecurityContext entries (minimum: 2)
```

### Suite 3: Pod-Level SecurityContext Validation

Validates pod-level SecurityContext configuration:
- `runAsNonRoot: true`
- `runAsUser: 1000`
- `fsGroup: 1000`
- `seccompProfile.type: RuntimeDefault`

**Example Output:**
```
Test Suite 3: Pod-Level SecurityContext Validation
══════════════════════════════════════════
[✓] Pod-level context: fileprocessor-deployment.yaml - Pod SecurityContext configured
[✓] Pod-level context: mongodb-statefulset.yaml - Pod SecurityContext configured
```

### Suite 4: Container-Level SecurityContext Validation

Validates container-level SecurityContext configuration:
- `allowPrivilegeEscalation: false`
- `readOnlyRootFilesystem: true`
- `capabilities.drop: [ALL]`

**Example Output:**
```
Test Suite 4: Container-Level SecurityContext Validation
══════════════════════════════════════════
[✓] Container-level context: fileprocessor-deployment.yaml - Container SecurityContext configured
[✓] Container-level context: mongodb-statefulset.yaml - Container SecurityContext configured
```

### Suite 5: OCP-Specific Resources

Verifies OCP-specific files exist:
- `k8s/network-policies.yaml` - NetworkPolicies for pod-to-pod communication
- `k8s/ocp-routes.yaml` - OpenShift Routes (alternative to Ingress)

**Example Output:**
```
Test Suite 5: OCP-Specific Resources
══════════════════════════════════════════
[✓] NetworkPolicies file exists - Found at: network-policies.yaml
[✓] OCP Routes file exists - Found at: ocp-routes.yaml
```

### Suite 6: Helm Charts SecurityContext

Validates Helm chart templates (if `helm/` directory exists):
- `values.yaml` has SecurityContext defaults (pod + container)
- All deployment templates reference `.Values.securityContext`
- All statefulset templates reference `.Values.securityContext`

**Example Output:**
```
Test Suite 6: Helm Charts SecurityContext
══════════════════════════════════════════
[✓] Helm values.yaml SecurityContext defaults - SecurityContext defaults configured
[✓] Helm template: fileprocessor-deployment.yaml - Uses .Values.securityContext
[✓] Helm template: mongodb-statefulset.yaml - Uses .Values.securityContext
```

---

## Sample Output

### Standard Mode

```
══════════════════════════════════════════
  OCP SecurityContext Compliance Test Suite
══════════════════════════════════════════
Test Path: C:\Users\UserC\source\repos\EZ
Test Time: 2026-01-08 14:30:00

══════════════════════════════════════════
  Test Suite 1: Deployment Files SecurityContext
══════════════════════════════════════════
[✓] Deployment: fileprocessor-deployment.yaml - Found 2 SecurityContext entries (minimum: 2)
[✓] Deployment: validation-deployment.yaml - Found 2 SecurityContext entries (minimum: 2)
[✓] Deployment: output-deployment.yaml - Found 2 SecurityContext entries (minimum: 2)

══════════════════════════════════════════
  Test Summary
══════════════════════════════════════════

Total Tests:    45
Passed:         45
Failed:         0
Success Rate:   100%

✓ All tests passed!
```

### CI Mode

```
TEST_SUITE: OCP SecurityContext Compliance Test Suite
TEST: PASS | Deployment: fileprocessor-deployment.yaml | Found 2 SecurityContext entries (minimum: 2)
TEST: PASS | Deployment: validation-deployment.yaml | Found 2 SecurityContext entries (minimum: 2)
TEST: PASS | Infrastructure: mongodb-statefulset.yaml | Found 2 SecurityContext entries (minimum: 2)
TEST: PASS | NetworkPolicies file exists | Found at: network-policies.yaml
TEST: PASS | OCP Routes file exists | Found at: ocp-routes.yaml
SUMMARY: Total=45 | Passed=45 | Failed=0 | SuccessRate=100%
RESULTS_FILE: C:\Users\UserC\source\repos\EZ\scripts\ocp-compliance-test-results.json
STATUS: PASS
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: OCP Compliance Tests

on: [push, pull_request]

jobs:
  ocp-compliance:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run OCP Compliance Tests
        shell: pwsh
        run: |
          .\scripts\test-ocp-security-compliance.ps1 -CIMode

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: ocp-compliance-results
          path: scripts/ocp-compliance-test-results.json
```

### GitLab CI Example

```yaml
ocp-compliance:
  stage: test
  script:
    - pwsh scripts/test-ocp-security-compliance.ps1 -CIMode
  artifacts:
    reports:
      junit: scripts/ocp-compliance-test-results.json
    when: always
```

### Azure Pipelines Example

```yaml
- task: PowerShell@2
  displayName: 'OCP Compliance Tests'
  inputs:
    filePath: 'scripts/test-ocp-security-compliance.ps1'
    arguments: '-CIMode'
    pwsh: true

- task: PublishTestResults@2
  condition: always()
  inputs:
    testResultsFormat: 'JUnit'
    testResultsFiles: 'scripts/ocp-compliance-test-results.json'
```

---

## Interpreting Results

### Success (Exit Code 0)

All tests passed. The Kubernetes manifests are fully OCP-compliant.

**Action:** None required. Safe to deploy.

### Failure (Exit Code 1)

One or more tests failed. Review the output to identify missing SecurityContext configurations.

**Action:**
1. Review failed tests in output
2. Add missing SecurityContext to identified files
3. Re-run tests
4. Commit fixes

### Error (Exit Code 2)

Critical error occurred (missing directories, invalid parameters).

**Action:**
1. Verify directory structure exists (k8s/, k8s/deployments/, k8s/infrastructure/)
2. Check path parameter is correct
3. Review script error message

---

## Troubleshooting

### Issue: "k8s/ directory not found"

**Solution:**
```powershell
# Specify correct path
.\scripts\test-ocp-security-compliance.ps1 -Path "C:\path\to\project"
```

### Issue: "File not found" for specific deployments

**Solution:**
Ensure deployment files exist in `k8s/deployments/` or `k8s/infrastructure/`

### Issue: Tests fail for SecurityContext count

**Solution:**
Add both pod-level and container-level SecurityContext to deployment files:

```yaml
spec:
  template:
    spec:
      # Pod-level SecurityContext (1)
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: app
        # Container-level SecurityContext (2)
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
              - ALL
```

### Issue: Helm tests fail

**Solution:**
Ensure `helm/ez-platform/values.yaml` includes:

```yaml
securityContext:
  pod:
    runAsNonRoot: true
    runAsUser: 1000
  container:
    allowPrivilegeEscalation: false
    capabilities:
      drop:
        - ALL
```

And templates reference it:
```yaml
securityContext: {{ toYaml .Values.securityContext.pod | nindent 8 }}
```

---

## Maintenance

### Adding New Test Cases

Edit `test-ocp-security-compliance.ps1` and add new test suites:

```powershell
# Test Suite 7: Custom Validation
Write-TestHeader "Test Suite 7: Custom Validation"

# Your test logic here
Write-TestResult `
    -TestName "Your test name" `
    -Passed $result `
    -Message "Test message"
```

### Modifying Minimum Requirements

Change minimum SecurityContext count:

```powershell
# Default is 2 (pod + container level)
$result = Test-SecurityContextInFile -FilePath $file.FullName -MinimumContexts 3
```

---

## Related Scripts

- `verify-release-package-sync.ps1` - Synchronization verification between dev and release-package
- `start-port-forwards.ps1` - Port forwarding setup

---

## Support

For issues or questions:
1. Review this documentation
2. Check script output with `-Verbose` flag
3. Verify directory structure and file locations
4. Check GitHub issues: https://github.com/yourorg/ezplatform/issues

---

**Last Updated:** 2026-01-08
**Version:** 1.0.0
**Compatibility:** PowerShell 5.1+, PowerShell Core 7+
