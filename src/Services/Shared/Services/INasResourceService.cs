using k8s.Models;
using DataProcessing.Shared.Entities;

namespace DataProcessing.Shared.Services;

/// <summary>
/// Service interface for managing Kubernetes storage resources (PersistentVolumes, PersistentVolumeClaims)
/// for NAS devices. Enables dynamic provisioning and mounting of NFS-based storage.
/// v0.2.0: NAS/NFS Architecture Support
/// </summary>
public interface INasResourceService
{
    // ========== PersistentVolume Operations ==========

    /// <summary>
    /// Create a PersistentVolume for the specified NAS device.
    /// Builds NFS-type PV with labels for PVC selector binding.
    /// </summary>
    /// <param name="device">NAS device configuration</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Created or existing PersistentVolume</returns>
    Task<V1PersistentVolume> CreatePersistentVolumeAsync(NasDevice device, CancellationToken ct = default);

    /// <summary>
    /// Get a PersistentVolume by name.
    /// </summary>
    /// <param name="pvName">PersistentVolume name</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>PersistentVolume if found, null otherwise</returns>
    Task<V1PersistentVolume?> GetPersistentVolumeAsync(string pvName, CancellationToken ct = default);

    /// <summary>
    /// Delete a PersistentVolume by name.
    /// </summary>
    /// <param name="pvName">PersistentVolume name</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>True if deleted or not found, false on error</returns>
    Task<bool> DeletePersistentVolumeAsync(string pvName, CancellationToken ct = default);

    // ========== PersistentVolumeClaim Operations ==========

    /// <summary>
    /// Create a PersistentVolumeClaim for the specified NAS device.
    /// Uses label selector binding to match the corresponding PV.
    /// </summary>
    /// <param name="device">NAS device configuration</param>
    /// <param name="namespace_">Kubernetes namespace for the PVC</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Created or existing PersistentVolumeClaim</returns>
    Task<V1PersistentVolumeClaim> CreatePersistentVolumeClaimAsync(NasDevice device, string namespace_, CancellationToken ct = default);

    /// <summary>
    /// Get a PersistentVolumeClaim by name and namespace.
    /// </summary>
    /// <param name="pvcName">PersistentVolumeClaim name</param>
    /// <param name="namespace_">Kubernetes namespace</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>PersistentVolumeClaim if found, null otherwise</returns>
    Task<V1PersistentVolumeClaim?> GetPersistentVolumeClaimAsync(string pvcName, string namespace_, CancellationToken ct = default);

    /// <summary>
    /// Delete a PersistentVolumeClaim by name and namespace.
    /// </summary>
    /// <param name="pvcName">PersistentVolumeClaim name</param>
    /// <param name="namespace_">Kubernetes namespace</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>True if deleted or not found, false on error</returns>
    Task<bool> DeletePersistentVolumeClaimAsync(string pvcName, string namespace_, CancellationToken ct = default);

    // ========== Status Checking ==========

    /// <summary>
    /// Get the binding status of a PersistentVolumeClaim.
    /// </summary>
    /// <param name="pvcName">PersistentVolumeClaim name</param>
    /// <param name="namespace_">Kubernetes namespace</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>PVC phase (Pending, Bound, Lost) or "NotFound"</returns>
    Task<string> GetPvcBindingStatusAsync(string pvcName, string namespace_, CancellationToken ct = default);

    /// <summary>
    /// Wait for a PersistentVolumeClaim to reach Bound status.
    /// Polls every 2 seconds until bound or timeout.
    /// </summary>
    /// <param name="pvcName">PersistentVolumeClaim name</param>
    /// <param name="namespace_">Kubernetes namespace</param>
    /// <param name="timeout">Maximum time to wait</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>True if PVC became bound, false on timeout</returns>
    Task<bool> WaitForPvcBoundAsync(string pvcName, string namespace_, TimeSpan timeout, CancellationToken ct = default);

    // ========== Deployment Operations ==========

    /// <summary>
    /// Add NAS volume mount to a deployment's first container.
    /// Creates PVC volume and mounts to the configured mount path.
    /// </summary>
    /// <param name="deploymentName">Deployment name</param>
    /// <param name="namespace_">Kubernetes namespace</param>
    /// <param name="device">NAS device configuration</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Updated Deployment</returns>
    Task<V1Deployment> AddNasMountToDeploymentAsync(string deploymentName, string namespace_, NasDevice device, CancellationToken ct = default);

    /// <summary>
    /// Remove NAS volume mount from a deployment.
    /// </summary>
    /// <param name="deploymentName">Deployment name</param>
    /// <param name="namespace_">Kubernetes namespace</param>
    /// <param name="nasName">NAS device name (used to identify volume)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Updated Deployment</returns>
    Task<V1Deployment> RemoveNasMountFromDeploymentAsync(string deploymentName, string namespace_, string nasName, CancellationToken ct = default);

    /// <summary>
    /// Trigger a rolling restart of a deployment by updating the restart annotation.
    /// </summary>
    /// <param name="deploymentName">Deployment name</param>
    /// <param name="namespace_">Kubernetes namespace</param>
    /// <param name="ct">Cancellation token</param>
    Task RestartDeploymentAsync(string deploymentName, string namespace_, CancellationToken ct = default);
}
