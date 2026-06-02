using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using System.Security.Cryptography;
using System.Text;

namespace DataProcessing.Shared.Services;

/// <summary>
/// Provides field-level encryption (AES-256-CBC) for sensitive server credential fields
/// — specifically the S3 <c>SecretKey</c> stored inside <c>AdminServer.TypeSpecificConfig</c>.
///
/// Phase 34 (D-A3): the secret-at-rest mechanism for the AdminServer S3 path. The admin
/// enters an Access Key / Secret Key in the UI; the controller encrypts the Secret Key with
/// this protector before persistence so only ciphertext reaches MongoDB, and the
/// connection-establish flow decrypts on read before <see cref="ServerCredentials.FromBsonDocument"/>.
///
/// Encrypted values are Base64-encoded and prefixed with the discriminator <c>enc:v1:</c>
/// (random 16-byte IV prepended to the ciphertext) so they are detectable and legacy
/// plaintext secrets read through transparently for back-compat.
/// </summary>
public class ServerCredentialProtector
{
    /// <summary>
    /// Discriminator prefix marking a value as produced by this protector (versioned).
    /// </summary>
    public const string Prefix = "enc:v1:";

    /// <summary>
    /// Configuration key holding the field-encryption secret
    /// (env: <c>Credentials__FieldEncryptionKey</c>).
    /// </summary>
    public const string ConfigKey = "Credentials:FieldEncryptionKey";

    // Documented developer fallback used ONLY when no key is configured in a non-production
    // environment. It is intentionally non-secret; production MUST set Credentials:FieldEncryptionKey.
    private const string DevFallbackSecret = "ez-platform-dev-field-encryption-fallback-do-not-use-in-prod";

    private readonly byte[] _key;
    private readonly ILogger<ServerCredentialProtector> _logger;

    /// <summary>
    /// Creates the protector, deriving a 32-byte AES key via SHA-256 of the configured secret.
    /// </summary>
    public ServerCredentialProtector(
        IConfiguration configuration,
        ILogger<ServerCredentialProtector> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        var configured = configuration[ConfigKey];
        string secret;
        if (string.IsNullOrWhiteSpace(configured))
        {
            secret = DevFallbackSecret;
            // Single warning; never logs the key material.
            _logger.LogWarning(
                "Credentials:FieldEncryptionKey is not configured; using the non-production dev fallback key. " +
                "Set Credentials__FieldEncryptionKey before deploying to production.");
        }
        else
        {
            secret = configured;
        }

        // Derive a fixed 32-byte (AES-256) key from the secret of arbitrary length.
        _key = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
    }

    /// <summary>
    /// Encrypts <paramref name="plaintext"/> with AES-256-CBC and a random IV, returning a
    /// Base64 value prefixed with <see cref="Prefix"/>. Never returns the input unchanged.
    /// </summary>
    public string Protect(string plaintext)
    {
        ArgumentNullException.ThrowIfNull(plaintext);

        using var aes = Aes.Create();
        aes.Key = _key;
        aes.GenerateIV();
        var iv = aes.IV;

        var plainBytes = Encoding.UTF8.GetBytes(plaintext);
        using var encryptor = aes.CreateEncryptor();
        var cipherBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

        // Prepend IV to ciphertext so Unprotect is self-contained.
        var combined = new byte[iv.Length + cipherBytes.Length];
        Buffer.BlockCopy(iv, 0, combined, 0, iv.Length);
        Buffer.BlockCopy(cipherBytes, 0, combined, iv.Length, cipherBytes.Length);

        return Prefix + Convert.ToBase64String(combined);
    }

    /// <summary>
    /// Decrypts a value produced by <see cref="Protect"/>. If <paramref name="value"/> is NOT
    /// prefixed with <see cref="Prefix"/> it is treated as legacy plaintext and returned unchanged.
    /// </summary>
    public string Unprotect(string value)
    {
        ArgumentNullException.ThrowIfNull(value);

        if (!IsProtected(value))
        {
            // Back-compat: legacy plaintext secrets read through transparently.
            return value;
        }

        var payload = value[Prefix.Length..];
        var combined = Convert.FromBase64String(payload);

        using var aes = Aes.Create();
        aes.Key = _key;

        var ivLength = aes.BlockSize / 8; // 16 bytes for AES
        if (combined.Length < ivLength)
        {
            throw new CryptographicException("Protected value is too short to contain an IV.");
        }

        var iv = new byte[ivLength];
        Buffer.BlockCopy(combined, 0, iv, 0, ivLength);
        aes.IV = iv;

        var cipherBytes = new byte[combined.Length - ivLength];
        Buffer.BlockCopy(combined, ivLength, cipherBytes, 0, cipherBytes.Length);

        using var decryptor = aes.CreateDecryptor();
        var plainBytes = decryptor.TransformFinalBlock(cipherBytes, 0, cipherBytes.Length);
        return Encoding.UTF8.GetString(plainBytes);
    }

    /// <summary>
    /// Returns true when <paramref name="value"/> carries the <see cref="Prefix"/> discriminator.
    /// </summary>
    public bool IsProtected(string? value)
        => value is not null && value.StartsWith(Prefix, StringComparison.Ordinal);

    /// <summary>
    /// If the <c>SecretKey</c> field of <paramref name="config"/> is present and protected,
    /// replaces it in place with the decrypted plaintext so a subsequent
    /// <see cref="ServerCredentials.FromBsonDocument"/> reads the real key. Legacy plaintext
    /// secrets (no <see cref="Prefix"/>) are left untouched.
    /// </summary>
    public static void DecryptSecretInPlace(BsonDocument config, ServerCredentialProtector protector)
    {
        ArgumentNullException.ThrowIfNull(config);
        ArgumentNullException.ThrowIfNull(protector);

        if (config.TryGetValue("SecretKey", out var secretValue)
            && secretValue.IsString)
        {
            var secret = secretValue.AsString;
            if (protector.IsProtected(secret))
            {
                config["SecretKey"] = protector.Unprotect(secret);
            }
        }
    }
}
