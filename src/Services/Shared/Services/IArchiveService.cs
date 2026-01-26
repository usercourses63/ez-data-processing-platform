namespace DataProcessing.Shared.Services;

/// <summary>
/// Service for archive file operations (ZIP, TAR.GZ, RAR, 7Z)
/// Implements two-phase architecture: Discovery (list contents) → Processing (extract files)
/// </summary>
public interface IArchiveService
{
    /// <summary>
    /// Checks if a file is a supported archive format based on extension or magic bytes
    /// </summary>
    /// <param name="fileName">File name or path to check</param>
    /// <param name="fileContent">Optional file content for magic byte detection</param>
    /// <returns>True if the file is a recognized archive format</returns>
    bool IsArchive(string fileName, byte[]? fileContent = null);

    /// <summary>
    /// Gets the archive type from file name or content
    /// </summary>
    /// <param name="fileName">File name or path</param>
    /// <param name="fileContent">Optional file content for detection</param>
    /// <returns>Detected archive type or null if not an archive</returns>
    ArchiveType? GetArchiveType(string fileName, byte[]? fileContent = null);

    /// <summary>
    /// Lists all entries in an archive
    /// </summary>
    /// <param name="archiveContent">Archive file content as bytes</param>
    /// <param name="archiveType">Type of archive (auto-detect if null)</param>
    /// <param name="password">Password for encrypted archives</param>
    /// <param name="settings">Security settings to enforce</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of archive entries with metadata</returns>
    /// <exception cref="ArchiveSecurityException">When security limits are exceeded</exception>
    /// <exception cref="ArchiveException">When archive cannot be read</exception>
    Task<IReadOnlyList<ArchiveEntry>> ListContentsAsync(
        byte[] archiveContent,
        ArchiveType? archiveType = null,
        string? password = null,
        ArchiveSecuritySettings? settings = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Extracts a specific file from an archive
    /// </summary>
    /// <param name="archiveContent">Archive file content as bytes</param>
    /// <param name="entryPath">Path of the entry within the archive</param>
    /// <param name="archiveType">Type of archive (auto-detect if null)</param>
    /// <param name="password">Password for encrypted archives</param>
    /// <param name="settings">Security settings to enforce</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Extracted file content</returns>
    /// <exception cref="ArchiveEntryNotFoundException">When entry doesn't exist</exception>
    /// <exception cref="ArchiveSecurityException">When security limits are exceeded</exception>
    /// <exception cref="ArchiveException">When extraction fails</exception>
    Task<byte[]> ExtractFileAsync(
        byte[] archiveContent,
        string entryPath,
        ArchiveType? archiveType = null,
        string? password = null,
        ArchiveSecuritySettings? settings = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Extracts all files matching a pattern from an archive
    /// </summary>
    /// <param name="archiveContent">Archive file content as bytes</param>
    /// <param name="pattern">Glob pattern to match (e.g., "*.csv", "data/**/*.json")</param>
    /// <param name="archiveType">Type of archive (auto-detect if null)</param>
    /// <param name="password">Password for encrypted archives</param>
    /// <param name="settings">Security settings to enforce</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Dictionary of entry path to extracted content</returns>
    Task<IReadOnlyDictionary<string, byte[]>> ExtractMatchingFilesAsync(
        byte[] archiveContent,
        string pattern,
        ArchiveType? archiveType = null,
        string? password = null,
        ArchiveSecuritySettings? settings = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Supported archive types
/// </summary>
public enum ArchiveType
{
    /// <summary>ZIP archive (.zip)</summary>
    Zip,

    /// <summary>Gzipped TAR archive (.tar.gz, .tgz)</summary>
    TarGz,

    /// <summary>TAR archive (.tar)</summary>
    Tar,

    /// <summary>RAR archive (.rar)</summary>
    Rar,

    /// <summary>7-Zip archive (.7z)</summary>
    SevenZip,

    /// <summary>Gzip compressed file (.gz)</summary>
    GZip,

    /// <summary>BZip2 compressed file (.bz2)</summary>
    BZip2
}

/// <summary>
/// Represents an entry within an archive
/// </summary>
public class ArchiveEntry
{
    /// <summary>
    /// Full path within the archive
    /// </summary>
    public string Path { get; set; } = string.Empty;

    /// <summary>
    /// File name without directory
    /// </summary>
    public string FileName => System.IO.Path.GetFileName(Path);

    /// <summary>
    /// Directory containing the file
    /// </summary>
    public string? Directory => System.IO.Path.GetDirectoryName(Path)?.Replace('\\', '/');

    /// <summary>
    /// Whether this entry is a directory
    /// </summary>
    public bool IsDirectory { get; set; }

    /// <summary>
    /// Compressed size in bytes
    /// </summary>
    public long CompressedSize { get; set; }

    /// <summary>
    /// Uncompressed size in bytes
    /// </summary>
    public long UncompressedSize { get; set; }

    /// <summary>
    /// Last modification time
    /// </summary>
    public DateTime? LastModified { get; set; }

    /// <summary>
    /// Whether the entry is encrypted
    /// </summary>
    public bool IsEncrypted { get; set; }

    /// <summary>
    /// CRC32 checksum (if available)
    /// </summary>
    public uint? Crc32 { get; set; }

    /// <summary>
    /// Compression ratio (0-100%)
    /// </summary>
    public double CompressionRatio =>
        UncompressedSize > 0
            ? Math.Round((1 - (double)CompressedSize / UncompressedSize) * 100, 2)
            : 0;
}

/// <summary>
/// Security settings for archive processing to prevent zip bomb attacks
/// </summary>
public class ArchiveSecuritySettings
{
    /// <summary>
    /// Maximum number of entries allowed in an archive (default: 1000)
    /// </summary>
    public int MaxEntriesPerArchive { get; set; } = 1000;

    /// <summary>
    /// Maximum total uncompressed size in bytes (default: 1GB)
    /// </summary>
    public long MaxUncompressedSizeBytes { get; set; } = 1_073_741_824; // 1GB

    /// <summary>
    /// Maximum archive file size in bytes (default: 512MB)
    /// </summary>
    public long MaxArchiveSizeBytes { get; set; } = 536_870_912; // 512MB

    /// <summary>
    /// Maximum nesting depth for archives within archives (default: 2)
    /// </summary>
    public int MaxNestingDepth { get; set; } = 2;

    /// <summary>
    /// Maximum compression ratio allowed (to detect zip bombs) (default: 100)
    /// A ratio greater than 100 means compressed size is less than 1% of uncompressed size
    /// </summary>
    public int MaxCompressionRatio { get; set; } = 100;

    /// <summary>
    /// Maximum size of a single extracted file in bytes (default: 100MB)
    /// </summary>
    public long MaxSingleFileSizeBytes { get; set; } = 104_857_600; // 100MB

    /// <summary>
    /// Whether to allow encrypted archives (default: true)
    /// </summary>
    public bool AllowEncryptedArchives { get; set; } = true;

    /// <summary>
    /// Gets the default security settings
    /// </summary>
    public static ArchiveSecuritySettings Default => new();

    /// <summary>
    /// Gets strict security settings for untrusted archives
    /// </summary>
    public static ArchiveSecuritySettings Strict => new()
    {
        MaxEntriesPerArchive = 100,
        MaxUncompressedSizeBytes = 104_857_600, // 100MB
        MaxArchiveSizeBytes = 52_428_800, // 50MB
        MaxNestingDepth = 1,
        MaxCompressionRatio = 50,
        MaxSingleFileSizeBytes = 10_485_760, // 10MB
        AllowEncryptedArchives = false
    };
}

/// <summary>
/// Archive settings for a datasource
/// </summary>
public class ArchiveSettings
{
    /// <summary>
    /// Whether the source files are archives that need extraction
    /// </summary>
    public bool IsArchiveSource { get; set; }

    /// <summary>
    /// Archive type: "auto", "zip", "tar.gz", "rar", "7z"
    /// </summary>
    public string ArchiveType { get; set; } = "auto";

    /// <summary>
    /// Password for encrypted archives (stored encrypted)
    /// </summary>
    public string? ArchivePassword { get; set; }

    /// <summary>
    /// Glob pattern for files to extract (e.g., "*.csv", "data/**/*.json")
    /// </summary>
    public string? ExtractionPattern { get; set; }

    /// <summary>
    /// Whether to process nested archives (archives within archives)
    /// </summary>
    public bool ProcessNestedArchives { get; set; }

    /// <summary>
    /// Custom security settings (uses defaults if null)
    /// </summary>
    public ArchiveSecuritySettings? SecuritySettings { get; set; }
}

/// <summary>
/// Base exception for archive operations
/// </summary>
public class ArchiveException : Exception
{
    public string? ArchivePath { get; }

    public ArchiveException(string message)
        : base(message) { }

    public ArchiveException(string message, string archivePath)
        : base(message)
    {
        ArchivePath = archivePath;
    }

    public ArchiveException(string message, Exception innerException)
        : base(message, innerException) { }

    public ArchiveException(string message, string archivePath, Exception innerException)
        : base(message, innerException)
    {
        ArchivePath = archivePath;
    }
}

/// <summary>
/// Exception thrown when archive security limits are exceeded
/// </summary>
public class ArchiveSecurityException : ArchiveException
{
    public SecurityViolationType ViolationType { get; }
    public long? ActualValue { get; }
    public long? MaxAllowedValue { get; }

    public ArchiveSecurityException(
        SecurityViolationType violationType,
        string message,
        long? actualValue = null,
        long? maxAllowedValue = null)
        : base(message)
    {
        ViolationType = violationType;
        ActualValue = actualValue;
        MaxAllowedValue = maxAllowedValue;
    }
}

/// <summary>
/// Types of security violations in archive processing
/// </summary>
public enum SecurityViolationType
{
    /// <summary>Too many entries in archive</summary>
    TooManyEntries,

    /// <summary>Uncompressed size exceeds limit</summary>
    UncompressedSizeTooLarge,

    /// <summary>Archive file size exceeds limit</summary>
    ArchiveSizeTooLarge,

    /// <summary>Nesting depth exceeds limit</summary>
    NestingTooDeep,

    /// <summary>Compression ratio suspiciously high (possible zip bomb)</summary>
    SuspiciousCompressionRatio,

    /// <summary>Single file too large</summary>
    SingleFileTooLarge,

    /// <summary>Encrypted archives not allowed</summary>
    EncryptedNotAllowed,

    /// <summary>Path traversal attempt detected</summary>
    PathTraversal
}

/// <summary>
/// Exception thrown when a requested entry is not found in the archive
/// </summary>
public class ArchiveEntryNotFoundException : ArchiveException
{
    public string EntryPath { get; }

    public ArchiveEntryNotFoundException(string entryPath, string archivePath)
        : base($"Entry '{entryPath}' not found in archive")
    {
        EntryPath = entryPath;
    }
}

/// <summary>
/// Exception thrown when archive password is incorrect or missing
/// </summary>
public class ArchivePasswordException : ArchiveException
{
    public ArchivePasswordException(string message)
        : base(message) { }

    public ArchivePasswordException(string message, Exception innerException)
        : base(message, innerException) { }
}
