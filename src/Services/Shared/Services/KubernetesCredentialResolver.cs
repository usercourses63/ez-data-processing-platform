using k8s;
using k8s.Models;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Diagnostics.Metrics;
using System.Text;

namespace DataProcessing.Shared.Services;

/// <summary>
/// Resolves server credentials from Kubernetes Secrets
/// Production-ready implementation with error handling, logging, and OpenTelemetry instrumentation
/// v0.2.0: External File Access Support
/// </summary>
public class KubernetesCredentialResolver : ICredentialResolver
{
    private readonly IKubernetes _kubernetesClient;
    private readonly ILogger<KubernetesCredentialResolver> _logger;
    private readonly string _defaultNamespace;

    // OpenTelemetry Instrumentation
    private static readonly ActivitySource ActivitySource = new("DataProcessing.CredentialResolver", "1.0.0");
    private static readonly Meter Meter = new("DataProcessing.CredentialResolver", "1.0.0");

    // Metrics
    private static readonly Counter<long> CredentialResolutionCounter = Meter.CreateCounter<long>(
        "credential_resolution_total",
        description: "Total number of credential resolution attempts",
        unit: "resolutions");

    private static readonly Histogram<double> CredentialResolutionDuration = Meter.CreateHistogram<double>(
        "credential_resolution_duration_seconds",
        description: "Duration of credential resolution operations",
        unit: "s");

    public KubernetesCredentialResolver(
        IKubernetes kubernetesClient,
        ILogger<KubernetesCredentialResolver> logger,
        string defaultNamespace = "ez-platform")
    {
        _kubernetesClient = kubernetesClient ?? throw new ArgumentNullException(nameof(kubernetesClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _defaultNamespace = defaultNamespace;
    }

    /// <summary>
    /// Resolves credentials from the specified Kubernetes Secret reference
    /// </summary>
    /// <param name="secretRef">Reference in format "namespace/secret-name" or "secret-name"</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Resolved server credentials</returns>
    /// <exception cref="CredentialResolutionException">When credentials cannot be resolved</exception>
    public async Task<ServerCredentials> ResolveAsync(string secretRef, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(secretRef))
            throw new ArgumentException("Secret reference cannot be empty", nameof(secretRef));

        var stopwatch = Stopwatch.StartNew();
        var (secretNamespace, secretName) = ParseSecretRef(secretRef);

        // Start OpenTelemetry Activity for distributed tracing
        using var activity = ActivitySource.StartActivity("ResolveCredentials");
        activity?.SetTag("secret.namespace", secretNamespace);
        activity?.SetTag("secret.name", secretName);
        activity?.SetTag("secret.ref", secretRef);

        try
        {
            _logger.LogDebug("Resolving credentials from K8s Secret: {Namespace}/{SecretName}", secretNamespace, secretName);

            // Read Secret from Kubernetes API
            V1Secret secret;
            try
            {
                secret = await _kubernetesClient.CoreV1.ReadNamespacedSecretAsync(
                    secretName,
                    secretNamespace,
                    cancellationToken: cancellationToken);
            }
            catch (k8s.Autorest.HttpOperationException ex) when (ex.Response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                _logger.LogWarning("Secret not found: {Namespace}/{SecretName}", secretNamespace, secretName);
                throw new CredentialResolutionException(
                    secretRef,
                    $"Secret not found: {secretNamespace}/{secretName}");
            }
            catch (k8s.Autorest.HttpOperationException ex) when (ex.Response.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                _logger.LogError("Access denied to secret: {Namespace}/{SecretName}. Check RBAC permissions.", secretNamespace, secretName);
                throw new CredentialResolutionException(
                    secretRef,
                    $"Access denied to secret: {secretNamespace}/{secretName}. Check service account permissions.");
            }

            // Map Secret data to ServerCredentials
            var credentials = MapSecretToCredentials(secret);

            stopwatch.Stop();

            _logger.LogInformation(
                "Successfully resolved credentials from {Namespace}/{SecretName}: {CredentialTypes} in {DurationMs}ms",
                secretNamespace,
                secretName,
                credentials.ToString(), // Uses redacted ToString() from ServerCredentials
                stopwatch.ElapsedMilliseconds);

            // Record success metrics
            activity?.SetTag("credential.types", credentials.ToString());
            activity?.SetTag("resolution.status", "success");
            activity?.SetStatus(ActivityStatusCode.Ok);

            var tags = new TagList
            {
                { "status", "success" },
                { "namespace", secretNamespace }
            };
            CredentialResolutionCounter.Add(1, tags);
            CredentialResolutionDuration.Record(stopwatch.Elapsed.TotalSeconds, tags);

            return credentials;
        }
        catch (CredentialResolutionException ex)
        {
            stopwatch.Stop();

            // Record failure metrics
            activity?.SetTag("resolution.status", "failed");
            activity?.SetTag("error.type", ex.GetType().Name);
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);

            var tags = new TagList
            {
                { "status", "failed" },
                { "namespace", secretNamespace },
                { "error_type", "not_found_or_forbidden" }
            };
            CredentialResolutionCounter.Add(1, tags);
            CredentialResolutionDuration.Record(stopwatch.Elapsed.TotalSeconds, tags);

            throw; // Re-throw our custom exception as-is
        }
        catch (Exception ex)
        {
            stopwatch.Stop();

            _logger.LogError(ex, "Unexpected error resolving credentials from secret: {SecretRef}", secretRef);

            // Record failure metrics
            activity?.SetTag("resolution.status", "error");
            activity?.SetTag("error.type", ex.GetType().Name);
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);

            var tags = new TagList
            {
                { "status", "error" },
                { "namespace", secretNamespace },
                { "error_type", "unexpected" }
            };
            CredentialResolutionCounter.Add(1, tags);
            CredentialResolutionDuration.Record(stopwatch.Elapsed.TotalSeconds, tags);

            throw new CredentialResolutionException(secretRef, "Failed to resolve credentials", ex);
        }
    }

    /// <summary>
    /// Checks if a secret exists for the specified reference
    /// </summary>
    /// <param name="secretRef">Reference to check</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if secret exists and is readable</returns>
    public async Task<bool> ExistsAsync(string secretRef, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(secretRef))
            return false;

        try
        {
            var (secretNamespace, secretName) = ParseSecretRef(secretRef);

            await _kubernetesClient.CoreV1.ReadNamespacedSecretAsync(
                secretName,
                secretNamespace,
                cancellationToken: cancellationToken);

            return true;
        }
        catch (k8s.Autorest.HttpOperationException ex) when (
            ex.Response.StatusCode == System.Net.HttpStatusCode.NotFound ||
            ex.Response.StatusCode == System.Net.HttpStatusCode.Forbidden)
        {
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error checking if secret exists: {SecretRef}", secretRef);
            return false;
        }
    }

    /// <summary>
    /// Parse secret reference in format "namespace/secret-name" or "secret-name"
    /// Uses default namespace if not specified
    /// </summary>
    private (string Namespace, string SecretName) ParseSecretRef(string secretRef)
    {
        if (secretRef.Contains('/'))
        {
            var parts = secretRef.Split('/', 2);
            return (parts[0], parts[1]);
        }

        return (_defaultNamespace, secretRef);
    }

    /// <summary>
    /// Map Kubernetes Secret data to ServerCredentials
    /// Supports multiple authentication types based on which fields are present in the Secret
    ///
    /// Expected Secret keys:
    /// - username, password: Basic auth (FTP, SFTP, HTTP)
    /// - accessKey, secretKey, sessionToken: S3/AWS auth
    /// - privateKey, privateKeyPassphrase: SFTP key auth
    /// - saslUsername, saslPassword: Kafka SASL auth
    /// - bearerToken: HTTP Bearer token
    /// - apiKey: API key authentication
    /// </summary>
    private ServerCredentials MapSecretToCredentials(V1Secret secret)
    {
        var credentials = new ServerCredentials();

        if (secret.Data == null || secret.Data.Count == 0)
        {
            _logger.LogWarning("Secret {Namespace}/{SecretName} has no data fields",
                secret.Metadata.NamespaceProperty, secret.Metadata.Name);
            return credentials;
        }

        // Helper to decode base64 Secret data
        static string? DecodeSecretValue(byte[] bytes) =>
            bytes != null ? Encoding.UTF8.GetString(bytes) : null;

        // Basic Auth (FTP, SFTP, HTTP Basic)
        if (secret.Data.TryGetValue("username", out var usernameBytes))
            credentials.Username = DecodeSecretValue(usernameBytes);

        if (secret.Data.TryGetValue("password", out var passwordBytes))
            credentials.Password = DecodeSecretValue(passwordBytes);

        // S3 Auth (AWS, MinIO)
        if (secret.Data.TryGetValue("accessKey", out var accessKeyBytes))
            credentials.AccessKey = DecodeSecretValue(accessKeyBytes);

        if (secret.Data.TryGetValue("secretKey", out var secretKeyBytes))
            credentials.SecretKey = DecodeSecretValue(secretKeyBytes);

        if (secret.Data.TryGetValue("sessionToken", out var sessionTokenBytes))
            credentials.SessionToken = DecodeSecretValue(sessionTokenBytes);

        // SFTP Key Auth
        if (secret.Data.TryGetValue("privateKey", out var privateKeyBytes))
            credentials.PrivateKey = DecodeSecretValue(privateKeyBytes);

        if (secret.Data.TryGetValue("privateKeyPassphrase", out var passphraseBytes))
            credentials.PrivateKeyPassphrase = DecodeSecretValue(passphraseBytes);

        // Kafka SASL
        if (secret.Data.TryGetValue("saslUsername", out var saslUserBytes))
            credentials.SaslUsername = DecodeSecretValue(saslUserBytes);

        if (secret.Data.TryGetValue("saslPassword", out var saslPassBytes))
            credentials.SaslPassword = DecodeSecretValue(saslPassBytes);

        // HTTP Bearer Token
        if (secret.Data.TryGetValue("bearerToken", out var bearerBytes))
            credentials.BearerToken = DecodeSecretValue(bearerBytes);

        // API Key
        if (secret.Data.TryGetValue("apiKey", out var apiKeyBytes))
            credentials.ApiKey = DecodeSecretValue(apiKeyBytes);

        // Parse expiration if present
        if (secret.Data.TryGetValue("expiresAt", out var expiresBytes))
        {
            var expiresStr = DecodeSecretValue(expiresBytes);
            if (DateTime.TryParse(expiresStr, out var expiresAt))
                credentials.ExpiresAt = expiresAt;
        }

        return credentials;
    }
}
