using DataProcessing.FileDiscovery.Consumers;
using DataProcessing.Shared.Configuration;
using DataProcessing.Shared.Connectors;
using DataProcessing.Shared.Middleware;
using DataProcessing.Shared.Monitoring;
using DataProcessing.Shared.Services;
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
    "DataProcessing.FileDiscovery");

// Configure OpenTelemetry
var serviceName = "DataProcessing.FileDiscovery";
var activitySource = new ActivitySource(serviceName);
builder.Services.AddSingleton(activitySource);
builder.Services.AddDataProcessingOpenTelemetry(builder.Configuration, serviceName);

// Configure MongoDB
var connectionString = builder.Configuration.GetConnectionString("MongoDB") ?? "localhost";
Console.WriteLine($"[DEBUG] FileDiscovery MongoDB ConnectionString from config: '{connectionString}'");
// IMPORTANT: Use "ezplatform" database to access shared DataProcessingDataSource collection
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

// Register IFileHashService for distributed file deduplication
builder.Services.AddScoped<IFileHashService, HazelcastFileHashService>();

// Configure MassTransit with RabbitMQ transport
var rabbitMqHost = builder.Configuration.GetValue<string>("RabbitMQ:Host") ?? "rabbitmq.ez-platform.svc.cluster.local";
var rabbitMqUser = builder.Configuration.GetValue<string>("RabbitMQ:Username") ?? "guest";
var rabbitMqPass = builder.Configuration.GetValue<string>("RabbitMQ:Password") ?? "guest";

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<FilePollingEventConsumer>(cfg =>
    {
        cfg.UseConcurrentMessageLimit(5); // Process 5 datasources concurrently
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

// Register data source connectors
builder.Services.AddScoped<LocalFileConnector>();
builder.Services.AddScoped<FtpConnector>();
builder.Services.AddScoped<SftpConnector>();
builder.Services.AddScoped<IDataSourceConnector>(provider =>
{
    // Factory pattern - will be selected based on datasource type
    return provider.GetRequiredService<LocalFileConnector>();
});

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
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "File Discovery Service API v1");
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
