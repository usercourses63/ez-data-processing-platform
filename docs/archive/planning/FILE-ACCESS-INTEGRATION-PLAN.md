# EZ Platform - External File Access Integration Plan

## Overview

This plan outlines the integration of the file-simulator-suite protocols into the EZ Platform for external file access in both development (Minikube) and production (OCP) environments.

**Date:** January 26, 2026
**Status:** Planning Phase
**Simulator Location:** `C:\Users\UserC\source\repos\file-simulator-suite`

---

## Supported Protocols

| Protocol | Input | Output | Library | Port (Dev) | Port (OCP) |
|----------|-------|--------|---------|------------|------------|
| FTP | ✅ | ✅ | FluentFTP | 30021 | Configurable |
| SFTP | ✅ | ✅ | SSH.NET (Renci.SshNet) | 30022 | Configurable |
| S3/MinIO | ✅ | ✅ | AWSSDK.S3 | 30900 | Configurable |
| HTTP/WebDAV | ✅ | ✅ | HttpClient | 30088/30089 | Configurable |
| SMB | ✅ | ✅ | SMBLibrary | 445 (LB) | Configurable |
| NFS | ✅ | ✅ | Filesystem (mounted PV) | 32149 | NFS PV |

---

## Part 1: Frontend Changes

### 1.1 Type Definitions Updates

**File:** `src/Frontend/src/components/datasource/shared/types.ts`

```typescript
// Current
export type ConnectionType = 'SFTP' | 'FTP' | 'HTTP' | 'Local' | 'Kafka';

// Updated
export type ConnectionType =
  | 'Local'
  | 'FTP'
  | 'SFTP'
  | 'HTTP'
  | 'S3'
  | 'SMB'
  | 'NFS'
  | 'Kafka';

// New: Protocol-specific configuration interfaces
export interface S3ConnectionConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  usePathStyle: boolean;
  basePath?: string;
}

export interface SmbConnectionConfig {
  host: string;
  port: number;
  shareName: string;
  domain?: string;
  username: string;
  password: string;
  basePath?: string;
}

export interface NfsConnectionConfig {
  // NFS uses mounted PV - configuration is at K8s level
  mountPath: string;  // e.g., /mnt/nfs
  basePath?: string;  // relative path within mount
}

export interface HttpConnectionConfig {
  baseUrl: string;
  authType: 'none' | 'basic' | 'bearer';
  username?: string;
  password?: string;
  bearerToken?: string;
  basePath?: string;
}

// Updated ConnectionConfig
export interface ConnectionConfig {
  type: ConnectionType;
  // Common fields
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  path?: string;
  filePattern?: string;

  // S3-specific
  s3Endpoint?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3UsePathStyle?: boolean;

  // SMB-specific
  smbShareName?: string;
  smbDomain?: string;

  // NFS-specific
  nfsMountPath?: string;

  // HTTP-specific
  httpAuthType?: 'none' | 'basic' | 'bearer';
  httpBearerToken?: string;

  // Kafka-specific (existing)
  brokers?: string;
  topic?: string;
  consumerGroup?: string;
  securityProtocol?: string;
  offsetReset?: string;
}
```

### 1.2 Constants Updates

**File:** `src/Frontend/src/components/datasource/shared/constants.ts`

```typescript
export const CONNECTION_TYPE_OPTIONS = [
  { value: 'Local', label: 'Local - תיקייה מקומית', icon: 'FolderOutlined' },
  { value: 'FTP', label: 'FTP - File Transfer Protocol', icon: 'CloudUploadOutlined' },
  { value: 'SFTP', label: 'SFTP - Secure FTP', icon: 'SafetyOutlined' },
  { value: 'S3', label: 'S3 - Object Storage (MinIO/AWS)', icon: 'CloudServerOutlined' },
  { value: 'HTTP', label: 'HTTP/WebDAV - Web API', icon: 'GlobalOutlined' },
  { value: 'SMB', label: 'SMB - Windows File Share', icon: 'WindowsOutlined' },
  { value: 'NFS', label: 'NFS - Network File System', icon: 'HddOutlined' },
  { value: 'Kafka', label: 'Kafka - Message Queue', icon: 'ApiOutlined' }
];

// Default ports for each protocol
export const PROTOCOL_DEFAULT_PORTS: Record<ConnectionType, number> = {
  Local: 0,
  FTP: 21,
  SFTP: 22,
  S3: 9000,
  HTTP: 80,
  SMB: 445,
  NFS: 2049,
  Kafka: 9092
};

// Development ports (Minikube NodePorts)
export const PROTOCOL_DEV_PORTS: Record<ConnectionType, number> = {
  Local: 0,
  FTP: 30021,
  SFTP: 30022,
  S3: 30900,
  HTTP: 30088,
  SMB: 445,  // Uses LoadBalancer
  NFS: 32149,
  Kafka: 9094
};
```

### 1.3 Connection Tab Component Updates

**File:** `src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx`

Add conditional rendering for each protocol:

```tsx
{/* S3/MinIO Configuration */}
{connectionType === 'S3' && (
  <>
    <Form.Item
      name="s3Endpoint"
      label="S3 Endpoint"
      rules={[{ required: true }]}
      tooltip="e.g., http://minio:9000 or https://s3.amazonaws.com"
    >
      <Input className="ltr-field" placeholder="http://localhost:30900" />
    </Form.Item>

    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="s3AccessKey" label="Access Key" rules={[{ required: true }]}>
          <Input className="ltr-field" placeholder="minioadmin" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="s3SecretKey" label="Secret Key" rules={[{ required: true }]}>
          <Input.Password className="ltr-field" placeholder="minioadmin123" />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="s3Bucket" label="Bucket Name" rules={[{ required: true }]}>
          <Input className="ltr-field" placeholder="input" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="s3Region" label="Region (Optional)">
          <Input className="ltr-field" placeholder="us-east-1" />
        </Form.Item>
      </Col>
    </Row>

    <Form.Item name="s3UsePathStyle" valuePropName="checked" initialValue={true}>
      <Checkbox>Use Path Style URLs (required for MinIO)</Checkbox>
    </Form.Item>

    <Form.Item name="connectionPath" label="Base Path (prefix)">
      <Input className="ltr-field" placeholder="/data/input" />
    </Form.Item>

    <Form.Item name="filePattern" label="File Pattern">
      <Input className="ltr-field" placeholder="*.csv" />
    </Form.Item>
  </>
)}

{/* SMB Configuration */}
{connectionType === 'SMB' && (
  <>
    <Row gutter={16}>
      <Col span={16}>
        <Form.Item name="connectionHost" label="SMB Server" rules={[{ required: true }]}>
          <Input className="ltr-field" placeholder="192.168.1.100" />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="connectionPort" label="Port" initialValue={445}>
          <InputNumber className="ltr-field" min={1} max={65535} />
        </Form.Item>
      </Col>
    </Row>

    <Form.Item name="smbShareName" label="Share Name" rules={[{ required: true }]}>
      <Input className="ltr-field" placeholder="simulator" />
    </Form.Item>

    <Form.Item name="smbDomain" label="Domain (Optional)">
      <Input className="ltr-field" placeholder="WORKGROUP" />
    </Form.Item>

    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="connectionUsername" label="Username" rules={[{ required: true }]}>
          <Input className="ltr-field" placeholder="smbuser" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="connectionPassword" label="Password" rules={[{ required: true }]}>
          <Input.Password className="ltr-field" />
        </Form.Item>
      </Col>
    </Row>

    <Form.Item name="connectionPath" label="Base Path">
      <Input className="ltr-field" placeholder="/output" />
    </Form.Item>

    <Form.Item name="filePattern" label="File Pattern">
      <Input className="ltr-field" placeholder="*.csv" />
    </Form.Item>

    <Alert
      type="warning"
      message="SMB requires LoadBalancer access. NTLM auth fails through proxies."
      style={{ marginTop: 8 }}
    />
  </>
)}

{/* NFS Configuration */}
{connectionType === 'NFS' && (
  <>
    <Alert
      type="info"
      message="NFS uses Kubernetes PersistentVolume mounting"
      description="Configure the NFS server at infrastructure level. The mount path below should match your PV mount."
      style={{ marginBottom: 16 }}
    />

    <Form.Item
      name="nfsMountPath"
      label="Mount Path"
      rules={[{ required: true }]}
      tooltip="Path where NFS is mounted in the container"
    >
      <Input className="ltr-field" placeholder="/mnt/nfs" />
    </Form.Item>

    <Form.Item name="connectionPath" label="Base Path (relative to mount)">
      <Input className="ltr-field" placeholder="/input" />
    </Form.Item>

    <Form.Item name="filePattern" label="File Pattern">
      <Input className="ltr-field" placeholder="*.csv" />
    </Form.Item>
  </>
)}
```

### 1.4 Output Destination Updates

**File:** `src/Frontend/src/components/datasource/shared/types.ts`

```typescript
// Update OutputDestination type to support all protocols
export type OutputDestinationType =
  | 'kafka'
  | 'folder'
  | 'sftp'
  | 'ftp'
  | 's3'
  | 'smb'
  | 'nfs'
  | 'http';

export interface OutputDestination {
  id: string;
  name: string;
  description?: string;
  type: OutputDestinationType;
  enabled: boolean;
  outputFormat?: 'original' | 'json' | 'csv' | 'xml' | null;

  // Protocol configs
  kafkaConfig?: KafkaOutputConfig;
  folderConfig?: FolderOutputConfig;
  sftpConfig?: SftpOutputConfig;
  ftpConfig?: FtpOutputConfig;
  s3Config?: S3OutputConfig;
  smbConfig?: SmbOutputConfig;
  nfsConfig?: NfsOutputConfig;
  httpConfig?: HttpOutputConfig;
}

// New output configs
export interface S3OutputConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
  usePathStyle: boolean;
  basePath?: string;
  filenamePattern?: string;
}

export interface SmbOutputConfig {
  host: string;
  port: number;
  shareName: string;
  domain?: string;
  username: string;
  password: string;
  basePath?: string;
  filenamePattern?: string;
}

export interface NfsOutputConfig {
  mountPath: string;
  basePath?: string;
  filenamePattern?: string;
  createSubfolders?: boolean;
}

export interface FtpOutputConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  basePath?: string;
  filenamePattern?: string;
  useSsl?: boolean;
  usePassiveMode?: boolean;
}
```

### 1.5 Output Tab / Destination Editor Modal Updates

**File:** `src/Frontend/src/components/datasource/modals/DestinationEditorModal.tsx`

Add new output type options and corresponding form fields for S3, SMB, NFS, FTP outputs (similar structure to existing SFTP/Folder/Kafka).

### 1.6 Connection Test API Updates

**File:** `src/Frontend/src/api/connection-test-api-client.ts`

```typescript
export const testS3Connection = async (config: S3ConnectionConfig): Promise<boolean> => {
  const response = await fetch(`${API_BASE}/api/v1/datasource/test-connection/s3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return response.ok;
};

export const testSmbConnection = async (config: SmbConnectionConfig): Promise<boolean> => {
  const response = await fetch(`${API_BASE}/api/v1/datasource/test-connection/smb`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return response.ok;
};

export const testNfsConnection = async (config: NfsConnectionConfig): Promise<boolean> => {
  const response = await fetch(`${API_BASE}/api/v1/datasource/test-connection/nfs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return response.ok;
};
```

### 1.7 Hebrew Localization

**File:** `src/Frontend/src/locales/he/translation.json`

```json
{
  "datasource": {
    "connectionTypes": {
      "s3": "S3 - אחסון אובייקטים",
      "smb": "SMB - שיתוף קבצי Windows",
      "nfs": "NFS - מערכת קבצי רשת"
    },
    "s3": {
      "endpoint": "נקודת קצה S3",
      "accessKey": "מפתח גישה",
      "secretKey": "מפתח סודי",
      "bucket": "שם הדלי",
      "region": "אזור",
      "usePathStyle": "השתמש בכתובות בסגנון נתיב (נדרש עבור MinIO)"
    },
    "smb": {
      "shareName": "שם השיתוף",
      "domain": "דומיין",
      "warning": "SMB דורש גישת LoadBalancer. אימות NTLM נכשל דרך פרוקסים."
    },
    "nfs": {
      "mountPath": "נתיב הרכבה",
      "info": "NFS משתמש בהרכבת PersistentVolume של Kubernetes"
    }
  }
}
```

---

## Part 2: Backend Service Changes

### 2.1 New NuGet Packages

**Add to all services that need file access:**

```xml
<!-- src/Services/Shared/Shared.csproj -->
<PackageReference Include="FluentFTP" Version="50.0.1" />
<PackageReference Include="SSH.NET" Version="2024.1.0" />
<PackageReference Include="AWSSDK.S3" Version="3.7.305.23" />
<PackageReference Include="SMBLibrary" Version="1.5.3" />
```

### 2.2 New Connector Implementations

#### S3Connector

**File:** `src/Services/Shared/Connectors/S3Connector.cs`

```csharp
using Amazon.S3;
using Amazon.S3.Model;

namespace DataProcessing.Shared.Connectors;

public class S3Connector : IDataSourceConnector
{
    private readonly ILogger<S3Connector> _logger;

    public string ConnectorType => "s3";

    public S3Connector(ILogger<S3Connector> logger)
    {
        _logger = logger;
    }

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken ct = default)
    {
        var client = CreateClient(dataSource);
        var (bucket, key) = ParsePath(filePath, dataSource);

        var response = await client.GetObjectAsync(bucket, key, ct);
        var ms = new MemoryStream();
        await response.ResponseStream.CopyToAsync(ms, ct);
        ms.Position = 0;

        _logger.LogInformation("S3 read {Size} bytes from {Bucket}/{Key}", ms.Length, bucket, key);
        return ms;
    }

    public async Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource,
        string pattern,
        CancellationToken ct = default)
    {
        var client = CreateClient(dataSource);
        var bucket = GetBucket(dataSource);
        var prefix = GetBasePath(dataSource);

        var files = new List<string>();
        var request = new ListObjectsV2Request { BucketName = bucket, Prefix = prefix };

        ListObjectsV2Response response;
        do
        {
            response = await client.ListObjectsV2Async(request, ct);
            foreach (var obj in response.S3Objects)
            {
                var name = Path.GetFileName(obj.Key);
                if (MatchesPattern(name, pattern))
                    files.Add($"{bucket}/{obj.Key}");
            }
            request.ContinuationToken = response.NextContinuationToken;
        } while (response.IsTruncated);

        return files;
    }

    public async Task<bool> TestConnectionAsync(
        DataProcessingDataSource dataSource,
        CancellationToken ct = default)
    {
        try
        {
            var client = CreateClient(dataSource);
            await client.ListBucketsAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "S3 connection test failed");
            return false;
        }
    }

    public async Task<FileMetadata> GetFileMetadataAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken ct = default)
    {
        var client = CreateClient(dataSource);
        var (bucket, key) = ParsePath(filePath, dataSource);

        var metadata = await client.GetObjectMetadataAsync(bucket, key, ct);

        return new FileMetadata
        {
            FilePath = filePath,
            FileName = Path.GetFileName(key),
            FileSizeBytes = metadata.ContentLength,
            LastModifiedUtc = metadata.LastModified,
            ContentType = metadata.Headers.ContentType ?? "application/octet-stream"
        };
    }

    private AmazonS3Client CreateClient(DataProcessingDataSource dataSource)
    {
        var config = dataSource.AdditionalConfiguration;
        var endpoint = config.GetValue("S3Endpoint", "http://localhost:9000").AsString;
        var accessKey = config.GetValue("S3AccessKey", "minioadmin").AsString;
        var secretKey = config.GetValue("S3SecretKey", "minioadmin123").AsString;
        var usePathStyle = config.Contains("S3UsePathStyle")
            ? config["S3UsePathStyle"].AsBoolean
            : true;

        var s3Config = new AmazonS3Config
        {
            ServiceURL = endpoint,
            ForcePathStyle = usePathStyle,
            UseHttp = !endpoint.StartsWith("https")
        };

        return new AmazonS3Client(accessKey, secretKey, s3Config);
    }

    private string GetBucket(DataProcessingDataSource dataSource) =>
        dataSource.AdditionalConfiguration.GetValue("S3Bucket", "input").AsString;

    private string GetBasePath(DataProcessingDataSource dataSource) =>
        dataSource.AdditionalConfiguration.GetValue("S3BasePath", "").AsString.TrimStart('/');

    private (string bucket, string key) ParsePath(string path, DataProcessingDataSource dataSource)
    {
        if (path.Contains('/'))
        {
            var parts = path.TrimStart('/').Split('/', 2);
            return (parts[0], parts.Length > 1 ? parts[1] : "");
        }
        return (GetBucket(dataSource), path);
    }

    private static bool MatchesPattern(string name, string pattern)
    {
        var regex = "^" + Regex.Escape(pattern)
            .Replace("\\*", ".*")
            .Replace("\\?", ".") + "$";
        return Regex.IsMatch(name, regex, RegexOptions.IgnoreCase);
    }
}
```

#### SmbConnector

**File:** `src/Services/Shared/Connectors/SmbConnector.cs`

```csharp
using SMBLibrary;
using SMBLibrary.Client;

namespace DataProcessing.Shared.Connectors;

public class SmbConnector : IDataSourceConnector, IDisposable
{
    private readonly ILogger<SmbConnector> _logger;
    private SMB2Client? _client;
    private ISMBFileStore? _fileStore;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public string ConnectorType => "smb";

    // Implementation similar to file-simulator SmbFileService
    // See FileProtocolServices.cs lines 733-1018 for full implementation
}
```

#### NfsConnector

**File:** `src/Services/Shared/Connectors/NfsConnector.cs`

```csharp
namespace DataProcessing.Shared.Connectors;

public class NfsConnector : IDataSourceConnector
{
    private readonly ILogger<NfsConnector> _logger;

    public string ConnectorType => "nfs";

    public NfsConnector(ILogger<NfsConnector> logger)
    {
        _logger = logger;
    }

    public async Task<Stream> ReadFileAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken ct = default)
    {
        var fullPath = GetFullPath(dataSource, filePath);
        var content = await File.ReadAllBytesAsync(fullPath, ct);
        return new MemoryStream(content);
    }

    public Task<List<string>> ListFilesAsync(
        DataProcessingDataSource dataSource,
        string pattern,
        CancellationToken ct = default)
    {
        var basePath = GetBasePath(dataSource);
        var files = Directory.GetFiles(basePath, pattern)
            .Select(f => Path.GetRelativePath(basePath, f))
            .ToList();
        return Task.FromResult(files);
    }

    public Task<bool> TestConnectionAsync(
        DataProcessingDataSource dataSource,
        CancellationToken ct = default)
    {
        var mountPath = GetMountPath(dataSource);
        return Task.FromResult(Directory.Exists(mountPath));
    }

    public Task<FileMetadata> GetFileMetadataAsync(
        DataProcessingDataSource dataSource,
        string filePath,
        CancellationToken ct = default)
    {
        var fullPath = GetFullPath(dataSource, filePath);
        var fi = new FileInfo(fullPath);

        return Task.FromResult(new FileMetadata
        {
            FilePath = filePath,
            FileName = fi.Name,
            FileSizeBytes = fi.Length,
            LastModifiedUtc = fi.LastWriteTimeUtc,
            ContentType = GetContentType(fi.Extension)
        });
    }

    private string GetMountPath(DataProcessingDataSource dataSource) =>
        dataSource.AdditionalConfiguration.GetValue("NfsMountPath", "/mnt/nfs").AsString;

    private string GetBasePath(DataProcessingDataSource dataSource)
    {
        var mountPath = GetMountPath(dataSource);
        var relativePath = dataSource.FilePath?.TrimStart('/') ?? "";
        return Path.Combine(mountPath, relativePath);
    }

    private string GetFullPath(DataProcessingDataSource dataSource, string filePath) =>
        Path.Combine(GetBasePath(dataSource), filePath.TrimStart('/'));

    private static string GetContentType(string ext) => ext.ToLower() switch
    {
        ".csv" => "text/csv",
        ".json" => "application/json",
        ".xml" => "application/xml",
        ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        _ => "application/octet-stream"
    };
}
```

### 2.3 Connector Factory Implementation

**File:** `src/Services/Shared/Connectors/ConnectorFactory.cs`

```csharp
namespace DataProcessing.Shared.Connectors;

public interface IConnectorFactory
{
    IDataSourceConnector GetConnector(string connectorType);
    IDataSourceConnector GetConnector(DataProcessingDataSource dataSource);
}

public class ConnectorFactory : IConnectorFactory
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ConnectorFactory> _logger;

    public ConnectorFactory(IServiceProvider serviceProvider, ILogger<ConnectorFactory> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public IDataSourceConnector GetConnector(string connectorType)
    {
        return connectorType.ToLowerInvariant() switch
        {
            "local" => _serviceProvider.GetRequiredService<LocalFileConnector>(),
            "ftp" => _serviceProvider.GetRequiredService<FtpConnector>(),
            "sftp" => _serviceProvider.GetRequiredService<SftpConnector>(),
            "s3" => _serviceProvider.GetRequiredService<S3Connector>(),
            "http" => _serviceProvider.GetRequiredService<HttpApiConnector>(),
            "smb" => _serviceProvider.GetRequiredService<SmbConnector>(),
            "nfs" => _serviceProvider.GetRequiredService<NfsConnector>(),
            "kafka" => _serviceProvider.GetRequiredService<KafkaConnector>(),
            _ => throw new ArgumentException($"Unknown connector type: {connectorType}")
        };
    }

    public IDataSourceConnector GetConnector(DataProcessingDataSource dataSource)
    {
        // Determine connector type from configuration
        var connectorType = DetermineConnectorType(dataSource);
        _logger.LogDebug("Resolved connector type {Type} for datasource {Name}",
            connectorType, dataSource.Name);
        return GetConnector(connectorType);
    }

    private string DetermineConnectorType(DataProcessingDataSource dataSource)
    {
        // Check AdditionalConfiguration for explicit type
        if (dataSource.AdditionalConfiguration.Contains("ConnectorType"))
            return dataSource.AdditionalConfiguration["ConnectorType"].AsString;

        // Check connectionConfig.type from configurationSettings
        if (!string.IsNullOrEmpty(dataSource.ConfigurationSettings))
        {
            try
            {
                var config = JsonSerializer.Deserialize<JsonElement>(dataSource.ConfigurationSettings);
                if (config.TryGetProperty("connectionConfig", out var connConfig) &&
                    connConfig.TryGetProperty("type", out var typeElement))
                {
                    return typeElement.GetString()?.ToLower() ?? "local";
                }
            }
            catch { }
        }

        // Fallback: detect from FilePath prefix
        var path = dataSource.FilePath ?? "";
        if (path.StartsWith("s3://") || path.StartsWith("minio://")) return "s3";
        if (path.StartsWith("ftp://")) return "ftp";
        if (path.StartsWith("sftp://")) return "sftp";
        if (path.StartsWith("http://") || path.StartsWith("https://")) return "http";
        if (path.StartsWith("\\\\") || path.StartsWith("smb://")) return "smb";

        // Default to local
        return "local";
    }
}
```

### 2.4 Service Registration Updates

**File:** `src/Services/Shared/Configuration/ConnectorConfiguration.cs`

```csharp
namespace DataProcessing.Shared.Configuration;

public static class ConnectorConfiguration
{
    public static IServiceCollection AddFileConnectors(this IServiceCollection services)
    {
        // Register all connectors
        services.AddScoped<LocalFileConnector>();
        services.AddScoped<FtpConnector>();
        services.AddScoped<SftpConnector>();
        services.AddScoped<S3Connector>();
        services.AddScoped<HttpApiConnector>();
        services.AddScoped<SmbConnector>();
        services.AddScoped<NfsConnector>();
        services.AddScoped<KafkaConnector>();

        // Register factory
        services.AddScoped<IConnectorFactory, ConnectorFactory>();

        return services;
    }
}
```

### 2.5 FileDiscoveryService Updates

**File:** `src/Services/FileDiscoveryService/Workers/FileDiscoveryWorker.cs`

```csharp
// Update to use ConnectorFactory instead of hardcoded LocalFileConnector

private readonly IConnectorFactory _connectorFactory;

public FileDiscoveryWorker(
    IConnectorFactory connectorFactory,
    // ... other deps
)
{
    _connectorFactory = connectorFactory;
}

private async Task<List<FileMetadata>> DiscoverFilesAsync(
    DataProcessingDataSource datasource,
    string correlationId)
{
    // Get appropriate connector based on datasource configuration
    var connector = _connectorFactory.GetConnector(datasource);

    _logger.LogInformation(
        "Using {ConnectorType} connector for datasource {Name}",
        connector.ConnectorType, datasource.Name);

    // Use connector to list and get metadata for files
    var pattern = datasource.FilePattern ?? "*";
    var files = await connector.ListFilesAsync(datasource, pattern);

    var metadata = new List<FileMetadata>();
    foreach (var file in files)
    {
        var meta = await connector.GetFileMetadataAsync(datasource, file);
        metadata.Add(meta);
    }

    return metadata;
}
```

### 2.6 FileProcessorService Updates

**File:** `src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs`

```csharp
// Similar update to use ConnectorFactory
private readonly IConnectorFactory _connectorFactory;

protected override async Task ProcessMessageAsync(
    FileDiscoveredEvent message,
    ConsumeContext<FileDiscoveredEvent> context)
{
    var datasource = await _repository.GetByIdAsync(message.DataSourceId);
    var connector = _connectorFactory.GetConnector(datasource);

    // Read file content via connector
    using var stream = await connector.ReadFileAsync(
        datasource,
        message.FilePath,
        context.CancellationToken);

    // Continue with format conversion and processing...
}
```

### 2.7 OutputService Updates - New Output Handlers

**File:** `src/Services/OutputService/Handlers/S3OutputHandler.cs`

```csharp
namespace DataProcessing.Output.Handlers;

public class S3OutputHandler : IOutputHandler
{
    public string HandlerType => "s3";

    public async Task WriteAsync(
        OutputDestinationConfig config,
        byte[] content,
        string filename,
        CancellationToken ct = default)
    {
        var s3Config = config.S3Config
            ?? throw new ArgumentException("S3 config required");

        var clientConfig = new AmazonS3Config
        {
            ServiceURL = s3Config.Endpoint,
            ForcePathStyle = s3Config.UsePathStyle
        };

        using var client = new AmazonS3Client(
            s3Config.AccessKey,
            s3Config.SecretKey,
            clientConfig);

        var key = BuildKey(s3Config.BasePath, filename);

        using var stream = new MemoryStream(content);
        var request = new PutObjectRequest
        {
            BucketName = s3Config.Bucket,
            Key = key,
            InputStream = stream
        };

        await client.PutObjectAsync(request, ct);
    }

    private string BuildKey(string? basePath, string filename)
    {
        if (string.IsNullOrEmpty(basePath))
            return filename;
        return $"{basePath.TrimEnd('/')}/{filename}";
    }
}
```

Create similar handlers: `SmbOutputHandler.cs`, `NfsOutputHandler.cs`, `FtpOutputHandler.cs`

---

## Part 3: Kubernetes Configuration

### 3.1 Development Environment (Minikube)

#### ConfigMap for File Simulator Access

**File:** `k8s/configmaps/file-simulator-config.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: file-simulator-config
  namespace: ez-platform
data:
  # File Simulator cluster IP (update after installation)
  SIMULATOR_HOST: "172.23.17.71"

  # FTP Configuration
  FILE_FTP_HOST: "172.23.17.71"
  FILE_FTP_PORT: "30021"
  FILE_FTP_USERNAME: "ftpuser"
  FILE_FTP_PASSWORD: "ftppass123"

  # SFTP Configuration
  FILE_SFTP_HOST: "172.23.17.71"
  FILE_SFTP_PORT: "30022"
  FILE_SFTP_USERNAME: "sftpuser"
  FILE_SFTP_PASSWORD: "sftppass123"

  # S3/MinIO Configuration
  FILE_S3_ENDPOINT: "http://172.23.17.71:30900"
  FILE_S3_ACCESS_KEY: "minioadmin"
  FILE_S3_SECRET_KEY: "minioadmin123"
  FILE_S3_BUCKET: "simulator"
  FILE_S3_USE_PATH_STYLE: "true"

  # HTTP/WebDAV Configuration
  FILE_HTTP_BASE_URL: "http://172.23.17.71:30088"
  FILE_WEBDAV_BASE_URL: "http://172.23.17.71:30089"
  FILE_HTTP_USERNAME: "httpuser"
  FILE_HTTP_PASSWORD: "httppass123"

  # SMB Configuration (requires LoadBalancer)
  FILE_SMB_HOST: "10.101.173.233"  # LoadBalancer IP
  FILE_SMB_PORT: "445"
  FILE_SMB_SHARE: "simulator"
  FILE_SMB_DOMAIN: "WORKGROUP"
  FILE_SMB_USERNAME: "smbuser"
  FILE_SMB_PASSWORD: "smbpass123"

  # NFS Configuration
  FILE_NFS_HOST: "172.23.17.71"
  FILE_NFS_PORT: "32149"
  FILE_NFS_MOUNT_PATH: "/mnt/nfs"
```

#### NFS PersistentVolume for Development

**File:** `k8s/storage/nfs-pv-dev.yaml`

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: file-simulator-nfs-pv
  namespace: ez-platform
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 172.23.17.71  # File simulator cluster IP
    path: /               # NFSv4 pseudo-root (fsid=0)
  mountOptions:
    - nfsvers=4
    - port=32149
    - nolock
    - soft
    - timeo=30
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: file-simulator-nfs-pvc
  namespace: ez-platform
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
  volumeName: file-simulator-nfs-pv
```

#### Updated Deployment with NFS Mount

**File:** `k8s/deployments/filediscovery-deployment.yaml` (additions)

```yaml
spec:
  template:
    spec:
      containers:
      - name: filediscovery
        envFrom:
          - configMapRef:
              name: services-config
          - configMapRef:
              name: file-simulator-config  # Add file simulator config
        volumeMounts:
          - name: nfs-data
            mountPath: /mnt/nfs
            readOnly: false
      volumes:
        - name: nfs-data
          persistentVolumeClaim:
            claimName: file-simulator-nfs-pvc
```

### 3.2 Production Environment (OCP)

#### Secret for Credentials

**File:** `k8s/secrets/file-access-secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: file-access-secrets
  namespace: ez-platform
type: Opaque
stringData:
  # FTP
  FILE_FTP_PASSWORD: "${FTP_PASSWORD}"

  # SFTP
  FILE_SFTP_PASSWORD: "${SFTP_PASSWORD}"

  # S3
  FILE_S3_ACCESS_KEY: "${S3_ACCESS_KEY}"
  FILE_S3_SECRET_KEY: "${S3_SECRET_KEY}"

  # SMB
  FILE_SMB_PASSWORD: "${SMB_PASSWORD}"

  # HTTP
  FILE_HTTP_PASSWORD: "${HTTP_PASSWORD}"
```

#### Production ConfigMap

**File:** `k8s/configmaps/file-access-config-prod.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: file-access-config
  namespace: ez-platform
data:
  # FTP Configuration
  FILE_FTP_HOST: "${PROD_FTP_HOST}"
  FILE_FTP_PORT: "21"
  FILE_FTP_USERNAME: "${PROD_FTP_USER}"

  # SFTP Configuration
  FILE_SFTP_HOST: "${PROD_SFTP_HOST}"
  FILE_SFTP_PORT: "22"
  FILE_SFTP_USERNAME: "${PROD_SFTP_USER}"

  # S3 Configuration
  FILE_S3_ENDPOINT: "${PROD_S3_ENDPOINT}"
  FILE_S3_BUCKET: "${PROD_S3_BUCKET}"
  FILE_S3_USE_PATH_STYLE: "false"  # AWS uses virtual-hosted style

  # NFS Mount Path (OCP will mount via PV)
  FILE_NFS_MOUNT_PATH: "/mnt/nfs"
```

#### OCP NFS PersistentVolume

**File:** `k8s/storage/nfs-pv-ocp.yaml`

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: ez-platform-nfs-pv
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: nfs-server.prod.internal  # Production NFS server
    path: /exports/ez-platform
  mountOptions:
    - nfsvers=4.1
    - hard
    - timeo=600
    - retrans=2
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ez-platform-nfs-pvc
  namespace: ez-platform
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 100Gi
  storageClassName: ""  # Empty to use pre-provisioned PV
```

#### OCP Network Policies

**File:** `k8s/network-policies/file-access-egress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-file-access-egress
  namespace: ez-platform
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/component: file-processor
  policyTypes:
    - Egress
  egress:
    # Allow FTP
    - to:
        - ipBlock:
            cidr: 10.0.0.0/8
      ports:
        - protocol: TCP
          port: 21
        - protocol: TCP
          port: 20

    # Allow SFTP
    - to:
        - ipBlock:
            cidr: 10.0.0.0/8
      ports:
        - protocol: TCP
          port: 22

    # Allow S3 (HTTPS)
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
      ports:
        - protocol: TCP
          port: 443

    # Allow NFS
    - to:
        - ipBlock:
            cidr: 10.0.0.0/8
      ports:
        - protocol: TCP
          port: 2049

    # Allow SMB
    - to:
        - ipBlock:
            cidr: 10.0.0.0/8
      ports:
        - protocol: TCP
          port: 445
```

---

## Part 4: Implementation Tasks

### Phase 1: Backend Foundation (Week 1)

| Task | Priority | Complexity |
|------|----------|------------|
| Add NuGet packages (AWSSDK.S3, SMBLibrary) | High | Low |
| Create S3Connector | High | Medium |
| Create SmbConnector | High | Medium |
| Create NfsConnector | High | Low |
| Create ConnectorFactory | High | Medium |
| Update Shared project registration | High | Low |

### Phase 2: Service Integration (Week 2)

| Task | Priority | Complexity |
|------|----------|------------|
| Update FileDiscoveryService to use ConnectorFactory | High | Medium |
| Update FileProcessorService to use ConnectorFactory | High | Medium |
| Create S3OutputHandler | High | Medium |
| Create SmbOutputHandler | Medium | Medium |
| Create NfsOutputHandler | Medium | Low |
| Create FtpOutputHandler | Medium | Medium |
| Update OutputService handler registration | High | Low |

### Phase 3: Frontend Changes (Week 3)

| Task | Priority | Complexity |
|------|----------|------------|
| Update TypeScript types | High | Low |
| Update constants (CONNECTION_TYPE_OPTIONS) | High | Low |
| Add S3 configuration fields to ConnectionTab | High | Medium |
| Add SMB configuration fields to ConnectionTab | High | Medium |
| Add NFS configuration fields to ConnectionTab | High | Low |
| Update OutputTab for new destinations | Medium | Medium |
| Update DestinationEditorModal | Medium | Medium |
| Add Hebrew translations | Medium | Low |
| Add connection test APIs | Medium | Medium |

### Phase 4: Kubernetes Configuration (Week 4)

| Task | Priority | Complexity |
|------|----------|------------|
| Create file-simulator-config ConfigMap | High | Low |
| Create NFS PV/PVC for development | High | Medium |
| Update deployment manifests with volume mounts | High | Medium |
| Create OCP production ConfigMap template | Medium | Low |
| Create OCP Secret template | Medium | Low |
| Create OCP NFS PV/PVC | Medium | Medium |
| Create Network Policies for OCP | Medium | Medium |

### Phase 5: Testing & Validation (Week 5)

| Task | Priority | Complexity |
|------|----------|------------|
| Test FTP connector against simulator | High | Low |
| Test SFTP connector against simulator | High | Low |
| Test S3 connector against simulator | High | Low |
| Test SMB connector against simulator | Medium | Medium |
| Test NFS connector against simulator | High | Low |
| Test output handlers | High | Medium |
| End-to-end pipeline test | High | High |
| Document configuration for production | Medium | Low |

---

## Part 5: Environment-Specific Notes

### Development (Minikube)

1. **File Simulator Cluster Required**: Install file-simulator-suite in separate Minikube profile
2. **Cross-Cluster Access**: Use Minikube IP + NodePorts
3. **SMB Limitation**: Requires LoadBalancer IP (run `minikube tunnel`)
4. **NFS**: Mount via NFSv4 single port (32149)

```powershell
# Get simulator IP
minikube ip --profile file-simulator

# Update ConfigMap with IP
kubectl apply -f k8s/configmaps/file-simulator-config.yaml
```

### Production (OCP)

1. **Credentials in Secrets**: Never store passwords in ConfigMaps
2. **NFS via PV**: Use enterprise NFS server with proper mount options
3. **Network Policies**: Restrict egress to known file server IPs
4. **TLS/SSL**: Enable for FTP (FTPS), HTTP (HTTPS), S3 (HTTPS)
5. **SMB Considerations**: May require dedicated LoadBalancer or avoid due to NTLM constraints

---

## Summary

This plan provides a complete integration of 6 file protocols (FTP, SFTP, S3, HTTP, SMB, NFS) for both input (FileDiscovery, FileProcessor) and output (OutputService) operations, with full frontend configuration support and environment-specific Kubernetes configurations for development (Minikube + file-simulator) and production (OCP).

**Key Design Decisions:**
1. **ConnectorFactory Pattern**: Dynamic connector resolution based on datasource configuration
2. **Unified Interface**: All connectors implement `IDataSourceConnector`
3. **Environment Abstraction**: ConfigMaps for environment-specific endpoints
4. **Security First**: Secrets for credentials in production, Network Policies for egress control
5. **NFS for Shared Access**: Best performance for multi-pod file sharing
