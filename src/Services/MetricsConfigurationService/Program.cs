using MassTransit;
using MetricsConfigurationService.Consumers;
using MetricsConfigurationService.Repositories;
using MetricsConfigurationService.Services.Alerts;
using MetricsConfigurationService.Services.Collection;
using MetricsConfigurationService.Services.Prometheus;
using MongoDB.Driver;
using MongoDB.Entities;
using DataProcessing.Shared.Configuration;
using DataProcessing.Shared.Monitoring;
using System.Diagnostics;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Configure JSON serialization to use camelCase (matches frontend)
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "Metrics Configuration API", Version = "v1" });
});

// Configure logging with Serilog and OTEL
var serviceName = "DataProcessing.MetricsConfiguration";
builder.Services.AddDataProcessingLogging(
    builder.Configuration,
    builder.Environment,
    serviceName);

// Configure OpenTelemetry (metrics, traces, and logs via OTLP)
var activitySource = new ActivitySource(serviceName);
builder.Services.AddSingleton(activitySource);
builder.Services.AddDataProcessingOpenTelemetry(builder.Configuration, serviceName);

// Configure metrics (using OpenTelemetry-based BusinessMetrics)
builder.Services.AddBusinessMetrics();

// Add rate limiting
builder.Services.AddDataProcessingRateLimiting(builder.Configuration);

// CORS configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:8080")
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Register HTTP client for Prometheus queries
builder.Services.AddHttpClient("Prometheus", client =>
{
    var timeoutSeconds = builder.Configuration.GetValue<int>("Prometheus:TimeoutSeconds", 30);
    client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
});

// Register repositories
builder.Services.AddScoped<IMetricRepository, MetricRepository>();
builder.Services.AddScoped<IGlobalAlertRepository, GlobalAlertRepository>();

// Register Prometheus query service
builder.Services.AddScoped<IPrometheusQueryService, PrometheusQueryService>();

// Register alert evaluation service
builder.Services.AddScoped<IAlertEvaluationService, AlertEvaluationService>();

// Register background metrics collection service
builder.Services.AddHostedService<MetricsCollectionBackgroundService>();

// Configure health checks
builder.Services.AddDataProcessingHealthChecks(builder.Configuration, serviceName);

// Configure MassTransit with conditional transport (in-memory for dev, Kafka for prod)
var useKafka = builder.Configuration.GetValue<bool>("MassTransit:UseKafka", false);

builder.Services.AddMassTransit(x =>
{
    // Register consumer for GetMetricsConfigurationRequest
    x.AddConsumer<GetMetricsConfigurationConsumer>();

    if (useKafka)
    {
        // Use Kafka for production cross-process communication
        x.UsingInMemory((context, cfg) =>
        {
            cfg.ConfigureEndpoints(context);
        });

        x.AddRider(rider =>
        {
            var kafkaServer = builder.Configuration.GetValue<string>("MassTransit:Kafka:Server")
                ?? "localhost:9092";

            rider.AddConsumer<GetMetricsConfigurationConsumer>();

            rider.UsingKafka((context, kafka) =>
            {
                kafka.Host(kafkaServer);

                kafka.TopicEndpoint<DataProcessing.Shared.Messages.GetMetricsConfigurationRequest>(
                    "metrics-configuration-requests",
                    "metrics-service-group",
                    e =>
                    {
                        e.ConfigureConsumer<GetMetricsConfigurationConsumer>(context);
                    });
            });
        });
    }
    else
    {
        // Use in-memory bus for development/testing
        x.UsingInMemory((context, cfg) =>
        {
            cfg.ConfigureEndpoints(context);
        });
    }
});

var app = builder.Build();

// Initialize MongoDB
var databaseName = builder.Configuration.GetValue<string>("MongoDB:DatabaseName") ?? "ezplatform";
var connectionString = builder.Configuration.GetConnectionString("MongoDB") ?? "mongodb";

// Parse MongoDB URI properly for replica set connections
if (connectionString.StartsWith("mongodb://") || connectionString.StartsWith("mongodb+srv://"))
{
    var settings = MongoClientSettings.FromConnectionString(connectionString);
    await DB.InitAsync(databaseName, settings);
}
else
{
    await DB.InitAsync(databaseName, connectionString);
}

var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("MongoDB initialized: {DatabaseName} at {ConnectionString}", databaseName, connectionString);

// Configure the HTTP request pipeline
// Swagger enabled for Beta (will disable in Production in future versions)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Metrics Configuration API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("AllowFrontend");

// Add rate limiting (after CORS, before routing/controllers)
app.UseDataProcessingRateLimiting();

app.UseAuthorization();
app.MapControllers();

// Health check endpoints
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live")
});

app.Run();
