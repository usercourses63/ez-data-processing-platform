using DataProcessing.Shared.Entities;
using MongoDB.Entities;
using MetricsConfigurationService.Models;

namespace DemoDataGenerator.Services;

public class DatabaseResetService
{
    public async Task ResetAllCollectionsAsync()
    {
        Console.WriteLine("\n[1/11] 🗑️  Resetting all database collections...");

        try
        {
            // Reset DataSource Management collections
            await ResetCollectionAsync<DataSourceCategory>("Categories");
            await ResetCollectionAsync<AdminServer>("AdminServers");
            await ResetCollectionAsync<DataProcessingDataSource>("DataSources");
            await ResetCollectionAsync<DataProcessingSchema>("Schemas");

            // Reset Scheduling collections
            await ResetCollectionAsync<ScheduledDataSource>("ScheduledDataSources");

            // Reset Metrics Configuration collections
            await ResetCollectionAsync<MetricConfiguration>("Metrics");

            // Reset Validation collections
            await ResetCollectionAsync<DataProcessingValidationResult>("ValidationResults");
            await ResetCollectionAsync<DataProcessingInvalidRecord>("InvalidRecords");
            
            Console.WriteLine("  ✅ All collections reset successfully\n");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  ❌ Error resetting collections: {ex.Message}");
            throw;
        }
    }
    
    private async Task ResetCollectionAsync<T>(string collectionName) where T : IEntity
    {
        try
        {
            await DB.DeleteAsync<T>(_ => true);
            var count = await DB.CountAsync<T>(_ => true);
            Console.WriteLine($"  ✓ Reset {collectionName} (deleted all, count: {count})");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  ⚠️  {collectionName}: {ex.Message}");
        }
    }
}
