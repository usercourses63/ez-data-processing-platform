# File-Simulator Integration Guide

## Overview

File-simulator provides realistic protocol servers (FTP, SFTP, S3, SMB, NFS, HTTP) for testing EZ Platform's file I/O operations. It runs in a separate Minikube profile and communicates with EZ Platform via NodePort services.

**Important:** This guide covers infrastructure setup and connectivity verification only. Protocol integration tests (verifying connectors work correctly) are in Phase 3.

### Why File-Simulator?

- **Protocol fidelity:** Real FTP/SFTP/S3/NFS servers instead of mocks
- **Network testing:** Validates actual network I/O patterns
- **Multi-NAS topology:** Mirrors production OCP environments with 7 NAS servers
- **Isolation:** Separate Minikube profile prevents interference with EZ Platform

## Prerequisites

Before setting up file-simulator integration, ensure you have:

- **Minikube with Hyper-V driver** (for file-simulator cluster)
- **Minikube with Docker driver** (for EZ Platform cluster)
- **Helm 3.x** (for file-simulator deployment)
- **PowerShell 7.x** (for verification scripts)
- **file-simulator-suite repo:** `C:\Users\UserC\source\repos\file-simulator-suite`
- **Windows shared storage:** `C:\simulator-data` directory

### Verify Prerequisites

```powershell
# Check Minikube
minikube version

# Check Helm
helm version

# Check PowerShell
$PSVersionTable.PSVersion

# Check file-simulator repo exists
Test-Path "C:\Users\UserC\source\repos\file-simulator-suite"

# Create shared storage directory if needed
New-Item -ItemType Directory -Force -Path "C:\simulator-data"
```

## Quick Start

Get file-simulator running in 5 minutes:

### 1. Start file-simulator cluster

```powershell
minikube start --profile file-simulator --driver=hyperv --memory=8192 --cpus=4 `
  --mount --mount-string="C:\simulator-data:/mnt/simulator-data"
```

### 2. Deploy file-simulator

```powershell
cd C:\Users\UserC\source\repos\file-simulator-suite
helm upgrade --install file-sim .\helm-chart\file-simulator `
  --kube-context=file-simulator `
  --namespace file-simulator `
  --create-namespace
```

### 3. Apply NFS fix (required)

```powershell
kubectl --context=file-simulator patch deployment file-sim-file-simulator-nas `
  -n file-simulator --patch-file nfs-fix-patch.yaml
```

### 4. Wait for pods to be ready

```powershell
kubectl --context=file-simulator wait --for=condition=ready pod `
  -l app.kubernetes.io/name=file-simulator `
  -n file-simulator --timeout=300s
```

### 5. Verify connectivity from EZ Platform

```powershell
cd C:\Users\UserC\source\repos\EZ
.\scripts\verify-file-simulator.ps1 -Apply
```

## ConfigMap Configuration

The file-simulator-config ConfigMap contains all protocol endpoints. Located at: `k8s/configmaps/file-simulator-config.yaml`

### Key Environment Variables

| Variable | Purpose | Example Value |
|----------|---------|---------------|
| `FileAccess__Ftp__Host` | FTP server hostname | `172.25.201.3` |
| `FileAccess__Ftp__Port` | FTP server port | `30021` |
| `FileAccess__Sftp__Host` | SFTP server hostname | `172.25.201.3` |
| `FileAccess__Sftp__Port` | SFTP server port | `30022` |
| `FileAccess__S3__Endpoint` | S3-compatible endpoint URL | `http://172.25.201.3:30900` |
| `FileAccess__Http__BaseUrl` | HTTP server URL | `http://172.25.201.3:30088` |
| `FileSimulator__Enabled` | Feature flag for file-simulator mode | `true` |

### ConfigMap Template

The ConfigMap uses `{{FILE_SIMULATOR_IP}}` placeholder for version control compatibility:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: file-simulator-config
  namespace: ez-platform
data:
  FileAccess__Ftp__Host: "{{FILE_SIMULATOR_IP}}"
  FileAccess__Ftp__Port: "30021"
  # ... other settings
```

The verification script (`verify-file-simulator.ps1`) resolves placeholders at runtime and applies the ConfigMap with the current file-simulator IP.

### Service Deployments

EZ Platform services reference file-simulator-config via `envFrom`:

```yaml
spec:
  template:
    spec:
      containers:
      - name: service-name
        envFrom:
        - configMapRef:
            name: services-config
        - configMapRef:
            name: file-simulator-config
            optional: true  # Allows deployment without file-simulator
```

The `optional: true` flag ensures EZ Platform can run in environments without file-simulator (e.g., production OCP).

## Verification

Run the verification script to test all endpoints:

### Test-Only Mode

```powershell
.\scripts\verify-file-simulator.ps1 -TestOnly
```

Tests connectivity without applying ConfigMap changes.

### Apply Mode

```powershell
.\scripts\verify-file-simulator.ps1 -Apply
```

Tests connectivity AND applies ConfigMap to ez-platform namespace.

### Expected Output

```
File-Simulator Connectivity Verification
========================================
File-Simulator IP: 172.25.201.3

Testing endpoints...

  FTP        : OK - FTP Server
  SFTP       : OK - SFTP Server
  S3/MinIO   : OK - S3-compatible API
  HTTP       : OK - HTTP Server
  WebDAV     : OK - WebDAV Server
  S3 Health  : OK - MinIO responding

Results: 6/6 tests passed

ConfigMap applied to ez-platform namespace.
```

### Manual Verification

If you prefer to verify manually:

```powershell
# Get file-simulator IP
$SIMULATOR_IP = minikube ip -p file-simulator

# Test FTP (port 30021)
Test-NetConnection -ComputerName $SIMULATOR_IP -Port 30021

# Test SFTP (port 30022)
Test-NetConnection -ComputerName $SIMULATOR_IP -Port 30022

# Test S3/MinIO (port 30900)
Invoke-WebRequest -Uri "http://${SIMULATOR_IP}:30900/minio/health/live" -TimeoutSec 5

# Test HTTP (port 30088)
Invoke-WebRequest -Uri "http://${SIMULATOR_IP}:30088/" -TimeoutSec 5
```

## Protocol Reference

### Standard Protocol Endpoints

| Protocol | NodePort | Username | Password | Notes |
|----------|----------|----------|----------|-------|
| FTP | 30021 | ftpuser | ftppass123 | Passive mode supported |
| SFTP | 30022 | sftpuser | sftppass123 | SSH key auth also available |
| S3/MinIO | 30900 | minioadmin | minioadmin123 | S3-compatible API |
| HTTP | 30088 | httpuser | httppass123 | Basic auth |
| WebDAV | 30089 | httpuser | httppass123 | DAV extensions |

### NFS Servers (Multi-NAS Topology)

| Server | NodePort | Windows Path | NFS Mount | Purpose |
|--------|----------|--------------|-----------|---------|
| NAS Input 1 | 32150 | `C:\simulator-data\nas-input-1` | `/mnt/simulator-data/nas-input-1` | Input server 1 |
| NAS Input 2 | 32151 | `C:\simulator-data\nas-input-2` | `/mnt/simulator-data/nas-input-2` | Input server 2 |
| NAS Input 3 | 32152 | `C:\simulator-data\nas-input-3` | `/mnt/simulator-data/nas-input-3` | Input server 3 |
| NAS Backup | 32153 | `C:\simulator-data\nas-backup` | `/mnt/simulator-data/nas-backup` | Backup server |
| NAS Output 1 | 32154 | `C:\simulator-data\nas-output-1` | `/mnt/simulator-data/nas-output-1` | Output server 1 |
| NAS Output 2 | 32155 | `C:\simulator-data\nas-output-2` | `/mnt/simulator-data/nas-output-2` | Output server 2 |
| NAS Output 3 | 32156 | `C:\simulator-data\nas-output-3` | `/mnt/simulator-data/nas-output-3` | Output server 3 |

### S3 Buckets

Default buckets available in MinIO:

| Bucket | Purpose |
|--------|---------|
| `input` | Input files for processing |
| `output` | Processed output files |
| `archive` | Archived/backup files |

## Troubleshooting

### Issue: Connection refused

**Cause:** file-simulator cluster not running or pods not ready

**Solution:**

1. Check cluster status:
   ```powershell
   minikube status -p file-simulator
   ```

2. Check pods:
   ```powershell
   kubectl --context=file-simulator get pods -n file-simulator
   ```

3. Wait for pods to be ready:
   ```powershell
   kubectl --context=file-simulator wait --for=condition=ready pod `
     -l app.kubernetes.io/name=file-simulator `
     -n file-simulator --timeout=300s
   ```

4. Check pod logs for errors:
   ```powershell
   kubectl --context=file-simulator logs -l app.kubernetes.io/name=file-simulator `
     -n file-simulator --tail=100
   ```

### Issue: IP address changed

**Cause:** Minikube assigns dynamic IPs; file-simulator IP changed after restart

**Solution:**

1. Re-run verification script:
   ```powershell
   .\scripts\verify-file-simulator.ps1 -Apply
   ```

2. Restart EZ Platform services to pick up new config:
   ```powershell
   kubectl --context=minikube rollout restart deployment -n ez-platform
   ```

### Issue: SMB not working

**Cause:** SMB requires standard port 445, not NodePort

**Solution:**

1. Run tunnel in separate terminal:
   ```powershell
   minikube tunnel -p file-simulator
   ```

2. Use LoadBalancer IP for SMB connections (not NodePort)

3. Note: SMB connector may not be available in EZ Platform; see 01-RESEARCH.md for details

### Issue: NFS files not visible

**Cause:** Init container only syncs at pod start

**Solution:**

1. Place test files in Windows shared storage:
   ```powershell
   "test,data,row" | Out-File -FilePath C:\simulator-data\nas-input-1\test.csv -Encoding UTF8
   ```

2. Restart the relevant NAS pod:
   ```powershell
   kubectl --context=file-simulator delete pod -n file-simulator `
     -l nas-server=nas-input-1
   ```

3. Wait 30 seconds for sync to complete

### Issue: ConfigMap not applied

**Cause:** Missing ez-platform namespace or kubectl context issues

**Solution:**

1. Verify namespace exists:
   ```powershell
   kubectl --context=minikube get namespace ez-platform
   ```

2. Manually apply ConfigMap:
   ```powershell
   # Get current IP
   $IP = minikube ip -p file-simulator

   # Create temp file with resolved IP
   (Get-Content k8s/configmaps/file-simulator-config.yaml) `
     -replace '\{\{FILE_SIMULATOR_IP\}\}', $IP | `
     Out-File -FilePath $env:TEMP\file-simulator-config-resolved.yaml -Encoding UTF8

   # Apply
   kubectl --context=minikube apply -f $env:TEMP\file-simulator-config-resolved.yaml `
     -n ez-platform
   ```

### Issue: Tests failing with timeout

**Cause:** Services not restarted after ConfigMap update

**Solution:**

1. Restart affected deployments:
   ```powershell
   kubectl --context=minikube rollout restart deployment/filediscovery -n ez-platform
   kubectl --context=minikube rollout restart deployment/fileprocessor -n ez-platform
   kubectl --context=minikube rollout restart deployment/validation -n ez-platform
   kubectl --context=minikube rollout restart deployment/output -n ez-platform
   ```

2. Wait for rollout:
   ```powershell
   kubectl --context=minikube rollout status deployment -n ez-platform --timeout=120s
   ```

## Architecture Reference

### Cross-Cluster Communication

```
Windows Host
|
+-- minikube (Docker driver) - EZ Platform
|   |
|   +-- ez-platform namespace
|       +-- FileDiscoveryService
|       +-- FileProcessorService
|       +-- ValidationService
|       +-- OutputService
|           |
|           +-- Connects via: file-simulator-IP:NodePort
|
+-- file-simulator (Hyper-V driver) - Protocol Servers
    |
    +-- file-simulator namespace
        +-- FTP Server (30021)
        +-- SFTP Server (30022)
        +-- S3/MinIO (30900)
        +-- HTTP/WebDAV (30088/30089)
        +-- NFS Servers (32150-32156)
        +-- SMB (445 via tunnel)
```

### Service Integration Pattern

EZ Platform connectors read endpoints from environment variables populated by the file-simulator-config ConfigMap:

```csharp
// FTP Connector uses FileAccess__Ftp__* env vars
var host = Configuration["FileAccess:Ftp:Host"];
var port = int.Parse(Configuration["FileAccess:Ftp:Port"]);
var client = new AsyncFtpClient(host, username, password, port);
```

## Related Documentation

- **Research:** `.planning/phases/01-file-simulator-integration/01-RESEARCH.md`
- **ConfigMap Wiring Summary:** `.planning/phases/01-file-simulator-integration/01-01-SUMMARY.md`
- **Verification Script:** `scripts/verify-file-simulator.ps1`
- **ConfigMap Template:** `k8s/configmaps/file-simulator-config.yaml`
- **file-simulator Client Integration Guide:** `C:\Users\UserC\source\repos\file-simulator-suite\docs\CLIENT-INTEGRATION-GUIDE.md`

---

*Last Updated: 2026-02-02*
*Phase: 01-file-simulator-integration*
