using DataProcessing.Scheduling.Jobs;
using DataProcessing.Scheduling.Services;
using DataProcessing.Shared.Configuration;
using DataProcessing.Shared.Middleware;
using DataProcessing.Shared.Monitoring;
using MongoDB.Entities;
using Quartz;
using System.Diagnostics;
using Prometheus;
using MassTransit;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure logging
builder.Services.AddDataProcessingLogging(
    builder.Configuration, 
    builder.Environment, 
    "DataProcessing.Scheduling");

// Configure OpenTelemetry (metrics, traces, and logs via OTLP)
var serviceName = "DataProcessing.Scheduling";
var activitySource = new ActivitySource(serviceName);
builder.Services.AddSingleton(activitySource);
builder.Services.AddDataProcessingOpenTelemetry(builder.Configuration, serviceName);

// Configure MongoDB
var connectionString = builder.Configuration.GetConnectionString("MongoDB") 
    ?? throw new InvalidOperationException("MongoDB connection string is required");
var databaseName = builder.Configuration.GetConnectionString("DatabaseName") ?? "ezplatform";
await DB.InitAsync(databaseName, connectionString);

// Configure MassTransit with RabbitMQ transport
var rabbitMqHost = builder.Configuration.GetValue<string>("RabbitMQ:Host") ?? "rabbitmq.ez-platform.svc.cluster.local";
var rabbitMqUser = builder.Configuration.GetValue<string>("RabbitMQ:Username") ?? "guest";
var rabbitMqPass = builder.Configuration.GetValue<string>("RabbitMQ:Password") ?? "guest";

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<DataProcessing.Scheduling.Consumers.DataSourceCreatedConsumer>();
    x.AddConsumer<DataProcessing.Scheduling.Consumers.DataSourceUpdatedConsumer>();
    x.AddConsumer<DataProcessing.Scheduling.Consumers.DataSourceDeletedConsumer>();

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

// Configure Quartz.NET
builder.Services.AddQuartz(q =>
{
    // Use in-memory job store for simplicity
    q.UseInMemoryStore();
    
    // Configure scheduler
    q.SchedulerName = "DataProcessing-Scheduler";
    q.SchedulerId = Environment.MachineName;
    q.MaxBatchSize = 20;
    q.BatchTriggerAcquisitionFireAheadTimeWindow = TimeSpan.FromSeconds(15);
    
    // Jobs will be created dynamically by SchedulingManager
    // No need to pre-register jobs here
});

// Configure Quartz.NET hosted service
builder.Services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);

// Register IScheduler for dependency injection
builder.Services.AddSingleton<IScheduler>(provider =>
{
    var schedulerFactory = provider.GetRequiredService<ISchedulerFactory>();
    return schedulerFactory.GetScheduler().GetAwaiter().GetResult();
});

// Register application services
builder.Services.AddScoped<ISchedulingManager, SchedulingManager>();
builder.Services.AddScoped<DataSourcePollingJob>();

// Register schedule reload hosted service (runs on startup to restore schedules from MongoDB)
builder.Services.AddHostedService<ScheduleReloadService>();

// Configure health checks
builder.Services.AddDataProcessingHealthChecks(builder.Configuration, serviceName);

// Configure metrics
builder.Services.AddSingleton<BusinessMetrics>();
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
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Scheduling Service API v1");
        c.RoutePrefix = string.Empty; // Swagger UI at root
    });
}

app.UseHttpsRedirection();

// CORS must be BEFORE UseRouting
app.UseCors("AllowAll");

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

app.Run();
