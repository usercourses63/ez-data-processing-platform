// S3OutputHandler.cs - S3/MinIO Output Handler
// v0.2.0: External File Access Support
// Date: January 26, 2026

using System.Diagnostics;
using System.Text;
using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using DataProcessing.Shared.Entities;
using DataProcessing.Output.Models;

namespace DataProcessing.Output.Handlers;

/// <summary>
/// Handles output to S3/MinIO object storage
/// </summary>
public class S3OutputHandler : IOutputHandler
{
    private readonly ILogger<S3OutputHandler> _logger;

    public S3OutputHandler(ILogger<S3OutputHandler> logger)
    {
        _logger = logger;
    }

    public bool CanHandle(string destinationType) => destinationType == "s3";

    public async Task<OutputResult> WriteAsync(
        OutputDestination destination,
        string content,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            if (destination.S3Config == null)
            {
                throw new ArgumentException("S3Config is required for S3 destination type");
            }

            var config = destination.S3Config;

            _logger.LogInformation(
                "Writing to S3: bucket={Bucket}, prefix={Prefix}, file={FileName}, destination={Destination}",
                config.Bucket, config.KeyPrefix, fileName, destination.Name);

            // Build the S3 key (path)
            var key = BuildS3Key(config, fileName, destination.Name, destination.OutputFormat);

            // Create S3 client
            using var client = CreateS3Client(config);

            // Upload content
            var contentBytes = Encoding.UTF8.GetBytes(content);
            using var stream = new MemoryStream(contentBytes);

            var putRequest = new PutObjectRequest
            {
                BucketName = config.Bucket,
                Key = key,
                InputStream = stream,
                ContentType = GetContentType(destination.OutputFormat)
            };

            var response = await client.PutObjectAsync(putRequest, cancellationToken);

            _logger.LogInformation(
                "Successfully wrote to S3: bucket={Bucket}, key={Key}, size={Size} bytes, ETag={ETag}",
                config.Bucket, key, content.Length, response.ETag);

            stopwatch.Stop();

            return OutputResult.Successful(
                destination.Name,
                "s3",
                content.Length,
                stopwatch.Elapsed);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();

            _logger.LogError(
                ex,
                "Failed to write to S3 destination {Destination}, bucket={Bucket}",
                destination.Name,
                destination.S3Config?.Bucket);

            return OutputResult.Failure(
                destination.Name,
                "s3",
                ex.Message);
        }
    }

    private AmazonS3Client CreateS3Client(S3OutputConfig config)
    {
        var s3Config = new AmazonS3Config();

        // Configure endpoint for MinIO or custom S3-compatible storage.
        // IMPORTANT: when a custom ServiceURL/Endpoint is set we must NOT also set
        // RegionEndpoint — the AWS SDK lets RegionEndpoint override ServiceURL, which
        // makes the client connect to (and SigV4-sign for) the real AWS S3 region
        // instead of MinIO ("Access Key Id does not exist" / 403 Forbidden).
        // AuthenticationRegion is sufficient for SigV4 signing against a custom endpoint.
        if (!string.IsNullOrEmpty(config.Endpoint))
        {
            s3Config.ServiceURL = config.Endpoint;
            s3Config.ForcePathStyle = config.UsePathStyle;
            if (!string.IsNullOrEmpty(config.Region))
            {
                s3Config.AuthenticationRegion = config.Region;
            }
        }
        else if (!string.IsNullOrEmpty(config.Region))
        {
            s3Config.RegionEndpoint = RegionEndpoint.GetBySystemName(config.Region);
        }

        // Create client with credentials
        if (!string.IsNullOrEmpty(config.AccessKeyId) && !string.IsNullOrEmpty(config.SecretAccessKey))
        {
            return new AmazonS3Client(config.AccessKeyId, config.SecretAccessKey, s3Config);
        }

        // Use default credentials (from environment/IAM role)
        return new AmazonS3Client(s3Config);
    }

    private string BuildS3Key(S3OutputConfig config, string fileName, string datasourceName, string? outputFormat)
    {
        // G12 (Phase 35): always honor KeyPrefix. Previously, when a KeyPattern was present the
        // method returned the pattern result and ignored KeyPrefix entirely, so objects landed at
        // the bucket root instead of under e.g. "processed/". Compute the object name (from the
        // pattern if set, otherwise the source filename) and ALWAYS prepend the prefix.
        var prefix = config.KeyPrefix?.Trim().Trim('/') ?? "";

        var objectName = !string.IsNullOrEmpty(config.KeyPattern)
            ? ReplaceKeyPlaceholders(config.KeyPattern, fileName, datasourceName, outputFormat)
            : fileName;

        return string.IsNullOrEmpty(prefix) ? objectName : $"{prefix}/{objectName}";
    }

    private string ReplaceKeyPlaceholders(string pattern, string fileName, string datasourceName, string? outputFormat)
    {
        var now = DateTime.UtcNow;
        var ext = Path.GetExtension(fileName);
        var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
        // G12: substitute {format} (was left literal). Use the destination's output format
        // (json/csv/xml); fall back to the source file extension when format is unset/"original".
        var format = !string.IsNullOrEmpty(outputFormat) && outputFormat.ToLowerInvariant() != "original"
            ? outputFormat.ToLowerInvariant()
            : ext.TrimStart('.');

        return pattern
            .Replace("{filename}", nameWithoutExt)
            .Replace("{ext}", ext.TrimStart('.'))
            .Replace("{format}", format)
            .Replace("{date}", now.ToString("yyyy-MM-dd"))
            .Replace("{year}", now.ToString("yyyy"))
            .Replace("{month}", now.ToString("MM"))
            .Replace("{day}", now.ToString("dd"))
            .Replace("{timestamp}", now.ToString("yyyyMMddHHmmss"))
            .Replace("{datasource}", datasourceName);
    }

    private static string GetContentType(string? outputFormat)
    {
        return outputFormat?.ToLowerInvariant() switch
        {
            "json" => "application/json",
            "xml" => "application/xml",
            "csv" => "text/csv",
            _ => "application/octet-stream"
        };
    }
}
