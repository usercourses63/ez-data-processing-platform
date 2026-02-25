namespace DataProcessing.Shared.Services;

/// <summary>
/// Service for caching archive content in distributed cache (Hazelcast)
/// Implements size-tiered caching strategy per architecture specification
/// </summary>
public interface IArchiveCacheService
{
    /// <summary>
    /// Stores archive content in cache with size-appropriate TTL
    /// Size-tiered strategy:
    /// - Less than 10MB: 5 min TTL (full cache)
    /// - 10-100MB: 2 min TTL (short cache)
    /// - Greater than 100MB: Not cached (stream directly)
    /// </summary>
    /// <param name="archiveCacheKey">Unique cache key (format: "archive:{guid}")</param>
    /// <param name="content">Archive file content</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if cached, false if too large to cache</returns>
    Task<bool> CacheArchiveAsync(string archiveCacheKey, byte[] content, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves archive content from cache
    /// </summary>
    /// <param name="archiveCacheKey">Cache key</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Archive content or null if not in cache</returns>
    Task<byte[]?> GetArchiveAsync(string archiveCacheKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes archive from cache
    /// </summary>
    /// <param name="archiveCacheKey">Cache key</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task RemoveArchiveAsync(string archiveCacheKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if archive should be cached based on size
    /// </summary>
    /// <param name="sizeBytes">Archive size in bytes</param>
    /// <returns>True if should be cached</returns>
    bool ShouldCache(long sizeBytes);

    /// <summary>
    /// Gets the TTL for a given archive size
    /// </summary>
    /// <param name="sizeBytes">Archive size in bytes</param>
    /// <returns>TTL or null if shouldn't be cached</returns>
    TimeSpan? GetTtlForSize(long sizeBytes);

    /// <summary>
    /// Generates a new archive cache key
    /// </summary>
    /// <returns>Unique cache key in format "archive:{guid}"</returns>
    string GenerateCacheKey();
}

/// <summary>
/// Archive cache size thresholds (configurable)
/// </summary>
public class ArchiveCacheSettings
{
    /// <summary>
    /// Archives smaller than this are fully cached with long TTL (default: 10MB)
    /// </summary>
    public long SmallArchiveThresholdBytes { get; set; } = 10_485_760; // 10MB

    /// <summary>
    /// Archives smaller than this are cached with short TTL (default: 100MB)
    /// Archives larger are not cached
    /// </summary>
    public long LargeArchiveThresholdBytes { get; set; } = 104_857_600; // 100MB

    /// <summary>
    /// TTL for small archives (default: 5 minutes)
    /// </summary>
    public TimeSpan SmallArchiveTtl { get; set; } = TimeSpan.FromMinutes(5);

    /// <summary>
    /// TTL for medium archives (default: 2 minutes)
    /// </summary>
    public TimeSpan MediumArchiveTtl { get; set; } = TimeSpan.FromMinutes(2);
}
