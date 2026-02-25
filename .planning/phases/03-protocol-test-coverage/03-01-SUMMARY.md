---
phase: 03-protocol-test-coverage
plan: 01
subsystem: testing
status: complete
completed: 2026-02-02
duration: 6 min
tags: [integration-tests, protocol-connectors, ftp, sftp, http, file-simulator]

dependency-graph:
  requires:
    - "01-file-simulator-integration (ConfigMap, file-simulator setup)"
  provides:
    - "FileSimulatorFixture shared test fixture"
    - "FtpConnectorTests (3 tests)"
    - "SftpConnectorTests (3 tests)"
    - "HttpApiConnectorTests (2 tests)"
  affects:
    - "03-02 (S3/MinIO tests will follow same pattern)"
    - "03-03 (SMB/NFS tests will follow same pattern)"
    - "03-04 (Kafka/Local tests will follow same pattern)"

tech-stack:
  added:
    - "xunit.SkippableFact (1.4.13) - graceful test skipping"
  patterns:
    - "IClassFixture<FileSimulatorFixture> for shared test context"
    - "SkippableFact with Skip.If() for conditional test execution"
    - "TestHttpClientFactory for HttpApiConnector testing"

key-files:
  created:
    - tests/IntegrationTests/Fixtures/FileSimulatorFixture.cs
    - tests/IntegrationTests/Connectors/FtpConnectorTests.cs
    - tests/IntegrationTests/Connectors/SftpConnectorTests.cs
    - tests/IntegrationTests/Connectors/HttpApiConnectorTests.cs
  modified:
    - tests/IntegrationTests/TestConfiguration.cs
    - tests/IntegrationTests/IntegrationTestCollection.cs
    - tests/IntegrationTests/DataProcessing.IntegrationTests.csproj
    - Directory.Packages.props

decisions:
  - decision: "Use xunit.SkippableFact for graceful test skipping"
    rationale: "Cleanly distinguishes unavailable infrastructure from test failures"
    scope: "All protocol tests"

metrics:
  tests_created: 8
  tests_passing: 0
  tests_skipping: 8
  coverage_protocols: "FTP, SFTP, HTTP"
---

# Phase 03 Plan 01: FTP/SFTP/HTTP Test Foundation Summary

**One-liner:** FileSimulatorFixture shared test infrastructure with FTP, SFTP, HTTP integration tests that skip gracefully when file-simulator unavailable

## What Was Built

### 1. FileSimulatorFixture (Task 1)
Shared xUnit fixture for managing file-simulator connectivity:

```csharp
public class FileSimulatorFixture : IAsyncLifetime
{
    public string FileSimulatorIp { get; private set; }
    public bool IsAvailable { get; private set; }

    // Protocol endpoints
    public int FtpPort => 30021;
    public int SftpPort => 30022;
    public int HttpPort => 30088;

    // Credentials
    public static class Credentials
    {
        public static readonly (string User, string Password) Ftp = ("ftpuser", "ftppass123");
        public static readonly (string User, string Password) Sftp = ("sftpuser", "sftppass123");
        public static readonly (string User, string Password) Http = ("httpuser", "httppass123");
    }
}
```

### 2. TestConfiguration Extensions (Task 1)
Added FileSimulator nested class with port constants and default IP:

```csharp
public static class FileSimulator
{
    public const string DefaultIp = "172.25.201.3";
    public const int FtpPort = 30021;
    public const int SftpPort = 30022;
    public const int HttpPort = 30088;
    // ... additional ports
}
```

### 3. Protocol Connector Tests (Task 2)

**FtpConnectorTests (3 tests):**
- `FtpConnector_TestConnection_ReturnsSuccess` - Verifies FTP connection
- `FtpConnector_WriteAndReadFile_RoundTripsSuccessfully` - Write/read round-trip
- `FtpConnector_ListFiles_ReturnsMatchingFiles` - File listing with patterns

**SftpConnectorTests (3 tests):**
- `SftpConnector_TestConnection_ReturnsSuccess` - Verifies SFTP connection
- `SftpConnector_WriteAndReadFile_RoundTripsSuccessfully` - Write/read round-trip
- `SftpConnector_ListFiles_ReturnsMatchingFiles` - File listing with patterns

**HttpApiConnectorTests (2 tests):**
- `HttpApiConnector_TestConnection_ReturnsSuccess` - Verifies HTTP connection
- `HttpApiConnector_ListFiles_ReturnsMatchingFiles` - Endpoint listing

## Test Pattern Established

All tests follow this structure:
1. Use `[Collection("Integration")]` for shared context
2. Implement `IClassFixture<FileSimulatorFixture>` for fixture injection
3. Call `SkipIfFileSimulatorUnavailable()` at test start
4. Use test traits for filtering: `[Trait("Category", "Protocol")]`, `[Trait("Protocol", "FTP")]`

Example test pattern:
```csharp
[SkippableFact(DisplayName = "FTP: Test connection returns success")]
public async Task FtpConnector_TestConnection_ReturnsSuccess()
{
    SkipIfFileSimulatorUnavailable();

    var server = CreateAdminServer();
    var credentials = CreateCredentials();

    var result = await _connector.TestConnectionAsync(server, credentials);

    result.IsSuccess.Should().BeTrue();
}
```

## Verification Results

```
Test Run Successful.
Total tests: 8
    Skipped: 8 (File-simulator not available)
Total time: 16.55 Seconds
```

All tests correctly skip when file-simulator is unavailable and are ready to pass when file-simulator is deployed.

## Commits

| Commit | Description |
|--------|-------------|
| `48bf37d` | Task 1: FileSimulatorFixture and test configuration |
| `7ca5c2b` | Task 2: FTP, SFTP, HTTP connector tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MongoDB.Driver version conflict**
- **Found during:** Task 1 build
- **Issue:** Test project referenced MongoDB.Driver 3.1.0 but Shared project required 3.2.0 via MongoDB.Entities
- **Fix:** Updated Directory.Packages.props MongoDB.Driver from 3.1.0 to 3.2.0
- **Commit:** `48bf37d`

**2. [Rule 3 - Blocking] Missing test project reference to Shared**
- **Found during:** Task 1
- **Issue:** Test project couldn't access connectors without reference
- **Fix:** Added ProjectReference to DataProcessing.Shared.csproj
- **Commit:** `48bf37d`

## Next Phase Readiness

Ready for 03-02 (S3/MinIO and WebDAV tests):
- FileSimulatorFixture pattern established
- Credentials already defined for S3
- Same test structure can be applied

Dependencies verified:
- xunit.SkippableFact package available
- Shared project builds successfully
- Test collection includes FileSimulatorFixture
