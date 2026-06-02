using DataProcessing.Shared.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using Xunit;

namespace DataProcessing.Shared.Tests.Services;

/// <summary>
/// Unit tests for <see cref="ServerCredentialProtector"/> — AES field encryption of the
/// S3 SecretKey stored in AdminServer.TypeSpecificConfig (Phase 34, Task 1).
/// </summary>
public class ServerCredentialProtectorTests
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

    [Fact]
    public void Protect_ReturnsCiphertext_NotEqualToPlaintext_WithDiscriminatorPrefix()
    {
        var protector = CreateProtector();
        const string plaintext = "minioadmin123";

        var protectedValue = protector.Protect(plaintext);

        protectedValue.Should().NotBeNullOrEmpty();
        protectedValue.Should().NotBe(plaintext);
        protectedValue.Should().StartWith("enc:v1:");
    }

    [Theory]
    [InlineData("")]
    [InlineData("minioadmin123")]
    [InlineData("AKIAIOSFODNN7EXAMPLEwJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY12")]
    [InlineData("שלום-secret-unicode-値")]
    public void Unprotect_RoundTrips_Protect(string secret)
    {
        var protector = CreateProtector();

        var roundTripped = protector.Unprotect(protector.Protect(secret));

        roundTripped.Should().Be(secret);
    }

    [Fact]
    public void Unprotect_LegacyPlaintext_WithoutPrefix_ReturnsInputUnchanged()
    {
        var protector = CreateProtector();
        const string legacyPlaintext = "minioadmin123";

        var result = protector.Unprotect(legacyPlaintext);

        result.Should().Be(legacyPlaintext);
    }

    [Fact]
    public void IsProtected_ReturnsTrue_ForProtectedValue()
    {
        var protector = CreateProtector();

        var protectedValue = protector.Protect("minioadmin123");

        protector.IsProtected(protectedValue).Should().BeTrue();
    }

    [Fact]
    public void IsProtected_ReturnsFalse_ForLegacyPlaintext()
    {
        var protector = CreateProtector();

        protector.IsProtected("minioadmin123").Should().BeFalse();
    }

    [Fact]
    public void DevFallbackKey_IsUsed_WhenConfigKeyAbsent()
    {
        // No configured key → documented dev fallback (non-production) must still round-trip.
        var protector = CreateProtector(key: null);

        var roundTripped = protector.Unprotect(protector.Protect("minioadmin123"));

        roundTripped.Should().Be("minioadmin123");
    }

    [Fact]
    public void DecryptSecretInPlace_ReplacesProtectedSecretKey_BeforeFromBsonDocument()
    {
        var protector = CreateProtector();
        const string accessKey = "minioadmin";
        const string secretKey = "minioadmin123";

        var doc = new BsonDocument
        {
            ["AccessKey"] = accessKey,
            ["SecretKey"] = protector.Protect(secretKey),
            ["Bucket"] = "ez-data"
        };

        ServerCredentialProtector.DecryptSecretInPlace(doc, protector);

        doc["SecretKey"].AsString.Should().Be(secretKey);

        var credentials = ServerCredentials.FromBsonDocument(doc);
        credentials.AccessKey.Should().Be(accessKey);
        credentials.SecretKey.Should().Be(secretKey);
    }

    [Fact]
    public void DecryptSecretInPlace_LeavesLegacyPlaintextSecret_Untouched()
    {
        var protector = CreateProtector();
        var doc = new BsonDocument
        {
            ["AccessKey"] = "minioadmin",
            ["SecretKey"] = "minioadmin123"
        };

        ServerCredentialProtector.DecryptSecretInPlace(doc, protector);

        doc["SecretKey"].AsString.Should().Be("minioadmin123");
    }
}
