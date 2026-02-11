using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.Shared.Entities;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Service interface for managing NAS (Network Attached Storage) devices.
/// Provides CRUD operations, K8s provisioning, and connection testing.
/// v0.2.0: NAS/NFS Architecture Support
/// </summary>
public interface INasDeviceService
{
    // ========== CRUD Operations ==========

    /// <summary>
    /// Get all NAS devices.
    /// </summary>
    /// <param name="includeDeleted">Whether to include soft-deleted devices</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>List of NAS devices</returns>
    Task<List<NasDevice>> GetAllNasDevicesAsync(bool includeDeleted = false, CancellationToken ct = default);

    /// <summary>
    /// Get a NAS device by ID.
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>NAS device or null if not found</returns>
    Task<NasDevice?> GetNasDeviceByIdAsync(string id, CancellationToken ct = default);

    /// <summary>
    /// Get NAS devices by role.
    /// </summary>
    /// <param name="role">NAS device role (Input, Output, Backup, Both)</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>List of NAS devices with the specified role</returns>
    Task<List<NasDevice>> GetNasDevicesByRoleAsync(NasDeviceRole role, CancellationToken ct = default);

    /// <summary>
    /// Create a new NAS device.
    /// </summary>
    /// <param name="device">NAS device to create</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Created NAS device</returns>
    Task<NasDevice> CreateNasDeviceAsync(NasDevice device, CancellationToken ct = default);

    /// <summary>
    /// Update an existing NAS device.
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="device">Updated NAS device data</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Updated NAS device or null if not found</returns>
    Task<NasDevice?> UpdateNasDeviceAsync(string id, NasDevice device, CancellationToken ct = default);

    /// <summary>
    /// Delete a NAS device (soft delete).
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>True if deleted, false if not found</returns>
    Task<bool> DeleteNasDeviceAsync(string id, CancellationToken ct = default);

    // ========== Provisioning ==========

    /// <summary>
    /// Provision Kubernetes resources (PV/PVC) for a NAS device.
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="request">Provisioning request</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Provisioning result</returns>
    Task<NasDeviceProvisionResult> ProvisionNasDeviceAsync(string id, ProvisionNasDeviceRequest request, CancellationToken ct = default);

    /// <summary>
    /// Deprovision Kubernetes resources (PV/PVC) for a NAS device.
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="namespace_">Kubernetes namespace</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>True if deprovisioned successfully</returns>
    Task<bool> DeprovisionNasDeviceAsync(string id, string namespace_, CancellationToken ct = default);

    // ========== Connection Testing ==========

    /// <summary>
    /// Test connection to a NAS device.
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Connection test result</returns>
    Task<NasDeviceConnectionTestResult> TestConnectionAsync(string id, CancellationToken ct = default);

    // ========== Delete Protection ==========

    /// <summary>
    /// Check if a NAS device can be deleted (no DataSources reference it).
    /// </summary>
    /// <param name="id">NAS device ID</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Delete check result with referencing DataSources if blocked</returns>
    Task<NasDeviceDeleteCheckResult> CanDeleteNasDeviceAsync(string id, CancellationToken ct = default);
}
