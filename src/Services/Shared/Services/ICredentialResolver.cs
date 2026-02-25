namespace DataProcessing.Shared.Services;

/// <summary>
/// Resolves server credentials from external sources (e.g., Kubernetes Secrets)
/// Credentials are never stored in the database - only references to secrets
/// </summary>
public interface ICredentialResolver
{
    /// <summary>
    /// Resolves credentials from the specified secret reference
    /// </summary>
    /// <param name="secretRef">Reference to the secret (e.g., "namespace/secret-name" or "secret-name")</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Resolved credentials</returns>
    /// <exception cref="CredentialResolutionException">When credentials cannot be resolved</exception>
    Task<ServerCredentials> ResolveAsync(string secretRef, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if credentials exist for the specified secret reference
    /// </summary>
    /// <param name="secretRef">Reference to the secret</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if credentials exist</returns>
    Task<bool> ExistsAsync(string secretRef, CancellationToken cancellationToken = default);
}

/// <summary>
/// Holds resolved credentials for server connections
/// Supports multiple authentication types across different protocols
/// </summary>
public class ServerCredentials
{
    // ========== Basic Auth (FTP, SFTP, HTTP Basic) ==========

    /// <summary>
    /// Username for basic authentication
    /// </summary>
    public string? Username { get; set; }

    /// <summary>
    /// Password for basic authentication
    /// </summary>
    public string? Password { get; set; }

    // ========== S3/Object Storage ==========

    /// <summary>
    /// AWS/S3 access key ID
    /// </summary>
    public string? AccessKey { get; set; }

    /// <summary>
    /// AWS/S3 secret access key
    /// </summary>
    public string? SecretKey { get; set; }

    /// <summary>
    /// AWS session token (for temporary credentials)
    /// </summary>
    public string? SessionToken { get; set; }

    // ========== SFTP Key Auth ==========

    /// <summary>
    /// Private key content for SFTP key authentication (PEM format)
    /// </summary>
    public string? PrivateKey { get; set; }

    /// <summary>
    /// Passphrase for encrypted private key
    /// </summary>
    public string? PrivateKeyPassphrase { get; set; }

    // ========== Kafka SASL ==========

    /// <summary>
    /// SASL username for Kafka authentication
    /// </summary>
    public string? SaslUsername { get; set; }

    /// <summary>
    /// SASL password for Kafka authentication
    /// </summary>
    public string? SaslPassword { get; set; }

    // ========== HTTP Bearer Token ==========

    /// <summary>
    /// Bearer token for HTTP authentication
    /// </summary>
    public string? BearerToken { get; set; }

    // ========== API Keys ==========

    /// <summary>
    /// API key for services that use key-based authentication
    /// </summary>
    public string? ApiKey { get; set; }

    // ========== Metadata ==========

    /// <summary>
    /// When the credentials were resolved
    /// </summary>
    public DateTime ResolvedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Expiration time for temporary credentials (e.g., AWS STS)
    /// </summary>
    public DateTime? ExpiresAt { get; set; }

    /// <summary>
    /// Checks if the credentials have expired
    /// </summary>
    public bool IsExpired => ExpiresAt.HasValue && DateTime.UtcNow > ExpiresAt.Value;

    /// <summary>
    /// Checks if the credentials have basic auth (username/password)
    /// </summary>
    public bool HasBasicAuth => !string.IsNullOrEmpty(Username) && !string.IsNullOrEmpty(Password);

    /// <summary>
    /// Checks if the credentials have S3 auth (access key/secret key)
    /// </summary>
    public bool HasS3Auth => !string.IsNullOrEmpty(AccessKey) && !string.IsNullOrEmpty(SecretKey);

    /// <summary>
    /// Checks if the credentials have SFTP key auth
    /// </summary>
    public bool HasKeyAuth => !string.IsNullOrEmpty(PrivateKey);

    /// <summary>
    /// Checks if the credentials have Kafka SASL auth
    /// </summary>
    public bool HasSaslAuth => !string.IsNullOrEmpty(SaslUsername) && !string.IsNullOrEmpty(SaslPassword);

    /// <summary>
    /// Returns a redacted string representation (safe for logging)
    /// </summary>
    public override string ToString()
    {
        var parts = new List<string>();
        if (HasBasicAuth) parts.Add($"BasicAuth(user={Username})");
        if (HasS3Auth) parts.Add($"S3Auth(key={AccessKey?[..Math.Min(4, AccessKey?.Length ?? 0)]}***)");
        if (HasKeyAuth) parts.Add("KeyAuth");
        if (HasSaslAuth) parts.Add($"SaslAuth(user={SaslUsername})");
        if (!string.IsNullOrEmpty(BearerToken)) parts.Add("BearerToken");
        if (!string.IsNullOrEmpty(ApiKey)) parts.Add("ApiKey");
        return parts.Count > 0 ? string.Join(", ", parts) : "NoCredentials";
    }

    /// <summary>
    /// Creates ServerCredentials from BsonDocument (TypeSpecificConfig)
    /// </summary>
    public static ServerCredentials FromBsonDocument(MongoDB.Bson.BsonDocument config)
    {
        var credentials = new ServerCredentials();

        // Extract basic auth (FTP, SFTP, HTTP)
        if (config.TryGetValue("Username", out var username))
            credentials.Username = username.AsString;
        if (config.TryGetValue("Password", out var password))
            credentials.Password = password.AsString;

        // Extract S3 credentials
        if (config.TryGetValue("AccessKey", out var accessKey))
            credentials.AccessKey = accessKey.AsString;
        if (config.TryGetValue("SecretKey", out var secretKey))
            credentials.SecretKey = secretKey.AsString;
        if (config.TryGetValue("SessionToken", out var sessionToken))
            credentials.SessionToken = sessionToken.AsString;

        // Extract SFTP key auth
        if (config.TryGetValue("PrivateKey", out var privateKey))
            credentials.PrivateKey = privateKey.AsString;
        if (config.TryGetValue("PrivateKeyPassphrase", out var passphrase))
            credentials.PrivateKeyPassphrase = passphrase.AsString;

        // Extract Kafka SASL
        if (config.TryGetValue("SaslUsername", out var saslUser))
            credentials.SaslUsername = saslUser.AsString;
        if (config.TryGetValue("SaslPassword", out var saslPass))
            credentials.SaslPassword = saslPass.AsString;

        // Extract API key / Bearer token
        if (config.TryGetValue("ApiKey", out var apiKey))
            credentials.ApiKey = apiKey.AsString;
        if (config.TryGetValue("BearerToken", out var bearerToken))
            credentials.BearerToken = bearerToken.AsString;

        return credentials;
    }
}

/// <summary>
/// Exception thrown when credentials cannot be resolved
/// </summary>
public class CredentialResolutionException : Exception
{
    public string SecretRef { get; }

    public CredentialResolutionException(string secretRef, string message)
        : base(message)
    {
        SecretRef = secretRef;
    }

    public CredentialResolutionException(string secretRef, string message, Exception innerException)
        : base(message, innerException)
    {
        SecretRef = secretRef;
    }
}
