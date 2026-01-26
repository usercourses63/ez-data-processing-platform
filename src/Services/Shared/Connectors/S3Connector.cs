using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using System.Diagnostics;
using System.Text.RegularExpressions;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for Amazon S3 and S3-compatible storage (MinIO, DigitalOcean Spaces, etc.)
/// Supports both AWS S3 and self-hosted S3-compatible endpoints
/// </summary>
public class S3Connector : IDataSourceConnector, IServerConnector
{
    private readonly ILogger<S3Connector> _logger;

    public string ConnectorType => "s3";

    public S3Connector(ILogger<S3Connector> logger)
    {
        _logger = logger;
    }

    #region IDataSourceConnector Implementation (Legacy - DataProcessingDataSource)

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        var config = GetS3Config(dataSource);
        using var client = CreateS3Client(config);

        try
        {
            _logger.LogInformation("Reading file from S3: {Bucket}/{Key}", config.Bucket, filePath);

            var response = await client.GetObjectAsync(new GetObjectRequest
            {
                BucketName = config.Bucket,
                Key = NormalizeKey(filePath)
            }, cancellationToken);

            // Copy to memory stream to allow disposal of response
            var memoryStream = new MemoryStream();
            await response.ResponseStream.CopyToAsync(memoryStream, cancellationToken);
            memoryStream.Position = 0;

            return memoryStream;
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "S3 error reading file: {Bucket}/{Key}", config.Bucket, filePath);
            throw new InvalidOperationException($"Failed to read S3 object: {ex.Message}", ex);
        }
    }

    public async Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        var config = GetS3Config(dataSource);
        using var client = CreateS3Client(config);

        try
        {
            var prefix = GetPrefixFromPath(dataSource.FilePath);
            _logger.LogInformation("Listing S3 objects: {Bucket}/{Prefix} with pattern: {Pattern}",
                config.Bucket, prefix, pattern);

            var files = new List<string>();
            var request = new ListObjectsV2Request
            {
                BucketName = config.Bucket,
                Prefix = prefix
            };

            ListObjectsV2Response response;
            do
            {
                response = await client.ListObjectsV2Async(request, cancellationToken);

                foreach (var obj in response.S3Objects)
                {
                    // Skip directories (keys ending with /)
                    if (obj.Key.EndsWith('/'))
                        continue;

                    var fileName = Path.GetFileName(obj.Key);
                    if (MatchesPattern(fileName, pattern))
                    {
                        files.Add(obj.Key);
                    }
                }

                request.ContinuationToken = response.NextContinuationToken;
            }
            while (response.IsTruncated);

            _logger.LogInformation("Found {Count} files matching pattern in S3", files.Count);
            return files;
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "S3 error listing objects: {Bucket}", config.Bucket);
            throw new InvalidOperationException($"Failed to list S3 objects: {ex.Message}", ex);
        }
    }

    public async Task<bool> TestConnectionAsync(
        DataProcessingDataSource dataSource,
        CancellationToken cancellationToken = default)
    {
        var config = GetS3Config(dataSource);
        using var client = CreateS3Client(config);

        try
        {
            _logger.LogInformation("Testing S3 connection: {Endpoint}/{Bucket}",
                config.Endpoint ?? "AWS", config.Bucket);

            // Try to get bucket location to verify access
            await client.GetBucketLocationAsync(config.Bucket, cancellationToken);

            _logger.LogInformation("S3 connection test successful");
            return true;
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "S3 connection test failed: {Bucket}", config.Bucket);
            return false;
        }
    }

    public async Task<FileMetadata> GetFileMetadataAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        var config = GetS3Config(dataSource);
        using var client = CreateS3Client(config);

        try
        {
            var response = await client.GetObjectMetadataAsync(new GetObjectMetadataRequest
            {
                BucketName = config.Bucket,
                Key = NormalizeKey(filePath)
            }, cancellationToken);

            return new FileMetadata
            {
                FilePath = filePath,
                FileName = Path.GetFileName(filePath),
                FileSizeBytes = response.ContentLength,
                LastModifiedUtc = response.LastModified.ToUniversalTime(),
                ContentType = response.Headers.ContentType,
                AdditionalProperties = new Dictionary<string, string>
                {
                    ["ETag"] = response.ETag,
                    ["VersionId"] = response.VersionId ?? string.Empty,
                    ["StorageClass"] = response.StorageClass?.Value ?? "STANDARD"
                }
            };
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "S3 error getting metadata: {Bucket}/{Key}", config.Bucket, filePath);
            throw new InvalidOperationException($"Failed to get S3 object metadata: {ex.Message}", ex);
        }
    }

    #endregion

    #region IServerConnector Implementation (New - AdminServer)

    public async Task<ConnectionTestResult> TestConnectionAsync(
        AdminServer server,
        ServerCredentials? credentials,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var config = GetS3ConfigFromServer(server, credentials);

        using var client = CreateS3Client(config);

        try
        {
            _logger.LogInformation("Testing S3 connection: {Endpoint}/{Bucket}",
                config.Endpoint ?? "AWS", config.Bucket);

            var location = await client.GetBucketLocationAsync(config.Bucket, cancellationToken);
            stopwatch.Stop();

            return ConnectionTestResult.Success(
                stopwatch.ElapsedMilliseconds,
                $"Bucket: {config.Bucket}, Region: {location.Location?.Value ?? "us-east-1"}");
        }
        catch (AmazonS3Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "S3 connection test failed: {Bucket}", config.Bucket);
            return ConnectionTestResult.Failure($"S3 Error: {ex.Message} (Code: {ex.ErrorCode})");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "S3 connection test failed unexpectedly");
            return ConnectionTestResult.Failure($"Connection failed: {ex.Message}");
        }
    }

    public async Task<List<DiscoveredFile>> ListFilesAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string? path,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        var config = GetS3ConfigFromServer(server, credentials);
        using var client = CreateS3Client(config);

        try
        {
            var prefix = NormalizePrefix(path);
            _logger.LogInformation("Listing S3 objects: {Bucket}/{Prefix} with pattern: {Pattern}",
                config.Bucket, prefix, pattern);

            var files = new List<DiscoveredFile>();
            var request = new ListObjectsV2Request
            {
                BucketName = config.Bucket,
                Prefix = prefix
            };

            ListObjectsV2Response response;
            do
            {
                response = await client.ListObjectsV2Async(request, cancellationToken);

                foreach (var obj in response.S3Objects)
                {
                    // Skip directories
                    if (obj.Key.EndsWith('/'))
                        continue;

                    var fileName = Path.GetFileName(obj.Key);
                    if (MatchesPattern(fileName, pattern))
                    {
                        var extension = Path.GetExtension(fileName).ToLowerInvariant();
                        var isArchive = IsArchiveExtension(extension);

                        files.Add(new DiscoveredFile
                        {
                            FullPath = obj.Key,
                            FileName = fileName,
                            SizeBytes = obj.Size,
                            LastModifiedUtc = obj.LastModified.ToUniversalTime(),
                            IsDirectory = false,
                            ContentType = GetContentType(extension),
                            IsArchive = isArchive,
                            ArchiveType = isArchive ? GetArchiveType(extension) : null
                        });
                    }
                }

                request.ContinuationToken = response.NextContinuationToken;
            }
            while (response.IsTruncated);

            _logger.LogInformation("Found {Count} files matching pattern in S3", files.Count);
            return files;
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "S3 error listing objects: {Bucket}", config.Bucket);
            throw new InvalidOperationException($"Failed to list S3 objects: {ex.Message}", ex);
        }
    }

    public async Task<byte[]> ReadFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        var config = GetS3ConfigFromServer(server, credentials);
        using var client = CreateS3Client(config);

        try
        {
            _logger.LogInformation("Reading file from S3: {Bucket}/{Key}", config.Bucket, filePath);

            var response = await client.GetObjectAsync(new GetObjectRequest
            {
                BucketName = config.Bucket,
                Key = NormalizeKey(filePath)
            }, cancellationToken);

            using var memoryStream = new MemoryStream();
            await response.ResponseStream.CopyToAsync(memoryStream, cancellationToken);
            return memoryStream.ToArray();
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "S3 error reading file: {Bucket}/{Key}", config.Bucket, filePath);
            throw new InvalidOperationException($"Failed to read S3 object: {ex.Message}", ex);
        }
    }

    public async Task WriteFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        byte[] content,
        CancellationToken cancellationToken = default)
    {
        var config = GetS3ConfigFromServer(server, credentials);
        using var client = CreateS3Client(config);

        try
        {
            _logger.LogInformation("Writing file to S3: {Bucket}/{Key} ({Size} bytes)",
                config.Bucket, filePath, content.Length);

            using var stream = new MemoryStream(content);
            await client.PutObjectAsync(new PutObjectRequest
            {
                BucketName = config.Bucket,
                Key = NormalizeKey(filePath),
                InputStream = stream,
                ContentType = GetContentType(Path.GetExtension(filePath))
            }, cancellationToken);

            _logger.LogInformation("Successfully wrote file to S3: {Bucket}/{Key}", config.Bucket, filePath);
        }
        catch (AmazonS3Exception ex)
        {
            _logger.LogError(ex, "S3 error writing file: {Bucket}/{Key}", config.Bucket, filePath);
            throw new InvalidOperationException($"Failed to write S3 object: {ex.Message}", ex);
        }
    }

    #endregion

    #region Helper Methods

    private S3Config GetS3Config(DataProcessingDataSource dataSource)
    {
        var additionalConfig = dataSource.AdditionalConfiguration;
        if (additionalConfig == null)
        {
            throw new InvalidOperationException("S3 configuration is required in AdditionalConfiguration");
        }

        return new S3Config
        {
            AccessKey = additionalConfig.GetValue("accessKey", string.Empty).AsString,
            SecretKey = additionalConfig.GetValue("secretKey", string.Empty).AsString,
            Bucket = additionalConfig.GetValue("bucket", string.Empty).AsString,
            Region = additionalConfig.GetValue("region", "us-east-1").AsString,
            Endpoint = additionalConfig.GetValue("endpoint", BsonValue.Create(null)).IsBsonNull
                ? null
                : additionalConfig.GetValue("endpoint", string.Empty).AsString,
            UsePathStyle = additionalConfig.GetValue("usePathStyle", false).AsBoolean
        };
    }

    private S3Config GetS3ConfigFromServer(AdminServer server, ServerCredentials? credentials)
    {
        var typeConfig = server.TypeSpecificConfig ?? new BsonDocument();

        return new S3Config
        {
            AccessKey = credentials?.AccessKey ?? string.Empty,
            SecretKey = credentials?.SecretKey ?? string.Empty,
            SessionToken = credentials?.SessionToken,
            Bucket = typeConfig.GetValue("bucket", string.Empty).AsString,
            Region = typeConfig.GetValue("region", "us-east-1").AsString,
            Endpoint = server.Host,  // Host is the S3 endpoint for non-AWS
            UsePathStyle = typeConfig.GetValue("usePathStyle", false).AsBoolean
        };
    }

    private IAmazonS3 CreateS3Client(S3Config config)
    {
        AWSCredentials awsCredentials;

        if (!string.IsNullOrEmpty(config.SessionToken))
        {
            awsCredentials = new SessionAWSCredentials(
                config.AccessKey,
                config.SecretKey,
                config.SessionToken);
        }
        else if (!string.IsNullOrEmpty(config.AccessKey) && !string.IsNullOrEmpty(config.SecretKey))
        {
            awsCredentials = new BasicAWSCredentials(config.AccessKey, config.SecretKey);
        }
        else
        {
            // Use default credentials chain (EC2 instance profile, environment, etc.)
            awsCredentials = FallbackCredentialsFactory.GetCredentials();
        }

        var clientConfig = new AmazonS3Config
        {
            RegionEndpoint = RegionEndpoint.GetBySystemName(config.Region),
            ForcePathStyle = config.UsePathStyle
        };

        // Custom endpoint for MinIO/S3-compatible storage
        if (!string.IsNullOrEmpty(config.Endpoint))
        {
            clientConfig.ServiceURL = config.Endpoint;
            clientConfig.ForcePathStyle = true;  // Always use path style for custom endpoints
        }

        return new AmazonS3Client(awsCredentials, clientConfig);
    }

    private static string NormalizeKey(string key)
    {
        // Remove leading slash if present
        return key.TrimStart('/');
    }

    private static string NormalizePrefix(string? path)
    {
        if (string.IsNullOrEmpty(path))
            return string.Empty;

        var prefix = path.TrimStart('/');
        // Ensure prefix ends with / if not empty
        if (!string.IsNullOrEmpty(prefix) && !prefix.EndsWith('/'))
            prefix += '/';

        return prefix;
    }

    private static string GetPrefixFromPath(string? path)
    {
        if (string.IsNullOrEmpty(path))
            return string.Empty;

        return NormalizePrefix(path);
    }

    private static bool MatchesPattern(string fileName, string pattern)
    {
        if (string.IsNullOrEmpty(pattern) || pattern == "*" || pattern == "*.*")
            return true;

        // Convert glob pattern to regex
        var regexPattern = "^" + Regex.Escape(pattern)
            .Replace("\\*", ".*")
            .Replace("\\?", ".") + "$";

        return Regex.IsMatch(fileName, regexPattern, RegexOptions.IgnoreCase);
    }

    private static bool IsArchiveExtension(string extension)
    {
        return extension switch
        {
            ".zip" or ".tar" or ".gz" or ".tgz" or ".rar" or ".7z" or ".bz2" => true,
            _ => false
        };
    }

    private static string? GetArchiveType(string extension)
    {
        return extension switch
        {
            ".zip" => "zip",
            ".tar" => "tar",
            ".gz" or ".tgz" => "tar.gz",
            ".rar" => "rar",
            ".7z" => "7z",
            ".bz2" => "bz2",
            _ => null
        };
    }

    private static string GetContentType(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".json" => "application/json",
            ".xml" => "application/xml",
            ".csv" => "text/csv",
            ".txt" => "text/plain",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls" => "application/vnd.ms-excel",
            ".zip" => "application/zip",
            ".gz" or ".tgz" => "application/gzip",
            ".tar" => "application/x-tar",
            ".rar" => "application/vnd.rar",
            ".7z" => "application/x-7z-compressed",
            _ => "application/octet-stream"
        };
    }

    #endregion

    #region Configuration Classes

    private class S3Config
    {
        public string AccessKey { get; set; } = string.Empty;
        public string SecretKey { get; set; } = string.Empty;
        public string? SessionToken { get; set; }
        public string Bucket { get; set; } = string.Empty;
        public string Region { get; set; } = "us-east-1";
        public string? Endpoint { get; set; }
        public bool UsePathStyle { get; set; }
    }

    #endregion
}
