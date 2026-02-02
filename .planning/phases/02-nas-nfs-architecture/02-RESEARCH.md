# Phase 2: NAS/NFS Architecture Implementation - Research

**Researched:** 2026-02-02
**Domain:** Kubernetes PV/PVC dynamic provisioning, NFS integration, .NET Kubernetes API
**Confidence:** HIGH

## Summary

This phase implements NAS device configuration and dynamic Kubernetes volume provisioning via the .NET 10 KubernetesClient library. The EZ Platform needs to manage NAS devices through its AdminServer UI, dynamically create PersistentVolumes/PersistentVolumeClaims for NFS-based storage, and mount volumes to pods at runtime without static manifests.

The file-simulator-suite project provides comprehensive documentation and working examples for exactly this pattern. The approach uses:
1. **NAS device entity** extending AdminServer pattern (MongoDB storage)
2. **KubernetesClient 14.x** for PV/PVC/Deployment manipulation via .NET API
3. **Static NFS provisioning** with label-based PVC-to-PV binding (matches OCP patterns)
4. **NFS protocol connector** that reads from mounted PVC paths (uses LocalFileConnector pattern)

**Primary recommendation:** Create a NasDevice entity and NasResourceService that wraps KubernetesClient operations, then integrate NFS connector as a NAS-backed protocol using mounted PVC paths.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| KubernetesClient | 14.0.7 | .NET Kubernetes API client | Official Microsoft-maintained client for K8s API |
| KubernetesClient.Models | 14.0.7 | K8s resource models (V1PersistentVolume, etc.) | Type-safe K8s resource manipulation |
| MongoDB.Entities | (existing) | NAS device entity storage | Already used for AdminServer pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Microsoft.Extensions.Logging | (existing) | Structured logging | K8s API operations logging |
| Polly | (existing) | Resilience | Retry logic for K8s API calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| KubernetesClient | kubectl exec via Process | KubernetesClient is type-safe, no shell dependency |
| Static PV provisioning | Dynamic StorageClass | Static matches OCP production patterns, explicit binding |
| Label selector binding | volumeName direct binding | Labels allow multi-tenant flexibility |

**Installation:**
```bash
dotnet add package KubernetesClient --version 14.0.7
```

## Architecture Patterns

### Recommended Project Structure
```
src/Services/Shared/
├── Entities/
│   └── NasDevice.cs              # NAS device configuration entity
├── Services/
│   └── NasResourceService.cs     # K8s PV/PVC management service
├── Connectors/
│   └── NfsConnector.cs           # NFS protocol connector (extends LocalFileConnector)
└── Configuration/
    └── KubernetesConfiguration.cs # K8s client DI setup

src/Services/DataSourceManagementService/
├── Controllers/
│   └── NasDeviceController.cs    # CRUD API for NAS devices
└── Services/
    └── NasDeviceService.cs       # Business logic for NAS device management
```

### Pattern 1: NAS Device Entity
**What:** MongoDB entity storing NAS device configuration
**When to use:** Persist NAS server connection details (host, share path, credentials, mount options)
**Example:**
```csharp
// Source: file-simulator-suite/docs/DOTNET-K8S-INTEGRATION.md
public class NasDevice : DataProcessingBaseEntity
{
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Description { get; set; }

    // NFS-specific configuration
    [Required]
    [StringLength(255)]
    public string Host { get; set; } = string.Empty;  // DNS or IP

    public int Port { get; set; } = 2049;

    [StringLength(500)]
    public string ExportPath { get; set; } = "/data";

    // Role classification
    public NasDeviceRole Role { get; set; } = NasDeviceRole.Input;

    // K8s resource names (auto-generated if null)
    public string PvName => $"{Name.ToLower()}-pv";
    public string PvcName => $"{Name.ToLower()}-pvc";
    public string MountPath => $"/mnt/{Name.ToLower()}";

    // Storage configuration
    public string StorageCapacity { get; set; } = "10Gi";
    public string AccessMode { get; set; } = "ReadWriteMany";
    public string ReclaimPolicy { get; set; } = "Retain";
    public List<string> MountOptions { get; set; } = new() { "nfsvers=3", "tcp", "hard", "intr" };

    // Provisioning status
    public bool IsPvCreated { get; set; }
    public bool IsPvcBound { get; set; }
    public DateTime? LastProvisionedAt { get; set; }
    public string? ProvisioningError { get; set; }
}

public enum NasDeviceRole
{
    Input,      // Read files from NAS
    Output,     // Write files to NAS
    Backup,     // Archive/backup storage
    Both        // Bidirectional access
}
```

### Pattern 2: Kubernetes Client DI Setup
**What:** Configure KubernetesClient for both in-cluster and local development
**When to use:** Initialize K8s client at application startup
**Example:**
```csharp
// Source: file-simulator-suite/docs/DOTNET-K8S-INTEGRATION.md
public static class KubernetesConfiguration
{
    public static IServiceCollection AddKubernetesClient(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSingleton<Kubernetes>(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<Kubernetes>>();

            try
            {
                // Try in-cluster config first (OCP/K8s pod)
                var config = KubernetesClientConfiguration.InClusterConfig();
                logger.LogInformation("Using in-cluster Kubernetes configuration");
                return new Kubernetes(config);
            }
            catch (KubeConfigException)
            {
                // Fall back to kubeconfig for local development
                var contextName = configuration["Kubernetes:Context"] ?? "minikube";
                var kubeConfigPath = configuration["Kubernetes:KubeConfigPath"];

                var config = KubernetesClientConfiguration.BuildConfigFromConfigFile(
                    kubeConfigPath,
                    contextName);

                logger.LogInformation("Using kubeconfig with context {Context}", contextName);
                return new Kubernetes(config);
            }
        });

        return services;
    }
}
```

### Pattern 3: NAS Resource Service (PV/PVC Management)
**What:** Service encapsulating Kubernetes API operations for NAS provisioning
**When to use:** Create/delete PV/PVC, add volume mounts to deployments
**Example:**
```csharp
// Source: file-simulator-suite/docs/DOTNET-K8S-INTEGRATION.md
public interface INasResourceService
{
    Task<V1PersistentVolume> CreatePersistentVolumeAsync(NasDevice device, CancellationToken ct = default);
    Task<bool> DeletePersistentVolumeAsync(string pvName, CancellationToken ct = default);
    Task<V1PersistentVolumeClaim> CreatePersistentVolumeClaimAsync(NasDevice device, string namespace_, CancellationToken ct = default);
    Task<bool> DeletePersistentVolumeClaimAsync(string pvcName, string namespace_, CancellationToken ct = default);
    Task<string> GetPvcBindingStatusAsync(string pvcName, string namespace_, CancellationToken ct = default);
    Task<V1Deployment> AddNasMountToDeploymentAsync(string deploymentName, string namespace_, NasDevice device, CancellationToken ct = default);
    Task<V1Deployment> RemoveNasMountFromDeploymentAsync(string deploymentName, string namespace_, string nasName, CancellationToken ct = default);
}

public class NasResourceService : INasResourceService
{
    private readonly Kubernetes _k8sClient;
    private readonly ILogger<NasResourceService> _logger;

    public async Task<V1PersistentVolume> CreatePersistentVolumeAsync(
        NasDevice device,
        CancellationToken ct = default)
    {
        var pv = new V1PersistentVolume
        {
            ApiVersion = "v1",
            Kind = "PersistentVolume",
            Metadata = new V1ObjectMeta
            {
                Name = device.PvName,
                Labels = new Dictionary<string, string>
                {
                    ["type"] = "nfs",
                    ["nas-role"] = device.Role.ToString().ToLower(),
                    ["nas-device"] = device.Name.ToLower(),
                    ["managed-by"] = "ez-platform"
                }
            },
            Spec = new V1PersistentVolumeSpec
            {
                Capacity = new Dictionary<string, ResourceQuantity>
                {
                    ["storage"] = new ResourceQuantity(device.StorageCapacity)
                },
                AccessModes = new List<string> { device.AccessMode },
                PersistentVolumeReclaimPolicy = device.ReclaimPolicy,
                Nfs = new V1NFSVolumeSource
                {
                    Server = device.Host,
                    Path = device.ExportPath,
                    ReadOnlyProperty = device.Role == NasDeviceRole.Backup
                },
                MountOptions = device.MountOptions
            }
        };

        try
        {
            return await _k8sClient.CoreV1.CreatePersistentVolumeAsync(pv, cancellationToken: ct);
        }
        catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.Conflict)
        {
            _logger.LogWarning("PV {PvName} already exists", device.PvName);
            return await _k8sClient.CoreV1.ReadPersistentVolumeAsync(device.PvName, cancellationToken: ct);
        }
    }
}
```

### Pattern 4: NFS Connector (NAS-backed file access)
**What:** Data source connector that reads/writes via NAS-mounted PVC paths
**When to use:** When NFS protocol selected, route through NAS device configuration
**Example:**
```csharp
// The NFS connector uses LocalFileConnector pattern but resolves paths from NAS device
public class NfsConnector : IDataSourceConnector
{
    private readonly ILogger<NfsConnector> _logger;

    public string ConnectorType => "nfs";

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken ct = default)
    {
        // NFS mounts appear as local filesystem paths via PVC
        // The mount path is configured in the NAS device entity
        // Example: /mnt/nas-input-1/subdirectory/file.csv
        var fullPath = Path.Combine(dataSource.FilePath, filePath);

        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"NFS file not found: {fullPath}");
        }

        // Return as memory stream for processing
        var content = await File.ReadAllBytesAsync(fullPath, ct);
        return new MemoryStream(content);
    }

    public async Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource,
        string pattern,
        CancellationToken ct = default)
    {
        var basePath = dataSource.FilePath;

        if (!Directory.Exists(basePath))
        {
            _logger.LogWarning("NFS mount path does not exist: {Path}", basePath);
            return new List<string>();
        }

        var files = Directory.GetFiles(basePath, pattern, SearchOption.TopDirectoryOnly)
            .Select(f => Path.GetFileName(f))
            .ToList();

        return files;
    }
}
```

### Anti-Patterns to Avoid
- **Dynamic StorageClass for NAS:** Don't create a StorageClass for dynamic NFS provisioning. Static PV/PVC matches OCP production patterns and provides explicit control.
- **Storing credentials in database:** Use CredentialSecretRef pattern (K8s Secrets) for NFS authentication, not database storage.
- **Hardcoded mount paths:** Always derive mount paths from NAS device configuration, not static strings.
- **kubectl subprocess calls:** Use KubernetesClient library for type-safe API access, not shell exec.
- **Ignoring PVC binding status:** Always wait for PVC to reach "Bound" status before attempting mount operations.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| K8s API client | Custom HTTP client | KubernetesClient 14.x | Type-safe, handles auth, retries, watches |
| PV/PVC YAML generation | String templates | V1PersistentVolume objects | Model validation, proper serialization |
| In-cluster auth | Manual token reading | InClusterConfig() | Handles token mounting, CA cert, namespace |
| NFS file operations | Custom NFS client | Mounted PVC + File API | K8s handles mount; use standard File API |
| Service discovery | Manual DNS | K8s Service DNS | Stable DNS names, automatic load balancing |

**Key insight:** The Kubernetes API provides a well-tested abstraction layer for storage provisioning. The NFS protocol itself is abstracted away by PVC mounts - your application just sees a filesystem path.

## Common Pitfalls

### Pitfall 1: PVC Pending Forever
**What goes wrong:** PVC stays in "Pending" status and never binds to PV
**Why it happens:** Label selector mismatch between PVC and PV, or capacity mismatch
**How to avoid:**
- Use exact label matching: PVC selector `nas-device: nas-input-1` must match PV label
- Ensure PVC storage request <= PV capacity
- Omit `storageClassName` for static binding (don't set to empty string)
**Warning signs:** `kubectl describe pvc` shows "no persistent volumes available"

### Pitfall 2: NFS Mount Timeout
**What goes wrong:** Pod stuck in ContainerCreating with mount timeout errors
**Why it happens:** NFS server unreachable, wrong port, firewall blocking
**How to avoid:**
- Verify NFS server DNS resolution from cluster
- Use explicit mount options: `nfsvers=3, tcp, hard, intr`
- Test NFS connectivity before creating PV
**Warning signs:** Pod events show "MountVolume.SetUp failed"

### Pitfall 3: Stale File Handle Errors
**What goes wrong:** "Stale NFS file handle" errors during file operations
**Why it happens:** NFS server restarted without re-mounting clients, or mount options missing
**How to avoid:**
- Always include `hard` mount option (retry on failure)
- Include `intr` mount option (allow interrupt)
- Use NFSv3 explicitly to avoid v4 lease issues
**Warning signs:** File operations fail after NFS pod restart

### Pitfall 4: RBAC Permission Denied
**What goes wrong:** K8s API calls fail with 403 Forbidden
**Why it happens:** ServiceAccount lacks required permissions for PV (cluster-scoped) or PVC (namespace-scoped)
**How to avoid:**
- PV operations require ClusterRole + ClusterRoleBinding
- PVC/ConfigMap/Deployment operations require Role + RoleBinding
- Deploy RBAC manifests before application
**Warning signs:** HttpOperationException with StatusCode 403

### Pitfall 5: Empty NFS Mount
**What goes wrong:** Mount succeeds but directory is empty
**Why it happens:** For file-simulator, init container hasn't synced files from Windows
**How to avoid:**
- Restart NAS pod after adding files to Windows directory
- Verify init container logs show successful rsync
- Check mount path matches NAS export path
**Warning signs:** `ls /mnt/nas-*` returns empty in pod

## Code Examples

Verified patterns from official sources:

### Creating PersistentVolume via API
```csharp
// Source: file-simulator-suite/docs/DOTNET-K8S-INTEGRATION.md
var pv = new V1PersistentVolume
{
    ApiVersion = "v1",
    Kind = "PersistentVolume",
    Metadata = new V1ObjectMeta
    {
        Name = "nas-input-1-pv",
        Labels = new Dictionary<string, string>
        {
            ["type"] = "nfs",
            ["nas-role"] = "input",
            ["nas-device"] = "nas-input-1"
        }
    },
    Spec = new V1PersistentVolumeSpec
    {
        Capacity = new Dictionary<string, ResourceQuantity>
        {
            ["storage"] = new ResourceQuantity("10Gi")
        },
        AccessModes = new List<string> { "ReadWriteMany" },
        PersistentVolumeReclaimPolicy = "Retain",
        Nfs = new V1NFSVolumeSource
        {
            Server = "file-sim-nas-input-1.file-simulator.svc.cluster.local",
            Path = "/data",
            ReadOnlyProperty = false
        },
        MountOptions = new List<string> { "nfsvers=3", "tcp", "hard", "intr" }
    }
};

var created = await _k8sClient.CoreV1.CreatePersistentVolumeAsync(pv);
```

### Creating PersistentVolumeClaim with Label Selector
```csharp
// Source: file-simulator-suite/docs/DOTNET-K8S-INTEGRATION.md
var pvc = new V1PersistentVolumeClaim
{
    ApiVersion = "v1",
    Kind = "PersistentVolumeClaim",
    Metadata = new V1ObjectMeta
    {
        Name = "nas-input-1-pvc",
        NamespaceProperty = "ez-platform"
    },
    Spec = new V1PersistentVolumeClaimSpec
    {
        AccessModes = new List<string> { "ReadWriteMany" },
        Resources = new V1VolumeResourceRequirements
        {
            Requests = new Dictionary<string, ResourceQuantity>
            {
                ["storage"] = new ResourceQuantity("10Gi")
            }
        },
        Selector = new V1LabelSelector
        {
            MatchLabels = new Dictionary<string, string>
            {
                ["nas-device"] = "nas-input-1"  // Must match PV label
            }
        }
        // NOTE: StorageClassName is intentionally NULL for static binding
    }
};

var created = await _k8sClient.CoreV1.CreateNamespacedPersistentVolumeClaimAsync(pvc, "ez-platform");
```

### Adding Volume Mount to Deployment
```csharp
// Source: file-simulator-suite/docs/DOTNET-K8S-INTEGRATION.md
var deployment = await _k8sClient.AppsV1.ReadNamespacedDeploymentAsync("fileprocessor", "ez-platform");

// Add volume reference
deployment.Spec.Template.Spec.Volumes ??= new List<V1Volume>();
deployment.Spec.Template.Spec.Volumes.Add(new V1Volume
{
    Name = "nas-nas-input-1",
    PersistentVolumeClaim = new V1PersistentVolumeClaimVolumeSource
    {
        ClaimName = "nas-input-1-pvc",
        ReadOnlyProperty = false
    }
});

// Add volume mount to container
var container = deployment.Spec.Template.Spec.Containers.First();
container.VolumeMounts ??= new List<V1VolumeMount>();
container.VolumeMounts.Add(new V1VolumeMount
{
    Name = "nas-nas-input-1",
    MountPath = "/mnt/nas-input-1",
    ReadOnlyProperty = false
});

await _k8sClient.AppsV1.ReplaceNamespacedDeploymentAsync(deployment, "fileprocessor", "ez-platform");
```

### RBAC Manifest for NAS Management
```yaml
# Source: file-simulator-suite/docs/OCP-RBAC-GUIDE.md
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: nas-device-manager
  namespace: ez-platform

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: nas-pv-manager
rules:
  - apiGroups: [""]
    resources: ["persistentvolumes"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: nas-device-manager-pv-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: nas-pv-manager
subjects:
  - kind: ServiceAccount
    name: nas-device-manager
    namespace: ez-platform

---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: nas-resource-manager
  namespace: ez-platform
rules:
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "update", "patch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: nas-device-manager-binding
  namespace: ez-platform
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: nas-resource-manager
subjects:
  - kind: ServiceAccount
    name: nas-device-manager
    namespace: ez-platform
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| kubectl exec via Process | KubernetesClient library | KubernetesClient 3.0+ | Type-safe, no shell dependency |
| Dynamic NFS provisioner | Static PV + label selectors | OCP best practice | Explicit binding, production parity |
| Manual kubeconfig parsing | InClusterConfig() | K8s 1.8+ | Automatic token/CA handling |
| NFS v4 default | Explicit NFSv3 with mount options | Stability fix | Avoids lease/stale handle issues |

**Deprecated/outdated:**
- **KubernetesClient 13.x and below:** Version 14.x has improved async support and .NET 10 compatibility
- **NFS v4 without explicit options:** Can cause stale file handle issues; always specify `nfsvers=3`

## Open Questions

Things that couldn't be fully resolved:

1. **Which service hosts NAS management API?**
   - What we know: DataSourceManagementService already handles AdminServer CRUD
   - What's unclear: Should NAS devices be a new controller in DataSourceManagementService or a separate service?
   - Recommendation: Add to DataSourceManagementService (consistent with AdminServer pattern)

2. **Frontend integration scope**
   - What we know: AdminServer UI exists, NAS device UI should follow same pattern
   - What's unclear: Exact UI component design, form fields, validation rules
   - Recommendation: Design during planning phase, mirror AdminServer form structure

3. **File-simulator cluster IP resolution**
   - What we know: file-simulator cluster uses separate Minikube profile with different IP
   - What's unclear: How to dynamically resolve file-simulator NFS server IP in dev environment
   - Recommendation: Use ConfigMap placeholder pattern (like Phase 1) for file-simulator integration

## Sources

### Primary (HIGH confidence)
- **file-simulator-suite/docs/DOTNET-K8S-INTEGRATION.md** - Complete .NET K8s API examples (2225 lines)
- **file-simulator-suite/docs/NAS-INTEGRATION-GUIDE.md** - NAS architecture, PV/PVC patterns (1210 lines)
- **file-simulator-suite/docs/OCP-RBAC-GUIDE.md** - RBAC configuration for K8s API access
- **EZ Platform Shared/Connectors/** - Existing connector patterns (ConnectorFactory, LocalFileConnector)
- **EZ Platform Shared/Entities/AdminServer.cs** - Entity pattern for server configuration

### Secondary (MEDIUM confidence)
- **file-simulator-suite/README.md** - Architecture overview, multi-NAS topology
- **file-simulator-suite/CLAUDE.md** - Deployment commands, NFS fix patterns

### Tertiary (LOW confidence)
- None - all patterns verified with file-simulator documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - KubernetesClient 14.x is documented in file-simulator with working code
- Architecture: HIGH - Patterns directly from file-simulator docs, verified against EZ codebase
- Pitfalls: HIGH - Documented issues with solutions in NAS-INTEGRATION-GUIDE.md

**Research date:** 2026-02-02
**Valid until:** 60 days (stable Kubernetes patterns, KubernetesClient version may update)

---

## Implementation Requirements Mapping

| Requirement | Implementation Approach | Confidence |
|-------------|------------------------|------------|
| NAS-01: NAS device entity | NasDevice extends DataProcessingBaseEntity | HIGH |
| NAS-02: PV creation via K8s API | NasResourceService.CreatePersistentVolumeAsync | HIGH |
| NAS-03: PVC creation and binding | Label selector binding, wait for Bound status | HIGH |
| NAS-04: Volume mounting at runtime | AddNasMountToDeploymentAsync | HIGH |
| NAS-05: NFS connector to NAS devices | NfsConnector using mounted PVC paths | HIGH |
| NAS-06: AdminServer UI for NAS CRUD | NasDeviceController + React form (mirror AdminServer) | HIGH |
| NAS-07: Testing against file-simulator | Use file-simulator multi-NAS topology (7 servers) | HIGH |
