---
last-verified: 2026-02-02
status: current
---

# Protocol Test Coverage Guide

This guide documents how to run and extend the EZ Platform protocol connector tests.

## Overview

EZ Platform supports 8 file/message protocols through dedicated connectors:

| Protocol | Connector | Test Class | OCP Compatible | Dependencies |
|----------|-----------|------------|----------------|--------------|
| FTP | FtpConnector | FtpConnectorTests | Yes | FileSimulator |
| SFTP | SftpConnector | SftpConnectorTests | Yes | FileSimulator |
| HTTP/WebDAV | HttpApiConnector | HttpApiConnectorTests | Yes | FileSimulator |
| S3/MinIO | S3Connector | S3ConnectorTests | Yes | FileSimulator |
| SMB | SmbConnector | SmbConnectorTests | Yes (with tunnel) | FileSimulator, Tunnel |
| NFS | NfsConnector | NfsConnectorTests | Yes (via PVC) | K8sPod, PVC |
| Kafka | KafkaConnector | KafkaConnectorTests | Yes | Kafka Broker |
| Local | LocalFileConnector | LocalFileConnectorTests | No | None (local dev only) |

### Test Location

All connector tests are in: `tests/IntegrationTests/Connectors/`

```
tests/IntegrationTests/Connectors/
  FtpConnectorTests.cs
  SftpConnectorTests.cs
  HttpApiConnectorTests.cs
  S3ConnectorTests.cs
  SmbConnectorTests.cs
  NfsConnectorTests.cs
  KafkaConnectorTests.cs
  LocalFileConnectorTests.cs
```

## Prerequisites

### File-Simulator Setup

Most protocol tests run against file-simulator. See: [file-simulator-setup.md](./file-simulator-setup.md)

1. Ensure file-simulator cluster is running:
   ```powershell
   minikube status -p file-simulator
   ```

2. Get file-simulator IP:
   ```powershell
   $env:FILE_SIMULATOR_IP = (minikube ip -p file-simulator)
   echo $env:FILE_SIMULATOR_IP
   ```

3. Verify connectivity:
   ```powershell
   .\scripts\verify-file-simulator.ps1 -TestOnly
   ```

### Kafka Setup

Kafka tests require port-forward to ez-platform Kafka:
```powershell
kubectl port-forward svc/kafka 9094:9094 -n ez-platform
```

### Local Connector

Local connector tests require no external dependencies - they use the system temp directory. However, these tests are marked OCP-Incompatible because:
- OCP pods run with `readOnlyRootFilesystem: true`
- Local paths don't exist in container context
- Use NFS connector for production file access

## Running Protocol Tests

### Run All Protocol Tests

```powershell
dotnet test tests/IntegrationTests --filter "Category=Protocol"
```

### Run Specific Protocol

```powershell
# FTP only
dotnet test tests/IntegrationTests --filter "Protocol=FTP"

# SFTP only
dotnet test tests/IntegrationTests --filter "Protocol=SFTP"

# HTTP only
dotnet test tests/IntegrationTests --filter "Protocol=HTTP"

# S3/MinIO only
dotnet test tests/IntegrationTests --filter "Protocol=S3"

# SMB only
dotnet test tests/IntegrationTests --filter "Protocol=SMB"

# NFS only
dotnet test tests/IntegrationTests --filter "Protocol=NFS"

# Kafka only
dotnet test tests/IntegrationTests --filter "Protocol=Kafka"

# Local only (reference tests)
dotnet test tests/IntegrationTests --filter "Protocol=Local"
```

### Run Multiple Protocols

```powershell
# File-based protocols
dotnet test tests/IntegrationTests --filter "Protocol=FTP|Protocol=SFTP|Protocol=HTTP|Protocol=S3"

# All file-simulator dependent tests
dotnet test tests/IntegrationTests --filter "Dependency=FileSimulator"

# All OCP-compatible protocol tests
dotnet test tests/IntegrationTests --filter "Category=Protocol&OCP=Compatible"
```

### Run with Verbose Output

```powershell
dotnet test tests/IntegrationTests --filter "Category=Protocol" --logger "console;verbosity=detailed"
```

### List Available Tests Without Running

```powershell
dotnet test tests/IntegrationTests --filter "Category=Protocol" --list-tests
```

## Protocol-Specific Notes

### FTP (Port 30021)

- NodePort service on file-simulator
- No special setup beyond FILE_SIMULATOR_IP
- Credentials: `ftpuser` / `ftppass123`
- Tests: Connection, WriteRead, ListFiles

```powershell
# Test FTP connectivity
Test-NetConnection -ComputerName $env:FILE_SIMULATOR_IP -Port 30021
```

### SFTP (Port 30022)

- NodePort service on file-simulator
- SSH-based secure file transfer
- Credentials: `sftpuser` / `sftppass123`
- Tests: Connection, WriteRead, ListFiles

```powershell
# Test SFTP connectivity
Test-NetConnection -ComputerName $env:FILE_SIMULATOR_IP -Port 30022
```

### HTTP/WebDAV (Port 30088/30089)

- NodePort service on file-simulator
- HTTP: Port 30088
- WebDAV: Port 30089
- Credentials: `httpuser` / `httppass123`
- Tests: Connection, WriteRead, ListFiles

```powershell
# Test HTTP connectivity
Invoke-WebRequest -Uri "http://${env:FILE_SIMULATOR_IP}:30088/" -TimeoutSec 5
```

### S3/MinIO (Port 30900)

- Uses MinIO S3-compatible endpoint
- Port 30900 on file-simulator
- Default bucket: `input`, `output`, `archive`
- Credentials: `minioadmin` / `minioadmin123`
- Tests: Connection, WriteRead, ListFiles

```powershell
# Test MinIO health
Invoke-WebRequest -Uri "http://${env:FILE_SIMULATOR_IP}:30900/minio/health/live" -TimeoutSec 5
```

### SMB (Requires Tunnel)

**Important:** SMB protocol requires port 445 (not remappable via NodePort).

- Must run `minikube tunnel -p file-simulator`
- Tests skip with message if tunnel not active
- Share name: `files`
- Credentials: `smbuser` / `smbpass123`
- Tests: Connection, WriteRead, ListFiles

```powershell
# Start tunnel in separate terminal (keep running)
minikube tunnel -p file-simulator

# Test SMB connectivity (requires tunnel)
Test-NetConnection -ComputerName $env:FILE_SIMULATOR_IP -Port 445
```

### NFS (Requires K8s Pod Context)

**Important:** NFS connector accesses mounted PVC paths that only exist inside K8s pods.

- NfsConnector reads from Kubernetes PersistentVolumeClaims
- Mounts only exist inside K8s pods, not on host
- Set `NFS_MOUNT_PATH=/mnt/nas-input-1` to enable tests locally
- For full testing, run tests inside K8s pod

**Local Development Workaround:**
```powershell
# If you have local directories simulating NAS mounts:
$env:NFS_MOUNT_PATH = "C:\simulator-data\nas-input-1"
dotnet test tests/IntegrationTests --filter "Protocol=NFS"
```

**Full Testing (K8s Pod):**
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: protocol-test-pod
  namespace: ez-platform
spec:
  containers:
  - name: tests
    image: mcr.microsoft.com/dotnet/sdk:10.0
    env:
    - name: NFS_MOUNT_PATH
      value: /mnt/nas-input-1
    volumeMounts:
    - name: nas-input
      mountPath: /mnt/nas-input-1
  volumes:
  - name: nas-input
    persistentVolumeClaim:
      claimName: nas-input-1-pvc
```

### Kafka

- Requires port-forward to Kafka broker
- Tests use unique consumer groups to avoid conflicts
- Topic names include test run ID for isolation

```powershell
# Port-forward Kafka (external listener)
kubectl port-forward svc/kafka 9094:9094 -n ez-platform

# Verify connectivity
Test-NetConnection -ComputerName localhost -Port 9094
```

### Local (OCP-Incompatible)

**Important:** These are reference tests only, not for OCP deployment.

- Uses local temp directory
- Will not work in OCP (readOnlyRootFilesystem)
- Use NFS connector for production file access
- No external dependencies required
- Tests: ConnectorType, TestConnection, WriteRead, ListFiles

```powershell
# Local tests always run (no external deps)
dotnet test tests/IntegrationTests --filter "Protocol=Local"
```

## Test Traits Reference

| Trait | Values | Purpose |
|-------|--------|---------|
| Category | Protocol | All protocol connector tests |
| Protocol | FTP, SFTP, HTTP, S3, SMB, NFS, Kafka, Local | Specific protocol type |
| OCP | Compatible, Incompatible | OCP deployment compatibility |
| Dependency | FileSimulator, Tunnel, K8sPod, KafkaBroker | External requirements |

### Trait Combinations

```powershell
# All protocol tests
--filter "Category=Protocol"

# Specific protocol
--filter "Protocol=FTP"

# OCP-compatible only
--filter "OCP=Compatible"

# FileSimulator-dependent
--filter "Dependency=FileSimulator"

# Multiple conditions (AND)
--filter "Category=Protocol&OCP=Compatible"

# Multiple protocols (OR)
--filter "Protocol=FTP|Protocol=SFTP"
```

## Adding New Protocol Tests

When adding support for a new protocol connector:

1. **Create test class** in `tests/IntegrationTests/Connectors/`
   ```csharp
   [Collection("Integration")]
   [Trait("Category", "Protocol")]
   [Trait("Protocol", "NewProtocol")]
   [Trait("Dependency", "...")]  // FileSimulator, Tunnel, K8sPod, etc.
   [Trait("OCP", "Compatible")]  // or "Incompatible"
   public class NewProtocolConnectorTests : IClassFixture<FileSimulatorFixture>
   ```

2. **Add required fixtures** to constructor injection

3. **Implement skip logic** for unavailable dependencies:
   ```csharp
   private void SkipIfDependencyUnavailable()
   {
       Skip.If(!_fixture.IsAvailable, "File-simulator not available");
   }
   ```

4. **Implement standard test methods:**
   - `ConnectorType_ReturnsExpectedType`
   - `TestConnection_ReturnsSuccess`
   - `TestConnection_Fails_WhenServerUnavailable`
   - `WriteAndReadFile_RoundTripsSuccessfully`
   - `ListFiles_ReturnsMatchingFiles`

5. **Update this guide** with new protocol details

### Test Naming Convention

```
[Protocol]: [Operation] [ExpectedBehavior]

Examples:
  FTP: Test connection returns success
  FTP: Write and read file round-trips successfully
  FTP: List files returns matching files
```

## Troubleshooting

### Tests Skip with "File-simulator not available"

1. Check file-simulator status:
   ```powershell
   minikube status -p file-simulator
   ```

2. Start file-simulator if not running:
   ```powershell
   minikube start -p file-simulator --driver=hyperv
   ```

3. Verify IP:
   ```powershell
   minikube ip -p file-simulator
   ```

4. Set environment:
   ```powershell
   $env:FILE_SIMULATOR_IP = (minikube ip -p file-simulator)
   ```

5. Test connectivity:
   ```powershell
   Test-NetConnection -ComputerName $env:FILE_SIMULATOR_IP -Port 30021
   ```

### SMB Tests Skip with "requires minikube tunnel"

1. Run tunnel in separate terminal (keep it running):
   ```powershell
   minikube tunnel -p file-simulator
   ```

2. Verify port 445 is forwarded:
   ```powershell
   Test-NetConnection -ComputerName $env:FILE_SIMULATOR_IP -Port 445
   ```

3. Keep tunnel running during test execution

### NFS Tests Skip with "NFS mount not available"

1. Tests require K8s pod context with mounted PVC

2. For local dev workaround:
   ```powershell
   $env:NFS_MOUNT_PATH = "C:\simulator-data\nas-input-1"
   ```

3. For full testing, deploy test pod with PVC mounts (see NFS section above)

### Kafka Tests Fail with "broker not available"

1. Verify port-forward:
   ```powershell
   kubectl port-forward svc/kafka 9094:9094 -n ez-platform
   ```

2. Check broker health:
   ```powershell
   kubectl logs deploy/kafka -n ez-platform --tail=20
   ```

3. Test connectivity:
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 9094
   ```

### Tests Timeout or Hang

1. Check network connectivity to file-simulator
2. Verify file-simulator pods are healthy:
   ```powershell
   kubectl --context=file-simulator get pods -n file-simulator
   ```
3. Check for resource exhaustion on Minikube:
   ```powershell
   minikube status -p file-simulator
   ```

### Authentication Failures

1. Verify credentials match file-simulator defaults (see protocol sections above)
2. Check file-simulator service logs for auth errors:
   ```powershell
   kubectl --context=file-simulator logs -l app.kubernetes.io/name=file-simulator -n file-simulator
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
jobs:
  protocol-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Setup .NET
      uses: actions/setup-dotnet@v4
      with:
        dotnet-version: '10.0.x'

    # Run OCP-compatible tests only in CI
    - name: Run Protocol Tests
      run: |
        dotnet test tests/IntegrationTests \
          --filter "Category=Protocol&OCP=Compatible" \
          --logger "trx;LogFileName=protocol-tests.trx"
```

### Test Categories for CI

| Environment | Filter | Description |
|-------------|--------|-------------|
| Local Dev | `Category=Protocol` | All protocol tests |
| CI (no file-simulator) | `Protocol=Local&Protocol=Kafka` | Tests without file-simulator |
| CI (with file-simulator) | `Category=Protocol&OCP=Compatible` | OCP-compatible only |
| Pre-OCP Deployment | `OCP=Compatible` | Verify OCP readiness |

## Related Documentation

- **File-Simulator Setup:** [file-simulator-setup.md](./file-simulator-setup.md)
- **NAS Device Management:** `docs/architecture/nas-nfs-architecture.md`
- **Connector Implementations:** `src/Services/Shared/Connectors/`
- **Test Fixtures:** `tests/IntegrationTests/Fixtures/`

---

*Last Updated: 2026-02-02*
*Phase: 03-protocol-test-coverage*
