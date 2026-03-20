using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Monitoring;
using DataProcessing.Shared.Configuration;
using DataProcessing.Shared.Connectors;
using DataProcessing.DataSourceManagement.Infrastructure;
using DataProcessing.DataSourceManagement.Repositories;
using DataProcessing.DataSourceManagement.Services;
using MongoDB.Entities;
using MongoDB.Driver;
using MongoDB.Bson;
using System.Reflection;
using System.Diagnostics;
using MassTransit;
using Quartz;
using DataProcessing.DataSourceManagement.Jobs;
using DataProcessing.DataSourceManagement.Hubs;
using DataProcessing.DataSourceManagement.Consumers;

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
        options.JsonSerializerOptions.PropertyNamingPolicy = null; // Keep original property names
        options.JsonSerializerOptions.WriteIndented = true;
        options.JsonSerializerOptions.Converters.Add(new BsonDocumentJsonConverter());
        // Fix Hebrew encoding - don't escape Unicode characters
        options.JsonSerializerOptions.Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
    });

// Add API Explorer for Swagger
services.AddEndpointsApiExplorer();
services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "DataSource Management API", Version = "v1" });
});

// Configure OpenTelemetry (metrics, traces, and logs via OTLP)
var serviceName = "DataProcessing.DataSourceManagement";
var activitySource = new ActivitySource(serviceName);
services.AddSingleton(activitySource);
services.AddDataProcessingOpenTelemetry(configuration, serviceName);

// Configure structured logging via Serilog + OTEL pipeline
services.AddDataProcessingLogging(configuration, builder.Environment, serviceName);

// Configure metrics
services.AddSingleton<BusinessMetrics>();

// Configure MassTransit with RabbitMQ transport
var rabbitMqHost = configuration.GetValue<string>("RabbitMQ:Host") ?? "rabbitmq.ez-platform.svc.cluster.local";
var rabbitMqUser = configuration.GetValue<string>("RabbitMQ:Username") ?? "guest";
var rabbitMqPass = configuration.GetValue<string>("RabbitMQ:Password") ?? "guest";

services.AddMassTransit(x =>
{
    // Register pipeline event consumer for SignalR broadcasting (v0.2.0: MON-07)
    x.AddConsumer<PipelineEventConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(rabbitMqHost, "/", h =>
        {
            h.Username(rabbitMqUser);
            h.Password(rabbitMqPass);
        });

        cfg.ConfigureEndpoints(context);
    });
});

// Add health checks
services.AddHealthChecks()
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy())
    .AddCheck("database", () =>
    {
        try
        {
            // Simple database connectivity check
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

// Register category management service (BETA Release)
services.AddScoped<ICategoryService, CategoryService>();

// Register server management service (v0.2.0: External File Access)
services.AddConnectorFactory();  // Includes HttpClient registration for HttpApiConnector
services.AddScoped<IServerService, ServerService>();

// Register file operations proxy service (v0.2.0: SIM-TEST-01 - Protocol testing endpoints)
services.AddScoped<IFileOperationsService, FileOperationsService>();

// Register Kubernetes client and NAS device service (v0.2.0: NAS/NFS Architecture)
services.AddKubernetesClient(configuration);
services.AddScoped<INasDeviceService, NasDeviceService>();

// Register schema management services
services.AddScoped<DataProcessing.DataSourceManagement.Repositories.Schema.ISchemaRepository,
    DataProcessing.DataSourceManagement.Repositories.Schema.SchemaRepository>();
services.AddScoped<DataProcessing.DataSourceManagement.Services.Schema.ISchemaService,
    DataProcessing.DataSourceManagement.Services.Schema.SchemaService>();
services.AddScoped<DataProcessing.DataSourceManagement.Services.Schema.ISchemaValidationService,
    DataProcessing.DataSourceManagement.Services.Schema.SchemaValidationService>();

// Register connection testing service (Week 1: Connection Testing)
services.AddScoped<DataProcessing.DataSourceManagement.Services.ConnectionTest.IConnectionTestService,
    DataProcessing.DataSourceManagement.Services.ConnectionTest.ConnectionTestService>();

// Register device health monitoring (v0.2.0: MON-05, MON-06)
services.AddScoped<IDeviceHealthService, DeviceHealthService>();
services.AddScoped<DeviceHealthCheckJob>();
services.AddHostedService<DeviceHealthService>();

// Register monitoring data services (v0.2.0: SignalR Real-Time Updates, MON-07)
services.AddScoped<IKubernetesMonitoringService, KubernetesMonitoringService>();
services.AddScoped<IPrometheusQueryService, PrometheusQueryService>();
services.AddScoped<IKafkaMonitoringService, RabbitMqMonitoringService>();

// Register SignalR hub and monitoring broadcaster
services.AddSignalR();
services.AddSingleton<MonitoringBroadcaster>();
services.AddHostedService(sp => sp.GetRequiredService<MonitoringBroadcaster>());

// Configure Quartz.NET for device health check scheduling
builder.Services.AddQuartz(q =>
{
    q.UseInMemoryStore();
    var jobKey = new JobKey("DeviceHealthCheck");
    q.AddJob<DeviceHealthCheckJob>(opts => opts.WithIdentity(jobKey));
    q.AddTrigger(opts => opts
        .ForJob(jobKey)
        .WithIdentity("DeviceHealthCheck-trigger")
        .WithSimpleSchedule(x => x
            .WithIntervalInSeconds(30)
            .RepeatForever()));
});
builder.Services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);

// Add rate limiting
services.AddDataProcessingRateLimiting(configuration);

// Add CORS
services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
                new Uri(origin).Host is "localhost" or "127.0.0.1" or "172.17.80.157" or "172.17.86.71" or "172.17.89.141")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials(); // Required for SignalR WebSocket transport
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
var connectionString = configuration.GetConnectionString("MongoDB") ?? "localhost";

// Initialize database connection using MongoDB.Entities
try
{
    // Parse MongoDB URI properly for replica set connections
    if (connectionString.StartsWith("mongodb://") || connectionString.StartsWith("mongodb+srv://"))
    {
        var settings = MongoClientSettings.FromConnectionString(connectionString);
        await DB.InitAsync(databaseName, settings);
    }
    else
    {
        // Simple hostname for local development
        await DB.InitAsync(databaseName, connectionString);
    }
    
    var initLogger = app.Services.GetRequiredService<ILogger<Program>>();
    initLogger.LogInformation("MongoDB.Entities database connection initialized successfully");

    // Seed default categories (BETA Release)
    await DataProcessing.DataSourceManagement.Data.CategorySeeder.SeedDefaultCategoriesAsync(initLogger);

    // Create indexes for better performance - non-blocking
    _ = Task.Run(async () =>
    {
        try
        {
            await Task.Delay(2000); // Wait 2 seconds for connection to stabilize
            
            await DB.Index<DataProcessingDataSource>()
                .Key(x => x.Name, KeyType.Ascending)
                .Option(o => o.Unique = true)
                .CreateAsync();

            await DB.Index<DataProcessingDataSource>()
                .Key(x => x.SupplierName, KeyType.Ascending)
                .CreateAsync();

            await DB.Index<DataProcessingDataSource>()
                .Key(x => x.IsActive, KeyType.Ascending)
                .CreateAsync();

            await DB.Index<DataProcessingDataSource>()
                .Key(x => x.IsDeleted, KeyType.Ascending)
                .CreateAsync();

            await DB.Index<DataProcessingDataSource>()
                .Key(x => x.CreatedAt, KeyType.Descending)
                .CreateAsync();

            // Create indexes for DataSourceCategory (BETA Release)
            await DB.Index<DataSourceCategory>()
                .Key(x => x.SortOrder, KeyType.Ascending)
                .CreateAsync();

            await DB.Index<DataSourceCategory>()
                .Key(x => x.IsActive, KeyType.Ascending)
                .CreateAsync();

            await DB.Index<DataSourceCategory>()
                .Key(x => x.Name, KeyType.Ascending)
                .CreateAsync();

            // TTL index for 7-day retention of health check history (v0.2.0: MON-05)
            await DB.Index<DeviceHealthCheckResult>()
                .Key(x => x.CheckedAt, KeyType.Ascending)
                .Option(o => o.ExpireAfter = TimeSpan.FromDays(7))
                .CreateAsync();

            // Compound index for fast per-device latest check lookup
            await DB.Index<DeviceHealthCheckResult>()
                .Key(x => x.DeviceId, KeyType.Ascending)
                .Key(x => x.CheckedAt, KeyType.Descending)
                .CreateAsync();

            initLogger.LogInformation("Database indexes created successfully");
        }
        catch (Exception indexEx)
        {
            initLogger.LogWarning(indexEx, "Failed to create database indexes, but service will continue running");
        }
    });
}
catch (Exception ex)
{
    var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
    startupLogger.LogCritical(ex, "Failed to initialize database connection");
    throw;
}

// Add UTF-8 charset middleware for JSON responses
app.Use(async (context, next) =>
{
    await next();
    
    // Ensure UTF-8 charset is set for JSON responses
    if (context.Response.ContentType?.Contains("application/json") == true && 
        !context.Response.ContentType.Contains("charset"))
    {
        context.Response.ContentType = "application/json; charset=utf-8";
    }
});

// Add security headers middleware
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'";
    
    await next();
});

// Configure Swagger (Enabled for Beta - will disable in Production later)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "DataSource Management API v1");
    c.RoutePrefix = "swagger"; // Swagger UI at /swagger
});

// Configure CORS
if (app.Environment.IsDevelopment())
{
    app.UseCors("AllowAll");
}
else
{
    app.UseCors("Production");
}

// Add rate limiting (after CORS, before routing)
app.UseDataProcessingRateLimiting();

// Add correlation ID middleware (simple version)
app.Use(async (context, next) =>
{
    if (!context.Request.Headers.ContainsKey("X-Correlation-ID"))
    {
        context.Request.Headers["X-Correlation-ID"] = Guid.NewGuid().ToString();
    }

    context.Response.Headers["X-Correlation-ID"] = context.Request.Headers["X-Correlation-ID"].ToString();

    await next();
});

// Configure localization
var supportedCultures = new[] { "en-US", "he-IL" };
var localizationOptions = new RequestLocalizationOptions()
    .SetDefaultCulture(supportedCultures[0])
    .AddSupportedCultures(supportedCultures)
    .AddSupportedUICultures(supportedCultures);

app.UseRequestLocalization(localizationOptions);

// Add standard middleware
app.UseHttpsRedirection();
app.UseRouting();

// Add health checks
app.UseHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        // CRITICAL: Set ContentType BEFORE writing to response
        if (!context.Response.HasStarted)
        {
            context.Response.ContentType = "application/json; charset=utf-8";
        }
        
        var response = new
        {
            status = report.Status.ToString(),
            timestamp = DateTime.UtcNow,
            duration = report.TotalDuration,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                duration = e.Value.Duration,
                exception = e.Value.Exception?.Message,
                tags = e.Value.Tags
            })
        };
        await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(response));
    }
});

app.UseHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});

app.UseHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false // No checks, just returns healthy
});

// Map SignalR monitoring hub (v0.2.0: MON-07)
app.MapHub<MonitoringHub>("/hubs/monitoring");

// Map controllers
app.MapControllers();

// Add graceful shutdown
var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
lifetime.ApplicationStopping.Register(() =>
{
    var shutdownLogger = app.Services.GetRequiredService<ILogger<Program>>();
    shutdownLogger.LogInformation("Application is shutting down gracefully...");
});

// Log startup information
var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("Data Source Management Service starting up...");
logger.LogInformation("Environment: {Environment}", app.Environment.EnvironmentName);
logger.LogInformation("Database: {DatabaseName} at {ConnectionString}", 
    databaseName, 
    connectionString.Split('@').LastOrDefault() ?? "localhost");

logger.LogInformation("Health checks available at: /health, /health/ready, /health/live");

try
{
    await app.RunAsync();
}
catch (Exception ex)
{
    logger.LogCritical(ex, "Application terminated unexpectedly");
    throw;
}
finally
{
    logger.LogInformation("Data Source Management Service shut down complete");
}
