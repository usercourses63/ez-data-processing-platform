using DataProcessing.Shared.Services;
using Hazelcast;
using Hazelcast.DistributedObjects;
using Microsoft.Extensions.Options;

namespace DataProcessing.FileDiscovery.Services;

/// <summary>
/// Hazelcast-based implementation of archive content caching
/// Implements size-tiered caching strategy per architecture specification
/// </summary>
public class HazelcastArchiveCacheService : IArchiveCacheService
{
    private const string MapName = "archive-content";
    private readonly IHazelcastClient _hazelcast;
    private readonly ILogger<HazelcastArchiveCacheService> _logger;
    private readonly ArchiveCacheSettings _settings;

    public HazelcastArchiveCacheService(
        IHazelcastClient hazelcast,
        ILogger<HazelcastArchiveCacheService> logger,
        IOptions<ArchiveCacheSettings>? settings = null)
    {
        _hazelcast = hazelcast;
        _logger = logger;
        _settings = settings?.Value ?? new ArchiveCacheSettings();
    }

    public async Task<bool> CacheArchiveAsync(
        string archiveCacheKey,
        byte[] content,
        CancellationToken cancellationToken = default)
    {
        var sizeBytes = content.Length;
        var ttl = GetTtlForSize(sizeBytes);

        if (ttl == null)
        {
            _logger.LogInformation(
                "Archive {CacheKey} too large to cache ({Size:N0} bytes > {Threshold:N0})",
                archiveCacheKey, sizeBytes, _settings.LargeArchiveThresholdBytes);
            return false;
        }

        try
        {
            var map = await _hazelcast.GetMapAsync<string, byte[]>(MapName);
            await map.SetAsync(archiveCacheKey, content, ttl.Value);

            _logger.LogInformation(
                "Cached archive {CacheKey} ({Size:N0} bytes) with TTL {Ttl}",
                archiveCacheKey, sizeBytes, ttl.Value);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to cache archive {CacheKey} ({Size:N0} bytes)",
                archiveCacheKey, sizeBytes);
            return false;
        }
    }

    public async Task<byte[]?> GetArchiveAsync(
        string archiveCacheKey,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var map = await _hazelcast.GetMapAsync<string, byte[]>(MapName);
            var content = await map.GetAsync(archiveCacheKey);

            if (content != null)
            {
                _logger.LogDebug(
                    "Retrieved archive {CacheKey} from cache ({Size:N0} bytes)",
                    archiveCacheKey, content.Length);
            }
            else
            {
                _logger.LogDebug(
                    "Archive {CacheKey} not found in cache",
                    archiveCacheKey);
            }

            return content;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to retrieve archive {CacheKey} from cache",
                archiveCacheKey);
            return null;
        }
    }

    public async Task RemoveArchiveAsync(
        string archiveCacheKey,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var map = await _hazelcast.GetMapAsync<string, byte[]>(MapName);
            await map.RemoveAsync(archiveCacheKey);

            _logger.LogDebug(
                "Removed archive {CacheKey} from cache",
                archiveCacheKey);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to remove archive {CacheKey} from cache",
                archiveCacheKey);
        }
    }

    public bool ShouldCache(long sizeBytes)
    {
        return sizeBytes <= _settings.LargeArchiveThresholdBytes;
    }

    public TimeSpan? GetTtlForSize(long sizeBytes)
    {
        if (sizeBytes <= _settings.SmallArchiveThresholdBytes)
        {
            // Small archives: full cache with long TTL
            return _settings.SmallArchiveTtl;
        }

        if (sizeBytes <= _settings.LargeArchiveThresholdBytes)
        {
            // Medium archives: short TTL
            return _settings.MediumArchiveTtl;
        }

        // Large archives: don't cache
        return null;
    }

    public string GenerateCacheKey()
    {
        return $"archive:{Guid.NewGuid()}";
    }
}
