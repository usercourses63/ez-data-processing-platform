using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.CircuitBreaker;
using Polly.Registry;
using Polly.Retry;
using Polly.Timeout;

namespace DataProcessing.Shared.Configuration;

/// <summary>
/// Resilience configuration for external connectors.
/// Registers a shared Polly v8 resilience pipeline that wraps external I/O operations
/// (HTTP, FTP, SFTP, Kafka) with circuit-breaker, retry, and timeout strategies.
/// </summary>
public static class ResilienceConfiguration
{
    /// <summary>
    /// The pipeline key used to resolve the external-connector pipeline from
    /// <see cref="ResiliencePipelineProvider{TKey}"/>.
    /// </summary>
    public const string ExternalConnectorPipelineKey = "external-connector";

    /// <summary>
    /// Adds the shared <c>external-connector</c> resilience pipeline to the DI container.
    /// <list type="bullet">
    ///   <item>Circuit breaker — opens after 5 consecutive failures, half-opens after 30 s, closes after 2 successes.</item>
    ///   <item>Retry — 3 attempts with exponential back-off (2^n seconds) plus random jitter.</item>
    ///   <item>Timeout — 30 s per individual attempt.</item>
    /// </list>
    /// State-change events (opened / half-opened / closed) are written to a logger obtained from
    /// the service provider so that circuit-breaker activity is always visible in the log stream.
    /// </summary>
    public static IServiceCollection AddDataProcessingResilience(this IServiceCollection services)
    {
        services.AddResiliencePipeline(ExternalConnectorPipelineKey, (builder, context) =>
        {
            var logger = context.ServiceProvider
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("DataProcessing.Shared.Resilience");

            builder
                // ── Timeout (innermost — applied per attempt, inside retry) ───────────
                .AddTimeout(new TimeoutStrategyOptions
                {
                    Timeout = TimeSpan.FromSeconds(30),
                    Name = "ConnectorTimeout"
                })

                // ── Retry with exponential back-off ──────────────────────────────────
                .AddRetry(new RetryStrategyOptions
                {
                    MaxRetryAttempts = 3,
                    BackoffType = DelayBackoffType.Exponential,
                    Delay = TimeSpan.FromSeconds(1),   // base: 1 s → 2 s → 4 s
                    UseJitter = true,
                    Name = "ConnectorRetry",
                    OnRetry = static args =>
                    {
                        // Logger is captured in the outer scope — no allocation on hot path.
                        return default;
                    }
                })

                // ── Circuit breaker (outermost) ───────────────────────────────────────
                .AddCircuitBreaker(new CircuitBreakerStrategyOptions
                {
                    FailureRatio = 1.0,          // all failures in the sampling window
                    MinimumThroughput = 5,        // need at least 5 calls before tripping
                    SamplingDuration = TimeSpan.FromSeconds(30),
                    BreakDuration = TimeSpan.FromSeconds(30),
                    Name = "ConnectorCircuitBreaker",

                    OnOpened = args =>
                    {
                        logger.LogWarning(
                            "Circuit breaker OPENED for external connector. " +
                            "Break duration: {BreakDuration}s. Outcome: {Outcome}",
                            args.BreakDuration.TotalSeconds,
                            args.Outcome.Exception?.Message ?? args.Outcome.Result?.ToString() ?? "unknown");
                        return default;
                    },

                    OnClosed = args =>
                    {
                        logger.LogInformation(
                            "Circuit breaker CLOSED — external connector is healthy again.");
                        return default;
                    },

                    OnHalfOpened = args =>
                    {
                        logger.LogInformation(
                            "Circuit breaker HALF-OPEN — probing external connector.");
                        return default;
                    }
                });
        });

        return services;
    }
}
