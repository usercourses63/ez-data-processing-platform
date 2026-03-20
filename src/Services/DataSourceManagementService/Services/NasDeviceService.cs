using System.Diagnostics;
using System.Net;
using MongoDB.Entities;
using k8s.Autorest;
using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service for managing NAS (Network Attached Storage) devices.
/// Provides CRUD operations with MongoDB persistence and K8s provisioning via INasResourceService.
/// v0.2.0: NAS/NFS Architecture Support
/// </summary>
public class NasDeviceService : INasDeviceService
{
    private readonly INasResourceService _nasResourceService;
    private readonly ILogger<NasDeviceService> _logger;

    public NasDeviceService(
        INasResourceService nasResourceService,
        ILogger<NasDeviceService> logger)
    {
        _nasResourceService = nasResourceService ?? throw new ArgumentNullException(nameof(nasResourceService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    // ========== CRUD Operations ==========

    /// <inheritdoc/>
    public async Task<List<NasDevice>> GetAllNasDevicesAsync(bool includeDeleted = false, CancellationToken ct = default)
    {
        _logger.LogDebug("Getting all NAS devices (includeDeleted: {IncludeDeleted})", includeDeleted);

        if (includeDeleted)
        {
            return await DB.Find<NasDevice, NasDevice>()
                .ExecuteAsync(ct);
        }

        return await DB.Find<NasDevice, NasDevice>()
            .Match(d => !d.IsDeleted)
            .ExecuteAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<NasDevice?> GetNasDeviceByIdAsync(string id, CancellationToken ct = default)
    {
        _logger.LogDebug("Getting NAS device by ID: {Id}", id);

        try
        {
            var device = await DB.Find<NasDevice, NasDevice>().OneAsync(id, ct);

            // Return null if device is soft-deleted
            if (device != null && device.IsDeleted)
            {
                return null;
            }

            return device;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting NAS device by ID: {Id}", id);
            return null;
        }
    }

    /// <inheritdoc/>
    public async Task<List<NasDevice>> GetNasDevicesByRoleAsync(NasDeviceRole role, CancellationToken ct = default)
    {
        _logger.LogDebug("Getting NAS devices by role: {Role}", role);

        // Handle "Both" role - match devices that have the specific role OR "Both"
        if (role == NasDeviceRole.Input)
        {
            return await DB.Find<NasDevice, NasDevice>()
                .Match(d => !d.IsDeleted && (d.Role == NasDeviceRole.Input || d.Role == NasDeviceRole.Both))
                .ExecuteAsync(ct);
        }

        if (role == NasDeviceRole.Output)
        {
            return await DB.Find<NasDevice, NasDevice>()
                .Match(d => !d.IsDeleted && (d.Role == NasDeviceRole.Output || d.Role == NasDeviceRole.Both))
                .ExecuteAsync(ct);
        }

        return await DB.Find<NasDevice, NasDevice>()
            .Match(d => !d.IsDeleted && d.Role == role)
            .ExecuteAsync(ct);
    }

    /// <inheritdoc/>
    public async Task<NasDevice> CreateNasDeviceAsync(NasDevice device, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(device);

        _logger.LogInformation("Creating NAS device: {Name}", device.Name);

        // Initialize required fields
        device.CorrelationId = Guid.NewGuid().ToString();
        device.CreatedAt = DateTime.UtcNow;
        device.UpdatedAt = DateTime.UtcNow;
        device.IsDeleted = false;
        device.Version = 1;

        // Apply default mount options if not specified
        if (device.MountOptions == null || device.MountOptions.Count == 0)
        {
            device.MountOptions = new List<string> { "nfsvers=4", "nolock" };
        }

        await device.SaveAsync(cancellation: ct);

        _logger.LogInformation(
            "Created NAS device {Name} with ID {Id}",
            device.Name, device.ID);

        return device;
    }

    /// <inheritdoc/>
    public async Task<NasDevice?> UpdateNasDeviceAsync(string id, NasDevice device, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(device);

        _logger.LogInformation("Updating NAS device: {Id}", id);

        var existing = await GetNasDeviceByIdAsync(id, ct);
        if (existing == null)
        {
            _logger.LogWarning("NAS device not found for update: {Id}", id);
            return null;
        }

        // Update fields
        existing.Name = device.Name;
        existing.Description = device.Description;
        existing.Host = device.Host;
        existing.Port = device.Port;
        existing.ExportPath = device.ExportPath;
        existing.Role = device.Role;
        existing.StorageCapacity = device.StorageCapacity;
        existing.AccessMode = device.AccessMode;
        existing.ReclaimPolicy = device.ReclaimPolicy;
        existing.IsActive = device.IsActive;

        if (device.MountOptions != null && device.MountOptions.Count > 0)
        {
            existing.MountOptions = device.MountOptions;
        }

        existing.MarkAsModified();
        await existing.SaveAsync(cancellation: ct);

        _logger.LogInformation(
            "Updated NAS device {Name} with ID {Id}",
            existing.Name, existing.ID);

        return existing;
    }

    /// <inheritdoc/>
    public async Task<bool> DeleteNasDeviceAsync(string id, CancellationToken ct = default)
    {
        _logger.LogInformation("Attempting to delete NAS device: {Id}", id);

        // Check for referencing DataSources first
        var deleteCheck = await CanDeleteNasDeviceAsync(id, ct);
        if (!deleteCheck.CanDelete)
        {
            var dsNames = string.Join(", ", deleteCheck.ReferencingDataSources.Take(5).Select(ds => ds.Name));
            throw new InvalidOperationException(
                $"לא ניתן למחוק התקן NAS: מקושר ל-{deleteCheck.ReferencingDataSources.Count} מקורות נתונים: {dsNames}");
        }

        var existing = await GetNasDeviceByIdAsync(id, ct);
        if (existing == null)
        {
            _logger.LogWarning("NAS device not found for deletion: {Id}", id);
            return false;
        }

        // Soft delete
        existing.IsDeleted = true;
        existing.IsActive = false;
        existing.MarkAsModified();
        await existing.SaveAsync(cancellation: ct);

        _logger.LogInformation(
            "Soft deleted NAS device {Name} with ID {Id}",
            existing.Name, existing.ID);

        return true;
    }

    // ========== Provisioning ==========

    /// <inheritdoc/>
    public async Task<NasDeviceProvisionResult> ProvisionNasDeviceAsync(
        string id,
        ProvisionNasDeviceRequest request,
        CancellationToken ct = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var result = new NasDeviceProvisionResult();

        _logger.LogInformation(
            "Provisioning K8s resources for NAS device {Id} in namespace {Namespace}",
            id, request.Namespace);

        try
        {
            var device = await GetNasDeviceByIdAsync(id, ct);
            if (device == null)
            {
                result.ErrorMessage = $"התקן NAS לא נמצא: {id}";
                result.DurationMs = stopwatch.ElapsedMilliseconds;
                return result;
            }

            result.PvName = device.PvName;
            result.PvcName = device.PvcName;

            // Create PersistentVolume
            if (request.CreatePv)
            {
                try
                {
                    await _nasResourceService.CreatePersistentVolumeAsync(device, ct);
                    result.PvCreated = true;
                    device.IsPvCreated = true;

                    _logger.LogInformation("Created PV {PvName} for NAS device {Name}", device.PvName, device.Name);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create PV for NAS device {Id}", id);
                    result.ErrorMessage = $"שגיאה ביצירת PersistentVolume: {ex.Message}";
                    device.ProvisioningError = result.ErrorMessage;
                    device.MarkAsModified();
                    await device.SaveAsync(cancellation: ct);
                    result.DurationMs = stopwatch.ElapsedMilliseconds;
                    return result;
                }
            }

            // Create PersistentVolumeClaim
            if (request.CreatePvc)
            {
                try
                {
                    await _nasResourceService.CreatePersistentVolumeClaimAsync(device, request.Namespace, ct);
                    result.PvcCreated = true;

                    _logger.LogInformation("Created PVC {PvcName} for NAS device {Name}", device.PvcName, device.Name);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create PVC for NAS device {Id}", id);
                    result.ErrorMessage = $"שגיאה ביצירת PersistentVolumeClaim: {ex.Message}";
                    device.ProvisioningError = result.ErrorMessage;
                    device.MarkAsModified();
                    await device.SaveAsync(cancellation: ct);
                    result.DurationMs = stopwatch.ElapsedMilliseconds;
                    return result;
                }
            }

            // Wait for PVC binding
            if (request.WaitForBinding && request.CreatePvc)
            {
                var timeout = TimeSpan.FromSeconds(request.TimeoutSeconds);
                var isBound = await _nasResourceService.WaitForPvcBoundAsync(
                    device.PvcName, request.Namespace, timeout, ct);

                result.PvcBound = isBound;
                device.IsPvcBound = isBound;

                if (!isBound)
                {
                    _logger.LogWarning(
                        "PVC {PvcName} did not bind within {Timeout}s for NAS device {Name}",
                        device.PvcName, request.TimeoutSeconds, device.Name);
                }
                else
                {
                    _logger.LogInformation(
                        "PVC {PvcName} bound successfully for NAS device {Name}",
                        device.PvcName, device.Name);
                }
            }

            // Auto-mount to deployments after PVC binding
            if (result.PvcBound)
            {
                var (mounted, failed) = await AutoMountToDeploymentsAsync(device, request.Namespace, ct);
                result.MountedDeployments = mounted;
                result.FailedMounts = failed;

                _logger.LogInformation(
                    "Auto-mount completed for NAS {Name}: {MountedCount} mounted, {FailedCount} failed",
                    device.Name, mounted.Count, failed.Count);
            }

            // Update device provisioning status
            device.SetProvisioningResult(
                result.PvCreated,
                result.PvcBound,
                null);

            await device.SaveAsync(cancellation: ct);

            result.Success = result.PvCreated && (request.CreatePvc ? result.PvcCreated : true);
            result.DurationMs = stopwatch.ElapsedMilliseconds;

            _logger.LogInformation(
                "Provisioning completed for NAS device {Name}: PV={PvCreated}, PVC={PvcCreated}, Bound={PvcBound} in {DurationMs}ms",
                device.Name, result.PvCreated, result.PvcCreated, result.PvcBound, result.DurationMs);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error provisioning K8s resources for NAS device {Id}", id);
            result.ErrorMessage = $"שגיאה בהקצאת משאבי Kubernetes: {ex.Message}";
            result.DurationMs = stopwatch.ElapsedMilliseconds;
            return result;
        }
    }

    /// <inheritdoc/>
    public async Task<bool> DeprovisionNasDeviceAsync(string id, string namespace_, CancellationToken ct = default)
    {
        _logger.LogInformation("Deprovisioning K8s resources for NAS device {Id}", id);

        var device = await GetNasDeviceByIdAsync(id, ct);
        if (device == null)
        {
            _logger.LogWarning("NAS device not found for deprovisioning: {Id}", id);
            return false;
        }

        var ns = string.IsNullOrEmpty(namespace_) ? "ez-platform" : namespace_;

        // Step 1: Remove volume mounts from target deployments BEFORE deleting PVC
        var targetDeployments = GetTargetDeployments(device.Role);
        foreach (var deploymentName in targetDeployments)
        {
            try
            {
                await _nasResourceService.RemoveNasMountFromDeploymentAsync(
                    deploymentName, ns, device.Name, ct);

                _logger.LogInformation(
                    "Removed NAS mount for {DeviceName} from deployment {Deployment}",
                    device.Name, deploymentName);
            }
            catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.NotFound)
            {
                _logger.LogDebug(
                    "Deployment {Deployment} not found, skipping unmount",
                    deploymentName);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Failed to remove NAS mount from deployment {Deployment}, continuing with deprovision",
                    deploymentName);
            }
        }

        // Step 2: Delete PVC (must be deleted before PV)
        var pvcDeleted = await _nasResourceService.DeletePersistentVolumeClaimAsync(device.PvcName, ns, ct);
        if (!pvcDeleted)
        {
            _logger.LogWarning("Failed to delete PVC {PvcName} for NAS device {Name}", device.PvcName, device.Name);
        }

        // Step 3: Delete PV
        var pvDeleted = await _nasResourceService.DeletePersistentVolumeAsync(device.PvName, ct);
        if (!pvDeleted)
        {
            _logger.LogWarning("Failed to delete PV {PvName} for NAS device {Name}", device.PvName, device.Name);
        }

        // Step 4: Update device status
        device.IsPvCreated = !pvDeleted;
        device.IsPvcBound = !pvcDeleted;
        device.LastProvisionedAt = null;
        device.ProvisioningError = null;
        device.MarkAsModified();
        await device.SaveAsync(cancellation: ct);

        _logger.LogInformation(
            "Deprovisioned K8s resources for NAS device {Name}: PV deleted={PvDeleted}, PVC deleted={PvcDeleted}, mounts removed from {DeploymentCount} deployments",
            device.Name, pvDeleted, pvcDeleted, targetDeployments.Count);

        return pvDeleted && pvcDeleted;
    }

    // ========== Connection Testing ==========

    /// <inheritdoc/>
    public async Task<NasDeviceConnectionTestResult> TestConnectionAsync(string id, CancellationToken ct = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var result = new NasDeviceConnectionTestResult();

        _logger.LogInformation("Testing connection for NAS device {Id}", id);

        try
        {
            var device = await GetNasDeviceByIdAsync(id, ct);
            if (device == null)
            {
                result.ErrorMessage = $"התקן NAS לא נמצא: {id}";
                result.DurationMs = stopwatch.ElapsedMilliseconds;
                return result;
            }

            // NFS connection test strategy:
            // - If PVC is bound, the NFS mount is working (K8s verified it)
            // - If not provisioned, do a TCP connectivity test to verify NFS server is reachable
            // - This allows health monitoring even before K8s provisioning

            // Step 1: Always test actual TCP connectivity to NFS server
            bool tcpReachable = false;
            try
            {
                using var tcpClient = new System.Net.Sockets.TcpClient();
                var connectTask = tcpClient.ConnectAsync(device.Host, device.Port);
                var timeoutTask = Task.Delay(TimeSpan.FromSeconds(3), ct);
                var completedTask = await Task.WhenAny(connectTask, timeoutTask);
                tcpReachable = completedTask == connectTask && tcpClient.Connected;
            }
            catch { /* TCP failed */ }

            // Step 2: Check PVC status if provisioned
            string? pvcStatus = null;
            if (device.IsProvisioned)
            {
                pvcStatus = await _nasResourceService.GetPvcBindingStatusAsync(
                    device.PvcName, "ez-platform", ct);
            }

            // Step 3: Build result combining both checks
            if (device.IsProvisioned)
            {
                if (tcpReachable && pvcStatus == "Bound")
                {
                    result.Success = true;
                    result.Message = $"חיבור NFS תקין - שרת נגיש, PVC מחובר ל-PV";
                    device.SetConnectionTestResult(true);
                }
                else if (!tcpReachable && pvcStatus == "Bound")
                {
                    result.Success = false;
                    result.ErrorMessage = $"שרת NFS לא נגיש ב-{device.Host}:{device.Port} - PVC מחובר אך השרת לא מגיב";
                    device.SetConnectionTestResult(false, result.ErrorMessage);
                }
                else if (tcpReachable && pvcStatus != "Bound")
                {
                    result.Success = false;
                    result.ErrorMessage = $"שרת NFS נגיש אך PVC לא מחובר (סטטוס: {pvcStatus})";
                    device.SetConnectionTestResult(false, result.ErrorMessage);
                }
                else
                {
                    result.Success = false;
                    result.ErrorMessage = $"שרת NFS לא נגיש ב-{device.Host}:{device.Port}, PVC לא מחובר (סטטוס: {pvcStatus})";
                    device.SetConnectionTestResult(false, result.ErrorMessage);
                }
            }
            else
            {
                if (tcpReachable)
                {
                    result.Success = true;
                    result.Message = $"שרת NFS נגיש ב-{device.Host}:{device.Port} (לא הוקצה - בדיקת רשת בלבד)";
                    device.SetConnectionTestResult(true);
                }
                else
                {
                    result.Success = false;
                    result.ErrorMessage = $"לא ניתן להתחבר ל-{device.Host}:{device.Port} - שרת NFS לא נגיש";
                    device.SetConnectionTestResult(false, result.ErrorMessage);
                }
            }

            await device.SaveAsync(cancellation: ct);

            result.DurationMs = stopwatch.ElapsedMilliseconds;

            _logger.LogInformation(
                "Connection test for NAS device {Name}: Success={Success} in {DurationMs}ms",
                device.Name, result.Success, result.DurationMs);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error testing connection for NAS device {Id}", id);
            result.ErrorMessage = $"שגיאה בבדיקת חיבור: {ex.Message}";
            result.DurationMs = stopwatch.ElapsedMilliseconds;
            return result;
        }
    }

    // ========== Delete Protection ==========

    /// <inheritdoc/>
    public async Task<NasDeviceDeleteCheckResult> CanDeleteNasDeviceAsync(
        string id,
        CancellationToken ct = default)
    {
        var result = new NasDeviceDeleteCheckResult { CanDelete = true };

        _logger.LogDebug("Checking if NAS device {Id} can be deleted", id);

        // Check for referencing DataSources
        var referencingDataSources = await DB.Find<DataProcessingDataSource>()
            .Match(ds => ds.NasDeviceId == id && !ds.IsDeleted)
            .ExecuteAsync(ct);

        if (referencingDataSources.Any())
        {
            result.CanDelete = false;
            result.BlockingReason = $"התקן NAS מקושר ל-{referencingDataSources.Count} מקורות נתונים";
            result.ReferencingDataSources = referencingDataSources
                .Select(ds => new DataSourceReference { Id = ds.ID, Name = ds.Name })
                .ToList();

            _logger.LogInformation(
                "NAS device {Id} cannot be deleted: referenced by {Count} DataSources",
                id, referencingDataSources.Count);
        }

        return result;
    }

    // ========== Auto-Mount Operations ==========

    /// <summary>
    /// Auto-mount NAS volume to target deployments based on device role.
    /// </summary>
    private async Task<(List<string> Mounted, List<string> Failed)> AutoMountToDeploymentsAsync(
        NasDevice device, string namespace_, CancellationToken ct)
    {
        var targetDeployments = GetTargetDeployments(device.Role);
        var mounted = new List<string>();
        var failed = new List<string>();

        foreach (var deploymentName in targetDeployments)
        {
            try
            {
                await _nasResourceService.AddNasMountToDeploymentAsync(
                    deploymentName, namespace_, device, ct);
                mounted.Add(deploymentName);
                _logger.LogInformation(
                    "Auto-mounted NAS {DeviceName} to deployment {Deployment}",
                    device.Name, deploymentName);
            }
            catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.NotFound)
            {
                failed.Add($"{deploymentName}: Deployment not found");
                _logger.LogWarning("Deployment {Deployment} not found, skipping mount", deploymentName);
            }
            catch (Exception ex)
            {
                failed.Add($"{deploymentName}: {ex.Message}");
                _logger.LogError(ex, "Failed to mount NAS {DeviceName} to {Deployment}",
                    device.Name, deploymentName);
            }
        }
        return (mounted, failed);
    }

    /// <summary>
    /// Get target deployment names based on NAS device role.
    /// </summary>
    private static List<string> GetTargetDeployments(NasDeviceRole role)
    {
        // datasource-management always included: hosts FileOperationsController
        // which needs filesystem access to NAS mount paths
        return role switch
        {
            NasDeviceRole.Input => new List<string> { "filediscovery", "fileprocessor", "datasource-management" },
            NasDeviceRole.Output => new List<string> { "output", "datasource-management" },
            NasDeviceRole.Both => new List<string> { "filediscovery", "fileprocessor", "output", "datasource-management" },
            NasDeviceRole.Backup => new List<string> { "output", "datasource-management" },
            _ => new List<string>()
        };
    }
}
