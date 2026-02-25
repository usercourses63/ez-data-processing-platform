using DataProcessing.FileProcessor.Consumers;
using DataProcessing.Shared.Configuration;
using DataProcessing.Shared.Connectors;
using DataProcessing.Shared.Converters;
using DataProcessing.Shared.Middleware;
using DataProcessing.Shared.Monitoring;
using Hazelcast;
using MongoDB.Entities;
using MongoDB.Driver;
using Prometheus;
using MassTransit;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure logging
builder.Services.AddDataProcessingLogging(
    builder.Configuration, 
    builder.Environment, 
    "DataProcessing.FileProcessor");

// Configure OpenTelemetry
var serviceName = "DataProcessing.FileProcessor";
var activitySource = new ActivitySource(serviceName);
builder.Services.AddSingleton(activitySource);
builder.Services.AddDataProcessingOpenTelemetry(builder.Configuration, serviceName);

// Configure MongoDB
var connectionString = builder.Configuration.GetConnectionString("MongoDB") ?? "localhost";
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

// Configure MassTransit with InMemory transport (MVP - Kafka migration pending)
var rabbitMqHost = builder.Configuration.GetValue<string>("RabbitMQ:Host") ?? "rabbitmq.ez-platform.svc.cluster.local";
var rabbitMqUser = builder.Configuration.GetValue<string>("RabbitMQ:Username") ?? "guest";
var rabbitMqPass = builder.Configuration.GetValue<string>("RabbitMQ:Password") ?? "guest";

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<FileDiscoveredEventConsumer>(cfg =>
    {
        cfg.UseConcurrentMessageLimit(10); // Process 10 files concurrently per instance
    });

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

// Register connector factory and all connectors (Phase 2: v0.2.0)
builder.Services.AddConnectorFactory();

// Register data source connectors (individual registration for legacy support)
builder.Services.AddScoped<LocalFileConnector>();
builder.Services.AddScoped<FtpConnector>();
builder.Services.AddScoped<SftpConnector>();

// Register archive service for archive extraction
builder.Services.AddScoped<DataProcessing.Shared.Services.IArchiveService, DataProcessing.Shared.Services.SharpCompressArchiveService>();

// Register archive cache service for retrieving cached archives from Hazelcast
builder.Services.AddScoped<DataProcessing.Shared.Services.IArchiveCacheService, DataProcessing.Shared.Services.HazelcastArchiveCacheService>();

// Configure archive cache settings from configuration
builder.Services.Configure<DataProcessing.Shared.Services.ArchiveCacheSettings>(
    builder.Configuration.GetSection("ArchiveCache"));

// Register format converters
builder.Services.AddScoped<CsvToJsonConverter>();
builder.Services.AddScoped<XmlToJsonConverter>();
builder.Services.AddScoped<ExcelToJsonConverter>();
builder.Services.AddScoped<JsonToJsonConverter>();

// Configure health checks
builder.Services.AddDataProcessingHealthChecks(builder.Configuration, serviceName);

// Configure metrics (BusinessMetrics is the active metrics system)
builder.Services.AddBusinessMetrics();

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
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "File Processor Service API v1");
    c.RoutePrefix = "swagger"; // Swagger UI at /swagger
});

if (app.Environment.IsDevelopment())
{
    app.UseCors("AllowAll");
}

app.UseHttpsRedirection();

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

app.Run();
