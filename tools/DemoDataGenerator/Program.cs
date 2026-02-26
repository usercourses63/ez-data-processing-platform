using System.Diagnostics;
using Microsoft.Extensions.Configuration;
using MongoDB.Entities;
using DemoDataGenerator.Services;
using DemoDataGenerator.Generators;
using DemoDataGenerator.Models;
using DataProcessing.Shared.Entities;

Console.OutputEncoding = System.Text.Encoding.UTF8;

Console.WriteLine("═══════════════════════════════════════════════");
Console.WriteLine("    Demo Data Generator for EZ Platform    ");
Console.WriteLine("═══════════════════════════════════════════════\n");

// Parse command line arguments
bool incrementalMode = args.Contains("--incremental");
bool useSimulator = args.Contains("--use-simulator");
bool discoverOnly = args.Contains("--discover-only");
bool createServers = args.Contains("--create-servers");
bool provisionNas = args.Contains("--provision-nas");

// Parse MongoDB connection string (support both Docker Compose and K8s)
string mongoHost = "localhost"; // Default for Docker Compose
int mongoPort = 27017;
bool directConnection = false;

var mongoArg = args.FirstOrDefault(a => a.StartsWith("--mongodb-connection="));
if (mongoArg != null)
{
    mongoHost = mongoArg.Split('=')[1];
}

var portArg = args.FirstOrDefault(a => a.StartsWith("--mongodb-port="));
if (portArg != null)
{
    mongoPort = int.Parse(portArg.Split('=')[1]);
}

directConnection = args.Contains("--direct-connection");

// Parse simulator URL override
string? simulatorUrlOverride = null;
var simUrlArg = args.FirstOrDefault(a => a.StartsWith("--simulator-url="));
if (simUrlArg != null)
{
    simulatorUrlOverride = simUrlArg.Split('=', 2)[1];
}

// Parse API URL for provisioning (DataSourceManagement service)
string? apiUrlOverride = null;
var apiUrlArg = args.FirstOrDefault(a => a.StartsWith("--api-url="));
if (apiUrlArg != null)
{
    apiUrlOverride = apiUrlArg.Split('=', 2)[1];
}

// Load configuration from appsettings.json
var configuration = new ConfigurationBuilder()
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
    .Build();

// Use file-simulator hostname (stable, no permissions needed)
// The hostname resolves automatically via DNS/mDNS to the correct IP
string fileSimulatorHost = "file-simulator.local";

// Determine seeding mode
string mode;
if (useSimulator)
{
    mode = incrementalMode ? "SIMULATOR (INCREMENTAL)" : "SIMULATOR";
}
else
{
    mode = incrementalMode ? "INCREMENTAL" : "FULL RESET";
}

Console.WriteLine($"Mode: {mode}");
Console.WriteLine($"MongoDB: {mongoHost}:{mongoPort} (direct={directConnection})");
Console.WriteLine($"Seed: {DemoConfig.RandomSeed} (deterministic)");

if (useSimulator)
{
    var simUrl = simulatorUrlOverride
        ?? configuration["FileSimulator:ControlApiUrl"]
        ?? "http://file-simulator.local:30500";
    Console.WriteLine($"Simulator URL: {simUrl}");
    Console.WriteLine($"Discover Only: {discoverOnly}");
    Console.WriteLine($"Create Servers: {createServers}");
    Console.WriteLine($"Provision NAS: {provisionNas}");
    if (provisionNas)
    {
        var apiUrl = apiUrlOverride ?? "http://datasource-management:5001";
        Console.WriteLine($"API URL: {apiUrl}");
    }
}
else
{
    Console.WriteLine($"File Simulator Host: {fileSimulatorHost}");
}
Console.WriteLine();

try
{
    // Initialize MongoDB connection with proper settings
    var settings = new MongoDB.Driver.MongoClientSettings
    {
        Server = new MongoDB.Driver.MongoServerAddress(mongoHost, mongoPort),
        DirectConnection = directConnection,
        ConnectTimeout = TimeSpan.FromSeconds(30),
        ServerSelectionTimeout = TimeSpan.FromSeconds(30)
    };

    await DB.InitAsync("ezplatform", settings);
    Console.WriteLine("Connected to MongoDB\n");

    // Initialize random with fixed seed for determinism
    var random = new Random(DemoConfig.RandomSeed);

    // Step 1: Reset database (unless incremental)
    if (!incrementalMode)
    {
        var resetService = new DatabaseResetService();
        await resetService.ResetAllCollectionsAsync();
    }
    else
    {
        Console.WriteLine("[1/9] Skipping reset (incremental mode)\n");
    }

    // Step 2: Seed Categories FIRST (datasources reference them)
    var categorySeeder = new CategorySeederGenerator();
    await categorySeeder.SeedCategoriesAsync();

    // Step 3: Generate Admin Servers (datasources reference them)
    List<AdminServer> servers;
    List<NasDevice> seededNasDevices = new();

    if (useSimulator)
    {
        // SIMULATOR MODE: Discover servers from file-simulator API
        var simulatorUrl = simulatorUrlOverride
            ?? configuration["FileSimulator:ControlApiUrl"]
            ?? "http://file-simulator.local:30500";

        var httpClient = new HttpClient
        {
            BaseAddress = new Uri(simulatorUrl),
            Timeout = TimeSpan.FromSeconds(30)
        };

        // Create API client for provisioning if enabled
        HttpClient? apiClient = null;
        if (provisionNas)
        {
            var apiUrl = apiUrlOverride ?? "http://datasource-management:5001";
            apiClient = new HttpClient
            {
                BaseAddress = new Uri(apiUrl),
                Timeout = TimeSpan.FromSeconds(120) // Longer timeout for provisioning
            };
        }

        var simulatorClient = new FileSimulatorClient(httpClient);
        var mappingService = new ServerMappingService();
        var seederService = new SimulatorSeederService(simulatorClient, mappingService, apiClient);

        var createDynamic = createServers && !discoverOnly;
        var (discoveredServers, nasDevices) = await seederService.SeedFromSimulatorAsync(createDynamic, provisionNas);
        servers = discoveredServers;
        seededNasDevices = nasDevices;
    }
    else
    {
        // STATIC MODE: Use hardcoded AdminServerGenerator
        var serverGenerator = new AdminServerGenerator(random, fileSimulatorHost);
        servers = await serverGenerator.GenerateAsync();
    }

    // Step 4: Generate DataSources (with server + NAS device references)
    var dsGenerator = new DataSourceGenerator(random, servers, seededNasDevices);
    var datasources = await dsGenerator.GenerateAsync();

    // Step 5: Generate Schemas
    var schemaGenerator = new SchemaGenerator(random);
    await schemaGenerator.GenerateForDataSourcesAsync(datasources);

    // Step 6: Generate Global Metrics (skipped - see documentation)
    var globalMetricGenerator = new GlobalMetricGenerator(random);
    await globalMetricGenerator.GenerateAsync();

    // Step 7: Generate Datasource Metrics
    var dsMetricGenerator = new DatasourceMetricGenerator(random);
    await dsMetricGenerator.GenerateAsync(datasources);

    // Step 8: Generate Datasource-Specific Alerts
    var alertGenerator = new AlertGenerator(random);
    await alertGenerator.GenerateAsync();

    // Step 9: Generate Invalid Records (with schema violations)
    var invalidRecordsGenerator = new InvalidRecordsGenerator(random);
    await invalidRecordsGenerator.GenerateAsync(datasources);

    // Step 10: Generate Global Alerts (system + business + complex)
    var globalAlertGenerator = new GlobalAlertGenerator(random);
    await globalAlertGenerator.GenerateAsync();

    // Step 11: Summary
    Console.WriteLine("[11/11] Generation Summary:");
    var serverCount = await DB.CountAsync<DataProcessing.Shared.Entities.AdminServer>(_ => true);
    var nasDeviceCount = await DB.CountAsync<DataProcessing.Shared.Entities.NasDevice>(_ => true);
    var dsCount = await DB.CountAsync<DataProcessing.Shared.Entities.DataProcessingDataSource>(_ => true);
    var schemaCount = await DB.CountAsync<DataProcessing.Shared.Entities.DataProcessingSchema>(_ => true);
    var categoryCount = await DB.CountAsync<DataProcessing.Shared.Entities.DataSourceCategory>(_ => true);
    var metricCount = await DB.CountAsync<MetricsConfigurationService.Models.MetricConfiguration>(_ => true);
    var invalidRecordCount = await DB.CountAsync<DataProcessing.Shared.Entities.DataProcessingInvalidRecord>(_ => true);
    var globalAlertCount = await DB.CountAsync<MetricsConfigurationService.Models.GlobalAlertConfiguration>(_ => true);
    var metricsWithAlerts = await DB.Find<MetricsConfigurationService.Models.MetricConfiguration>()
        .Match(m => m.AlertRules != null && m.AlertRules.Count > 0)
        .ExecuteAsync();

    Console.WriteLine($"  {categoryCount} Categories");
    Console.WriteLine($"  {serverCount} Admin Servers");
    if (useSimulator)
    {
        Console.WriteLine($"  {nasDeviceCount} NAS Devices");
    }
    Console.WriteLine($"  {dsCount} DataSources (with server refs)");
    Console.WriteLine($"  {schemaCount} Schemas");
    Console.WriteLine($"  {metricCount} Metrics (datasource-specific)");
    Console.WriteLine($"  {metricsWithAlerts.Count} Metrics with datasource alerts");
    Console.WriteLine($"  {globalAlertCount} Global Alerts (system + business)");
    Console.WriteLine($"  {invalidRecordCount} Invalid Records\n");

    Console.WriteLine("═══════════════════════════════════════════════");
    Console.WriteLine("  Demo data generation completed successfully!");
    Console.WriteLine("═══════════════════════════════════════════════\n");

    Console.WriteLine("Next steps:");
    Console.WriteLine("  1. cd tools\\ServiceOrchestrator");
    Console.WriteLine("  2. dotnet run start");
    Console.WriteLine("  3. Open http://localhost:3000\n");
}
catch (Exception ex)
{
    Console.WriteLine($"\nError: {ex.Message}");
    Console.WriteLine($"Stack: {ex.StackTrace}");
    Environment.Exit(1);
}
