using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Threading.RateLimiting;

namespace DataProcessing.Shared.Configuration;

/// <summary>
/// Configuration for ASP.NET Core built-in rate limiting middleware.
/// Protects all public-facing API services from abuse and overload.
/// Built-in to .NET 7+ (no additional NuGet package required on .NET 10).
/// </summary>
public static class RateLimitingConfiguration
{
    /// <summary>
    /// Policy name for general read API endpoints (GET).
    /// Limit: 100 requests per 10 seconds per IP.
    /// </summary>
    public const string GeneralPolicy = "api-general";

    /// <summary>
    /// Policy name for write API endpoints (POST, PUT, DELETE, PATCH).
    /// Limit: 20 requests per 10 seconds per IP.
    /// </summary>
    public const string WritePolicy = "api-write";

    /// <summary>
    /// Registers ASP.NET Core rate limiting services with default platform policies.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Application configuration (reserved for future config-driven limits).</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddDataProcessingRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddRateLimiter(options =>
        {
            // Global rejection handler — return 429 with Retry-After header
            options.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers["Retry-After"] =
                        ((int)retryAfter.TotalSeconds).ToString();
                }
                else
                {
                    // Default retry-after hint when lease metadata is unavailable
                    context.HttpContext.Response.Headers["Retry-After"] = "10";
                }

                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsync(
                    "{\"error\":\"Too many requests. Please retry after the indicated delay.\"}",
                    cancellationToken);
            };

            // General policy — 100 requests per 10-second fixed window per IP
            options.AddPolicy(GeneralPolicy, httpContext =>
            {
                var clientIp = GetClientIp(httpContext);
                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: $"{GeneralPolicy}:{clientIp}",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 100,
                        Window = TimeSpan.FromSeconds(10),
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit = 0,  // Reject immediately when limit is exceeded
                    });
            });

            // Write policy — 20 requests per 10-second fixed window per IP
            options.AddPolicy(WritePolicy, httpContext =>
            {
                var clientIp = GetClientIp(httpContext);
                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: $"{WritePolicy}:{clientIp}",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 20,
                        Window = TimeSpan.FromSeconds(10),
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit = 0,  // Reject immediately when limit is exceeded
                    });
            });
        });

        return services;
    }

    /// <summary>
    /// Adds rate limiting middleware to the pipeline.
    ///
    /// Applies the write policy (20 req/10s) to POST/PUT/DELETE/PATCH requests and
    /// the general policy (100 req/10s) to all other requests.
    /// Health check endpoints (/health, /health/ready, /health/live) are excluded.
    ///
    /// Placement: after UseCors(), before UseRouting()/MapControllers().
    /// </summary>
    /// <param name="app">The application builder.</param>
    /// <returns>The application builder for chaining.</returns>
    public static IApplicationBuilder UseDataProcessingRateLimiting(this IApplicationBuilder app)
    {
        // Short-circuit health endpoints and select the correct named policy for everything
        // else before the ASP.NET Core rate limiter middleware runs.
        app.Use(async (context, next) =>
        {
            var path = context.Request.Path.Value ?? string.Empty;

            // Exclude health check endpoints so Kubernetes probes are never throttled.
            if (path.StartsWith("/health", StringComparison.OrdinalIgnoreCase))
            {
                await next(context);
                return;
            }

            // Choose policy based on HTTP method
            var method = context.Request.Method;
            var isWriteMethod = HttpMethods.IsPost(method)
                             || HttpMethods.IsPut(method)
                             || HttpMethods.IsDelete(method)
                             || HttpMethods.IsPatch(method);

            var policyName = isWriteMethod ? WritePolicy : GeneralPolicy;

            // Attach rate-limit metadata to the endpoint so UseRateLimiter can read it.
            // We wrap the existing endpoint (if any) or create a minimal one.
            var existing = context.GetEndpoint();
            var metadata = new EndpointMetadataCollection(new EnableRateLimitingAttribute(policyName));
            context.SetEndpoint(new Endpoint(
                existing?.RequestDelegate ?? (ctx => next(ctx)),
                metadata,
                existing?.DisplayName ?? policyName));

            await next(context);
        });

        // The ASP.NET Core rate limiter reads IEnableRateLimitingMetadata from the endpoint
        // set above and enforces the matching named policy.
        app.UseRateLimiter();

        return app;
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    private static string GetClientIp(HttpContext context)
    {
        // Respect X-Forwarded-For when running behind a reverse proxy / ingress
        var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            // Header may contain a comma-separated list; the first entry is the originating client
            var firstIp = forwarded.Split(',')[0].Trim();
            if (!string.IsNullOrEmpty(firstIp))
                return firstIp;
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
