using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text.Json;

namespace DataProcessing.Shared.Connectors;

/// <summary>
/// Connector for reading data from HTTP/REST APIs and WebDAV
/// v0.2.0: Implements IServerConnector for AdminServer support
/// </summary>
public class HttpApiConnector : IDataSourceConnector, IServerConnector
{
    private readonly ILogger<HttpApiConnector> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly Lazy<HttpClient> _lazyHttpClient;
    private HttpClient _httpClient => _lazyHttpClient.Value;

    public string ConnectorType => "http";

    public HttpApiConnector(ILogger<HttpApiConnector> logger, IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _lazyHttpClient = new Lazy<HttpClient>(() => _httpClientFactory.CreateClient(nameof(HttpApiConnector)));
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

    #region IServerConnector Implementation (AdminServer support)

    public async Task<ConnectionTestResult> TestConnectionAsync(
        AdminServer server,
        ServerCredentials? credentials,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var baseUrl = GetBaseUrl(server);

        try
        {
            _logger.LogInformation("Testing HTTP connection: {BaseUrl}", baseUrl);

            // Create fresh HttpClient to avoid "already started" error
            using var httpClient = _httpClientFactory.CreateClient(nameof(HttpApiConnector));

            // Configure timeout
            var timeout = server.ConnectionTimeoutSeconds > 0 ? server.ConnectionTimeoutSeconds : 30;
            httpClient.Timeout = TimeSpan.FromSeconds(timeout);

            // Set auth headers if credentials provided
            if (credentials?.HasBasicAuth == true)
            {
                var encoded = Convert.ToBase64String(
                    System.Text.Encoding.ASCII.GetBytes($"{credentials.Username}:{credentials.Password}"));
                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", encoded);
            }

            var response = await httpClient.GetAsync(baseUrl, cancellationToken);
            stopwatch.Stop();

            if (response.IsSuccessStatusCode)
            {
                return ConnectionTestResult.Success(
                    stopwatch.ElapsedMilliseconds,
                    $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}");
            }
            else
            {
                return ConnectionTestResult.Failure(
                    $"HTTP {(int)response.StatusCode}: {response.ReasonPhrase}");
            }
        }
        catch (HttpRequestException ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "HTTP connection test failed: {BaseUrl}", baseUrl);
            return ConnectionTestResult.Failure($"Connection error: {ex.Message}");
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Unexpected error testing HTTP connection: {BaseUrl}", baseUrl);
            return ConnectionTestResult.Failure($"Error: {ex.Message}");
        }
    }

    public async Task<List<DiscoveredFile>> ListFilesAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string? path,
        string pattern,
        CancellationToken cancellationToken = default)
    {
        var baseUrl = GetBaseUrl(server);
        var fullUrl = string.IsNullOrEmpty(path)
            ? baseUrl
            : $"{baseUrl.TrimEnd('/')}/{path.TrimStart('/')}";

        // Ensure trailing slash for directory listing
        if (!fullUrl.EndsWith('/'))
            fullUrl += '/';

        _logger.LogInformation("Listing files from HTTP API: {Url}", fullUrl);

        try
        {
            using var httpClient = CreateHttpClientForServer(server, credentials);

            var response = await httpClient.GetAsync(fullUrl, cancellationToken);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            var contentType = response.Content.Headers.ContentType?.MediaType ?? "";

            _logger.LogInformation("HTTP List response: StatusCode={StatusCode}, ContentType={ContentType}, ContentLength={ContentLength}, RequestUri={RequestUri}",
                (int)response.StatusCode, contentType, content.Length, response.RequestMessage?.RequestUri);

            List<string> files;

            // Try JSON first, then fall back to HTML directory listing parsing
            if (contentType.Contains("json"))
            {
                files = JsonSerializer.Deserialize<List<string>>(content) ?? new List<string>();
            }
            else
            {
                // Parse HTML directory listing (nginx autoindex, WebDAV, Apache)
                // Matches <a href="filename">...</a> patterns
                files = ParseHtmlDirectoryListing(content);
                _logger.LogInformation("HTML parsing found {Count} raw file entries from {ContentLength} chars of HTML. First 300 chars: {Preview}",
                    files.Count, content.Length, content.Length > 300 ? content[..300] : content);
            }

            // Apply pattern filter and convert to DiscoveredFile objects
            var discoveredFiles = files
                .Where(f => !f.EndsWith('/')) // Skip directories
                .Where(f => MatchesPattern(Path.GetFileName(f), pattern))
                .Select(f => new DiscoveredFile
                {
                    FullPath = f,
                    FileName = Path.GetFileName(f),
                    SizeBytes = 0,
                    LastModifiedUtc = DateTime.UtcNow,
                    IsDirectory = false,
                    ContentType = "application/octet-stream"
                }).ToList();

            _logger.LogInformation("Found {Count} files from HTTP API", discoveredFiles.Count);
            return discoveredFiles;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing files from HTTP API: {Url}", fullUrl);
            throw;
        }
    }

    private static List<string> ParseHtmlDirectoryListing(string html)
    {
        var files = new List<string>();
        var regex = new System.Text.RegularExpressions.Regex(
            @"<a\s+href=""([^""]+)""",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        foreach (System.Text.RegularExpressions.Match match in regex.Matches(html))
        {
            var href = match.Groups[1].Value;
            // Skip parent directory and absolute links
            if (href == "../" || href.StartsWith("/") || href.StartsWith("http://") || href.StartsWith("https://"))
                continue;
            files.Add(href.TrimEnd('/'));
        }

        return files;
    }

    private static bool MatchesPattern(string fileName, string pattern)
    {
        if (string.IsNullOrEmpty(pattern) || pattern == "*" || pattern == "*.*")
            return true;

        var regexPattern = "^" + System.Text.RegularExpressions.Regex.Escape(pattern)
            .Replace("\\*", ".*")
            .Replace("\\?", ".") + "$";

        return System.Text.RegularExpressions.Regex.IsMatch(fileName, regexPattern,
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }

    public async Task<byte[]> ReadFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        CancellationToken cancellationToken = default)
    {
        var baseUrl = GetBaseUrl(server);
        var fullUrl = filePath.StartsWith("http")
            ? filePath
            : $"{baseUrl.TrimEnd('/')}/{filePath.TrimStart('/')}";

        _logger.LogInformation("Reading file from HTTP: {Url}", fullUrl);

        try
        {
            using var httpClient = CreateHttpClientForServer(server, credentials);

            var response = await httpClient.GetAsync(fullUrl, cancellationToken);
            response.EnsureSuccessStatusCode();

            return await response.Content.ReadAsByteArrayAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading file from HTTP: {Url}", fullUrl);
            throw;
        }
    }

    public async Task WriteFileAsync(
        AdminServer server,
        ServerCredentials? credentials,
        string filePath,
        byte[] content,
        CancellationToken cancellationToken = default)
    {
        var baseUrl = GetBaseUrl(server);
        var fullUrl = filePath.StartsWith("http")
            ? filePath
            : $"{baseUrl.TrimEnd('/')}/{filePath.TrimStart('/')}";

        _logger.LogInformation("Writing file to HTTP: {Url} ({SizeBytes} bytes)", fullUrl, content.Length);

        try
        {
            using var httpClient = CreateHttpClientForServer(server, credentials);

            using var byteContent = new ByteArrayContent(content);
            byteContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");

            var response = await httpClient.PutAsync(fullUrl, byteContent, cancellationToken);
            response.EnsureSuccessStatusCode();

            _logger.LogInformation("File written successfully to HTTP: {Url}", fullUrl);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error writing file to HTTP: {Url}", fullUrl);
            throw;
        }
    }

    private string GetBaseUrl(AdminServer server)
    {
        // If Host is set, construct URL from components
        if (!string.IsNullOrEmpty(server.Host))
        {
            var useHttps = server.TypeSpecificConfig?.Contains("UseHttps") == true &&
                          server.TypeSpecificConfig["UseHttps"].AsBoolean;
            var scheme = useHttps ? "https" : "http";

            // Handle nullable Port properly
            var portValue = server.Port ?? (useHttps ? 443 : 80);
            var port = portValue != 80 && portValue != 443
                ? $":{portValue}"
                : "";

            var basePath = (server.BasePath ?? "").TrimEnd('/');
            // Add trailing slash to prevent nginx redirects that drop port
            var trailingSlash = !string.IsNullOrEmpty(basePath) ? "/" : "";

            return $"{scheme}://{server.Host}{port}{basePath}{trailingSlash}";
        }

        // Otherwise use BasePath as full URL
        return server.BasePath ?? "http://localhost";
    }

    private HttpClient CreateHttpClientForServer(AdminServer server, ServerCredentials? credentials)
    {
        var httpClient = _httpClientFactory.CreateClient(nameof(HttpApiConnector));

        // Set authentication from ServerCredentials
        if (credentials != null)
        {
            if (!string.IsNullOrEmpty(credentials.BearerToken))
            {
                httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", credentials.BearerToken);
            }
            else if (credentials.HasBasicAuth)
            {
                var encoded = Convert.ToBase64String(
                    System.Text.Encoding.ASCII.GetBytes($"{credentials.Username}:{credentials.Password}"));
                httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Basic", encoded);
            }
            else if (!string.IsNullOrEmpty(credentials.ApiKey))
            {
                httpClient.DefaultRequestHeaders.Add("X-API-Key", credentials.ApiKey);
            }
        }

        // Set timeout from server config
        var timeout = server.ConnectionTimeoutSeconds > 0
            ? server.ConnectionTimeoutSeconds
            : 30;
        httpClient.Timeout = TimeSpan.FromSeconds(timeout);

        return httpClient;
    }

    #endregion
}
