using DataProcessing.Shared.Entities;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using System.Net.Http.Headers;
using System.Text.Json;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading data from HTTP/REST APIs
/// </summary>
public class HttpApiConnector : IDataSourceConnector
{
    private readonly ILogger<HttpApiConnector> _logger;
    private readonly HttpClient _httpClient;

    public string ConnectorType => "http";

    public HttpApiConnector(ILogger<HttpApiConnector> logger, HttpClient httpClient)
    {
        _logger = logger;
        _httpClient = httpClient;
    }

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Reading data from HTTP API: {FilePath}", filePath);
            
            ConfigureHttpClient(dataSource);
            var response = await _httpClient.GetAsync(filePath, cancellationToken);
            response.EnsureSuccessStatusCode();

            var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var memoryStream = new MemoryStream();
            await stream.CopyToAsync(memoryStream, cancellationToken);
            
            memoryStream.Position = 0;
            return memoryStream;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading from HTTP API: {FilePath}", filePath);
            throw;
        }
    }

    public async Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var config = GetHttpConfig(dataSource);
            var apiUrl = dataSource.FilePath;
            
            _logger.LogInformation("Listing endpoints from HTTP API: {ApiUrl}", apiUrl);
            
            ConfigureHttpClient(dataSource);
            
            // If list endpoint is configured, use it
            if (!string.IsNullOrEmpty(config.ListEndpoint))
            {
                var response = await _httpClient.GetAsync(config.ListEndpoint, cancellationToken);
                response.EnsureSuccessStatusCode();
                
                var content = await response.Content.ReadAsStringAsync(cancellationToken);
                var endpoints = JsonSerializer.Deserialize<List<string>>(content) ?? new List<string>();
                
                _logger.LogInformation("Found {Count} endpoints from API", endpoints.Count);
                return endpoints;
            }
            
            // Otherwise return the main endpoint
            return new List<string> { apiUrl };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing endpoints from HTTP API");
            throw;
        }
    }

    public async Task<bool> TestConnectionAsync(
        DataProcessingDataSource dataSource,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var apiUrl = dataSource.FilePath;
            _logger.LogInformation("Testing HTTP API connection to: {ApiUrl}", apiUrl);
            
            ConfigureHttpClient(dataSource);
            var response = await _httpClient.GetAsync(apiUrl, cancellationToken);
            
            var success = response.IsSuccessStatusCode;
            _logger.LogInformation("HTTP API connection test {Result}", success ? "successful" : "failed");
            
            return success;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "HTTP API connection test failed");
            return false;
        }
    }

    public async Task<FileMetadata> GetFileMetadataAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        try
        {
            ConfigureHttpClient(dataSource);
            using var request = new HttpRequestMessage(HttpMethod.Head, filePath);
            var response = await _httpClient.SendAsync(request, cancellationToken);
            
            response.EnsureSuccessStatusCode();

            var metadata = new FileMetadata
            {
                FilePath = filePath,
                FileName = Path.GetFileName(filePath),
                FileSizeBytes = response.Content.Headers.ContentLength ?? 0,
                LastModifiedUtc = response.Content.Headers.LastModified?.UtcDateTime ?? DateTime.UtcNow,
                ContentType = response.Content.Headers.ContentType?.MediaType ?? "application/json"
            };

            return metadata;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metadata for HTTP resource: {FilePath}", filePath);
            throw;
        }
    }

    private void ConfigureHttpClient(DataProcessingDataSource dataSource)
    {
        var config = GetHttpConfig(dataSource);
        
        // Set authentication header
        if (!string.IsNullOrEmpty(config.AuthType))
        {
            if (config.AuthType.Equals("bearer", StringComparison.OrdinalIgnoreCase) 
                && !string.IsNullOrEmpty(config.BearerToken))
            {
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", config.BearerToken);
            }
            else if (config.AuthType.Equals("basic", StringComparison.OrdinalIgnoreCase)
                && !string.IsNullOrEmpty(config.Username))
            {
                var credentials = Convert.ToBase64String(
                    System.Text.Encoding.ASCII.GetBytes($"{config.Username}:{config.Password}"));
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Basic", credentials);
            }
        }

        // Set custom headers
        foreach (var header in config.CustomHeaders)
        {
            _httpClient.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value);
        }

        // Set timeout
        if (config.TimeoutSeconds > 0)
        {
            _httpClient.Timeout = TimeSpan.FromSeconds(config.TimeoutSeconds);
        }
    }

    private HttpConfiguration GetHttpConfig(DataProcessingDataSource dataSource)
    {
        var config = new HttpConfiguration();

        if (dataSource.AdditionalConfiguration != null)
        {
            if (dataSource.AdditionalConfiguration.Contains("HttpAuthType"))
                config.AuthType = dataSource.AdditionalConfiguration["HttpAuthType"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("HttpBearerToken"))
                config.BearerToken = dataSource.AdditionalConfiguration["HttpBearerToken"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("HttpUsername"))
                config.Username = dataSource.AdditionalConfiguration["HttpUsername"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("HttpPassword"))
                config.Password = dataSource.AdditionalConfiguration["HttpPassword"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("HttpTimeoutSeconds"))
                config.TimeoutSeconds = dataSource.AdditionalConfiguration["HttpTimeoutSeconds"].AsInt32;
            
            if (dataSource.AdditionalConfiguration.Contains("HttpListEndpoint"))
                config.ListEndpoint = dataSource.AdditionalConfiguration["HttpListEndpoint"].AsString;
            
            if (dataSource.AdditionalConfiguration.Contains("HttpCustomHeaders") 
                && dataSource.AdditionalConfiguration["HttpCustomHeaders"].IsBsonDocument)
            {
                var headers = dataSource.AdditionalConfiguration["HttpCustomHeaders"].AsBsonDocument;
                foreach (var element in headers.Elements)
                {
                    config.CustomHeaders[element.Name] = element.Value.AsString;
                }
            }
        }

        return config;
    }

    private class HttpConfiguration
    {
        public string AuthType { get; set; } = "none"; // none, bearer, basic
        public string BearerToken { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public int TimeoutSeconds { get; set; } = 30;
        public string ListEndpoint { get; set; } = string.Empty;
        public Dictionary<string, string> CustomHeaders { get; set; } = new();
    }
}
