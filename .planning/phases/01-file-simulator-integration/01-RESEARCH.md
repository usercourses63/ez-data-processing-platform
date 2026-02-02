# Phase 1: File-Simulator Integration - Research

**Researched:** 2026-02-02
**Domain:** Cross-Cluster Kubernetes Communication, File Protocol Testing, Minikube Multi-Profile Networking
**Confidence:** HIGH

## Summary

This research investigates how to integrate the file-simulator-suite (running in a separate Minikube profile) as the authoritative test environment for EZ Platform's file I/O operations. The file-simulator provides FTP, SFTP, S3/MinIO, SMB, NFS, and HTTP/WebDAV protocol servers that can replace local/mock sources for comprehensive E2E testing.

The key challenge is **cross-cluster communication**: EZ Platform runs in the `minikube` profile (Docker driver), while file-simulator runs in the `file-simulator` profile (Hyper-V driver). These are separate Kubernetes clusters that cannot directly route pod-to-pod traffic. The solution is to use **NodePort services** exposed on the Minikube VM IP, which both clusters can reach via host networking.

**Primary recommendation:** Configure EZ Platform ConfigMaps to point to file-simulator NodePort endpoints using the file-simulator Minikube IP. All 6 existing E2E tests should pass without code changes, only configuration updates.

## Standard Stack

The established libraries/tools for this integration:

### Core (Already in EZ Platform)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FluentFTP | 50.0.1 | FTP client | Already used in `FtpConnector.cs`, production-ready |
| SSH.NET | 2024.1.0 | SFTP client | Already used in `SftpConnector.cs`, mature library |
| AWSSDK.S3 | 3.7.305 | S3/MinIO client | Already used in `S3Connector.cs`, works with MinIO |
| SMBLibrary | 1.5.2 | SMB client | Available in file-simulator, may need addition to EZ |
| Playwright | 1.40+ | E2E testing | Already used for frontend E2E tests |

### File-Simulator Infrastructure

| Component | Version | Purpose | Connection Method |
|-----------|---------|---------|-------------------|
| FTP Server (vsftpd) | latest | FTP protocol | NodePort 30021 |
| SFTP Server (OpenSSH) | latest | SFTP protocol | NodePort 30022 |
| MinIO | latest | S3-compatible storage | NodePort 30900 (API), 30901 (Console) |
| Nginx + WebDAV | latest | HTTP/WebDAV | NodePort 30088/30089 |
| Samba | latest | SMB protocol | Port 445 via LoadBalancer + tunnel |
| unfs3 | latest | NFS protocol | NodePort 32149 (legacy), 32150-32156 (multi-NAS) |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| kubectl | 1.28+ | Cluster management | Applying ConfigMaps, verifying pods |
| Helm | 3.x | File-simulator deployment | Deploying/upgrading file-simulator |
| PowerShell | 7.x | Test scripts | Cross-platform test automation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| NodePort | MetalLB LoadBalancer | Requires additional MetalLB addon setup, more complex routing |
| Separate profiles | Single profile with namespaces | Loses driver-specific benefits (Hyper-V for SMB), resource isolation |
| file-simulator NFS | Local mock files | Loses protocol fidelity, doesn't test real network I/O |

## Architecture Patterns

### Recommended Integration Structure

```
Cross-Cluster Communication Pattern:

Windows Host (10.x.x.x)
├── minikube (Docker driver) - EZ Platform
│   └── Namespace: ez-platform
│       ├── FileDiscoveryService
│       ├── FileProcessorService
│       ├── ValidationService
│       └── OutputService
│           └── Connects to: file-simulator IP:NodePort
│
├── file-simulator (Hyper-V driver) - Protocol Servers
│   └── Namespace: file-simulator
│       ├── FTP Server (30021)
│       ├── SFTP Server (30022)
│       ├── S3/MinIO (30900)
│       ├── HTTP/WebDAV (30088/30089)
│       ├── SMB (445 via tunnel)
│       └── NFS (32149-32156)
│
└── Shared: Windows filesystem (C:\simulator-data)
```

### Pattern 1: ConfigMap-Based Service Discovery

**What:** Store file-simulator endpoints in EZ Platform ConfigMap, read at runtime
**When to use:** Development and testing environments
**Example:**
```yaml
# Source: EZ Platform k8s/configmaps/file-simulator-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: file-simulator-config
  namespace: ez-platform
data:
  # FTP Configuration
  FileAccess__Ftp__Host: "172.25.201.3"  # file-simulator Minikube IP
  FileAccess__Ftp__Port: "30021"
  FileAccess__Ftp__Username: "ftpuser"
  FileAccess__Ftp__Password: "ftppass123"

  # SFTP Configuration
  FileAccess__Sftp__Host: "172.25.201.3"
  FileAccess__Sftp__Port: "30022"
  FileAccess__Sftp__Username: "sftpuser"
  FileAccess__Sftp__Password: "sftppass123"

  # S3/MinIO Configuration
  FileAccess__S3__Endpoint: "http://172.25.201.3:30900"
  FileAccess__S3__AccessKey: "minioadmin"
  FileAccess__S3__SecretKey: "minioadmin123"
```

### Pattern 2: Cross-Cluster Network Access

**What:** Use NodePort + Minikube IP for cross-cluster service access
**When to use:** Two Minikube profiles need to communicate
**Example:**
```powershell
# Get file-simulator cluster IP (run once, update ConfigMap)
$SIMULATOR_IP = minikube ip -p file-simulator
# Result: 172.25.201.3 (example, varies by setup)

# Update EZ Platform ConfigMap with this IP
kubectl --context=minikube apply -f k8s/configmaps/file-simulator-config.yaml -n ez-platform
```

### Pattern 3: E2E Test Data Setup via File-Simulator

**What:** Place test files in file-simulator storage, EZ Platform reads via protocol connectors
**When to use:** All E2E tests requiring file I/O
**Example:**
```powershell
# Windows: Create test file in shared storage
"test,data,row" | Out-File -FilePath C:\simulator-data\nas-input-1\test.csv -Encoding UTF8

# Restart NAS pod to sync Windows -> NFS
kubectl --context=file-simulator delete pod -n file-simulator -l nas-server=nas-input-1

# EZ Platform can now read via:
# - NFS mount: /mnt/input-1/test.csv
# - FTP: ftp://ftpuser@172.25.201.3:30021/output/test.csv
# - SFTP: sftp://sftpuser@172.25.201.3:30022/data/output/test.csv
```

### Anti-Patterns to Avoid

- **Hardcoding IPs in source code:** Use ConfigMaps/environment variables
- **Using kubectl config use-context:** Always use explicit --context flag to prevent accidental cross-cluster operations
- **Assuming pod-to-pod routing:** Separate Minikube profiles cannot route directly; use NodePort or LoadBalancer
- **Skipping SMB tunnel:** SMB requires standard port 445; NodePort 30445 breaks SMBLibrary

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Protocol client libraries | Custom FTP/SFTP/S3 implementations | FluentFTP, SSH.NET, AWSSDK.S3 | Edge cases, retries, connection pooling already handled |
| NFS Windows-to-K8s sync | Manual file copy scripts | file-simulator init container + sidecar | Handles sync timing, deletion propagation |
| Cross-cluster service discovery | Custom DNS/routing | NodePort + Minikube IP | Standard K8s pattern, no custom networking |
| Test file management | Manual file placement | C:\simulator-data\ + pod restart | file-simulator handles sync automatically |
| S3 bucket creation | kubectl exec into MinIO | mc CLI in MinIO pod | Built-in management tool |

**Key insight:** The file-simulator-suite has already solved Windows-to-Kubernetes file synchronization with init containers and sidecars. Don't replicate this logic in EZ Platform; simply configure endpoints.

## Common Pitfalls

### Pitfall 1: Minikube IP Changes

**What goes wrong:** file-simulator IP changes after `minikube stop/start`, breaking EZ Platform connections
**Why it happens:** Minikube assigns IP dynamically per session
**How to avoid:**
1. Re-run `minikube ip -p file-simulator` after cluster restart
2. Update ConfigMap with new IP
3. Restart affected EZ Platform pods to pick up new config
**Warning signs:** Connection timeout errors in FileDiscovery/FileProcessor logs

### Pitfall 2: SMB Port 445 Requirement

**What goes wrong:** SMB connections fail with "connection refused" or "bad network name"
**Why it happens:** SMBLibrary requires standard port 445, not NodePort 30445
**How to avoid:**
1. Run `minikube tunnel -p file-simulator` in separate terminal
2. Use LoadBalancer IP for SMB, not NodePort
3. Add route from minikube profile to file-simulator LoadBalancer network
**Warning signs:** FTP/SFTP work but SMB fails

### Pitfall 3: NFS Sync Timing

**What goes wrong:** Test files placed on Windows not visible in NFS mount
**Why it happens:** Init container only syncs at pod start; continuous sync requires pod restart
**How to avoid:**
1. Place test files BEFORE starting tests
2. Restart NAS pod after adding new test files
3. For output servers, wait 15-30s for sidecar sync (NFS->Windows)
**Warning signs:** Empty directory listings, "file not found" errors

### Pitfall 4: Context Confusion

**What goes wrong:** kubectl commands accidentally run against wrong cluster
**Why it happens:** Forgetting --context flag when two profiles active
**How to avoid:**
1. ALWAYS use `kubectl --context=minikube` or `kubectl --context=file-simulator`
2. NEVER use `kubectl config use-context`
3. Set PS1/bash prompt to show current context
**Warning signs:** Pods/services not found, unexpected namespace errors

### Pitfall 5: E2E Test Data Isolation

**What goes wrong:** Tests interfere with each other via shared test files
**Why it happens:** All tests read from same file-simulator storage
**How to avoid:**
1. Use unique file names per test (include timestamp/UUID)
2. Clean up test files after test completion
3. Use separate directories for each test suite
**Warning signs:** Flaky tests, unexpected file contents, test order dependencies

## Code Examples

Verified patterns from official sources and existing EZ Platform code:

### Connector Configuration (Existing Pattern)

```csharp
// Source: c:\Users\UserC\source\repos\EZ\src\Services\Shared\Connectors\FtpConnector.cs
// Lines 145-168

private async Task<AsyncFtpClient> CreateFtpClientAsync(
    DataProcessingDataSource dataSource,
    CancellationToken cancellationToken)
{
    var config = GetFtpConfig(dataSource);

    var client = new AsyncFtpClient(
        config.Server,    // From ConfigMap: FileAccess__Ftp__Host
        config.Username,  // From ConfigMap: FileAccess__Ftp__Username
        config.Password,  // From ConfigMap: FileAccess__Ftp__Password
        config.Port);     // From ConfigMap: FileAccess__Ftp__Port

    client.Config.DataConnectionType = config.UsePassiveMode
        ? FtpDataConnectionType.AutoPassive
        : FtpDataConnectionType.AutoActive;

    await client.Connect(cancellationToken);
    return client;
}
```

### S3/MinIO Configuration (Existing Pattern)

```csharp
// Source: c:\Users\UserC\source\repos\EZ\src\Services\Shared\Connectors\S3Connector.cs
// Lines 406-441

private IAmazonS3 CreateS3Client(S3Config config)
{
    var clientConfig = new AmazonS3Config
    {
        RegionEndpoint = RegionEndpoint.GetBySystemName(config.Region),
        ForcePathStyle = config.UsePathStyle  // Required for MinIO
    };

    // Custom endpoint for MinIO/S3-compatible storage
    if (!string.IsNullOrEmpty(config.Endpoint))
    {
        clientConfig.ServiceURL = config.Endpoint;  // http://172.25.201.3:30900
        clientConfig.ForcePathStyle = true;
    }

    return new AmazonS3Client(awsCredentials, clientConfig);
}
```

### Cross-Cluster Verification Script

```powershell
# Source: Derived from file-simulator-suite/examples/client-cluster/README.md
# Verify file-simulator accessibility from EZ Platform perspective

$SIMULATOR_IP = minikube ip -p file-simulator

# Test FTP connectivity
Test-NetConnection -ComputerName $SIMULATOR_IP -Port 30021 -InformationLevel Quiet

# Test SFTP connectivity
Test-NetConnection -ComputerName $SIMULATOR_IP -Port 30022 -InformationLevel Quiet

# Test S3/MinIO connectivity
$response = Invoke-WebRequest -Uri "http://${SIMULATOR_IP}:30900/minio/health/live" -Method GET -TimeoutSec 5
$response.StatusCode -eq 200

# Test HTTP server
$response = Invoke-WebRequest -Uri "http://${SIMULATOR_IP}:30088/" -Method GET -TimeoutSec 5
$response.StatusCode -eq 200
```

### ConfigMap Integration in Deployment

```yaml
# Source: k8s/deployments pattern
apiVersion: apps/v1
kind: Deployment
metadata:
  name: filediscovery
  namespace: ez-platform
spec:
  template:
    spec:
      containers:
      - name: filediscovery
        envFrom:
        # Existing service config
        - configMapRef:
            name: services-config
        # Add file-simulator endpoints
        - configMapRef:
            name: file-simulator-config
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mock file connectors | Real protocol servers | file-simulator v1.0 | Full protocol fidelity in tests |
| Single NFS server | 7-server multi-NAS topology | file-simulator Phase 2 | Matches production OCP patterns |
| Manual test file copy | Init container sync | file-simulator Phase 1 | Automated Windows-to-NFS sync |
| Output file polling | Sidecar bidirectional sync | file-simulator Phase 3 | 15-30s NFS-to-Windows sync |

**Deprecated/outdated:**
- **Local file mocks:** Use file-simulator for realistic testing
- **Hard-coded file paths:** Use ConfigMap-driven endpoints
- **Single cluster testing:** Cross-cluster integration validates real network I/O

## Open Questions

Things that couldn't be fully resolved:

1. **SMB Connector Addition**
   - What we know: file-simulator provides SMB via Samba; SMBLibrary works in test console
   - What's unclear: Does EZ Platform need SMB connector? Current connectors are FTP/SFTP/S3/HTTP/Local
   - Recommendation: Defer SMB until explicit requirement; focus on existing protocols first

2. **NFS Direct Mount vs PV/PVC**
   - What we know: file-simulator supports both patterns (NodePort for external, PV/PVC for K8s)
   - What's unclear: Should EZ Platform pods mount NFS directly or use existing file connectors?
   - Recommendation: Use existing FTP/SFTP/S3 connectors for simplicity; NFS PV/PVC pattern adds complexity

3. **E2E Test Architecture**
   - What we know: 6 E2E tests exist (datasource.spec.ts, invalid-records.spec.ts, metrics.spec.ts, alerts.spec.ts)
   - What's unclear: Are these UI tests only, or do they trigger backend file I/O?
   - Recommendation: Review each test to identify which require file-simulator configuration

4. **Credential Management**
   - What we know: file-simulator uses default credentials (ftpuser/ftppass123, etc.)
   - What's unclear: Should EZ Platform tests use Kubernetes Secrets or ConfigMap for credentials?
   - Recommendation: Use ConfigMap for dev (matches file-simulator defaults); migrate to Secrets for staging/prod

## Sources

### Primary (HIGH confidence)

- `C:\Users\UserC\source\repos\file-simulator-suite\CLAUDE.md` - Project overview, deployment commands, architecture
- `C:\Users\UserC\source\repos\file-simulator-suite\docs\CLIENT-INTEGRATION-GUIDE.md` - Integration patterns, test strategies
- `C:\Users\UserC\source\repos\file-simulator-suite\docs\SERVER-CONNECTION-PROPERTIES.md` - All NodePorts, credentials, DNS names
- `C:\Users\UserC\source\repos\file-simulator-suite\docs\DOTNET-K8S-INTEGRATION.md` - KubernetesClient patterns for NAS management
- `C:\Users\UserC\source\repos\file-simulator-suite\helm-chart\file-simulator\docs\NAS-INTEGRATION-GUIDE.md` - PV/PVC patterns, troubleshooting
- `C:\Users\UserC\source\repos\EZ\src\Services\Shared\Connectors\*.cs` - Existing connector implementations

### Secondary (MEDIUM confidence)

- `C:\Users\UserC\source\repos\file-simulator-suite\examples\client-cluster\README.md` - Cross-cluster configuration verified in file-simulator testing
- [GitHub Issue: Minikube cross-cluster communication](https://github.com/kubernetes/minikube/issues/15616) - Community patterns for multi-profile networking

### Tertiary (LOW confidence)

- Web search results for "Minikube multiple profiles cross-cluster communication" - General patterns, no specific 2026 updates

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing EZ Platform connectors and file-simulator infrastructure
- Architecture: HIGH - Cross-cluster pattern documented and validated in file-simulator testing
- Pitfalls: HIGH - Extracted from file-simulator CLAUDE.md and integration testing experience

**Research date:** 2026-02-02
**Valid until:** 60 days (infrastructure patterns stable; file-simulator v1.0 shipped)

---

## Appendix: File-Simulator Quick Reference

### Default Credentials

| Protocol | Username | Password |
|----------|----------|----------|
| FTP | ftpuser | ftppass123 |
| SFTP | sftpuser | sftppass123 |
| S3/MinIO | minioadmin | minioadmin123 |
| HTTP/WebDAV | httpuser | httppass123 |
| SMB | smbuser | smbpass123 |
| Management UI | admin | admin123 |

### NodePort Mappings

| Service | Port | Purpose |
|---------|------|---------|
| FTP | 30021 | FTP data/control |
| SFTP | 30022 | SSH/SFTP |
| HTTP | 30088 | HTTP downloads |
| WebDAV | 30089 | WebDAV operations |
| S3 API | 30900 | S3-compatible API |
| S3 Console | 30901 | MinIO web console |
| NFS (legacy) | 32149 | Single NFS server |
| NAS Input 1 | 32150 | Multi-NAS input server 1 |
| NAS Input 2 | 32151 | Multi-NAS input server 2 |
| NAS Input 3 | 32152 | Multi-NAS input server 3 |
| NAS Backup | 32153 | Multi-NAS backup server |
| NAS Output 1 | 32154 | Multi-NAS output server 1 |
| NAS Output 2 | 32155 | Multi-NAS output server 2 |
| NAS Output 3 | 32156 | Multi-NAS output server 3 |
| Management UI | 30180 | FileBrowser |

### File-Simulator Startup Commands

```powershell
# Start file-simulator cluster (if not running)
minikube start --profile file-simulator --driver=hyperv --memory=8192 --cpus=4 --mount --mount-string="C:\simulator-data:/mnt/simulator-data"

# Deploy file-simulator (ALWAYS use --kube-context)
helm upgrade --install file-sim .\file-simulator-suite\helm-chart\file-simulator --kube-context=file-simulator --namespace file-simulator --create-namespace

# Apply NFS fix (REQUIRED for NFS functionality)
kubectl --context=file-simulator patch deployment file-sim-file-simulator-nas -n file-simulator --patch-file nfs-fix-patch.yaml

# Verify all pods running
kubectl --context=file-simulator get pods -n file-simulator

# Get IP for ConfigMap
minikube ip -p file-simulator
```
