using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.ComponentModel.DataAnnotations;

namespace DataProcessing.Shared.Entities;

/// <summary>
/// Defines the role/purpose of a NAS device in the data processing pipeline
/// </summary>
public enum NasDeviceRole
{
    /// <summary>
    /// NAS device is used to read input files for processing
    /// </summary>
    Input,

    /// <summary>
    /// NAS device is used to write processed output files
    /// </summary>
    Output,

    /// <summary>
    /// NAS device is used for archive/backup storage
    /// </summary>
    Backup,

    /// <summary>
    /// NAS device supports both input and output operations
    /// </summary>
    Both
}

/// <summary>
/// Represents a NAS (Network Attached Storage) device configuration for NFS-based file access.
/// Stores connection details, Kubernetes resource names, and provisioning status.
/// Admins configure NAS devices which are then provisioned as PV/PVC for pod mounting.
/// </summary>
public class NasDevice : DataProcessingBaseEntity
{
    // ========== Basic Information ==========

    /// <summary>
    /// Display name for the NAS device (e.g., "Production Input NAS", "Backup Storage")
    /// </summary>
    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the NAS device purpose
    /// </summary>
    [StringLength(500)]
    public string? Description { get; set; }

    // ========== NFS Connection Configuration ==========

    /// <summary>
    /// NFS server hostname or IP address (e.g., "nas.internal.local" or "192.168.1.100")
    /// </summary>
    [Required]
    [StringLength(255)]
    public string Host { get; set; } = string.Empty;

    /// <summary>
    /// NFS server port (default: 2049)
    /// </summary>
    public int Port { get; set; } = 2049;

    /// <summary>
    /// NFS export path on the server.
    /// For NFSv4 with pseudo-root (fsid=0), use "/" which maps to the server's exported directory.
    /// </summary>
    [StringLength(500)]
    public string ExportPath { get; set; } = "/";

    // ========== Role Classification ==========

    /// <summary>
    /// How the NAS device is used in the data processing pipeline
    /// </summary>
    [BsonRepresentation(BsonType.String)]
    public NasDeviceRole Role { get; set; } = NasDeviceRole.Input;

    // ========== Computed Kubernetes Resource Names ==========

    /// <summary>
    /// Computed PersistentVolume name based on device name
    /// Format: "{name-lowercase}-pv"
    /// </summary>
    public string PvName => $"{Name.ToLowerInvariant().Replace(" ", "-")}-pv";

    /// <summary>
    /// Computed PersistentVolumeClaim name based on device name
    /// Format: "{name-lowercase}-pvc"
    /// </summary>
    public string PvcName => $"{Name.ToLowerInvariant().Replace(" ", "-")}-pvc";

    /// <summary>
    /// Computed mount path for pods
    /// Format: "/mnt/{name-lowercase}"
    /// </summary>
    public string MountPath => $"/mnt/{Name.ToLowerInvariant().Replace(" ", "-")}";

    // ========== Storage Configuration ==========

    /// <summary>
    /// Storage capacity for the PersistentVolume (e.g., "10Gi", "100Gi")
    /// </summary>
    [StringLength(20)]
    public string StorageCapacity { get; set; } = "10Gi";

    /// <summary>
    /// Access mode for the PV/PVC (default: ReadWriteMany for NFS)
    /// Options: ReadWriteOnce, ReadOnlyMany, ReadWriteMany
    /// </summary>
    [StringLength(20)]
    public string AccessMode { get; set; } = "ReadWriteMany";

    /// <summary>
    /// Reclaim policy for the PersistentVolume when PVC is deleted
    /// Options: Retain, Delete, Recycle
    /// </summary>
    [StringLength(20)]
    public string ReclaimPolicy { get; set; } = "Retain";

    /// <summary>
    /// NFS mount options for the PersistentVolume.
    /// Default: nfsvers=4 (required for cross-cluster NFS via NodePort), nolock (no NLM needed for NFSv4).
    /// </summary>
    public List<string> MountOptions { get; set; } = new() { "nfsvers=4", "nolock" };

    // ========== Provisioning Status ==========

    /// <summary>
    /// Whether the PersistentVolume has been created in Kubernetes
    /// </summary>
    public bool IsPvCreated { get; set; }

    /// <summary>
    /// Whether the PersistentVolumeClaim is bound to the PV
    /// </summary>
    public bool IsPvcBound { get; set; }

    /// <summary>
    /// Timestamp of the last successful provisioning operation
    /// </summary>
    public DateTime? LastProvisionedAt { get; set; }

    /// <summary>
    /// Error message from the last failed provisioning attempt
    /// </summary>
    [StringLength(1000)]
    public string? ProvisioningError { get; set; }

    // ========== Connection Testing ==========

    /// <summary>
    /// Timestamp of the last connection test
    /// </summary>
    public DateTime? LastConnectionTest { get; set; }

    /// <summary>
    /// Result of the last connection test
    /// </summary>
    public bool? LastConnectionSuccess { get; set; }

    /// <summary>
    /// Error message from the last failed connection test
    /// </summary>
    [StringLength(1000)]
    public string? LastConnectionError { get; set; }

    // ========== Activity Status ==========

    /// <summary>
    /// Whether the NAS device is active and available for use
    /// </summary>
    public bool IsActive { get; set; } = true;

    // ========== Helper Methods ==========

    /// <summary>
    /// Updates connection test result fields
    /// </summary>
    /// <param name="success">Whether the connection test succeeded</param>
    /// <param name="error">Error message if the test failed</param>
    public void SetConnectionTestResult(bool success, string? error = null)
    {
        LastConnectionTest = DateTime.UtcNow;
        LastConnectionSuccess = success;
        LastConnectionError = success ? null : error;
        MarkAsModified();
    }

    /// <summary>
    /// Updates provisioning result fields
    /// </summary>
    /// <param name="pvCreated">Whether the PV was created successfully</param>
    /// <param name="pvcBound">Whether the PVC is bound to the PV</param>
    /// <param name="error">Error message if provisioning failed</param>
    public void SetProvisioningResult(bool pvCreated, bool pvcBound, string? error = null)
    {
        IsPvCreated = pvCreated;
        IsPvcBound = pvcBound;
        ProvisioningError = error;

        if (pvCreated && pvcBound && string.IsNullOrEmpty(error))
        {
            LastProvisionedAt = DateTime.UtcNow;
        }

        MarkAsModified();
    }

    /// <summary>
    /// Checks if this NAS device can be used as an input source
    /// </summary>
    public bool CanBeInput => Role == NasDeviceRole.Input || Role == NasDeviceRole.Both;

    /// <summary>
    /// Checks if this NAS device can be used as an output destination
    /// </summary>
    public bool CanBeOutput => Role == NasDeviceRole.Output || Role == NasDeviceRole.Both;

    /// <summary>
    /// Checks if this NAS device is fully provisioned and ready for use
    /// </summary>
    public bool IsProvisioned => IsPvCreated && IsPvcBound && string.IsNullOrEmpty(ProvisioningError);
}
