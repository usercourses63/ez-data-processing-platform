using System.ComponentModel.DataAnnotations;
using DataProcessing.Shared.Entities;

namespace DataProcessing.DataSourceManagement.Models.Requests;

/// <summary>
/// Request model for creating a new NAS device
/// </summary>
public class CreateNasDeviceRequest
{
    /// <summary>
    /// Display name for the NAS device (e.g., "Production Input NAS", "Backup Storage")
    /// </summary>
    [Required(ErrorMessage = "שם התקן NAS נדרש")]
    [StringLength(100, ErrorMessage = "שם התקן NAS לא יכול להיות ארוך מ-100 תווים")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the NAS device purpose
    /// </summary>
    [StringLength(500, ErrorMessage = "תיאור לא יכול להיות ארוך מ-500 תווים")]
    public string? Description { get; set; }

    /// <summary>
    /// NFS server hostname or IP address
    /// </summary>
    [Required(ErrorMessage = "כתובת שרת NFS נדרשת")]
    [StringLength(255, ErrorMessage = "כתובת השרת לא יכולה להיות ארוכה מ-255 תווים")]
    public string Host { get; set; } = string.Empty;

    /// <summary>
    /// NFS server port (default: 2049)
    /// </summary>
    public int Port { get; set; } = 2049;

    /// <summary>
    /// NFS export path on the server. Use "/" for NFSv4 pseudo-root.
    /// </summary>
    [StringLength(500, ErrorMessage = "נתיב הייצוא לא יכול להיות ארוך מ-500 תווים")]
    public string ExportPath { get; set; } = "/";

    /// <summary>
    /// How the NAS device is used in the data processing pipeline
    /// </summary>
    [Required]
    public NasDeviceRole Role { get; set; } = NasDeviceRole.Input;

    // ========== Storage Configuration ==========

    /// <summary>
    /// Storage capacity for the PersistentVolume (e.g., "10Gi", "100Gi")
    /// </summary>
    [StringLength(20, ErrorMessage = "קיבולת אחסון לא יכולה להיות ארוכה מ-20 תווים")]
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
    /// Default: nfsvers=4, nolock (for cross-cluster NFS via NodePort).
    /// </summary>
    public List<string>? MountOptions { get; set; }
}

/// <summary>
/// Request model for updating an existing NAS device
/// </summary>
public class UpdateNasDeviceRequest
{
    /// <summary>
    /// Display name for the NAS device
    /// </summary>
    [Required(ErrorMessage = "שם התקן NAS נדרש")]
    [StringLength(100, ErrorMessage = "שם התקן NAS לא יכול להיות ארוך מ-100 תווים")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the NAS device purpose
    /// </summary>
    [StringLength(500, ErrorMessage = "תיאור לא יכול להיות ארוך מ-500 תווים")]
    public string? Description { get; set; }

    /// <summary>
    /// NFS server hostname or IP address
    /// </summary>
    [Required(ErrorMessage = "כתובת שרת NFS נדרשת")]
    [StringLength(255, ErrorMessage = "כתובת השרת לא יכולה להיות ארוכה מ-255 תווים")]
    public string Host { get; set; } = string.Empty;

    /// <summary>
    /// NFS server port
    /// </summary>
    public int Port { get; set; } = 2049;

    /// <summary>
    /// NFS export path on the server. Use "/" for NFSv4 pseudo-root.
    /// </summary>
    [StringLength(500, ErrorMessage = "נתיב הייצוא לא יכול להיות ארוך מ-500 תווים")]
    public string ExportPath { get; set; } = "/";

    /// <summary>
    /// How the NAS device is used in the data processing pipeline
    /// </summary>
    [Required]
    public NasDeviceRole Role { get; set; } = NasDeviceRole.Input;

    // ========== Storage Configuration ==========

    /// <summary>
    /// Storage capacity for the PersistentVolume
    /// </summary>
    [StringLength(20)]
    public string StorageCapacity { get; set; } = "10Gi";

    /// <summary>
    /// Access mode for the PV/PVC
    /// </summary>
    [StringLength(20)]
    public string AccessMode { get; set; } = "ReadWriteMany";

    /// <summary>
    /// Reclaim policy for the PersistentVolume
    /// </summary>
    [StringLength(20)]
    public string ReclaimPolicy { get; set; } = "Retain";

    /// <summary>
    /// NFS mount options for the PersistentVolume
    /// </summary>
    public List<string>? MountOptions { get; set; }

    /// <summary>
    /// Whether the NAS device is active
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Entity version for optimistic concurrency control (v0.3.0).
    /// Must match the current stored version or the update will be rejected with HTTP 409 Conflict.
    /// </summary>
    public long Version { get; set; }
}

/// <summary>
/// Request model for provisioning Kubernetes resources (PV/PVC) for a NAS device
/// </summary>
public class ProvisionNasDeviceRequest
{
    /// <summary>
    /// Kubernetes namespace for the PVC (default: ez-platform)
    /// </summary>
    [StringLength(63)]
    public string Namespace { get; set; } = "ez-platform";

    /// <summary>
    /// Whether to create the PersistentVolume
    /// </summary>
    public bool CreatePv { get; set; } = true;

    /// <summary>
    /// Whether to create the PersistentVolumeClaim
    /// </summary>
    public bool CreatePvc { get; set; } = true;

    /// <summary>
    /// Whether to wait for PVC to be bound before returning
    /// </summary>
    public bool WaitForBinding { get; set; } = true;

    /// <summary>
    /// Timeout in seconds for waiting for PVC binding (default: 60)
    /// </summary>
    [Range(5, 300, ErrorMessage = "זמן המתנה חייב להיות בין 5 ל-300 שניות")]
    public int TimeoutSeconds { get; set; } = 60;
}

/// <summary>
/// Result of a NAS device provisioning operation
/// </summary>
public class NasDeviceProvisionResult
{
    /// <summary>
    /// Whether the overall provisioning was successful
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Whether the PersistentVolume was created
    /// </summary>
    public bool PvCreated { get; set; }

    /// <summary>
    /// Whether the PersistentVolumeClaim was created
    /// </summary>
    public bool PvcCreated { get; set; }

    /// <summary>
    /// Whether the PVC is bound to the PV
    /// </summary>
    public bool PvcBound { get; set; }

    /// <summary>
    /// Name of the PersistentVolume
    /// </summary>
    public string? PvName { get; set; }

    /// <summary>
    /// Name of the PersistentVolumeClaim
    /// </summary>
    public string? PvcName { get; set; }

    /// <summary>
    /// Error message if provisioning failed
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Duration of the provisioning operation in milliseconds
    /// </summary>
    public long DurationMs { get; set; }

    /// <summary>
    /// List of deployment names where volume was successfully mounted
    /// </summary>
    public List<string> MountedDeployments { get; set; } = new();

    /// <summary>
    /// List of mount failures with deployment name and error message
    /// </summary>
    public List<string> FailedMounts { get; set; } = new();
}

/// <summary>
/// Result of a NAS device connection test
/// </summary>
public class NasDeviceConnectionTestResult
{
    /// <summary>
    /// Whether the connection test was successful
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Success message or status description
    /// </summary>
    public string? Message { get; set; }

    /// <summary>
    /// Error message if connection test failed
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Duration of the connection test in milliseconds
    /// </summary>
    public long DurationMs { get; set; }

    /// <summary>
    /// Timestamp of the test
    /// </summary>
    public DateTime TestedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Result of NAS device delete eligibility check
/// </summary>
public class NasDeviceDeleteCheckResult
{
    /// <summary>
    /// Whether the NAS device can be safely deleted
    /// </summary>
    public bool CanDelete { get; set; } = true;

    /// <summary>
    /// Reason why deletion is blocked (Hebrew)
    /// </summary>
    public string? BlockingReason { get; set; }

    /// <summary>
    /// List of DataSources referencing this NAS device
    /// </summary>
    public List<DataSourceReference> ReferencingDataSources { get; set; } = new();
}

/// <summary>
/// Reference to a DataSource for delete check results
/// </summary>
public class DataSourceReference
{
    /// <summary>
    /// DataSource ID
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// DataSource display name
    /// </summary>
    public string Name { get; set; } = string.Empty;
}
