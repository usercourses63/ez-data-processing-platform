# EZ Platform - File Access Integration Plan: Architecture Review

## Executive Summary

This document provides a comprehensive architectural review of the proposed file access integration plan for EZ Platform. The analysis covers protocol support (6 protocols), archive handling, admin file server configuration, and the overall system impact.

---

## 1. Architecture Overview

### Current State
The EZ Platform currently implements:
- **Connector Pattern:** Well-established `IDataSourceConnector` interface with implementations for Local, FTP, SFTP, HTTP, and Kafka
- **Output Handlers:** `IOutputHandler` pattern supporting Kafka and Folder outputs
- **Hazelcast Caching:** Resilient wrapper with retry and circuit breaker policies
- **Entity Model:** `DataProcessingDataSource` with `AdditionalConfiguration` (BsonDocument) for protocol-specific settings

### Proposed Changes
1. Add S3, SMB, and NFS connectors
2. Add ConnectorFactory for dynamic resolution
3. Implement two-phase archive processing
4. Introduce AdminFileServer entity (centralized server management)
5. Extend FileDiscoveredEvent for archive metadata

---

## 2. Detailed Analysis by Review Question

### 2.1 Architecture Concerns - Two-Phase Archive Design

**Assessment: SOUND DESIGN with caveats**

The two-phase approach (Discovery lists contents -> Processor extracts on demand) is architecturally appropriate because:

**Strengths:**
- Avoids memory pressure from full archive extraction
- Supports streaming for large archives
- Aligns with existing event-driven patterns
- Defers work until actually needed

**Concerns and Mitigations:**

| Concern | Risk Level | Mitigation |
|---------|------------|------------|
| Archive re-download between phases | HIGH | Cache archive in Hazelcast (proposed) |
| Hazelcast memory pressure for large archives | MEDIUM | Size-tiered caching strategy |
| Concurrent access to same archive | LOW | Use archive hash as cache key with atomic operations |
| Password-protected archive handling | LOW | Store password in ArchiveSettings, pass securely |

**Recommendation:**
```
Implement a size-tiered caching strategy:
- Archives < 10MB: Full cache in Hazelcast
- Archives 10-100MB: Hazelcast with aggressive TTL (2 min)
- Archives > 100MB: Stream directly, no cache (download twice if needed)
```

**Alternative Considered:** Single-phase extraction to temp storage
- Rejected because it creates state management complexity and doesn't scale well with multiple pods

---

### 2.2 Security - Admin File Server Approach

**Assessment: CORRECT APPROACH with enhancements needed**

Centralizing file server configuration at admin level is the right pattern for:
- Credential management (single source of truth)
- Compliance auditing (who can access what)
- Operations management (credential rotation without touching 100s of datasources)

**Current Plan Gap:** The plan doesn't specify password storage mechanism.

**Recommended Security Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    AdminFileServer Entity                        │
├─────────────────────────────────────────────────────────────────┤
│  Id: ObjectId                                                    │
│  Name: string                                                    │
│  Protocol: enum (FTP, SFTP, S3, HTTP, NFS, SMB)                 │
│  Host: string                                                    │
│  Port: int                                                       │
│  BasePath: string                                                │
│  Username: string (nullable)                                     │
│  CredentialSecretRef: string  ← K8s Secret name                 │
│  ProtocolSettings: BsonDocument                                  │
│  IsActive: bool                                                  │
│  CreatedAt, UpdatedAt, CreatedBy                                │
└─────────────────────────────────────────────────────────────────┘

Password Storage Options (ranked by security):

1. RECOMMENDED: Kubernetes Secrets + External Secrets Operator
   - Passwords stored in HashiCorp Vault or AWS Secrets Manager
   - K8s External Secrets syncs to cluster Secret
   - AdminFileServer stores only CredentialSecretRef
   - Services read from mounted Secret volume

2. ACCEPTABLE: Kubernetes Secrets (Direct)
   - Passwords in K8s Secret (base64, not encrypted at rest by default)
   - AdminFileServer stores CredentialSecretRef
   - Enable etcd encryption for production

3. NOT RECOMMENDED: MongoDB with field-level encryption
   - Complex key management
   - Performance overhead
   - Harder to rotate

4. AVOID: Plain text in MongoDB
   - Never store credentials in AdditionalConfiguration
```

**Implementation Pattern:**
```csharp
public interface ICredentialResolver
{
    Task<NetworkCredential?> ResolveAsync(string secretRef, CancellationToken ct);
}

public class KubernetesCredentialResolver : ICredentialResolver
{
    public async Task<NetworkCredential?> ResolveAsync(string secretRef, CancellationToken ct)
    {
        // Read from mounted secret volume: /etc/secrets/{secretRef}
        var secretPath = Path.Combine("/etc/secrets", secretRef);
        if (!File.Exists(secretPath)) return null;

        var json = await File.ReadAllTextAsync(secretPath, ct);
        var cred = JsonSerializer.Deserialize<CredentialData>(json);
        return new NetworkCredential(cred.Username, cred.Password);
    }
}
```

---

### 2.3 Data Model - FileServer vs DataSource Separation

**Assessment: CORRECT ABSTRACTION**

The separation follows proper domain modeling:

```
┌──────────────────┐         ┌────────────────────────┐
│  AdminFileServer │ 1    N  │  DataProcessingDataSource │
│  (Infrastructure)│─────────│  (Business Logic)          │
├──────────────────┤         ├────────────────────────────┤
│ - Credentials    │         │ - Schema                   │
│ - Connection     │         │ - FilePattern              │
│ - Protocol       │         │ - Schedule                 │
│ - BasePath       │         │ - Output destinations      │
│                  │         │ - FileServerId (FK)        │
│                  │         │ - RelativePath             │
│                  │         │ - ArchiveSettings          │
└──────────────────┘         └────────────────────────────┘
```

**Benefits:**
1. **Credential Rotation:** Change once, affects all datasources
2. **Access Control:** Admin vs. Data Engineer roles
3. **Reusability:** Multiple datasources share one server config
4. **Audit Trail:** Track server usage across datasources

**Recommended DataSource Changes:**
```csharp
public class DataProcessingDataSource : DataProcessingBaseEntity
{
    // Existing fields...

    // NEW: Reference to admin-configured file server
    [StringLength(24)]
    public string? FileServerId { get; set; }

    // NEW: Path relative to FileServer.BasePath (user-configurable)
    [StringLength(500)]
    public string? RelativePath { get; set; }

    // NEW: Archive processing configuration
    public ArchiveSettings? ArchiveSettings { get; set; }

    // DEPRECATED: Keep for migration, remove in v0.2.0
    [Obsolete("Use FileServerId instead")]
    public BsonDocument? AdditionalConfiguration { get; set; }
}

public class ArchiveSettings
{
    public bool IsArchiveSource { get; set; }
    public string ArchiveType { get; set; } = "auto"; // auto, zip, tar.gz, rar, 7z
    public string? ArchivePasswordSecretRef { get; set; } // K8s Secret ref
    public string? ExtractionPattern { get; set; } // e.g., "*.csv" within archive
    public int? MaxEntriesPerArchive { get; set; } = 1000; // Safety limit
}
```

---

### 2.4 Event Flow - Archive Metadata in FileDiscoveredEvent

**Assessment: APPROPRIATE with versioning**

The proposed changes to FileDiscoveredEvent are well-designed:

```csharp
public class FileDiscoveredEvent : IDataProcessingMessage
{
    // Existing fields...

    // NEW: Archive context (v2)
    public bool IsFromArchive { get; set; } = false;

    [StringLength(2000)]
    public string? ArchivePath { get; set; }

    [StringLength(500)]
    public string? PathInArchive { get; set; }

    [StringLength(64)]
    public string? ArchiveCacheKey { get; set; } // Hazelcast key

    // Bump version for consumers to handle
    public int MessageVersion { get; set; } = 2; // Was 1
}
```

**Concerns and Mitigations:**

| Concern | Mitigation |
|---------|------------|
| Backward compatibility | MessageVersion field allows consumers to adapt |
| Event size growth | Nullable fields, minimal overhead when not archive |
| Cache key leakage | ArchiveCacheKey is opaque hash, not sensitive |

**Alternative Considered:** Separate ArchiveFileDiscoveredEvent
- Rejected because it would require parallel consumer registration and complicate the pipeline

**Recommended Enhancement - Add Archive Batch Context:**
```csharp
// For tracking all files from single archive
public Guid? ArchiveBatchId { get; set; }
public int? TotalFilesInArchive { get; set; }
public int? FileIndexInArchive { get; set; }
```

This enables:
- Progress tracking for large archives
- Batch completion detection
- Archive cleanup after all files processed

---

### 2.5 Migration Strategy - Existing DataSources

**Assessment: CRITICAL PATH - Needs detailed plan**

**Current State:** DataSources store connection details in `AdditionalConfiguration` BsonDocument.

**Migration Approach:**

```
Phase 1: Parallel Support (v0.1.2)
├── Add FileServerId field (nullable)
├── Add AdminFileServer entity and API
├── ConnectorFactory checks FileServerId first, falls back to AdditionalConfiguration
└── No existing data changes required

Phase 2: Admin Migration Tool (v0.1.3)
├── Script extracts unique server configs from existing AdditionalConfiguration
├── Creates AdminFileServer entries for each unique server
├── Updates DataSources with FileServerId references
├── Keeps AdditionalConfiguration for rollback

Phase 3: Deprecation (v0.2.0)
├── Warning logs when AdditionalConfiguration is used
├── UI shows migration prompt
├── Documentation update

Phase 4: Removal (v0.3.0)
├── Remove AdditionalConfiguration support from ConnectorFactory
├── Migration becomes mandatory
└── Cleanup unused AdditionalConfiguration fields
```

**Migration Script Pattern:**
```csharp
public class DataSourceMigrationService
{
    public async Task MigrateToFileServersAsync()
    {
        var datasources = await _repository.GetAllWithInlineConfigAsync();
        var serverGroups = datasources
            .GroupBy(ds => ExtractServerKey(ds.AdditionalConfiguration))
            .ToList();

        foreach (var group in serverGroups)
        {
            // Create AdminFileServer from first datasource's config
            var fileServer = CreateFileServerFrom(group.First());
            await _fileServerRepo.SaveAsync(fileServer);

            // Update all datasources in group
            foreach (var ds in group)
            {
                ds.FileServerId = fileServer.ID;
                ds.RelativePath = ExtractRelativePath(ds);
                await _repository.SaveAsync(ds);
            }
        }
    }

    private string ExtractServerKey(BsonDocument config)
    {
        // Create unique key from host+port+protocol
        return $"{config["Protocol"]}://{config["Host"]}:{config["Port"]}";
    }
}
```

---

### 2.6 Testing Strategy - Critical E2E Tests

**Assessment: Test pyramid needs adjustment for integration complexity**

**Recommended E2E Test Matrix:**

| Test ID | Scenario | Priority | Complexity |
|---------|----------|----------|------------|
| E2E-007 | FTP input -> Validation -> Kafka output | HIGH | LOW |
| E2E-008 | SFTP input -> Validation -> S3 output | HIGH | MEDIUM |
| E2E-009 | S3 input -> Validation -> Folder output | HIGH | MEDIUM |
| E2E-010 | ZIP archive (5 files) -> Full pipeline | HIGH | HIGH |
| E2E-011 | Password-protected archive processing | MEDIUM | MEDIUM |
| E2E-012 | Archive > 50MB with streaming | MEDIUM | HIGH |
| E2E-013 | Multi-protocol: FTP -> S3 -> Kafka (chain) | LOW | HIGH |
| E2E-014 | FileServer credential rotation mid-processing | LOW | HIGH |
| E2E-015 | NFS mount failover | LOW | HIGH |

**Integration Tests (Per Connector):**
```
For each protocol (FTP, SFTP, S3, HTTP, NFS, SMB):
├── TestConnection_ValidCredentials_ReturnsTrue
├── TestConnection_InvalidCredentials_ReturnsFalse
├── TestConnection_Timeout_ReturnsFalseWithinSLA
├── ListFiles_EmptyDirectory_ReturnsEmptyList
├── ListFiles_WithPattern_FiltersCorrectly
├── ReadFile_ValidPath_ReturnsContent
├── ReadFile_InvalidPath_ThrowsFileNotFound
├── GetMetadata_ValidFile_ReturnsCorrectSize
└── Concurrent_10Operations_AllSucceed
```

**Archive-Specific Tests:**
```
├── ListArchiveContents_ZIP_ReturnsEntryList
├── ListArchiveContents_PasswordProtected_WithCorrectPassword_Succeeds
├── ListArchiveContents_PasswordProtected_WrongPassword_Fails
├── ExtractFile_FromZIP_ReturnsCorrectContent
├── ExtractFile_FromTarGz_ReturnsCorrectContent
├── ExtractFile_LargeArchive_StreamsWithoutOOM
├── ArchiveCache_SecondAccess_UsesCache
└── ArchiveCache_ExpiredTTL_RefetchesArchive
```

---

### 2.7 Performance - Hazelcast Caching for Archives

**Assessment: Needs tiered TTL strategy**

**Current Hazelcast Config (from CLAUDE.md):**
```yaml
Maps:
  file-content:
    time-to-live-seconds: 300    # 5 minutes
    max-idle-seconds: 180        # 3 minutes
    eviction-policy: LRU
    max-size: 256MB per map
```

**Recommended Archive Cache Configuration:**

```yaml
# k8s/infrastructure/hazelcast-config.yaml
hazelcast:
  map:
    archive-content:
      # Shorter TTL - archives are typically processed quickly
      time-to-live-seconds: 120    # 2 minutes
      max-idle-seconds: 60         # 1 minute idle expiry

      # Memory management
      eviction:
        eviction-policy: LRU
        max-size-policy: USED_HEAP_SIZE
        size: 512  # MB - higher than file-content due to archive sizes

      # Near cache for multi-pod scenarios
      near-cache:
        enabled: true
        time-to-live-seconds: 30
        max-idle-seconds: 20
        eviction:
          eviction-policy: LRU
          size: 100  # MB per pod

    archive-metadata:
      # Longer TTL for lightweight metadata
      time-to-live-seconds: 600    # 10 minutes
      max-idle-seconds: 300        # 5 minutes
      eviction:
        eviction-policy: LRU
        max-size-policy: ENTRY_COUNT
        size: 10000  # entries
```

**Implementation Pattern:**
```csharp
public interface IArchiveCacheService
{
    Task<byte[]?> GetArchiveAsync(string cacheKey);
    Task SetArchiveAsync(string cacheKey, byte[] content, ArchiveSizeTier tier);
    Task<ArchiveMetadata?> GetMetadataAsync(string cacheKey);
    Task SetMetadataAsync(string cacheKey, ArchiveMetadata metadata);
    string GenerateCacheKey(string archivePath, long size, DateTime lastModified);
}

public enum ArchiveSizeTier
{
    Small,      // < 10MB: Full cache, 5 min TTL
    Medium,     // 10-100MB: Full cache, 2 min TTL
    Large       // > 100MB: Metadata only, stream on demand
}
```

---

### 2.8 Alternative Approaches Considered

#### Alternative 1: Unified Storage Abstraction (Rejected)

**Concept:** Use a library like FluentStorage or Apache Commons VFS for all protocols.

**Why Rejected:**
- FluentStorage doesn't support SMB well
- Loses fine-grained control over protocol-specific optimizations
- Current IDataSourceConnector pattern already provides good abstraction

#### Alternative 2: Sidecar Pattern for File Access (Considered for Future)

**Concept:** Deploy protocol-specific sidecar containers that expose local filesystem interface.

**Pros:**
- Isolates protocol complexity
- Protocol updates don't require service redeployment
- Better security isolation

**Cons:**
- Operational complexity
- Latency overhead
- Resource consumption

**Recommendation:** Consider for v0.3.0 if protocol count exceeds 10 or security requirements increase.

#### Alternative 3: External Archive Extraction Service (Rejected)

**Concept:** Dedicated microservice for archive handling.

**Why Rejected:**
- Adds network hop and latency
- Complicates deployment
- Current two-phase design handles complexity adequately

---

## 3. Compliance Check - Architectural Principles

| Principle | Status | Notes |
|-----------|--------|-------|
| **Single Responsibility** | PASS | Each connector handles one protocol |
| **Open/Closed** | PASS | ConnectorFactory extensible without modification |
| **Liskov Substitution** | PASS | All connectors implement IDataSourceConnector uniformly |
| **Interface Segregation** | PASS | IDataSourceConnector is focused, IOutputHandler is separate |
| **Dependency Inversion** | PASS | Services depend on interfaces, not implementations |
| **Separation of Concerns** | PASS | Admin (FileServer) vs User (DataSource) clearly separated |
| **No Circular Dependencies** | PASS | Connectors don't depend on services, services depend on connectors |

---

## 4. Risk Analysis

### High Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Credential exposure in logs | HIGH | MEDIUM | Implement ICredentialResolver with redaction |
| Archive bomb (zip bomb) attack | HIGH | LOW | Implement MaxEntriesPerArchive, MaxUncompressedSize limits |
| Hazelcast OOM from large archives | HIGH | MEDIUM | Size-tiered caching, streaming for large files |

### Medium Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| SMB NTLM auth through proxies | MEDIUM | HIGH | Document limitation, recommend VPN for SMB |
| NFS mount permissions in OCP | MEDIUM | MEDIUM | Test with restricted-v2 SCC, document requirements |
| Migration data loss | MEDIUM | LOW | Parallel support phase, rollback capability |

### Low Risk Items

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Protocol library vulnerabilities | LOW | LOW | Regular dependency updates, Dependabot alerts |
| Archive format not supported | LOW | LOW | SharpCompress supports major formats, add as needed |

---

## 5. Actionable Recommendations

### Immediate (Before Implementation)

1. **Add AdminFileServer entity** to Shared project:
   - `c:\Users\UserC\source\repos\EZ\src\Services\Shared\Entities\AdminFileServer.cs`

2. **Add ICredentialResolver interface** for secure credential handling:
   - `c:\Users\UserC\source\repos\EZ\src\Services\Shared\Security\ICredentialResolver.cs`

3. **Define archive size limits** in configuration:
   ```yaml
   Archive:
     MaxEntriesPerArchive: 1000
     MaxUncompressedSizeMB: 500
     MaxArchiveSizeMB: 100
   ```

### Phase 1 Implementation Order

1. ConnectorFactory (foundation for all connectors)
2. S3Connector (most requested protocol)
3. NfsConnector (simplest to implement)
4. Archive support in FileDiscoveryService
5. AdminFileServer entity and API
6. Frontend Admin Settings tab

### Testing Checkpoints

- After each connector: Run connector-specific integration tests
- After ConnectorFactory: Run E2E-001 through E2E-006 (existing tests still pass)
- After archive support: Run E2E-010, E2E-011
- After AdminFileServer: Run migration script on test data

---

## 6. Conclusion

The proposed file access integration plan is **architecturally sound** with the following adjustments:

1. **Implement size-tiered archive caching** to prevent OOM
2. **Use Kubernetes Secrets** for credential storage (not MongoDB)
3. **Add ArchiveBatchId** to FileDiscoveredEvent for batch tracking
4. **Follow the 4-phase migration plan** for existing datasources
5. **Prioritize S3 and NFS** connectors (most value, lowest complexity)
6. **Deprioritize SMB** due to NTLM proxy limitations

The plan aligns with existing architectural patterns (IDataSourceConnector, IOutputHandler) and extends them consistently. The separation of AdminFileServer from DataSource is the correct domain model for enterprise credential management.

---

*Review completed: January 26, 2026*
*Reviewer: System Architecture Agent*
*Plan version reviewed: FILE-ACCESS-INTEGRATION-PLAN.md (January 26, 2026)*
