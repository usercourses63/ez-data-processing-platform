using System.Diagnostics;
using MongoDB.Entities;
using DemoDataGenerator.Services;
using DemoDataGenerator.Generators;
using DemoDataGenerator.Models;

Console.OutputEncoding = System.Text.Encoding.UTF8;

Console.WriteLine("═══════════════════════════════════════════════");
Console.WriteLine("    🎯 Demo Data Generator for EZ Platform    ");
Console.WriteLine("═══════════════════════════════════════════════\n");

// Parse command line arguments
bool incrementalMode = args.Contains("--incremental");
string mode = incrementalMode ? "INCREMENTAL" : "FULL RESET";

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

// Use file-simulator hostname (stable, no permissions needed)
// The hostname resolves automatically via DNS/mDNS to the correct IP
string fileSimulatorHost = "file-simulator.local";
Console.WriteLine($"✓ Using file-simulator hostname: {fileSimulatorHost}");

Console.WriteLine($"Mode: {mode}");
Console.WriteLine($"MongoDB: {mongoHost}:{mongoPort} (direct={directConnection})");
Console.WriteLine($"Seed: {DemoConfig.RandomSeed} (deterministic)\n");

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
    Console.WriteLine("✓ Connected to MongoDB\n");
    
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
        Console.WriteLine("[1/9] ⏭️  Skipping reset (incremental mode)\n");
    }

    // Step 2: Seed Categories FIRST (datasources reference them)
    var categorySeeder = new CategorySeederGenerator();
    await categorySeeder.SeedCategoriesAsync();

    // Step 3: Generate Admin Servers (datasources reference them)
    var serverGenerator = new AdminServerGenerator(random, fileSimulatorHost);
    var servers = await serverGenerator.GenerateAsync();

    // Step 4: Generate DataSources (with server references)
    var dsGenerator = new DataSourceGenerator(random, servers);
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
    Console.WriteLine("[11/11] 📊 Generation Summary:");
    var serverCount = await DB.CountAsync<DataProcessing.Shared.Entities.AdminServer>(_ => true);
    var dsCount = await DB.CountAsync<DataProcessing.Shared.Entities.DataProcessingDataSource>(_ => true);
    var schemaCount = await DB.CountAsync<DataProcessing.Shared.Entities.DataProcessingSchema>(_ => true);
    var categoryCount = await DB.CountAsync<DataProcessing.Shared.Entities.DataSourceCategory>(_ => true);
    var metricCount = await DB.CountAsync<MetricsConfigurationService.Models.MetricConfiguration>(_ => true);
    var invalidRecordCount = await DB.CountAsync<DataProcessing.Shared.Entities.DataProcessingInvalidRecord>(_ => true);
    var globalAlertCount = await DB.CountAsync<MetricsConfigurationService.Models.GlobalAlertConfiguration>(_ => true);
    var metricsWithAlerts = await DB.Find<MetricsConfigurationService.Models.MetricConfiguration>()
        .Match(m => m.AlertRules != null && m.AlertRules.Count > 0)
        .ExecuteAsync();

    Console.WriteLine($"  ✅ {categoryCount} Categories");
    Console.WriteLine($"  ✅ {serverCount} Admin Servers");
    Console.WriteLine($"  ✅ {dsCount} DataSources (with server refs)");
    Console.WriteLine($"  ✅ {schemaCount} Schemas");
    Console.WriteLine($"  ✅ {metricCount} Metrics (datasource-specific)");
    Console.WriteLine($"  ✅ {metricsWithAlerts.Count} Metrics with datasource alerts");
    Console.WriteLine($"  ✅ {globalAlertCount} Global Alerts (system + business)");
    Console.WriteLine($"  ✅ {invalidRecordCount} Invalid Records\n");
    
    Console.WriteLine("═══════════════════════════════════════════════");
    Console.WriteLine("  ✨ Demo data generation completed successfully!");
    Console.WriteLine("═══════════════════════════════════════════════\n");
    
    Console.WriteLine("Next steps:");
    Console.WriteLine("  1. cd tools\\ServiceOrchestrator");
    Console.WriteLine("  2. dotnet run start");
    Console.WriteLine("  3. Open http://localhost:3000\n");
}
catch (Exception ex)
{
    Console.WriteLine($"\n❌ Error: {ex.Message}");
    Console.WriteLine($"Stack: {ex.StackTrace}");
    Environment.Exit(1);
}
