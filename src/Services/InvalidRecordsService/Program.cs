using DataProcessing.Shared.Configuration;
using DataProcessing.Shared.Middleware;
using DataProcessing.Shared.Monitoring;
using MongoDB.Entities;
using System.Diagnostics;
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
    "DataProcessing.InvalidRecords");

// Configure OpenTelemetry
var serviceName = "DataProcessing.InvalidRecords";
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

// Register application services
builder.Services.AddScoped<InvalidRecordsService.Repositories.IInvalidRecordRepository, 
    InvalidRecordsService.Repositories.InvalidRecordRepository>();
builder.Services.AddScoped<InvalidRecordsService.Services.IInvalidRecordService, 
    InvalidRecordsService.Services.InvalidRecordService>();
builder.Services.AddScoped<InvalidRecordsService.Services.ICorrectionService, 
    InvalidRecordsService.Services.CorrectionService>();

// Configure health checks
builder.Services.AddDataProcessingHealthChecks(builder.Configuration, serviceName);

// Configure metrics
builder.Services.AddSingleton<BusinessMetrics>();

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
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Invalid Records Service API v1");
        c.RoutePrefix = string.Empty; // Swagger UI at root
    });
}

// IMPORTANT: HTTPS redirection disabled in containerized environments
// as it breaks CORS preflight requests from frontend
// app.UseHttpsRedirection();

// Add correlation ID middleware
app.UseMiddleware<CorrelationIdMiddleware>();

app.UseRouting();

// CRITICAL: For endpoint routing, UseCors MUST be between UseRouting and MapControllers
// This ensures OPTIONS preflight requests are handled correctly
app.UseCors("AllowAll");

app.UseAuthorization();

app.MapControllers();

// Map health checks
app.UseDataProcessingHealthChecks();

app.Run();
