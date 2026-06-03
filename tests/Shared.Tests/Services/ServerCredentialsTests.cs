using DataProcessing.Shared.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using Xunit;

namespace DataProcessing.Shared.Tests.Services;

/// <summary>
/// Unit tests for <see cref="ServerCredentials"/> — the PascalCase S3 key contract that
/// <see cref="ServerCredentials.FromBsonDocument"/> reads from <c>AdminServer.TypeSpecificConfig</c>,
/// the redacted <see cref="ServerCredentials.ToString"/> (SC-04 — secret never logged), and the
/// <see cref="ServerCredentialProtector"/> round-trip (Phase 34, Plan 04 — backend unit tier).
///
/// These prove the foundation that delivers real keys to the S3 connector so it stops falling
/// through to the AWS SDK "IAM credentials is missing" path (Pitfall 2: no camelCase drift).
/// </summary>
public class ServerCredentialsTests
{
    private static ServerCredentialProtector CreateProtector(string? key = "unit-test-field-encryption-key-32b")
    {
        var dict = new Dictionary<string, string?>();
        if (key != null)
        {
            dict["Credentials:FieldEncryptionKey"] = key;
        }

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(dict)
            .Build();

        return new ServerCredentialProtector(config, NullLogger<ServerCredentialProtector>.Instance);
    }

    /// <summary>
    /// The full S3 PascalCase TypeSpecificConfig the AdminServer path persists and reads back.
    /// </summary>
    private static BsonDocument SampleS3Config() => new()
    {
        ["AccessKey"] = "minioadmin",
        ["SecretKey"] = "minioadmin123",
        ["Bucket"] = "ez-data",
        ["Region"] = "us-east-1",
        ["ForcePathStyle"] = true,
        ["UseHttp"] = true,
    };

    // ========== PascalCase key contract (Pitfall 2) ==========

    [Fact]
    public void FromBsonDocument_ReadsPascalCaseAccessKeyAndSecretKey_NonNullAndEqual()
    {
        var config = SampleS3Config();

        var credentials = ServerCredentials.FromBsonDocument(config);

        credentials.AccessKey.Should().NotBeNull();
        credentials.SecretKey.Should().NotBeNull();
        credentials.AccessKey.Should().Be("minioadmin");
        credentials.SecretKey.Should().Be("minioadmin123");
    }

    [Fact]
    public void FromBsonDocument_PopulatedS3Config_HasS3Auth()
    {
        var credentials = ServerCredentials.FromBsonDocument(SampleS3Config());

        credentials.HasS3Auth.Should().BeTrue();
    }

    [Fact]
    public void FromBsonDocument_CamelCaseKeys_DoNotPopulateS3Credentials()
    {
        // Pitfall 2 regression: the AdminServer path is PascalCase. camelCase keys must NOT
        // be picked up — otherwise the connector silently sees no keys and the "IAM credentials
        // is missing" path fires even though the admin entered keys.
        var camelCase = new BsonDocument
        {
            ["accessKey"] = "minioadmin",
            ["secretKey"] = "minioadmin123",
        };

        var credentials = ServerCredentials.FromBsonDocument(camelCase);

        credentials.AccessKey.Should().BeNull();
        credentials.SecretKey.Should().BeNull();
        credentials.HasS3Auth.Should().BeFalse();
    }

    // ========== Redaction (SC-04 — secret never logged) ==========

    [Fact]
    public void ToString_RedactsSecretKey_ShowsOnlyAccessKeyPrefix()
    {
        var credentials = new ServerCredentials
        {
            AccessKey = "minioadmin",
            SecretKey = "minioadmin123"
        };

        var redacted = credentials.ToString();

        redacted.Should().Be("S3Auth(key=mini***)");
        redacted.Should().NotContain("minioadmin123", "the secret must never appear in the redacted log form");
        redacted.Should().NotContain("SecretKey");
    }

    [Fact]
    public void ToString_DoesNotContainFullAccessKey_OnlyFirstFourChars()
    {
        var credentials = new ServerCredentials
        {
            AccessKey = "AKIAIOSFODNN7EXAMPLE",
            SecretKey = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        };

        var redacted = credentials.ToString();

        redacted.Should().Contain("S3Auth(key=AKIA***)");
        redacted.Should().NotContain("wJalrXUtnFEMI");
        redacted.Should().NotContain("EXAMPLE", "neither the full access key nor the secret should leak");
    }

    [Fact]
    public void ToString_NoCredentials_ReturnsNoCredentialsSentinel()
    {
        new ServerCredentials().ToString().Should().Be("NoCredentials");
    }

    // ========== ServerCredentialProtector round-trip (encrypt-at-rest, SC-04) ==========

    [Fact]
    public void Protect_ProducesCiphertext_DifferentFromPlaintext_WithDiscriminator()
    {
        var protector = CreateProtector();
        const string secret = "minioadmin123";

        var ciphertext = protector.Protect(secret);

        ciphertext.Should().NotBe(secret);
        ciphertext.Should().StartWith("enc:v1:");
        ciphertext.Should().NotContain(secret, "the plaintext secret must not be recoverable from the ciphertext string");
    }

    [Fact]
    public void Unprotect_RoundTrips_ProtectedSecret()
    {
        var protector = CreateProtector();
        const string secret = "minioadmin123";

        var roundTripped = protector.Unprotect(protector.Protect(secret));

        roundTripped.Should().Be(secret);
    }

    [Fact]
    public void Unprotect_LegacyPlaintext_ReadsThroughTransparently()
    {
        var protector = CreateProtector();
        const string legacyPlaintext = "minioadmin123";

        // A pre-encryption (legacy) secret has no discriminator prefix and must read through unchanged.
        protector.Unprotect(legacyPlaintext).Should().Be(legacyPlaintext);
    }

    [Fact]
    public void DecryptSecretInPlace_ThenFromBsonDocument_DeliversRealKeysToConnectorPath()
    {
        // End-to-end of the establish-path read: an encrypted SecretKey in TypeSpecificConfig is
        // decrypted in place, then FromBsonDocument yields the real keys the S3 connector needs.
        var protector = CreateProtector();
        var config = new BsonDocument
        {
            ["AccessKey"] = "minioadmin",
            ["SecretKey"] = protector.Protect("minioadmin123"),
            ["Bucket"] = "ez-data"
        };

        ServerCredentialProtector.DecryptSecretInPlace(config, protector);
        var credentials = ServerCredentials.FromBsonDocument(config);

        credentials.AccessKey.Should().Be("minioadmin");
        credentials.SecretKey.Should().Be("minioadmin123");
        credentials.HasS3Auth.Should().BeTrue();
    }
}
