namespace DemoDataGenerator.Models;

/// <summary>
/// Represents a server instance reported by the file-simulator Control API
/// </summary>
public record SimulatorServer
{
    public string Name { get; init; } = "";
    public string Protocol { get; init; } = "";
    public bool IsDynamic { get; init; }
    public string Status { get; init; } = "";
    public bool IsHealthy { get; init; }
    public string Host { get; init; } = "";
    public int Port { get; init; }
    public int Replicas { get; init; }
    public int ReadyReplicas { get; init; }
}

/// <summary>
/// Connection information for all protocols served by file-simulator
/// </summary>
public record SimulatorConnectionInfo
{
    public string Hostname { get; init; } = "";
    public SimulatorFtpInfo? Ftp { get; init; }
    public SimulatorSftpInfo? Sftp { get; init; }
    public SimulatorHttpInfo? Http { get; init; }
    public SimulatorS3Info? S3 { get; init; }
    public SimulatorKafkaInfo? Kafka { get; init; }
    public List<SimulatorNasInfo>? Nas { get; init; }
}

/// <summary>
/// NAS/NFS server connection details from file-simulator
/// </summary>
public record SimulatorNasInfo
{
    public string Name { get; init; } = "";
    public string Host { get; init; } = "";
    public int Port { get; init; }
    public string Path { get; init; } = "";
}

/// <summary>
/// FTP server connection details from file-simulator
/// </summary>
public record SimulatorFtpInfo
{
    public string Host { get; init; } = "";
    public int Port { get; init; }
    public string Username { get; init; } = "";
    public string Password { get; init; } = "";
}

/// <summary>
/// SFTP server connection details from file-simulator
/// </summary>
public record SimulatorSftpInfo
{
    public string Host { get; init; } = "";
    public int Port { get; init; }
    public string Username { get; init; } = "";
    public string Password { get; init; } = "";
}

/// <summary>
/// HTTP/WebDAV server connection details from file-simulator
/// </summary>
public record SimulatorHttpInfo
{
    public string Host { get; init; } = "";
    public int Port { get; init; }
    public string Username { get; init; } = "";
    public string Password { get; init; } = "";
}

/// <summary>
/// S3-compatible (MinIO) connection details from file-simulator
/// </summary>
public record SimulatorS3Info
{
    public string Endpoint { get; init; } = "";
    public string AccessKey { get; init; } = "";
    public string SecretKey { get; init; } = "";
    public string Region { get; init; } = "";
    public string InputBucket { get; init; } = "";
    public string OutputBucket { get; init; } = "";
}

/// <summary>
/// Kafka connection details from file-simulator
/// </summary>
public record SimulatorKafkaInfo
{
    public string BootstrapServers { get; init; } = "";
    public int Port { get; init; }
}
