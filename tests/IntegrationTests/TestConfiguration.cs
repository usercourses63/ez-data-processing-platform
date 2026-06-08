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
    //
    // IMPORTANT (verified against the live ez-platform cluster, 2026-06-08):
    // The internal processing pipeline (FileDiscovery -> FileProcessor -> Validation
    // -> Output) is driven over the **RabbitMQ base bus** via MassTransit
    // (UsingRabbitMq + ConfigureEndpoints in each service's Program.cs), NOT over
    // these plain Kafka topics. No deployed service publishes a `FileDiscoveredEvent`
    // to the Kafka `file-discovered` topic, consumes it, or produces a `file-processed`
    // topic (which does not exist on the broker at all). These topic names exist on the
    // broker only because the integration tests themselves auto-create them on
    // produce/subscribe. Consequently, the Pipeline*/Format* tests that publish to
    // `file-discovered` and then wait on `file-processed`/`record-validated`/
    // `record-output` will NEVER observe a downstream message and would otherwise hang
    // for the full timeout on every test. They are kept as soft (best-effort) probes
    // (`if (result != null)`); the AUTHORITATIVE end-to-end proof is the MinIO->MinIO
    // round-trip verified out-of-band (input bucket -> Output writes converted JSON to
    // the output bucket). See PipelineWaitTimeout below.
    //
    // CANONICAL PIPELINE-OUTPUT ASSERTION (Phase 35-04, SC-6):
    //   tests/IntegrationTests/Pipeline/MinioOutputPipelineTests.cs is the canonical
    //   test that asserts the converted output object directly in the MinIO **output**
    //   bucket (ez-phase34-output/processed/) via S3 ListObjectsV2 + GetObject — never a
    //   Kafka topic. New pipeline-output assertions should follow that pattern, NOT the
    //   Kafka-topic soft-probes below. (The MinIO env defaults — buckets/creds/wait —
    //   live in that test file and are overridable via MINIO_* environment variables.)
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

    /// <summary>
    /// Short, bounded wait used by the pipeline soft-probes that watch the Kafka
    /// intermediate topics. Because the live pipeline runs over RabbitMQ (see the
    /// KafkaTopics note above), those probes will never observe a downstream message,
    /// so a long wait only makes the suite hang. Override with PIPELINE_WAIT_SECONDS.
    /// </summary>
    public static TimeSpan PipelineWaitTimeout =>
        TimeSpan.FromSeconds(
            int.TryParse(Environment.GetEnvironmentVariable("PIPELINE_WAIT_SECONDS"), out var s) ? s : 5);

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
