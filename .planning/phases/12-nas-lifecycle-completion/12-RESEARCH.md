# Phase 12: NAS Lifecycle Completion - Research

**Researched:** 2026-02-11
**Domain:** Kubernetes PV/PVC auto-mounting, DataSource entity linking, lifecycle management
**Confidence:** HIGH (based on existing codebase analysis + Kubernetes official documentation)

## Summary

Phase 12 completes the NAS device lifecycle by implementing automatic volume mounting to service deployments, linking DataSource entities to NAS devices, enforcing PVC binding verification, and managing cascading updates/deletes. The infrastructure exists (NasResourceService with `AddNasMountToDeploymentAsync` and `RemoveNasMountFromDeploymentAsync`), but these methods are not called automatically after provisioning. The DataSource entity currently lacks a `NasDeviceId` field for explicit linkage.

**Primary recommendation:** Trigger auto-mount from `ProvisionNasDeviceAsync` after successful PVC binding, add `NasDeviceId` to `DataProcessingDataSource` entity, implement referential integrity checks in delete operations, and add pod restart capability for configuration changes.

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| KubernetesClient | 14.0.0+ | K8s API interactions | Used by NasResourceService |
| MongoDB.Entities | 23.x | Database operations | Used by DataSourceManagement |
| MassTransit | 8.x | Event broadcasting | For NAS status events |

### Supporting (May Need)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Polly | 8.x | Retry policies | K8s API resilience |

### No New Dependencies Required

This phase leverages existing infrastructure. No new NuGet packages needed.

## Architecture Patterns

### Recommended Service Structure

```
DataSourceManagementService/
├── Controllers/
│   ├── NasDevicesController.cs          # MODIFY: Add referential check endpoints
│   └── DataSourcesController.cs         # MODIFY: NAS linkage validation
├── Services/
│   ├── NasDeviceService.cs              # MODIFY: Auto-mount orchestration
│   ├── INasDeviceService.cs             # MODIFY: New interface methods
│   ├── DataSourceService.cs             # MODIFY: NAS device validation
│   └── NasLifecycleService.cs           # NEW: Lifecycle orchestration
├── Consumers/
│   └── NasProvisionedEventConsumer.cs   # NEW: React to provisioning events

Shared/
├── Entities/
│   └── DataProcessingDataSource.cs      # MODIFY: Add NasDeviceId field
├── Messages/
│   └── NasDeviceEvents.cs               # NEW: NasProvisionedEvent, NasDeprovisionedEvent
└── Services/
    └── NasResourceService.cs            # EXISTS: Has AddNasMountToDeploymentAsync
```

### Pattern 1: Post-Provisioning Auto-Mount

**What:** After successful PVC binding, automatically mount to target deployments based on role
**When:** `ProvisionNasDeviceAsync` completes with `IsPvcBound = true`
**Example:**

```csharp
// In NasDeviceService.ProvisionNasDeviceAsync after line 283
if (result.PvcBound)
{
    // Auto-mount based on role
    await AutoMountToDeploymentsAsync(device, request.Namespace, ct);

    // Publish event for other services
    await _publishEndpoint.Publish(new NasProvisionedEvent
    {
        NasDeviceId = device.ID,
        DeviceName = device.Name,
        Role = device.Role,
        MountPath = device.MountPath,
        PvcName = device.PvcName
    });
}
```

```csharp
private async Task AutoMountToDeploymentsAsync(NasDevice device, string namespace_, CancellationToken ct)
{
    var targetDeployments = GetTargetDeployments(device.Role);

    foreach (var deploymentName in targetDeployments)
    {
        try
        {
            await _nasResourceService.AddNasMountToDeploymentAsync(
                deploymentName, namespace_, device, ct);

            _logger.LogInformation(
                "Auto-mounted NAS {DeviceName} to deployment {Deployment}",
                device.Name, deploymentName);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Failed to auto-mount NAS {DeviceName} to deployment {Deployment}",
                device.Name, deploymentName);
        }
    }
}

private static List<string> GetTargetDeployments(NasDeviceRole role)
{
    return role switch
    {
        NasDeviceRole.Input => new List<string> { "filediscovery", "fileprocessor" },
        NasDeviceRole.Output => new List<string> { "output" },
        NasDeviceRole.Both => new List<string> { "filediscovery", "fileprocessor", "output" },
        NasDeviceRole.Backup => new List<string> { "output" }, // Backup typically writes
        _ => new List<string>()
    };
}
```

### Pattern 2: DataSource NAS Device Linking

**What:** Add `NasDeviceId` field to DataSource, auto-populate `FilePath` from mount path
**When:** DataSource uses NAS protocol
**Example:**

```csharp
// In DataProcessingDataSource.cs - add new field
/// <summary>
/// Reference to NasDevice used for NFS file access (v0.2.0)
/// When set, FilePath is auto-populated from NasDevice.MountPath + subpath
/// </summary>
[StringLength(24)]
public string? NasDeviceId { get; set; }

// In DataSourceService - populate FilePath during save
if (!string.IsNullOrEmpty(dataSource.NasDeviceId))
{
    var nasDevice = await _nasDeviceService.GetNasDeviceByIdAsync(dataSource.NasDeviceId, ct);
    if (nasDevice == null)
    {
        throw new ValidationException("Referenced NAS device not found");
    }

    if (!nasDevice.IsProvisioned)
    {
        throw new ValidationException("NAS device PVC is not bound. Please provision the NAS device first.");
    }

    // Auto-populate FilePath: /mnt/{nas-name}/{export-path}/{sub-path}
    var subPath = dataSource.FilePath?.TrimStart('/') ?? string.Empty;
    dataSource.FilePath = Path.Combine(nasDevice.MountPath, nasDevice.ExportPath.TrimStart('/'), subPath);
}
```

### Pattern 3: Referential Integrity Check

**What:** Prevent NAS device deletion if referenced by DataSources
**When:** `DeleteNasDeviceAsync` or `DeprovisionNasDeviceAsync` called
**Example:**

```csharp
// In NasDeviceService.DeleteNasDeviceAsync
public async Task<bool> DeleteNasDeviceAsync(string id, CancellationToken ct = default)
{
    // Check for referencing DataSources
    var referencingDataSources = await DB.Find<DataProcessingDataSource>()
        .Match(ds => ds.NasDeviceId == id && !ds.IsDeleted)
        .ExecuteAsync(ct);

    if (referencingDataSources.Any())
    {
        var dsNames = string.Join(", ", referencingDataSources.Take(5).Select(ds => ds.Name));
        throw new InvalidOperationException(
            $"Cannot delete NAS device: Referenced by {referencingDataSources.Count} DataSource(s): {dsNames}");
    }

    // Proceed with soft delete
    // ... existing delete logic
}
```

### Pattern 4: Cascade Cleanup on Deprovision

**What:** Remove volume mounts from deployments when NAS is deprovisioned
**When:** `DeprovisionNasDeviceAsync` called
**Example:**

```csharp
public async Task<bool> DeprovisionNasDeviceAsync(string id, string namespace_, CancellationToken ct = default)
{
    var device = await GetNasDeviceByIdAsync(id, ct);
    if (device == null) return false;

    // 1. Remove mounts from deployments
    var targetDeployments = GetTargetDeployments(device.Role);
    foreach (var deploymentName in targetDeployments)
    {
        try
        {
            await _nasResourceService.RemoveNasMountFromDeploymentAsync(
                deploymentName, namespace_, device.Name, ct);
        }
        catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.NotFound)
        {
            // Deployment may not exist, ignore
        }
    }

    // 2. Delete PVC (existing logic)
    await _nasResourceService.DeletePersistentVolumeClaimAsync(device.PvcName, namespace_, ct);

    // 3. Delete PV (existing logic)
    await _nasResourceService.DeletePersistentVolumeAsync(device.PvName, ct);

    // 4. Publish event
    await _publishEndpoint.Publish(new NasDeprovisionedEvent
    {
        NasDeviceId = device.ID,
        DeviceName = device.Name
    });

    return true;
}
```

### Pattern 5: Pod Restart on Configuration Changes

**What:** Trigger pod restart when NAS mount configuration changes
**When:** NAS device update affects mount path or export path
**Example:**

```csharp
// In NasDeviceService.UpdateNasDeviceAsync
var needsRemount = existing.ExportPath != device.ExportPath ||
                   existing.Host != device.Host ||
                   existing.Name != device.Name; // Name affects mount path

if (needsRemount && existing.IsProvisioned)
{
    _logger.LogInformation(
        "NAS device {Name} configuration changed, triggering deployment restart",
        existing.Name);

    var targetDeployments = GetTargetDeployments(existing.Role);
    foreach (var deploymentName in targetDeployments)
    {
        await _nasResourceService.RestartDeploymentAsync(deploymentName, namespace_, ct);
    }
}
```

### Anti-Patterns to Avoid

- **Anti-pattern:** Mounting volumes without waiting for PVC binding
  **Why bad:** Pod will fail to start with "PersistentVolumeClaim not found" or "PVC not bound"
  **Instead:** Always verify `IsPvcBound == true` before attempting mount

- **Anti-pattern:** Deleting NAS device without checking DataSource references
  **Why bad:** DataSources will have broken references, file processing will fail silently
  **Instead:** Check for references and reject delete with clear error message

- **Anti-pattern:** Updating NAS export path without restarting pods
  **Why bad:** Running pods have stale mount configuration
  **Instead:** Trigger deployment rollout restart after mount-affecting changes

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| K8s deployment restart | Manual pod deletion | `kubectl rollout restart` via API | Graceful rolling restart, maintains availability |
| PVC binding wait | Sleep loop | `WaitForPvcBoundAsync` (existing) | Has proper polling, timeout, cancellation |
| Volume mount | Manual spec editing | `AddNasMountToDeploymentAsync` (existing) | Handles idempotency, volume naming |
| Referential integrity | In-memory checks | MongoDB queries | Handles concurrent operations, transactional |

**Key insight:** The infrastructure for mounting/unmounting already exists in `NasResourceService`. Phase 12 orchestrates when to call these methods, not how.

## Common Pitfalls

### Pitfall 1: Mount Path Collision

**What goes wrong:** Two NAS devices with similar names create conflicting mount paths
**Why it happens:** Mount path is computed from name: `/mnt/{name-lowercase}`
**How to avoid:** Validate unique mount paths during NAS device creation
**Warning signs:** Pod fails to start with "volume mount already exists" error

```csharp
// Add validation in CreateNasDeviceAsync
var existingWithSameMountPath = await DB.Find<NasDevice>()
    .Match(d => !d.IsDeleted && d.Name.ToLower().Replace(" ", "-") == device.Name.ToLower().Replace(" ", "-"))
    .ExecuteFirstAsync(ct);

if (existingWithSameMountPath != null)
{
    throw new ValidationException($"Mount path collision: '{device.MountPath}' already used by device '{existingWithSameMountPath.Name}'");
}
```

### Pitfall 2: Deployment Not Found During Mount

**What goes wrong:** `AddNasMountToDeploymentAsync` fails because deployment doesn't exist
**Why it happens:** Service may not be deployed yet, or deployment name mismatch
**How to avoid:** Use try-catch with graceful degradation, log warning but don't fail
**Warning signs:** Provisioning succeeds but files not accessible from services

### Pitfall 3: PVC Binding Race Condition

**What goes wrong:** Mount attempted before PVC fully bound
**Why it happens:** `WaitForPvcBoundAsync` returns true but binding not propagated
**How to avoid:** Add short delay after binding, verify in mount operation
**Warning signs:** Intermittent "PVC not bound" errors during pod startup

### Pitfall 4: Orphaned Mounts After Failed Deprovision

**What goes wrong:** PVC deleted but volume mounts remain in deployment specs
**Why it happens:** Partial deprovision failure, mount removal not transactional
**How to avoid:** Remove mounts BEFORE deleting PVC, idempotent operations
**Warning signs:** Pods fail to start after deprovision with "PVC not found"

### Pitfall 5: DataSource FilePath Desync

**What goes wrong:** DataSource.FilePath doesn't match actual NAS mount path
**Why it happens:** NAS device updated but DataSources not refreshed
**How to avoid:** Always compute FilePath from NasDevice at runtime, or cascade update
**Warning signs:** "File not found" errors despite files existing on NAS

## Code Examples

### Example 1: Complete Auto-Mount Flow

```csharp
// In NasDeviceService.ProvisionNasDeviceAsync - after PVC binding verified
if (result.PvcBound)
{
    _logger.LogInformation("PVC bound, initiating auto-mount for NAS device {Name}", device.Name);

    // Get deployment names based on role
    var deploymentNames = device.Role switch
    {
        NasDeviceRole.Input => new[] { "filediscovery", "fileprocessor" },
        NasDeviceRole.Output => new[] { "output" },
        NasDeviceRole.Both => new[] { "filediscovery", "fileprocessor", "output" },
        NasDeviceRole.Backup => new[] { "output" },
        _ => Array.Empty<string>()
    };

    var mountResults = new List<(string Deployment, bool Success, string? Error)>();

    foreach (var deploymentName in deploymentNames)
    {
        try
        {
            await _nasResourceService.AddNasMountToDeploymentAsync(
                deploymentName,
                request.Namespace,
                device,
                ct);

            mountResults.Add((deploymentName, true, null));
            _logger.LogInformation("Mounted NAS {DeviceName} to {Deployment}", device.Name, deploymentName);
        }
        catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.NotFound)
        {
            mountResults.Add((deploymentName, false, "Deployment not found"));
            _logger.LogWarning("Deployment {Deployment} not found, skipping mount", deploymentName);
        }
        catch (Exception ex)
        {
            mountResults.Add((deploymentName, false, ex.Message));
            _logger.LogError(ex, "Failed to mount NAS {DeviceName} to {Deployment}", device.Name, deploymentName);
        }
    }

    // Update result with mount info
    result.MountedDeployments = mountResults.Where(r => r.Success).Select(r => r.Deployment).ToList();
    result.FailedMounts = mountResults.Where(r => !r.Success).Select(r => $"{r.Deployment}: {r.Error}").ToList();
}
```

### Example 2: DataSource NAS Validation

```csharp
// In DataSourceService.CreateDataSourceAsync
public async Task<DataProcessingDataSource> CreateDataSourceAsync(
    DataProcessingDataSource dataSource,
    CancellationToken ct = default)
{
    // If using NAS, validate and compute FilePath
    if (!string.IsNullOrEmpty(dataSource.NasDeviceId))
    {
        var nasDevice = await _nasDeviceService.GetNasDeviceByIdAsync(dataSource.NasDeviceId, ct);

        if (nasDevice == null)
        {
            throw new ValidationException(
                $"NAS device not found: {dataSource.NasDeviceId}");
        }

        if (!nasDevice.IsProvisioned)
        {
            throw new ValidationException(
                $"NAS device '{nasDevice.Name}' is not provisioned. " +
                "PVC must be bound before creating a DataSource.");
        }

        if (!nasDevice.CanBeInput)
        {
            throw new ValidationException(
                $"NAS device '{nasDevice.Name}' has role '{nasDevice.Role}' " +
                "and cannot be used as input source. Use a device with Input or Both role.");
        }

        // Compute full mount path
        var subPath = dataSource.FilePath?.TrimStart('/') ?? string.Empty;
        dataSource.FilePath = Path.Combine(
            nasDevice.MountPath,
            nasDevice.ExportPath.TrimStart('/'),
            subPath
        ).Replace('\\', '/'); // Normalize for Linux

        _logger.LogInformation(
            "DataSource {Name} linked to NAS device {NasDevice}, computed path: {Path}",
            dataSource.Name, nasDevice.Name, dataSource.FilePath);
    }

    // Continue with existing save logic...
    await dataSource.SaveAsync(cancellation: ct);
    return dataSource;
}
```

### Example 3: Delete Protection Check

```csharp
// In NasDeviceService
public async Task<NasDeviceDeleteCheckResult> CanDeleteNasDeviceAsync(
    string id,
    CancellationToken ct = default)
{
    var result = new NasDeviceDeleteCheckResult { CanDelete = true };

    // Check for referencing DataSources
    var referencingDataSources = await DB.Find<DataProcessingDataSource>()
        .Match(ds => ds.NasDeviceId == id && !ds.IsDeleted)
        .Project(ds => new { ds.ID, ds.Name })
        .ExecuteAsync(ct);

    if (referencingDataSources.Any())
    {
        result.CanDelete = false;
        result.BlockingReason = "NAS device is referenced by DataSources";
        result.ReferencingDataSources = referencingDataSources
            .Select(ds => new DataSourceReference { Id = ds.ID, Name = ds.Name })
            .ToList();
    }

    return result;
}

public class NasDeviceDeleteCheckResult
{
    public bool CanDelete { get; set; }
    public string? BlockingReason { get; set; }
    public List<DataSourceReference> ReferencingDataSources { get; set; } = new();
}

public class DataSourceReference
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
```

### Example 4: Restart Deployment After Config Change

```csharp
// Add to INasResourceService and NasResourceService
public async Task RestartDeploymentAsync(
    string deploymentName,
    string namespace_,
    CancellationToken ct = default)
{
    var ns = string.IsNullOrEmpty(namespace_) ? _defaultNamespace : namespace_;

    using var activity = ActivitySource.StartActivity("RestartDeployment");
    activity?.SetTag("deployment", deploymentName);
    activity?.SetTag("namespace", ns);

    try
    {
        // Get deployment
        var deployment = await _k8sClient.AppsV1.ReadNamespacedDeploymentAsync(
            deploymentName, ns, cancellationToken: ct);

        // Add/update restart annotation to trigger rollout
        deployment.Spec.Template.Metadata ??= new V1ObjectMeta();
        deployment.Spec.Template.Metadata.Annotations ??= new Dictionary<string, string>();
        deployment.Spec.Template.Metadata.Annotations["kubectl.kubernetes.io/restartedAt"] =
            DateTime.UtcNow.ToString("O");

        await _k8sClient.AppsV1.ReplaceNamespacedDeploymentAsync(
            deployment, deploymentName, ns, cancellationToken: ct);

        _logger.LogInformation(
            "Triggered restart for deployment {Deployment} in namespace {Namespace}",
            deploymentName, ns);
    }
    catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.NotFound)
    {
        _logger.LogWarning("Deployment {Deployment} not found in namespace {Namespace}", deploymentName, ns);
    }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual PV/PVC creation | Dynamic provisioning via K8s API | v0.2.0 | NasResourceService handles all K8s operations |
| NFS path in DataSource config | NasDeviceId reference | Phase 12 | Centralized NAS management, auto-path computation |
| Manual deployment editing | Automated mount via API | v0.2.0 | AddNasMountToDeploymentAsync exists, needs orchestration |

**Current state:**
- NasDevice entity: COMPLETE
- PV/PVC provisioning: COMPLETE
- Volume mount methods: COMPLETE (not called automatically)
- DataSource NAS linking: NOT IMPLEMENTED (no NasDeviceId field)
- Delete protection: NOT IMPLEMENTED
- Auto-mount on provision: NOT IMPLEMENTED

## Open Questions

1. **Should auto-mount be synchronous or async?**
   - What we know: Mounting can take several seconds per deployment
   - What's unclear: Should provision wait for all mounts, or return immediately?
   - Recommendation: Return immediately after PVC bound, mount in background with event notification

2. **How to handle mount failures for some deployments?**
   - What we know: Some deployments may not exist (e.g., not deployed yet)
   - What's unclear: Should this be logged and ignored, or tracked?
   - Recommendation: Log warnings, track in result object, don't fail provisioning

3. **Should DataSource.FilePath be computed on-the-fly or stored?**
   - What we know: Currently stored in MongoDB
   - What's unclear: What if NAS mount path changes?
   - Recommendation: Store computed path but update on NAS device changes

## Deployment Names Mapping

Based on k8s/deployments/ analysis:

| Service | Deployment Name | NAS Role Requirement |
|---------|-----------------|---------------------|
| FileDiscoveryService | `filediscovery` | Input, Both |
| FileProcessorService | `fileprocessor` | Input, Both |
| OutputService | `output` | Output, Both, Backup |

**Note:** Backup role maps to Output service because backups are typically write operations.

## Frontend Changes Required

Based on ConnectionTab.tsx and DestinationEditorModal.tsx analysis:

1. **Already implemented:**
   - NAS device dropdown selection
   - PVC bound status checking (disables unmounted devices)
   - Mount path display

2. **Needs implementation:**
   - Display referencing DataSources count on NAS device card/row
   - Show warning when attempting to delete referenced NAS device
   - Update DataSource form to persist `nasDeviceId` (currently only UI)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/Services/Shared/Services/NasResourceService.cs`
- Existing codebase: `src/Services/Shared/Services/INasResourceService.cs`
- Existing codebase: `src/Services/DataSourceManagementService/Services/NasDeviceService.cs`
- Existing codebase: `src/Services/Shared/Entities/NasDevice.cs`
- Existing codebase: `src/Services/Shared/Entities/DataProcessingDataSource.cs`
- Kubernetes official docs: [PersistentVolumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- Kubernetes official docs: [Volumes](https://kubernetes.io/docs/concepts/storage/volumes/)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` - Consumer-to-Hub patterns
- `.planning/research/PITFALLS.md` - MP-05 NAS device form migration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing libraries and patterns
- Architecture: HIGH - Methods exist, need orchestration
- Pitfalls: MEDIUM - Based on K8s operational experience
- Code examples: HIGH - Based on actual codebase analysis

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days - stable domain, existing infrastructure)

---

## Success Criteria Verification Matrix

| Requirement | Implementation Approach | Key Files |
|-------------|------------------------|-----------|
| NAS-08: Auto-mount PV/PVC to services | Call AddNasMountToDeploymentAsync after PVC bound | NasDeviceService.cs |
| NAS-09: DataSource NasDeviceId linking | Add field to entity, validate during save | DataProcessingDataSource.cs, DataSourceService.cs |
| NAS-10: PVC binding verification | Check IsProvisioned before DataSource creation | DataSourceService.cs |
| NAS-11: Delete prevention & cascade cleanup | Check references before delete, remove mounts on deprovision | NasDeviceService.cs |
