// TestConfiguration.cs - Integration Test Configuration
// EZ Platform Integration Tests
// Version: 1.0
// Date: December 17, 2025

namespace DataProcessing.IntegrationTests;

/// <summary>
/// Configuration settings for integration tests
/// Uses environment variables with sensible defaults for local K8s testing
/// </summary>
public static class TestConfiguration
{
    // Kafka Configuration (port-forwarded from K8s via external listener)
    public static string KafkaBootstrapServers =>
        Environment.GetEnvironmentVariable("KAFKA_BOOTSTRAP_SERVERS") ?? "localhost:9094";

    // MongoDB Configuration (port-forwarded from K8s)
    // Note: directConnection=true is required because MongoDB in K8s is configured as a replica set
    // and advertises its internal K8s addresses. Without directConnection, the driver would try
    // to connect to the replica set members using their internal addresses.
    public static string MongoDbConnectionString =>
        Environment.GetEnvironmentVariable("MONGODB_CONNECTION_STRING") ?? "mongodb://localhost:27017/?directConnection=true";

    public static string MongoDbDatabase =>
        Environment.GetEnvironmentVariable("MONGODB_DATABASE") ?? "ez_platform";

    // Hazelcast Configuration (port-forwarded from K8s)
    public static string HazelcastAddress =>
        Environment.GetEnvironmentVariable("HAZELCAST_ADDRESS") ?? "localhost:5701";

    // Service API Endpoints (port-forwarded from K8s)
    public static string DatasourceManagementUrl =>
        Environment.GetEnvironmentVariable("DATASOURCE_MGMT_URL") ?? "http://localhost:5001";

    public static string FileDiscoveryUrl =>
        Environment.GetEnvironmentVariable("FILEDISCOVERY_URL") ?? "http://localhost:5002";

    public static string ValidationUrl =>
        Environment.GetEnvironmentVariable("VALIDATION_URL") ?? "http://localhost:5003";

    public static string OutputUrl =>
        Environment.GetEnvironmentVariable("OUTPUT_URL") ?? "http://localhost:5009";

    public static string InvalidRecordsUrl =>
        Environment.GetEnvironmentVariable("INVALIDRECORDS_URL") ?? "http://localhost:5007";

    public static string FrontendUrl =>
        Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://localhost:3000";

    // Kafka Topics
    public static class KafkaTopics
    {
        public const string FileDiscovered = "file-discovered";
        public const string FileProcessed = "file-processed";
        public const string RecordValidated = "record-validated";
        public const string InvalidRecord = "invalid-record";
        public const string RecordOutput = "record-output";
    }

    // Test Data Paths (host-mounted into K8s)
    public static string TestDataBasePath =>
        Environment.GetEnvironmentVariable("TEST_DATA_PATH") ?? @"C:\Users\UserC\source\repos\EZ\test-data";

    public static string E2E001DataPath => Path.Combine(TestDataBasePath, "E2E-001");
    public static string E2E003DataPath => Path.Combine(TestDataBasePath, "E2E-003");
    public static string E2E004DataPath => Path.Combine(TestDataBasePath, "E2E-004");
    public static string E2E005DataPath => Path.Combine(TestDataBasePath, "E2E-005");
    public static string E2E006DataPath => Path.Combine(TestDataBasePath, "E2E-006");

    // Test Timeouts
    public static TimeSpan DefaultTimeout => TimeSpan.FromSeconds(30);
    public static TimeSpan KafkaMessageTimeout => TimeSpan.FromSeconds(60);
    public static TimeSpan PipelineProcessingTimeout => TimeSpan.FromMinutes(2);

    // ========== File-Simulator Configuration ==========

    /// <summary>
    /// File-simulator IP address from environment variable or default
    /// </summary>
    public static string FileSimulatorIp =>
        Environment.GetEnvironmentVariable("FILE_SIMULATOR_IP") ?? FileSimulator.DefaultIp;

    /// <summary>
    /// File-simulator protocol endpoints configuration
    /// </summary>
    public static class FileSimulator
    {
        /// <summary>
        /// Default file-simulator Minikube IP (Hyper-V)
        /// Set FILE_SIMULATOR_IP environment variable to override
        /// </summary>
        public const string DefaultIp = "172.25.201.3";

        // Protocol NodePorts
        public const int FtpPort = 30021;
        public const int SftpPort = 30022;
        public const int S3Port = 30900;
        public const int HttpPort = 30088;
        public const int WebDavPort = 30089;

        // NFS NodePorts (mapped by NAS role)
        public const int NfsInputPort1 = 32150;
        public const int NfsInputPort2 = 32151;
        public const int NfsOutputPort1 = 32152;
        public const int NfsOutputPort2 = 32153;
        public const int NfsBackupPort1 = 32154;
        public const int NfsBackupPort2 = 32155;
        public const int NfsBothPort = 32156;
    }
}
