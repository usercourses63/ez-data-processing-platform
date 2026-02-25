# EZ Platform - External File Access & Archive Support Plan

## Overview

Comprehensive plan integrating 6 file protocols, archive file support, and admin-managed file server configuration for development (Minikube + file-simulator) and production (OCP) environments.

**Date:** January 26, 2026
**Version:** 0.2.0 (Major Feature Release)

---

## Architecture Review Summary

**Reviewed by:** compound-engineering:review:architecture-strategist

### Key Recommendations Incorporated

1. **Size-tiered archive caching** - Archives <10MB full cache (5min TTL), 10-100MB (2min TTL), >100MB stream directly
2. **Kubernetes Secrets for credentials** - AdminFileServer stores `CredentialSecretRef`, not actual passwords
3. **4-phase migration** for existing datasources
4. **Add ArchiveBatchId** to FileDiscoveredEvent for tracking
5. **Archive security limits** - MaxEntriesPerArchive, MaxUncompressedSize to prevent zip bombs

### Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Archive bomb (zip bomb) | HIGH | MaxEntriesPerArchive=1000, MaxUncompressedSize=1GB |
| Credential exposure in logs | HIGH | ICredentialResolver with redaction |
| Hazelcast OOM from large archives | HIGH | Size-tiered caching strategy |
| SMB through proxies | MEDIUM | Deprioritized, document limitation |

---

## Part 1: Admin Server Configuration (Input & Output)

### Concept

**Input Servers** and **Output Servers** are configured SEPARATELY by admins in System Settings. Users creating datasources select servers from dropdowns and configure only applicative settings.

**Key Design:**
- **Input Servers Tab**: FTP, SFTP, S3, NFS, HTTP, Kafka (sources for file discovery)
- **Output Servers Tab**: Kafka, FTP, SFTP, S3, NFS, HTTP, Folder (destinations for processed data)
- Some server types can be BOTH input and output (FTP, SFTP, S3, NFS, HTTP, Kafka)
- Kafka is a first-class server type (admin configures brokers/security, users configure topics)

**Benefits:**
- Centralized credential management
- Single-point rotation
- Proper RBAC (admin vs data engineer)
- Server reusability across datasources
- Clear separation of input sources vs output destinations

### Server Type Matrix

| Server Type | Input | Output | Admin Configures | User Configures |
|-------------|-------|--------|------------------|-----------------|
| FTP | ✅ | ✅ | Host, port, credentials, passive mode | Path, file pattern |
| SFTP | ✅ | ✅ | Host, port, credentials, key auth | Path, file pattern |
| S3 | ✅ | ✅ | Endpoint, access key, secret key, region | Bucket, prefix |
| NFS | ✅ | ✅ | Mount path (K8s PV configured separately) | Relative path |
| HTTP | ✅ | ✅ | Base URL, auth type, credentials | Endpoint path, headers |
| **Kafka** | ✅ | ✅ | Bootstrap servers, security protocol, SASL creds | Topic, consumer group, headers |
| Folder | ❌ | ✅ | Base path (mounted volume) | Subfolder, filename pattern |

### Backend Changes

#### 1. New Entity: AdminServer (Unified for Input & Output)

**File:** `src/Services/Shared/Entities/AdminServer.cs`

```csharp
public class AdminServer : DataProcessingBaseEntity
{
    public string Name { get; set; }                    // "Production Kafka Cluster"
    public string Description { get; set; }
    public string ServerType { get; set; }              // "ftp", "sftp", "s3", "nfs", "http", "kafka", "folder"
    public ServerDirection Direction { get; set; }      // Input, Output, Both
    public bool IsActive { get; set; } = true;

    // Common fields
    public string? Host { get; set; }
    public int? Port { get; set; }
    public string? BasePath { get; set; }

    // Credential reference (stored in K8s Secrets)
    public string? CredentialSecretRef { get; set; }

    // Kafka-specific (when ServerType == "kafka")
    public KafkaServerConfig? KafkaConfig { get; set; }

    // Type-specific configuration
    public BsonDocument? TypeSpecificConfig { get; set; }

    // Connection settings
    public int ConnectionTimeoutSeconds { get; set; } = 30;
    public int RetryCount { get; set; } = 3;

    // Usage tracking
    public DateTime? LastConnectionTest { get; set; }
    public bool? LastConnectionSuccess { get; set; }
}

public enum ServerDirection
{
    Input,      // Can only be used as input source
    Output,     // Can only be used as output destination
    Both        // Can be used for both
}

public class KafkaServerConfig
{
    public string BootstrapServers { get; set; }        // "kafka:9092,kafka2:9092"
    public string SecurityProtocol { get; set; }        // "PLAINTEXT", "SASL_SSL", "SSL"
    public string? SaslMechanism { get; set; }          // "PLAIN", "SCRAM-SHA-256"
    public bool EnableSsl { get; set; }
    public string? SslCaLocation { get; set; }
    public int AcksRequired { get; set; } = 1;          // For producers
    public string? DefaultConsumerGroup { get; set; }   // Default if not specified
}
```

#### 2. Credential Resolver

**File:** `src/Services/Shared/Services/ICredentialResolver.cs`

```csharp
public interface ICredentialResolver
{
    Task<ServerCredentials> ResolveAsync(string secretRef, CancellationToken ct = default);
}

public class ServerCredentials
{
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? AccessKey { get; set; }      // S3
    public string? SecretKey { get; set; }      // S3
    public string? PrivateKey { get; set; }     // SFTP key auth
    public string? SaslUsername { get; set; }   // Kafka SASL
    public string? SaslPassword { get; set; }   // Kafka SASL
}
```

#### 3. API Controller

**File:** `src/Services/DataSourceManagementService/Controllers/ServersController.cs`

```csharp
[Route("api/v1/servers")]
public class ServersController : ControllerBase
{
    // List by direction
    GET    /input                 // List input servers only
    GET    /output                // List output servers only
    GET    /                      // List all servers

    // CRUD operations
    GET    /{id}                  // Get server by ID
    POST   /                      // Create server (admin only)
    PUT    /{id}                  // Update server (admin only)
    DELETE /{id}                  // Soft delete (admin only)

    // Operations
    POST   /{id}/test-connection  // Test connectivity
    GET    /{id}/datasources      // List datasources using this server
    GET    /types                 // List available server types with direction support
}
```

### Frontend Changes

#### 1. Two Admin Tabs for Input/Output Servers

**File:** `src/Frontend/src/pages/admin/AdminSettings.tsx`

```tsx
<Tabs>
  <TabPane tab="קטגוריות" key="categories">
    <CategoryManagementTab />
  </TabPane>
  <TabPane tab="שרתי קלט (Input Servers)" key="input-servers">
    <ServerConfigurationTab direction="input" />
  </TabPane>
  <TabPane tab="שרתי פלט (Output Servers)" key="output-servers">
    <ServerConfigurationTab direction="output" />
  </TabPane>
</Tabs>
```

#### 2. Server Configuration Tab (Reusable)

**File:** `src/Frontend/src/pages/admin/tabs/ServerConfigurationTab.tsx`

```tsx
interface Props {
  direction: 'input' | 'output';
}

export const ServerConfigurationTab: React.FC<Props> = ({ direction }) => {
  const { data: servers } = useQuery({
    queryKey: ['servers', direction],
    queryFn: () => getServersByDirection(direction)
  });

  return (
    <>
      <ServerTable servers={servers} direction={direction} />
      <ServerModal direction={direction} />
    </>
  );
};
```

#### 3. Server Form Fields by Type

**Common Fields (all types):**
| Field | Type | Required |
|-------|------|----------|
| Name | text | ✅ |
| Description | textarea | |
| Server Type | select | ✅ |
| Is Active | switch | |

**FTP/SFTP Fields:**
| Field | Type | Required |
|-------|------|----------|
| Host | text | ✅ |
| Port | number | ✅ |
| Username | text | ✅ |
| Password | password | ✅ |
| Base Path | text | |
| Use Passive Mode (FTP) | switch | |
| Use SSL (FTP) | switch | |

**S3 Fields:**
| Field | Type | Required |
|-------|------|----------|
| Endpoint | text | ✅ |
| Access Key | text | ✅ |
| Secret Key | password | ✅ |
| Region | text | |
| Use Path Style | switch | |

**Kafka Fields:**
| Field | Type | Required |
|-------|------|----------|
| Bootstrap Servers | text | ✅ |
| Security Protocol | select | ✅ |
| SASL Mechanism | select | If SASL |
| SASL Username | text | If SASL |
| SASL Password | password | If SASL |
| Default Consumer Group | text | |

**HTTP Fields:**
| Field | Type | Required |
|-------|------|----------|
| Base URL | text | ✅ |
| Auth Type | select | |
| Username | text | If basic |
| Password | password | If basic |
| Bearer Token | password | If bearer |

#### 4. DataSource Form Changes

**File:** `src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx`

For INPUT (file source):
```tsx
<Form.Item name="inputServerId" label="שרת קלט (Input Server)" rules={[{ required: true }]}>
  <Select placeholder="בחר שרת קלט">
    {inputServers.filter(s => s.isActive).map(server => (
      <Option key={server.id} value={server.id}>
        {server.name} ({server.serverType.toUpperCase()})
      </Option>
    ))}
  </Select>
</Form.Item>

{/* Applicative fields based on server type */}
{selectedInputServer?.serverType === 'kafka' ? (
  <>
    <Form.Item name="kafkaTopic" label="Topic">
      <Input className="ltr-field" placeholder="sales-events" />
    </Form.Item>
    <Form.Item name="kafkaConsumerGroup" label="Consumer Group">
      <Input className="ltr-field" placeholder="dataprocessing-sales" />
    </Form.Item>
  </>
) : (
  <>
    <Form.Item name="filePath" label="נתיב (Path)">
      <Input className="ltr-field" placeholder="/data/input/sales" />
    </Form.Item>
    <Form.Item name="filePattern" label="תבנית קובץ (File Pattern)">
      <Input className="ltr-field" placeholder="*.csv" />
    </Form.Item>
  </>
)}
```

**File:** `src/Frontend/src/components/datasource/tabs/OutputTab.tsx`

For OUTPUT destinations:
```tsx
<Form.Item name="outputServerId" label="שרת פלט (Output Server)">
  <Select placeholder="בחר שרת פלט">
    {outputServers.filter(s => s.isActive).map(server => (
      <Option key={server.id} value={server.id}>
        {server.name} ({server.serverType.toUpperCase()})
      </Option>
    ))}
  </Select>
</Form.Item>

{/* Applicative fields based on server type */}
{selectedOutputServer?.serverType === 'kafka' ? (
  <>
    <Form.Item name="outputKafkaTopic" label="Topic">
      <Input className="ltr-field" placeholder="validated-data" />
    </Form.Item>
    <Form.Item name="outputKafkaHeaders" label="Headers">
      <Input.TextArea className="ltr-field" placeholder='{"source": "datasource-name"}' />
    </Form.Item>
  </>
) : (
  <>
    <Form.Item name="outputPath" label="נתיב (Path)">
      <Input className="ltr-field" placeholder="/data/output/validated" />
    </Form.Item>
    <Form.Item name="outputFilenamePattern" label="תבנית שם קובץ">
      <Input className="ltr-field" placeholder="{filename}_{date}.{ext}" />
    </Form.Item>
  </>
)}
```

---

## Part 2: File Protocol Support

### Supported Protocols

| Protocol | Input | Output | Library | Priority |
|----------|-------|--------|---------|----------|
| FTP | ✅ | ✅ | FluentFTP | HIGH |
| SFTP | ✅ | ✅ | SSH.NET | HIGH |
| S3/MinIO | ✅ | ✅ | AWSSDK.S3 | HIGH |
| HTTP/WebDAV | ✅ | ✅ | HttpClient | MEDIUM |
| NFS | ✅ | ✅ | Filesystem | HIGH |
| SMB | ⚠️ | ⚠️ | SMBLibrary | LOW (deprioritized) |

### Backend Implementation

#### ConnectorFactory Pattern

**File:** `src/Services/Shared/Connectors/ConnectorFactory.cs`

```csharp
public class ConnectorFactory : IConnectorFactory
{
    public IDataSourceConnector GetConnector(AdminFileServer server)
    {
        return server.ServerType.ToLower() switch
        {
            "local" => _sp.GetRequiredService<LocalFileConnector>(),
            "ftp" => _sp.GetRequiredService<FtpConnector>(),
            "sftp" => _sp.GetRequiredService<SftpConnector>(),
            "s3" => _sp.GetRequiredService<S3Connector>(),
            "http" => _sp.GetRequiredService<HttpApiConnector>(),
            "nfs" => _sp.GetRequiredService<NfsConnector>(),
            "smb" => _sp.GetRequiredService<SmbConnector>(),
            _ => throw new ArgumentException($"Unknown server type: {server.ServerType}")
        };
    }
}
```

#### New Connectors

| File | Key Implementation Notes |
|------|--------------------------|
| `S3Connector.cs` | Use AWSSDK.S3, ForcePathStyle for MinIO |
| `NfsConnector.cs` | Direct filesystem on mounted PV |
| `SmbConnector.cs` | SMBLibrary, note NTLM proxy limitation |

---

## Part 3: Archive File Support

### Supported Formats

| Format | Extension | Password | Library |
|--------|-----------|----------|---------|
| ZIP | .zip | ✅ AES | SharpCompress |
| TAR.GZ | .tar.gz, .tgz | ❌ | SharpCompress |
| RAR | .rar | ✅ | SharpCompress |
| 7Z | .7z | ✅ LZMA | SharpCompress |

### Two-Phase Architecture

```
Phase 1: Discovery (FileDiscoveryService)
┌──────────────────────────────────────────────────────────┐
│ 1. Detect archive file via IArchiveService.IsArchive()   │
│ 2. Download archive bytes via connector                  │
│ 3. Apply size-tiered caching:                           │
│    - <10MB: Cache 5min TTL                              │
│    - 10-100MB: Cache 2min TTL                           │
│    - >100MB: No cache (stream)                          │
│ 4. List contents via IArchiveService.ListContentsAsync() │
│ 5. Filter by ExtractionPattern                          │
│ 6. Publish FileDiscoveredEvent per matching file        │
│    - IsFromArchive: true                                │
│    - ArchiveCacheKey: "archive:{guid}"                  │
│    - ArchiveBatchId: shared across all files            │
└──────────────────────────────────────────────────────────┘

Phase 2: Extraction (FileProcessorService)
┌──────────────────────────────────────────────────────────┐
│ 1. Check IsFromArchive flag                              │
│ 2. If true: Retrieve archive from Hazelcast (or re-download) │
│ 3. Extract specific file via IArchiveService.ExtractFile() │
│ 4. Process extracted content normally                    │
└──────────────────────────────────────────────────────────┘
```

### Security Limits

```csharp
public class ArchiveSecuritySettings
{
    public int MaxEntriesPerArchive { get; set; } = 1000;
    public long MaxUncompressedSizeBytes { get; set; } = 1_073_741_824; // 1GB
    public long MaxArchiveSizeBytes { get; set; } = 536_870_912; // 512MB
    public int MaxNestingDepth { get; set; } = 2; // Archives in archives
}
```

### DataSource Archive Settings

```csharp
public class ArchiveSettings
{
    public bool IsArchiveSource { get; set; }
    public string ArchiveType { get; set; } = "auto";  // "auto", "zip", "tar.gz", "rar", "7z"
    public string? ArchivePassword { get; set; }       // Encrypted
    public string? ExtractionPattern { get; set; }     // "*.csv", "data/**/*.json"
    public bool ProcessNestedArchives { get; set; }
}
```

### Frontend Archive Settings

**Location:** ConnectionTab.tsx (after file pattern)

```tsx
<Divider>הגדרות ארכיון (Archive Settings)</Divider>

<Form.Item name={['archiveSettings', 'isArchiveSource']} valuePropName="checked">
  <Checkbox>קבצי המקור הם ארכיונים</Checkbox>
</Form.Item>

{isArchiveSource && (
  <>
    <Form.Item name={['archiveSettings', 'archiveType']} label="סוג ארכיון">
      <Select defaultValue="auto">
        <Option value="auto">זיהוי אוטומטי</Option>
        <Option value="zip">ZIP</Option>
        <Option value="tar.gz">TAR.GZ</Option>
        <Option value="rar">RAR</Option>
        <Option value="7z">7Z</Option>
      </Select>
    </Form.Item>

    <Form.Item name={['archiveSettings', 'archivePassword']} label="סיסמת ארכיון">
      <Input.Password />
    </Form.Item>

    <Form.Item name={['archiveSettings', 'extractionPattern']} label="תבנית חילוץ">
      <Input className="ltr-field" placeholder="*.csv" />
    </Form.Item>
  </>
)}
```

---

## Part 4: Message & Entity Updates

### FileDiscoveredEvent Updates

```csharp
public class FileDiscoveredEvent : IDataProcessingMessage
{
    // Existing fields...

    // NEW: Archive support
    public bool IsFromArchive { get; init; }
    public string? ArchivePath { get; init; }
    public string? PathInArchive { get; init; }
    public string? ArchiveCacheKey { get; init; }
    public Guid? ArchiveBatchId { get; init; }          // Track files from same archive
    public int? TotalFilesInArchive { get; init; }      // For progress
    public int? FileIndexInArchive { get; init; }       // For progress
}
```

### DataProcessingDataSource Updates

```csharp
public class DataProcessingDataSource
{
    // Existing fields...

    // NEW: Server reference (replaces inline config)
    public string? FileServerId { get; set; }

    // NEW: Archive settings
    public ArchiveSettings? ArchiveSettings { get; set; }

    // DEPRECATED: Keep for migration, remove in v0.3.0
    [Obsolete("Use FileServerId instead")]
    public BsonDocument? AdditionalConfiguration { get; set; }
}
```

---

## Part 5: DemoDataGenerator Updates

### New Generators

| Generator | Creates | Count |
|-----------|---------|-------|
| FileServerGenerator | AdminFileServer entities | 5 |
| ArchivePolicyGenerator | Archive test configurations | 2 |

### FileServer Seed Data

```csharp
new AdminFileServer[] {
    new { Name = "Local Development", ServerType = "local", BasePath = "/data/input" },
    new { Name = "Production FTP", ServerType = "ftp", Host = "ftp.example.com", Port = 21 },
    new { Name = "S3 Data Lake", ServerType = "s3", Host = "s3.amazonaws.com" },
    new { Name = "NFS Archive", ServerType = "nfs", BasePath = "/mnt/nfs" },
    new { Name = "SFTP Partner", ServerType = "sftp", Host = "sftp.partner.com", Port = 22 }
}
```

### DataSourceGenerator Changes

- Accept FileServer list in constructor
- Reference `FileServerId` instead of inline config
- Distribute 20 datasources across 5 server types
- Include 4 datasources with archive settings enabled

---

## Part 6: Kubernetes Configuration

### Development (Minikube)

| Resource | File | Purpose |
|----------|------|---------|
| ConfigMap | `k8s/configmaps/file-simulator-config.yaml` | Protocol endpoints |
| NFS PV/PVC | `k8s/storage/nfs-pv-dev.yaml` | Mount file-simulator NFS |
| Deployment updates | Various | Add envFrom + volumeMounts |

### Production (OCP)

| Resource | File | Purpose |
|----------|------|---------|
| Secret | `k8s/secrets/file-access-secrets.yaml` | Credentials template |
| ConfigMap | `k8s/configmaps/file-access-config-prod.yaml` | Non-sensitive config |
| NFS PV | `k8s/storage/nfs-pv-ocp.yaml` | Production NFS server |
| NetworkPolicy | `k8s/network-policies/file-access-egress.yaml` | Egress rules |

---

## Part 7: Migration Strategy

### 4-Phase Approach

| Phase | Version | Changes |
|-------|---------|---------|
| 1 | v0.2.0 | Add nullable FileServerId, ConnectorFactory falls back to AdditionalConfiguration |
| 2 | v0.2.1 | Migration tool creates AdminFileServer from existing configs |
| 3 | v0.2.5 | Deprecation warnings in logs when using inline config |
| 4 | v0.3.0 | Remove AdditionalConfiguration support |

### Migration Script

```csharp
// MigrationService.MigrateInlineConfigsAsync()
foreach (var ds in datasourcesWithInlineConfig)
{
    var server = ExtractServerFromConfig(ds.AdditionalConfiguration);
    var existingServer = await FindMatchingServer(server);

    if (existingServer == null)
    {
        existingServer = await CreateAdminFileServer(server);
    }

    ds.FileServerId = existingServer.ID;
    await ds.SaveAsync();
}
```

---

## Part 8: Implementation Phases

### Phase 1: Backend Foundation (Week 1-2)

- [ ] Add NuGet packages (AWSSDK.S3, SharpCompress)
- [ ] Create AdminFileServer entity
- [ ] Create ICredentialResolver interface + K8s implementation
- [ ] Create FileServersController + FileServerService
- [ ] Create S3Connector, NfsConnector
- [ ] Create ConnectorFactory
- [ ] Create IArchiveService + SharpCompress implementation
- [ ] Update FileMetadata with archive fields
- [ ] Update FileDiscoveredEvent with archive fields

### Phase 2: Service Integration (Week 3)

- [ ] Update FileDiscoveryWorker (factory + archive detection)
- [ ] Update FileProcessorService (archive extraction)
- [ ] Create S3OutputHandler, NfsOutputHandler, FtpOutputHandler
- [ ] Update OutputService handler registration
- [ ] Add archive security limits

### Phase 3: Frontend (Week 4)

- [ ] Create FileServerConfigurationTab
- [ ] Create FileServerModal, FileServerTable
- [ ] Update ConnectionTab (server dropdown + archive settings)
- [ ] Update DestinationEditorModal (new output types)
- [ ] Add Hebrew translations
- [ ] Add connection test APIs

### Phase 4: Kubernetes & Testing (Week 5)

- [ ] Create file-simulator-config ConfigMap
- [ ] Create NFS PV/PVC for development
- [ ] Update deployment manifests
- [ ] Create OCP production templates
- [ ] Test against file-simulator
- [ ] E2E tests for archive processing

### Phase 5: DemoDataGenerator & Documentation (Week 6)

- [ ] Create FileServerGenerator
- [ ] Update DataSourceGenerator
- [ ] Test demo data generation
- [ ] Update CLAUDE.md
- [ ] Create migration guide

### Phase 6: Release Package (Week 6)

- [ ] Update release-package folder
- [ ] Update README.md
- [ ] Create CHANGELOG.md entry
- [ ] Update user guide
- [ ] Update deployment guide
- [ ] Git branch, commits, push, release tag

---

## Part 9: Critical E2E Tests

| Priority | Test Scenario |
|----------|---------------|
| HIGH | FTP input -> Validation -> Kafka output |
| HIGH | SFTP input -> Validation -> S3 output |
| HIGH | S3 input -> Validation -> NFS output |
| HIGH | ZIP archive (5 files) -> Full pipeline |
| HIGH | Admin creates file server -> User creates datasource |
| MEDIUM | Password-protected RAR -> Processing |
| MEDIUM | Archive > 50MB with streaming |
| MEDIUM | Nested archives (ZIP containing TAR.GZ) |

---

## Part 10: Task Orchestrator Usage

After plan approval, use `task-orchestrator` MCP tool to:

1. **Create Feature**: "External File Access & Archive Support v0.2.0"
2. **Create Tasks**: One per implementation phase
3. **Track Progress**: Update status as work completes
4. **Git Workflow**: Branch `feature/file-access-v0.2.0`, commits per task
5. **Release**: Merge to main, tag v0.2.0

### Git Branch Strategy

```
main
└── feature/file-access-v0.2.0
    ├── commit: "feat: Add AdminFileServer entity and API"
    ├── commit: "feat: Add S3Connector and NfsConnector"
    ├── commit: "feat: Add archive support with SharpCompress"
    ├── commit: "feat: Add FileServerConfigurationTab to admin"
    ├── commit: "feat: Update DemoDataGenerator for new architecture"
    ├── commit: "docs: Update CLAUDE.md and guides"
    └── merge → main → tag v0.2.0
```

---

## Part 11: Release Package Updates

**Location:** `C:\Users\UserC\source\repos\EZ\release-package\`

| File | Updates Needed |
|------|----------------|
| README.md | Add file server configuration section |
| CHANGELOG.md | v0.2.0 release notes |
| docs/user-guide.md | Admin file server setup, archive settings |
| docs/deployment-guide.md | NFS PV setup, OCP network policies |
| docs/api-reference.md | FileServers API endpoints |
| k8s/ | Include new ConfigMaps, Secrets templates, NetworkPolicies |

---

## Key Files Summary

### Backend (NEW)

| File | Purpose |
|------|---------|
| `Entities/AdminFileServer.cs` | File server entity |
| `Services/ICredentialResolver.cs` | K8s secret resolution |
| `Services/IArchiveService.cs` | Archive operations |
| `Connectors/S3Connector.cs` | S3/MinIO connector |
| `Connectors/NfsConnector.cs` | NFS connector |
| `Connectors/ConnectorFactory.cs` | Connector resolution |
| `Controllers/FileServersController.cs` | Admin API |
| `Handlers/S3OutputHandler.cs` | S3 output |
| `Handlers/NfsOutputHandler.cs` | NFS output |

### Frontend (NEW)

| File | Purpose |
|------|---------|
| `admin/tabs/FileServerConfigurationTab.tsx` | Admin tab |
| `admin/components/FileServerModal.tsx` | Create/edit modal |
| `admin/components/FileServerTable.tsx` | Server list |
| `services/fileservers-api-client.ts` | API client |

### Kubernetes (NEW)

| File | Purpose |
|------|---------|
| `configmaps/file-simulator-config.yaml` | Dev endpoints |
| `storage/nfs-pv-dev.yaml` | Dev NFS mount |
| `storage/nfs-pv-ocp.yaml` | Prod NFS mount |
| `secrets/file-access-secrets.yaml` | Credentials template |
| `network-policies/file-access-egress.yaml` | OCP egress rules |

---

## Verification Checklist

- [ ] Admin can create/edit/delete file servers
- [ ] Admin can test file server connection
- [ ] User sees file server dropdown when creating datasource
- [ ] FileDiscoveryService uses ConnectorFactory
- [ ] Archive files are detected and contents listed
- [ ] Archive files with passwords are processed
- [ ] FileProcessorService extracts from cached archive
- [ ] Output handlers write to S3, NFS, FTP
- [ ] DemoDataGenerator creates file servers and references them
- [ ] All E2E tests pass
- [ ] Release package updated
