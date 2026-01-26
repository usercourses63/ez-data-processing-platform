// HttpOutputHandler.cs - HTTP API Output Handler
// v0.2.0: External File Access Support
// Date: January 26, 2026

using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using DataProcessing.Shared.Entities;
using DataProcessing.Output.Models;

namespace DataProcessing.Output.Handlers;

/// <summary>
/// Handles output to HTTP/HTTPS API endpoints
/// </summary>
public class HttpOutputHandler : IOutputHandler
{
    private readonly ILogger<HttpOutputHandler> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    public HttpOutputHandler(
        ILogger<HttpOutputHandler> logger,
        IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    public bool CanHandle(string destinationType) => destinationType == "http";

    public async Task<OutputResult> WriteAsync(
        OutputDestination destination,
        string content,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            if (destination.HttpConfig == null)
            {
                throw new ArgumentException("HttpConfig is required for HTTP destination type");
            }

            var config = destination.HttpConfig;

            _logger.LogInformation(
                "Sending to HTTP endpoint: {Method} {Url}, destination={Destination}",
                config.Method, config.Url, destination.Name);

            using var client = _httpClientFactory.CreateClient("OutputHandler");

            // Build request
            using var request = new HttpRequestMessage
            {
                Method = GetHttpMethod(config.Method),
                RequestUri = new Uri(config.Url),
                Content = new StringContent(content, Encoding.UTF8, GetContentType(destination.OutputFormat))
            };

            // Add custom headers
            if (config.Headers != null)
            {
                foreach (var header in config.Headers)
                {
                    request.Headers.TryAddWithoutValidation(header.Key, header.Value);
                }
            }

            // Add auth token if provided
            if (!string.IsNullOrEmpty(config.AuthToken))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.AuthToken);
            }

            // Add filename as custom header
            request.Headers.TryAddWithoutValidation("X-Original-Filename", fileName);

            // Send request
            using var response = await client.SendAsync(request, cancellationToken);

            stopwatch.Stop();

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation(
                    "Successfully sent to HTTP endpoint: {Url}, status={StatusCode}, size={Size} bytes",
                    config.Url, (int)response.StatusCode, content.Length);

                return OutputResult.Successful(
                    destination.Name,
                    "http",
                    content.Length,
                    stopwatch.Elapsed);
            }
            else
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                var errorMessage = $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}: {errorBody}";

                _logger.LogWarning(
                    "HTTP endpoint returned error: {Url}, status={StatusCode}, error={Error}",
                    config.Url, (int)response.StatusCode, errorBody);

                return OutputResult.Failure(
                    destination.Name,
                    "http",
                    errorMessage);
            }
        }
        catch (Exception ex)
        {
            stopwatch.Stop();

            _logger.LogError(
                ex,
                "Failed to send to HTTP destination {Destination}, url={Url}",
                destination.Name,
                destination.HttpConfig?.Url);

            return OutputResult.Failure(
                destination.Name,
                "http",
                ex.Message);
        }
    }

    private static HttpMethod GetHttpMethod(string method)
    {
        return method.ToUpperInvariant() switch
        {
            "GET" => HttpMethod.Get,
            "POST" => HttpMethod.Post,
            "PUT" => HttpMethod.Put,
            "PATCH" => HttpMethod.Patch,
            "DELETE" => HttpMethod.Delete,
            _ => HttpMethod.Post
        };
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
