using System.Collections.Generic;
using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Services;
using DataProcessing.Shared.Services;
using FluentAssertions;
using Xunit;

namespace DataProcessing.DataSourceManagement.Tests.Controllers;

/// <summary>
/// Phase 34, Task 2 — proves the S3 AdminServer credential keys round-trip through
/// TypeSpecificConfig using the exact PascalCase contract that
/// <see cref="ServerCredentials.FromBsonDocument"/> expects (Pitfall 2: no camelCase drift).
/// </summary>
public class TypeSpecificConfigKeyContractTests
{
    private static Dictionary<string, object> SampleS3Config() => new()
    {
        ["AccessKey"] = "minioadmin",
        ["SecretKey"] = "minioadmin123",
        ["Bucket"] = "ez-data",
        ["Region"] = "us-east-1",
        ["ForcePathStyle"] = true,
        ["UseHttp"] = true,
    };

    [Fact]
    public void ConvertToBsonDocument_PreservesExactPascalCaseKeys()
    {
        var dict = SampleS3Config();

        var doc = ServerConfigConverter.ConvertToBsonDocument(dict);

        doc.Should().NotBeNull();
        doc!.Names.Should().BeEquivalentTo(new[]
        {
            "AccessKey", "SecretKey", "Bucket", "Region", "ForcePathStyle", "UseHttp"
        });
    }

    [Fact]
    public void FromBsonDocument_ReadsAccessKeyAndSecretKey_FromConvertedConfig()
    {
        var dict = SampleS3Config();

        var doc = ServerConfigConverter.ConvertToBsonDocument(dict);
        var credentials = ServerCredentials.FromBsonDocument(doc!);

        credentials.AccessKey.Should().Be("minioadmin");
        credentials.SecretKey.Should().Be("minioadmin123");
        credentials.HasS3Auth.Should().BeTrue();
    }

    [Fact]
    public void ConvertToBsonDocument_PreservesBooleanTypes_ForPathStyleFlags()
    {
        var dict = SampleS3Config();

        var doc = ServerConfigConverter.ConvertToBsonDocument(dict);

        doc!["ForcePathStyle"].AsBoolean.Should().BeTrue();
        doc["UseHttp"].AsBoolean.Should().BeTrue();
    }

    [Fact]
    public void ConvertToBsonDocument_ReturnsNull_ForNullInput()
    {
        ServerConfigConverter.ConvertToBsonDocument(null).Should().BeNull();
    }
}
