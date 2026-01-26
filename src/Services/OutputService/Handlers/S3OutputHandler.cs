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
            var key = BuildS3Key(config, fileName, destination.Name);

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

        // Configure endpoint for MinIO or custom S3-compatible storage
        if (!string.IsNullOrEmpty(config.Endpoint))
        {
            s3Config.ServiceURL = config.Endpoint;
            s3Config.ForcePathStyle = config.UsePathStyle;
        }

        // Configure region
        if (!string.IsNullOrEmpty(config.Region))
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

    private string BuildS3Key(S3OutputConfig config, string fileName, string datasourceName)
    {
        // If a key pattern is provided, use it
        if (!string.IsNullOrEmpty(config.KeyPattern))
        {
            return ReplaceKeyPlaceholders(config.KeyPattern, fileName, datasourceName);
        }

        // Otherwise, use prefix + filename
        var prefix = config.KeyPrefix?.TrimEnd('/') ?? "";
        return string.IsNullOrEmpty(prefix) ? fileName : $"{prefix}/{fileName}";
    }

    private string ReplaceKeyPlaceholders(string pattern, string fileName, string datasourceName)
    {
        var now = DateTime.UtcNow;
        var ext = Path.GetExtension(fileName);
        var nameWithoutExt = Path.GetFileNameWithoutExtension(fileName);

        return pattern
            .Replace("{filename}", nameWithoutExt)
            .Replace("{ext}", ext.TrimStart('.'))
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
