using DataProcessing.Shared.Configuration;
using DataProcessing.Shared.Messages;
using DataProcessing.Shared.Middleware;
using DataProcessing.Shared.Monitoring;
using DataProcessing.Validation.Consumers;
using DataProcessing.Validation.Services;
using MongoDB.Entities;
using MongoDB.Driver;
using System.Diagnostics;
using Prometheus;
using MassTransit;
using Hazelcast;
using Corvus.Json;
using Corvus.Json.Validator;
using System.Text.Json;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure logging
builder.Services.AddDataProcessingLogging(
    builder.Configuration, 
    builder.Environment, 
    "DataProcessing.Validation");

// Configure OpenTelemetry
var serviceName = "DataProcessing.Validation";
var activitySource = new ActivitySource(serviceName);
builder.Services.AddSingleton(activitySource);
builder.Services.AddDataProcessingOpenTelemetry(builder.Configuration, serviceName);

// Configure MongoDB
var connectionString = builder.Configuration.GetConnectionString("MongoDB")
    ?? throw new InvalidOperationException("MongoDB connection string is required");
var databaseName = builder.Configuration.GetConnectionString("DatabaseName") ?? "ezplatform";

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

// Configure Hazelcast Client with resilience (auto-reconnect, retry, circuit breaker)
using var hazelcastLoggerFactory = LoggerFactory.Create(loggingBuilder =>
{
    loggingBuilder.AddConsole();
    loggingBuilder.SetMinimumLevel(LogLevel.Information);
});
builder.Services.AddResilientHazelcast(builder.Configuration, hazelcastLoggerFactory);

// Configure MassTransit with RabbitMQ transport
var rabbitMqHost = builder.Configuration.GetValue<string>("RabbitMQ:Host") ?? "rabbitmq.ez-platform.svc.cluster.local";
var rabbitMqUser = builder.Configuration.GetValue<string>("RabbitMQ:Username") ?? "guest";
var rabbitMqPass = builder.Configuration.GetValue<string>("RabbitMQ:Password") ?? "guest";

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<ValidationRequestEventConsumer>();

    // Register request client for querying MetricsConfigurationService
    x.AddRequestClient<GetMetricsConfigurationRequest>();

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

// Disable MassTransit automatic health check registration
builder.Services.Configure<MassTransitHostOptions>(options =>
{
    options.WaitUntilStarted = false;
});

// Remove MassTransit from health check registrations to prevent startup issues
builder.Services.PostConfigure<HealthCheckServiceOptions>(options =>
{
    var massTransitChecks = options.Registrations
        .Where(r => r.Name.Contains("masstransit", StringComparison.OrdinalIgnoreCase))
        .ToList();

    foreach (var check in massTransitChecks)
    {
        options.Registrations.Remove(check);
    }
});

// Register application services
builder.Services.AddScoped<IValidationService, ValidationService>();
builder.Services.AddScoped<DataMetricsCalculator>();

// Register memory cache for metric definitions caching
builder.Services.AddMemoryCache();

// Configure OpenTelemetry business metrics
builder.Services.AddSingleton<ValidationMetrics>();

// Configure OpenTelemetry with OTLP gRPC exporter
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource
        .AddService(
            serviceName: serviceName,
            serviceVersion: "1.0.0",
            serviceInstanceId: Environment.MachineName))
    .WithMetrics(metrics => metrics
        // Add ASP.NET Core instrumentation
        .AddAspNetCoreInstrumentation()

        // Add runtime instrumentation
        .AddRuntimeInstrumentation()

        // Add custom ValidationService meter
        .AddMeter("DataProcessing.Validation")

        // Add histogram view with custom buckets for validation duration
        .AddView(
            instrumentName: "validation.duration",
            new ExplicitBucketHistogramConfiguration
            {
                Boundaries = new double[] { 0, 5, 10, 25, 50, 75, 100, 250, 500, 1000, 2500, 5000, 10000 }
            })

        // Add histogram view for business metrics
        .AddView(
            instrumentName: "business.metric.value",
            new ExplicitBucketHistogramConfiguration
            {
                Boundaries = new double[] { 0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000 }
            })

        // Configure OTLP exporter (gRPC to OpenTelemetry Collector)
        .AddOtlpExporter(options =>
        {
            var otlpEndpoint = builder.Configuration.GetValue<string>("OpenTelemetry:OtlpEndpoint")
                ?? "http://localhost:4317";

            options.Endpoint = new Uri(otlpEndpoint);
            options.Protocol = OpenTelemetry.Exporter.OtlpExportProtocol.Grpc;

            // Use batch export processor for efficiency
            options.ExportProcessorType = OpenTelemetry.ExportProcessorType.Batch;
            options.BatchExportProcessorOptions = new OpenTelemetry.BatchExportProcessorOptions<System.Diagnostics.Activity>
            {
                MaxQueueSize = 2048,
                ScheduledDelayMilliseconds = 5000,
                ExporterTimeoutMilliseconds = 30000,
                MaxExportBatchSize = 512
            };
        }));

// Configure health checks
builder.Services.AddDataProcessingHealthChecks(builder.Configuration, serviceName);

// Configure legacy Prometheus metrics (keep for compatibility)
builder.Services.AddSingleton<DataProcessingMetrics>();

// Configure CORS for development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
// Swagger enabled for Beta (will disable in Production in future versions)
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Validation Service API v1");
    c.RoutePrefix = "swagger"; // Swagger UI at /swagger
});

if (app.Environment.IsDevelopment())
{
    app.UseCors("AllowAll");
}

app.UseHttpsRedirection();

// Add request logging - Disabled temporarily due to Serilog dependency issue
// app.UseDataProcessingRequestLogging();

// Add correlation ID middleware
app.UseMiddleware<CorrelationIdMiddleware>();

app.UseRouting();

app.UseAuthorization();

app.MapControllers();

// Map health checks
app.UseDataProcessingHealthChecks();

// Configure Prometheus metrics endpoint
app.UseHttpMetrics();
app.MapMetrics();

// Pre-warm Corvus JSON Schema validator to avoid cold-start latency on first validation
// This triggers Roslyn JIT compilation for schema validation code generation
try
{
    var warmupSchema = Corvus.Json.Validator.JsonSchema.FromText("{\"type\":\"object\"}", "urn:warmup:schema");
    using var warmupDoc = JsonDocument.Parse("{}");
    _ = warmupSchema.Validate(warmupDoc.RootElement, ValidationLevel.Flag);
    app.Logger.LogInformation("Corvus JSON Schema validator pre-warmed successfully");
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Failed to pre-warm Corvus JSON Schema validator - first validation may be slower");
}

app.Run();
