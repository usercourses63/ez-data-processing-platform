using SharpCompress.Archives;
using SharpCompress.Archives.GZip;
using SharpCompress.Archives.Rar;
using SharpCompress.Archives.SevenZip;
using SharpCompress.Archives.Tar;
using SharpCompress.Archives.Zip;
using SharpCompress.Readers;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
// Aliases to avoid collisions with SharpCompress.Common types
using ArchiveType = DataProcessing.Shared.Services.ArchiveType;
using ArchiveException = DataProcessing.Shared.Services.ArchiveException;
using InvalidFormatException = SharpCompress.Common.InvalidFormatException;
using CryptographicException = SharpCompress.Common.CryptographicException;

namespace DataProcessing.Shared.Services;

/// <summary>
/// SharpCompress-based implementation of archive operations
/// Supports ZIP, TAR.GZ, RAR, 7Z with password protection
/// </summary>
public class SharpCompressArchiveService : IArchiveService
{
    private readonly ILogger<SharpCompressArchiveService> _logger;

    // File extension to archive type mapping
    private static readonly Dictionary<string, ArchiveType> ExtensionMap = new(StringComparer.OrdinalIgnoreCase)
    {
        [".zip"] = ArchiveType.Zip,
        [".tar"] = ArchiveType.Tar,
        [".tar.gz"] = ArchiveType.TarGz,
        [".tgz"] = ArchiveType.TarGz,
        [".gz"] = ArchiveType.GZip,
        [".rar"] = ArchiveType.Rar,
        [".7z"] = ArchiveType.SevenZip,
        [".bz2"] = ArchiveType.BZip2
    };

    // Magic bytes for archive detection
    private static readonly Dictionary<ArchiveType, byte[][]> MagicBytes = new()
    {
        [ArchiveType.Zip] = new[] { new byte[] { 0x50, 0x4B, 0x03, 0x04 }, new byte[] { 0x50, 0x4B, 0x05, 0x06 } },
        [ArchiveType.Rar] = new[] { new byte[] { 0x52, 0x61, 0x72, 0x21, 0x1A, 0x07 } },
        [ArchiveType.SevenZip] = new[] { new byte[] { 0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C } },
        [ArchiveType.GZip] = new[] { new byte[] { 0x1F, 0x8B } },
        [ArchiveType.BZip2] = new[] { new byte[] { 0x42, 0x5A, 0x68 } }
    };

    public SharpCompressArchiveService(ILogger<SharpCompressArchiveService> logger)
    {
        _logger = logger;
    }

    public bool IsArchive(string fileName, byte[]? fileContent = null)
    {
        return GetArchiveType(fileName, fileContent) != null;
    }

    public ArchiveType? GetArchiveType(string fileName, byte[]? fileContent = null)
    {
        // Check double extensions first (tar.gz/tar.bz2) before magic bytes,
        // because GZip magic bytes would incorrectly classify tar.gz as plain GZip
        if (fileName.EndsWith(".tar.gz", StringComparison.OrdinalIgnoreCase) ||
            fileName.EndsWith(".tgz", StringComparison.OrdinalIgnoreCase) ||
            fileName.EndsWith(".tar.bz2", StringComparison.OrdinalIgnoreCase))
        {
            return ArchiveType.TarGz;
        }

        // Try magic bytes if content provided
        if (fileContent != null && fileContent.Length >= 6)
        {
            foreach (var (archiveType, magicBytesArray) in MagicBytes)
            {
                foreach (var magic in magicBytesArray)
                {
                    if (StartsWithBytes(fileContent, magic))
                    {
                        return archiveType;
                    }
                }
            }
        }

        // Fall back to extension detection
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return ExtensionMap.GetValueOrDefault(extension);
    }

    public async Task<IReadOnlyList<ArchiveEntry>> ListContentsAsync(
        byte[] archiveContent,
        ArchiveType? archiveType = null,
        string? password = null,
        ArchiveSecuritySettings? settings = null,
        CancellationToken cancellationToken = default)
    {
        settings ??= ArchiveSecuritySettings.Default;

        // Validate archive size
        if (archiveContent.Length > settings.MaxArchiveSizeBytes)
        {
            throw new ArchiveSecurityException(
                SecurityViolationType.ArchiveSizeTooLarge,
                $"Archive size ({archiveContent.Length:N0} bytes) exceeds maximum ({settings.MaxArchiveSizeBytes:N0} bytes)",
                archiveContent.Length,
                settings.MaxArchiveSizeBytes);
        }

        var detectedType = archiveType ?? DetectArchiveTypeFromContent(archiveContent);
        if (detectedType == null)
        {
            throw new ArchiveException("Unable to detect archive type from content");
        }

        using var stream = new MemoryStream(archiveContent);
        var entries = new List<ArchiveEntry>();

        try
        {
            using var archive = OpenArchive(stream, detectedType.Value, password);

            long totalUncompressedSize = 0;
            var entryCount = 0;

            foreach (var entry in archive.Entries)
            {
                cancellationToken.ThrowIfCancellationRequested();

                // Validate entry count
                entryCount++;
                if (entryCount > settings.MaxEntriesPerArchive)
                {
                    throw new ArchiveSecurityException(
                        SecurityViolationType.TooManyEntries,
                        $"Archive contains more than {settings.MaxEntriesPerArchive} entries",
                        entryCount,
                        settings.MaxEntriesPerArchive);
                }

                // Track total uncompressed size
                totalUncompressedSize += entry.Size;
                if (totalUncompressedSize > settings.MaxUncompressedSizeBytes)
                {
                    throw new ArchiveSecurityException(
                        SecurityViolationType.UncompressedSizeTooLarge,
                        $"Total uncompressed size ({totalUncompressedSize:N0} bytes) exceeds maximum ({settings.MaxUncompressedSizeBytes:N0} bytes)",
                        totalUncompressedSize,
                        settings.MaxUncompressedSizeBytes);
                }

                // Validate single file size
                if (entry.Size > settings.MaxSingleFileSizeBytes)
                {
                    throw new ArchiveSecurityException(
                        SecurityViolationType.SingleFileTooLarge,
                        $"Entry '{entry.Key}' size ({entry.Size:N0} bytes) exceeds maximum ({settings.MaxSingleFileSizeBytes:N0} bytes)",
                        entry.Size,
                        settings.MaxSingleFileSizeBytes);
                }

                // Check for path traversal
                if (IsPathTraversal(entry.Key))
                {
                    throw new ArchiveSecurityException(
                        SecurityViolationType.PathTraversal,
                        $"Path traversal detected in entry: {entry.Key}");
                }

                // Check compression ratio for potential zip bomb
                if (entry.CompressedSize > 0 && entry.Size > 0)
                {
                    var ratio = (double)entry.Size / entry.CompressedSize;
                    if (ratio > settings.MaxCompressionRatio)
                    {
                        throw new ArchiveSecurityException(
                            SecurityViolationType.SuspiciousCompressionRatio,
                            $"Suspicious compression ratio ({ratio:N0}x) for entry '{entry.Key}'",
                            (long)ratio,
                            settings.MaxCompressionRatio);
                    }
                }

                // Check encryption
                if (entry.IsEncrypted && !settings.AllowEncryptedArchives)
                {
                    throw new ArchiveSecurityException(
                        SecurityViolationType.EncryptedNotAllowed,
                        "Encrypted archives are not allowed");
                }

                entries.Add(new ArchiveEntry
                {
                    Path = NormalizePath(entry.Key),
                    IsDirectory = entry.IsDirectory,
                    CompressedSize = entry.CompressedSize,
                    UncompressedSize = entry.Size,
                    LastModified = entry.LastModifiedTime,
                    IsEncrypted = entry.IsEncrypted,
                    Crc32 = entry.Crc > 0 ? (uint?)entry.Crc : null
                });
            }

            _logger.LogInformation(
                "Listed {EntryCount} entries from archive (total uncompressed: {TotalSize:N0} bytes)",
                entries.Count, totalUncompressedSize);

            return entries;
        }
        catch (InvalidFormatException ex)
        {
            throw new ArchiveException("Invalid archive format", ex);
        }
        catch (CryptographicException ex)
        {
            throw new ArchivePasswordException("Invalid or missing password for encrypted archive", ex);
        }
    }

    public async Task<byte[]> ExtractFileAsync(
        byte[] archiveContent,
        string entryPath,
        ArchiveType? archiveType = null,
        string? password = null,
        ArchiveSecuritySettings? settings = null,
        CancellationToken cancellationToken = default)
    {
        settings ??= ArchiveSecuritySettings.Default;

        var detectedType = archiveType ?? DetectArchiveTypeFromContent(archiveContent);
        if (detectedType == null)
        {
            throw new ArchiveException("Unable to detect archive type from content");
        }

        using var stream = new MemoryStream(archiveContent);
        using var archive = OpenArchive(stream, detectedType.Value, password);

        var normalizedPath = NormalizePath(entryPath);

        var entry = archive.Entries.FirstOrDefault(e =>
            NormalizePath(e.Key).Equals(normalizedPath, StringComparison.OrdinalIgnoreCase));

        if (entry == null)
        {
            throw new ArchiveEntryNotFoundException(entryPath, "archive");
        }

        if (entry.IsDirectory)
        {
            throw new ArchiveException($"Cannot extract directory entry: {entryPath}");
        }

        // Validate size before extraction
        if (entry.Size > settings.MaxSingleFileSizeBytes)
        {
            throw new ArchiveSecurityException(
                SecurityViolationType.SingleFileTooLarge,
                $"Entry '{entryPath}' size ({entry.Size:N0} bytes) exceeds maximum ({settings.MaxSingleFileSizeBytes:N0} bytes)",
                entry.Size,
                settings.MaxSingleFileSizeBytes);
        }

        using var entryStream = entry.OpenEntryStream();
        using var output = new MemoryStream();

        await entryStream.CopyToAsync(output, cancellationToken);

        _logger.LogInformation(
            "Extracted '{EntryPath}' ({Size:N0} bytes) from archive",
            entryPath, output.Length);

        return output.ToArray();
    }

    public async Task<IReadOnlyDictionary<string, byte[]>> ExtractMatchingFilesAsync(
        byte[] archiveContent,
        string pattern,
        ArchiveType? archiveType = null,
        string? password = null,
        ArchiveSecuritySettings? settings = null,
        CancellationToken cancellationToken = default)
    {
        settings ??= ArchiveSecuritySettings.Default;

        // List contents first to apply security checks
        var entries = await ListContentsAsync(archiveContent, archiveType, password, settings, cancellationToken);

        // Filter entries by pattern
        var matchingEntries = entries
            .Where(e => !e.IsDirectory && MatchesPattern(e.Path, pattern))
            .ToList();

        var result = new Dictionary<string, byte[]>(StringComparer.OrdinalIgnoreCase);

        foreach (var entry in matchingEntries)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var content = await ExtractFileAsync(
                archiveContent, entry.Path, archiveType, password, settings, cancellationToken);

            result[entry.Path] = content;
        }

        _logger.LogInformation(
            "Extracted {Count} files matching pattern '{Pattern}'",
            result.Count, pattern);

        return result;
    }

    #region Private Methods

    private IArchive OpenArchive(Stream stream, ArchiveType type, string? password)
    {
        var options = new ReaderOptions { Password = password };

        return type switch
        {
            ArchiveType.Zip => ZipArchive.Open(stream, options),
            ArchiveType.Tar => TarArchive.Open(stream, options),
            ArchiveType.TarGz => OpenTarGzArchive(stream, options),
            ArchiveType.GZip => GZipArchive.Open(stream, options),
            ArchiveType.Rar => RarArchive.Open(stream, options),
            ArchiveType.SevenZip => SevenZipArchive.Open(stream, options),
            _ => throw new ArchiveException($"Unsupported archive type: {type}")
        };
    }

    private IArchive OpenTarGzArchive(Stream stream, ReaderOptions options)
    {
        // For tar.gz, we need to decompress gzip first, then open as tar
        using var gzipArchive = GZipArchive.Open(stream, options);
        var gzipEntry = gzipArchive.Entries.First();

        using var gzipStream = gzipEntry.OpenEntryStream();
        var decompressedStream = new MemoryStream();
        gzipStream.CopyTo(decompressedStream);
        decompressedStream.Position = 0;

        return TarArchive.Open(decompressedStream, options);
    }

    private ArchiveType? DetectArchiveTypeFromContent(byte[] content)
    {
        if (content.Length < 6)
            return null;

        foreach (var (archiveType, magicBytesArray) in MagicBytes)
        {
            foreach (var magic in magicBytesArray)
            {
                if (StartsWithBytes(content, magic))
                {
                    return archiveType;
                }
            }
        }

        return null;
    }

    private static bool StartsWithBytes(byte[] content, byte[] pattern)
    {
        if (content.Length < pattern.Length)
            return false;

        for (int i = 0; i < pattern.Length; i++)
        {
            if (content[i] != pattern[i])
                return false;
        }

        return true;
    }

    private static string NormalizePath(string? path)
    {
        if (string.IsNullOrEmpty(path))
            return string.Empty;

        return path
            .Replace('\\', '/')
            .TrimStart('/')
            .TrimEnd('/');
    }

    private static bool IsPathTraversal(string? path)
    {
        if (string.IsNullOrEmpty(path))
            return false;

        var normalized = NormalizePath(path);
        return normalized.Contains("..") ||
               normalized.StartsWith("/") ||
               Path.IsPathRooted(normalized);
    }

    private static bool MatchesPattern(string path, string pattern)
    {
        if (string.IsNullOrEmpty(pattern) || pattern == "*" || pattern == "*.*")
            return true;

        // Convert glob pattern to regex
        var regexPattern = "^" + Regex.Escape(pattern)
            .Replace("\\*\\*", ".*") // ** matches any path
            .Replace("\\*", "[^/]*")  // * matches within directory
            .Replace("\\?", ".")     // ? matches single char
            + "$";

        return Regex.IsMatch(path, regexPattern, RegexOptions.IgnoreCase);
    }

    #endregion
}
