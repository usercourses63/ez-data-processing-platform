namespace DemoDataGenerator.Models;

public static class DemoConfig
{
    /// <summary>
    /// Fixed random seed for deterministic data generation
    /// </summary>
    public const int RandomSeed = 42;
    
    /// <summary>
    /// Number of datasources to generate
    /// </summary>
    public const int DataSourceCount = 20;
    
    /// <summary>
    /// Number of global metrics to generate
    /// </summary>
    public const int GlobalMetricCount = 20;
    
    /// <summary>
    /// Min datasource-specific metrics per datasource
    /// </summary>
    public const int MinDatasourceMetrics = 2;
    
    /// <summary>
    /// Max datasource-specific metrics per datasource
    /// </summary>
    public const int MaxDatasourceMetrics = 4;
    
    /// <summary>
    /// Percentage of metrics that should have alerts (0.0 to 1.0)
    /// </summary>
    public const double AlertPercentage = 0.3;
}
