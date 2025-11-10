using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Monitoring;
using DataProcessing.DataSourceManagement.Infrastructure;
using DataProcessing.DataSourceManagement.Repositories;
using DataProcessing.DataSourceManagement.Services;
using MongoDB.Entities;
using MongoDB.Driver;
using MongoDB.Bson;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

// Add configuration
builder.Configuration
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables()
    .AddCommandLine(args);

// Add services to the container
var services = builder.Services;
var configuration = builder.Configuration;

// Add controllers with JSON options
services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
        options.JsonSerializerOptions.WriteIndented = true;
        options.JsonSerializerOptions.Converters.Add(new BsonDocumentJsonConverter());
        options.JsonSerializerOptions.Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
    });

services.AddEndpointsApiExplorer();

// Configure logging
services.AddLogging(builder =>
{
    builder.AddConsole();
    builder.AddDebug();
});

// Configure metrics
services.AddSingleton<DataProcessingMetrics>();

// Add health checks
services.AddHealthChecks()
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy())
    .AddCheck("database", () =>
    {
        try
        {
            return Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy("Database connection is healthy");
        }
        catch (Exception ex)
        {
            return Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Unhealthy("Database connection failed", ex);
        }
    });

// Register application services
services.AddScoped<IDataSourceRepository, DataSourceRepository>();
services.AddScoped<IDataSourceService, DataSourceService>();

// Register schema management services
services.AddScoped<DataProcessing.DataSourceManagement.Repositories.Schema.ISchemaRepository, 
    DataProcessing.DataSourceManagement.Repositories.Schema.SchemaRepository>();
services.AddScoped<DataProcessing.DataSourceManagement.Services.Schema.ISchemaService, 
    DataProcessing.DataSourceManagement.Services.Schema.SchemaService>();
services.AddScoped<DataProcessing.DataSourceManagement.Services.Schema.ISchemaValidationService, 
    DataProcessing.DataSourceManagement.Services.Schema.SchemaValidationService>();

// Add CORS
services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });

    options.AddPolicy("Production", policy =>
    {
        policy.WithOrigins(
                configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
                ?? new[] { "https://localhost:7001" })
              .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
              .WithHeaders("Content-Type", "Authorization", "X-Correlation-ID")
              .AllowCredentials();
    });
});

// Add localization for Hebrew support
services.AddLocalization(options => options.ResourcesPath = "Resources");

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

// Get database configuration
var databaseName = configuration.GetConnectionString("DefaultConnection") ?? "ezplatform";
var connectionString = configuration.GetConnectionString("MongoDB") ?? "mongodb://localhost:27017";

// Initialize database connection using MongoDB.Entities
try
{
    await DB.InitAsync(databaseName, connectionString);
    
    var initLogger = app.Services.GetRequiredService<ILogger<Program>>();
    initLogger.LogInformation("MongoDB.Entities database connection initialized successfully");
    
    // Create indexes for better performance - non-blocking
    _ = Task.Run(async () =>
    {
        try
        {
            await Task.Delay(2000);
            
            await DB.Index<DataProcessingDataSource>()
                .Key(x => x.Name, KeyType.Ascending)
                .Option(o => o.Unique = true)
                .CreateAsync();

            await DB.Index<DataProcessingDataSource>()
                .Key(x => x.IsActive, KeyType.Ascending)
                .CreateAsync();
                
            initLogger.LogInformation("Database indexes created successfully");
        }
        catch (Exception indexEx)
        {
            initLogger.LogWarning(indexEx, "Failed to create database indexes");
        }
    });
}
catch (Exception ex)
{
    var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
    startupLogger.LogCritical(ex, "Failed to initialize database connection");
    throw;
}

// Configure CORS
app.UseCors(app.Environment.IsDevelopment() ? "AllowAll" : "Production");

// Configure localization
var supportedCultures = new[] { "en-US", "he-IL" };
var localizationOptions = new RequestLocalizationOptions()
    .SetDefaultCulture(supportedCultures[0])
    .AddSupportedCultures(supportedCultures)
    .AddSupportedUICultures(supportedCultures);

app.UseRequestLocalization(localizationOptions);

app.UseHttpsRedirection();
app.UseRouting();

// Add health checks
app.UseHealthChecks("/health");
app.UseHealthChecks("/health/ready");
app.UseHealthChecks("/health/live");

app.MapControllers();

var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("Data Source Management Service starting up...");
logger.LogInformation("Environment: {Environment}", app.Environment.EnvironmentName);

await app.RunAsync();
