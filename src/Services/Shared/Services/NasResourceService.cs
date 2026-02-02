using k8s;
using k8s.Autorest;
using k8s.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using DataProcessing.Shared.Entities;
using System.Diagnostics;
using System.Diagnostics.Metrics;
using System.Net;

namespace DataProcessing.Shared.Services;

/// <summary>
/// Service for managing Kubernetes storage resources (PersistentVolumes, PersistentVolumeClaims)
/// for NAS devices. Implements dynamic NFS-based storage provisioning via the Kubernetes API.
/// v0.2.0: NAS/NFS Architecture Support
/// </summary>
public class NasResourceService : INasResourceService
{
    private readonly IKubernetes _k8sClient;
    private readonly ILogger<NasResourceService> _logger;
    private readonly string _defaultNamespace;

    // OpenTelemetry Instrumentation
    private static readonly ActivitySource ActivitySource = new("DataProcessing.NasResourceService", "1.0.0");
    private static readonly Meter Meter = new("DataProcessing.NasResourceService", "1.0.0");

    // Metrics
    private static readonly Counter<long> PvOperationCounter = Meter.CreateCounter<long>(
        "nas_pv_operations_total",
        description: "Total number of PersistentVolume operations",
        unit: "operations");

    private static readonly Counter<long> PvcOperationCounter = Meter.CreateCounter<long>(
        "nas_pvc_operations_total",
        description: "Total number of PersistentVolumeClaim operations",
        unit: "operations");

    private static readonly Histogram<double> OperationDuration = Meter.CreateHistogram<double>(
        "nas_operation_duration_seconds",
        description: "Duration of NAS resource operations",
        unit: "s");

    /// <summary>
    /// Create a new NasResourceService instance.
    /// </summary>
    /// <param name="k8sClient">Kubernetes API client</param>
    /// <param name="logger">Logger instance</param>
    /// <param name="configuration">Application configuration for default namespace</param>
    public NasResourceService(
        IKubernetes k8sClient,
        ILogger<NasResourceService> logger,
        IConfiguration configuration)
    {
        _k8sClient = k8sClient ?? throw new ArgumentNullException(nameof(k8sClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _defaultNamespace = configuration["Kubernetes:Namespace"] ?? "ez-platform";
    }

    // ========== PersistentVolume Operations ==========

    /// <inheritdoc/>
    public async Task<V1PersistentVolume> CreatePersistentVolumeAsync(NasDevice device, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(device);

        var stopwatch = Stopwatch.StartNew();
        using var activity = ActivitySource.StartActivity("CreatePersistentVolume");
        activity?.SetTag("nas.device", device.Name);
        activity?.SetTag("nas.pv_name", device.PvName);
        activity?.SetTag("nas.host", device.Host);

        try
        {
            _logger.LogInformation(
                "Creating PersistentVolume {PvName} for NAS device {DeviceName} at {Host}:{ExportPath}",
                device.PvName, device.Name, device.Host, device.ExportPath);

            var pv = BuildPersistentVolume(device);

            try
            {
                var created = await _k8sClient.CoreV1.CreatePersistentVolumeAsync(pv, cancellationToken: ct);

                stopwatch.Stop();
                RecordMetrics("create", "pv", "success", stopwatch.Elapsed);

                _logger.LogInformation(
                    "Created PersistentVolume {PvName} in {DurationMs}ms",
                    device.PvName, stopwatch.ElapsedMilliseconds);

                activity?.SetStatus(ActivityStatusCode.Ok);
                return created;
            }
            catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.Conflict)
            {
                // PV already exists, read and return it
                _logger.LogWarning("PersistentVolume {PvName} already exists, returning existing", device.PvName);

                var existing = await _k8sClient.CoreV1.ReadPersistentVolumeAsync(device.PvName, cancellationToken: ct);

                stopwatch.Stop();
                RecordMetrics("create", "pv", "already_exists", stopwatch.Elapsed);

                activity?.SetStatus(ActivityStatusCode.Ok);
                return existing;
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            RecordMetrics("create", "pv", "error", stopwatch.Elapsed);

            _logger.LogError(ex,
                "Failed to create PersistentVolume {PvName} for NAS device {DeviceName}",
                device.PvName, device.Name);

            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<V1PersistentVolume?> GetPersistentVolumeAsync(string pvName, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(pvName);

        try
        {
            return await _k8sClient.CoreV1.ReadPersistentVolumeAsync(pvName, cancellationToken: ct);
        }
        catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.NotFound)
        {
            _logger.LogDebug("PersistentVolume {PvName} not found", pvName);
            return null;
        }
    }

    /// <inheritdoc/>
    public async Task<bool> DeletePersistentVolumeAsync(string pvName, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(pvName);

        var stopwatch = Stopwatch.StartNew();
        using var activity = ActivitySource.StartActivity("DeletePersistentVolume");
        activity?.SetTag("nas.pv_name", pvName);

        try
        {
            _logger.LogInformation("Deleting PersistentVolume {PvName}", pvName);

            await _k8sClient.CoreV1.DeletePersistentVolumeAsync(pvName, cancellationToken: ct);

            stopwatch.Stop();
            RecordMetrics("delete", "pv", "success", stopwatch.Elapsed);

            _logger.LogInformation(
                "Deleted PersistentVolume {PvName} in {DurationMs}ms",
                pvName, stopwatch.ElapsedMilliseconds);

            activity?.SetStatus(ActivityStatusCode.Ok);
            return true;
        }
        catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.NotFound)
        {
            stopwatch.Stop();
            RecordMetrics("delete", "pv", "not_found", stopwatch.Elapsed);

            _logger.LogDebug("PersistentVolume {PvName} not found for deletion", pvName);
            activity?.SetStatus(ActivityStatusCode.Ok);
            return true;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            RecordMetrics("delete", "pv", "error", stopwatch.Elapsed);

            _logger.LogError(ex, "Failed to delete PersistentVolume {PvName}", pvName);
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            return false;
        }
    }

    // ========== PersistentVolumeClaim Operations ==========

    /// <inheritdoc/>
    public async Task<V1PersistentVolumeClaim> CreatePersistentVolumeClaimAsync(
        NasDevice device,
        string namespace_,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(device);
        var ns = string.IsNullOrEmpty(namespace_) ? _defaultNamespace : namespace_;

        var stopwatch = Stopwatch.StartNew();
        using var activity = ActivitySource.StartActivity("CreatePersistentVolumeClaim");
        activity?.SetTag("nas.device", device.Name);
        activity?.SetTag("nas.pvc_name", device.PvcName);
        activity?.SetTag("nas.namespace", ns);

        try
        {
            _logger.LogInformation(
                "Creating PersistentVolumeClaim {PvcName} in namespace {Namespace} for NAS device {DeviceName}",
                device.PvcName, ns, device.Name);

            var pvc = BuildPersistentVolumeClaim(device, ns);

            try
            {
                var created = await _k8sClient.CoreV1.CreateNamespacedPersistentVolumeClaimAsync(
                    pvc, ns, cancellationToken: ct);

                stopwatch.Stop();
                RecordMetrics("create", "pvc", "success", stopwatch.Elapsed);

                _logger.LogInformation(
                    "Created PersistentVolumeClaim {PvcName} in namespace {Namespace} in {DurationMs}ms",
                    device.PvcName, ns, stopwatch.ElapsedMilliseconds);

                activity?.SetStatus(ActivityStatusCode.Ok);
                return created;
            }
            catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.Conflict)
            {
                // PVC already exists, read and return it
                _logger.LogWarning(
                    "PersistentVolumeClaim {PvcName} already exists in namespace {Namespace}, returning existing",
                    device.PvcName, ns);

                var existing = await _k8sClient.CoreV1.ReadNamespacedPersistentVolumeClaimAsync(
                    device.PvcName, ns, cancellationToken: ct);

                stopwatch.Stop();
                RecordMetrics("create", "pvc", "already_exists", stopwatch.Elapsed);

                activity?.SetStatus(ActivityStatusCode.Ok);
                return existing;
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            RecordMetrics("create", "pvc", "error", stopwatch.Elapsed);

            _logger.LogError(ex,
                "Failed to create PersistentVolumeClaim {PvcName} in namespace {Namespace} for NAS device {DeviceName}",
                device.PvcName, ns, device.Name);

            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<V1PersistentVolumeClaim?> GetPersistentVolumeClaimAsync(
        string pvcName,
        string namespace_,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(pvcName);
        var ns = string.IsNullOrEmpty(namespace_) ? _defaultNamespace : namespace_;

        try
        {
            return await _k8sClient.CoreV1.ReadNamespacedPersistentVolumeClaimAsync(
                pvcName, ns, cancellationToken: ct);
        }
        catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.NotFound)
        {
            _logger.LogDebug("PersistentVolumeClaim {PvcName} not found in namespace {Namespace}", pvcName, ns);
            return null;
        }
    }

    /// <inheritdoc/>
    public async Task<bool> DeletePersistentVolumeClaimAsync(
        string pvcName,
        string namespace_,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(pvcName);
        var ns = string.IsNullOrEmpty(namespace_) ? _defaultNamespace : namespace_;

        var stopwatch = Stopwatch.StartNew();
        using var activity = ActivitySource.StartActivity("DeletePersistentVolumeClaim");
        activity?.SetTag("nas.pvc_name", pvcName);
        activity?.SetTag("nas.namespace", ns);

        try
        {
            _logger.LogInformation(
                "Deleting PersistentVolumeClaim {PvcName} from namespace {Namespace}",
                pvcName, ns);

            await _k8sClient.CoreV1.DeleteNamespacedPersistentVolumeClaimAsync(
                pvcName, ns, cancellationToken: ct);

            stopwatch.Stop();
            RecordMetrics("delete", "pvc", "success", stopwatch.Elapsed);

            _logger.LogInformation(
                "Deleted PersistentVolumeClaim {PvcName} from namespace {Namespace} in {DurationMs}ms",
                pvcName, ns, stopwatch.ElapsedMilliseconds);

            activity?.SetStatus(ActivityStatusCode.Ok);
            return true;
        }
        catch (HttpOperationException ex) when (ex.Response.StatusCode == HttpStatusCode.NotFound)
        {
            stopwatch.Stop();
            RecordMetrics("delete", "pvc", "not_found", stopwatch.Elapsed);

            _logger.LogDebug(
                "PersistentVolumeClaim {PvcName} not found in namespace {Namespace} for deletion",
                pvcName, ns);
            activity?.SetStatus(ActivityStatusCode.Ok);
            return true;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            RecordMetrics("delete", "pvc", "error", stopwatch.Elapsed);

            _logger.LogError(ex,
                "Failed to delete PersistentVolumeClaim {PvcName} from namespace {Namespace}",
                pvcName, ns);
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            return false;
        }
    }

    // ========== Status Checking ==========

    /// <inheritdoc/>
    public async Task<string> GetPvcBindingStatusAsync(
        string pvcName,
        string namespace_,
        CancellationToken ct = default)
    {
        var pvc = await GetPersistentVolumeClaimAsync(pvcName, namespace_, ct);
        return pvc?.Status?.Phase ?? "NotFound";
    }

    /// <inheritdoc/>
    public async Task<bool> WaitForPvcBoundAsync(
        string pvcName,
        string namespace_,
        TimeSpan timeout,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(pvcName);
        var ns = string.IsNullOrEmpty(namespace_) ? _defaultNamespace : namespace_;

        var stopwatch = Stopwatch.StartNew();
        using var activity = ActivitySource.StartActivity("WaitForPvcBound");
        activity?.SetTag("nas.pvc_name", pvcName);
        activity?.SetTag("nas.namespace", ns);
        activity?.SetTag("nas.timeout_seconds", timeout.TotalSeconds);

        _logger.LogInformation(
            "Waiting for PersistentVolumeClaim {PvcName} in namespace {Namespace} to be bound (timeout: {TimeoutSec}s)",
            pvcName, ns, timeout.TotalSeconds);

        var pollingInterval = TimeSpan.FromSeconds(2);

        while (stopwatch.Elapsed < timeout)
        {
            ct.ThrowIfCancellationRequested();

            var status = await GetPvcBindingStatusAsync(pvcName, ns, ct);

            if (status == "Bound")
            {
                _logger.LogInformation(
                    "PersistentVolumeClaim {PvcName} became bound in {DurationMs}ms",
                    pvcName, stopwatch.ElapsedMilliseconds);

                activity?.SetTag("nas.bound_duration_ms", stopwatch.ElapsedMilliseconds);
                activity?.SetStatus(ActivityStatusCode.Ok);
                return true;
            }

            if (status == "Lost")
            {
                _logger.LogWarning(
                    "PersistentVolumeClaim {PvcName} in Lost state, stopping wait",
                    pvcName);

                activity?.SetTag("nas.final_status", "Lost");
                activity?.SetStatus(ActivityStatusCode.Error, "PVC in Lost state");
                return false;
            }

            _logger.LogDebug(
                "PersistentVolumeClaim {PvcName} status: {Status}, waiting...",
                pvcName, status);

            await Task.Delay(pollingInterval, ct);
        }

        _logger.LogWarning(
            "Timeout waiting for PersistentVolumeClaim {PvcName} to be bound after {TimeoutSec}s",
            pvcName, timeout.TotalSeconds);

        activity?.SetTag("nas.final_status", "Timeout");
        activity?.SetStatus(ActivityStatusCode.Error, "Timeout waiting for PVC binding");
        return false;
    }

    // ========== Deployment Operations ==========

    /// <inheritdoc/>
    public async Task<V1Deployment> AddNasMountToDeploymentAsync(
        string deploymentName,
        string namespace_,
        NasDevice device,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(deploymentName);
        ArgumentNullException.ThrowIfNull(device);
        var ns = string.IsNullOrEmpty(namespace_) ? _defaultNamespace : namespace_;

        var stopwatch = Stopwatch.StartNew();
        using var activity = ActivitySource.StartActivity("AddNasMountToDeployment");
        activity?.SetTag("nas.device", device.Name);
        activity?.SetTag("nas.deployment", deploymentName);
        activity?.SetTag("nas.namespace", ns);
        activity?.SetTag("nas.mount_path", device.MountPath);

        try
        {
            _logger.LogInformation(
                "Adding NAS mount for device {DeviceName} to deployment {DeploymentName} in namespace {Namespace}",
                device.Name, deploymentName, ns);

            // Read current deployment
            var deployment = await _k8sClient.AppsV1.ReadNamespacedDeploymentAsync(
                deploymentName, ns, cancellationToken: ct);

            var volumeName = $"nas-{device.Name.ToLowerInvariant().Replace(" ", "-")}";
            var isReadOnly = device.Role == NasDeviceRole.Backup;

            // Initialize volumes list if null
            deployment.Spec.Template.Spec.Volumes ??= new List<V1Volume>();

            // Check if volume already exists
            var existingVolume = deployment.Spec.Template.Spec.Volumes
                .FirstOrDefault(v => v.Name == volumeName);

            if (existingVolume == null)
            {
                // Add volume reference
                deployment.Spec.Template.Spec.Volumes.Add(new V1Volume
                {
                    Name = volumeName,
                    PersistentVolumeClaim = new V1PersistentVolumeClaimVolumeSource
                    {
                        ClaimName = device.PvcName,
                        ReadOnlyProperty = isReadOnly
                    }
                });
            }
            else
            {
                _logger.LogDebug("Volume {VolumeName} already exists in deployment {DeploymentName}",
                    volumeName, deploymentName);
            }

            // Add volume mount to first container
            var container = deployment.Spec.Template.Spec.Containers.First();
            container.VolumeMounts ??= new List<V1VolumeMount>();

            // Check if mount already exists
            var existingMount = container.VolumeMounts
                .FirstOrDefault(vm => vm.Name == volumeName);

            if (existingMount == null)
            {
                container.VolumeMounts.Add(new V1VolumeMount
                {
                    Name = volumeName,
                    MountPath = device.MountPath,
                    ReadOnlyProperty = isReadOnly
                });
            }
            else
            {
                _logger.LogDebug("VolumeMount {VolumeName} already exists in container", volumeName);
            }

            // Replace deployment
            var updated = await _k8sClient.AppsV1.ReplaceNamespacedDeploymentAsync(
                deployment, deploymentName, ns, cancellationToken: ct);

            stopwatch.Stop();
            RecordMetrics("mount", "deployment", "success", stopwatch.Elapsed);

            _logger.LogInformation(
                "Added NAS mount {MountPath} to deployment {DeploymentName} in {DurationMs}ms",
                device.MountPath, deploymentName, stopwatch.ElapsedMilliseconds);

            activity?.SetStatus(ActivityStatusCode.Ok);
            return updated;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            RecordMetrics("mount", "deployment", "error", stopwatch.Elapsed);

            _logger.LogError(ex,
                "Failed to add NAS mount for device {DeviceName} to deployment {DeploymentName}",
                device.Name, deploymentName);

            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<V1Deployment> RemoveNasMountFromDeploymentAsync(
        string deploymentName,
        string namespace_,
        string nasName,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(deploymentName);
        ArgumentException.ThrowIfNullOrEmpty(nasName);
        var ns = string.IsNullOrEmpty(namespace_) ? _defaultNamespace : namespace_;

        var stopwatch = Stopwatch.StartNew();
        using var activity = ActivitySource.StartActivity("RemoveNasMountFromDeployment");
        activity?.SetTag("nas.device", nasName);
        activity?.SetTag("nas.deployment", deploymentName);
        activity?.SetTag("nas.namespace", ns);

        try
        {
            _logger.LogInformation(
                "Removing NAS mount for device {DeviceName} from deployment {DeploymentName} in namespace {Namespace}",
                nasName, deploymentName, ns);

            // Read current deployment
            var deployment = await _k8sClient.AppsV1.ReadNamespacedDeploymentAsync(
                deploymentName, ns, cancellationToken: ct);

            var volumeName = $"nas-{nasName.ToLowerInvariant().Replace(" ", "-")}";

            // Remove volume
            if (deployment.Spec.Template.Spec.Volumes != null)
            {
                var volumeToRemove = deployment.Spec.Template.Spec.Volumes
                    .FirstOrDefault(v => v.Name == volumeName);

                if (volumeToRemove != null)
                {
                    deployment.Spec.Template.Spec.Volumes.Remove(volumeToRemove);
                }
            }

            // Remove volume mount from all containers
            foreach (var container in deployment.Spec.Template.Spec.Containers)
            {
                if (container.VolumeMounts != null)
                {
                    var mountToRemove = container.VolumeMounts
                        .FirstOrDefault(vm => vm.Name == volumeName);

                    if (mountToRemove != null)
                    {
                        container.VolumeMounts.Remove(mountToRemove);
                    }
                }
            }

            // Replace deployment
            var updated = await _k8sClient.AppsV1.ReplaceNamespacedDeploymentAsync(
                deployment, deploymentName, ns, cancellationToken: ct);

            stopwatch.Stop();
            RecordMetrics("unmount", "deployment", "success", stopwatch.Elapsed);

            _logger.LogInformation(
                "Removed NAS mount for device {DeviceName} from deployment {DeploymentName} in {DurationMs}ms",
                nasName, deploymentName, stopwatch.ElapsedMilliseconds);

            activity?.SetStatus(ActivityStatusCode.Ok);
            return updated;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            RecordMetrics("unmount", "deployment", "error", stopwatch.Elapsed);

            _logger.LogError(ex,
                "Failed to remove NAS mount for device {DeviceName} from deployment {DeploymentName}",
                nasName, deploymentName);

            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }
    }

    // ========== Private Helper Methods ==========

    /// <summary>
    /// Build a V1PersistentVolume from NasDevice configuration.
    /// </summary>
    private static V1PersistentVolume BuildPersistentVolume(NasDevice device)
    {
        return new V1PersistentVolume
        {
            ApiVersion = "v1",
            Kind = "PersistentVolume",
            Metadata = new V1ObjectMeta
            {
                Name = device.PvName,
                Labels = new Dictionary<string, string>
                {
                    ["type"] = "nfs",
                    ["nas-role"] = device.Role.ToString().ToLowerInvariant(),
                    ["nas-device"] = device.Name.ToLowerInvariant().Replace(" ", "-"),
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
    }

    /// <summary>
    /// Build a V1PersistentVolumeClaim from NasDevice configuration.
    /// Uses label selector for static binding to matching PV.
    /// </summary>
    private static V1PersistentVolumeClaim BuildPersistentVolumeClaim(NasDevice device, string namespace_)
    {
        return new V1PersistentVolumeClaim
        {
            ApiVersion = "v1",
            Kind = "PersistentVolumeClaim",
            Metadata = new V1ObjectMeta
            {
                Name = device.PvcName,
                NamespaceProperty = namespace_,
                Labels = new Dictionary<string, string>
                {
                    ["nas-device"] = device.Name.ToLowerInvariant().Replace(" ", "-"),
                    ["managed-by"] = "ez-platform"
                }
            },
            Spec = new V1PersistentVolumeClaimSpec
            {
                AccessModes = new List<string> { device.AccessMode },
                Resources = new V1VolumeResourceRequirements
                {
                    Requests = new Dictionary<string, ResourceQuantity>
                    {
                        ["storage"] = new ResourceQuantity(device.StorageCapacity)
                    }
                },
                Selector = new V1LabelSelector
                {
                    MatchLabels = new Dictionary<string, string>
                    {
                        ["nas-device"] = device.Name.ToLowerInvariant().Replace(" ", "-")
                    }
                }
                // NOTE: StorageClassName is intentionally NULL for static binding
                // Do NOT set to empty string - that has different semantics
            }
        };
    }

    /// <summary>
    /// Record metrics for NAS resource operations.
    /// </summary>
    private void RecordMetrics(string operation, string resourceType, string status, TimeSpan duration)
    {
        var tags = new TagList
        {
            { "operation", operation },
            { "resource_type", resourceType },
            { "status", status }
        };

        if (resourceType == "pv")
        {
            PvOperationCounter.Add(1, tags);
        }
        else if (resourceType == "pvc")
        {
            PvcOperationCounter.Add(1, tags);
        }

        OperationDuration.Record(duration.TotalSeconds, tags);
    }
}
