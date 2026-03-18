using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Globalization;
using System.Threading.RateLimiting;

namespace DataProcessing.Shared.Configuration;

/// <summary>
/// Configuration for ASP.NET Core built-in rate limiting middleware.
/// Protects all public-facing API services from abuse and overload.
/// Built-in to .NET 7+ (no additional NuGet package required on .NET 10).
///
/// Uses GlobalLimiter with per-IP partitioning so all endpoints are covered
/// without requiring [EnableRateLimiting] attributes on controllers.
/// Health check endpoints (/health*) are excluded from limiting.
/// </summary>
public static class RateLimitingConfiguration
{
    /// <summary>
    /// Policy name constant for general read API endpoints (GET).
    /// Kept for reference; limiting is applied via GlobalLimiter, not named policies.
    /// Limit: 100 requests per 10 seconds per IP.
    /// </summary>
    public const string GeneralPolicy = "api-general";

    /// <summary>
    /// Policy name constant for write API endpoints (POST, PUT, DELETE, PATCH).
    /// Kept for reference; limiting is applied via GlobalLimiter, not named policies.
    /// Limit: 20 requests per 10 seconds per IP.
    /// </summary>
    public const string WritePolicy = "api-write";

    /// <summary>
    /// Registers ASP.NET Core rate limiting services using a GlobalLimiter that
    /// partitions by client IP and HTTP method — no per-endpoint attributes needed.
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
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            {
                var path = httpContext.Request.Path.Value ?? string.Empty;

                // Health check endpoints are never rate-limited (Kubernetes probes, etc.)
                if (path.StartsWith("/health", StringComparison.OrdinalIgnoreCase))
                {
                    return RateLimitPartition.GetNoLimiter("health");
                }

                var clientIp = GetClientIp(httpContext);
                var method = httpContext.Request.Method;

                // Write operations get a stricter limit: 20 req / 10s per IP
                if (HttpMethods.IsPost(method) ||
                    HttpMethods.IsPut(method) ||
                    HttpMethods.IsDelete(method) ||
                    HttpMethods.IsPatch(method))
                {
                    return RateLimitPartition.GetFixedWindowLimiter(
                        $"write:{clientIp}",
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 20,
                            Window = TimeSpan.FromSeconds(10),
                            QueueLimit = 0,
                        });
                }

                // All other requests (GET, HEAD, OPTIONS, etc.): 100 req / 10s per IP
                return RateLimitPartition.GetFixedWindowLimiter(
                    $"general:{clientIp}",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 100,
                        Window = TimeSpan.FromSeconds(10),
                        QueueLimit = 0,
                    });
            });

            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Return 429 with Retry-After header and a JSON error body
            options.OnRejected = async (context, cancellationToken) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                }
                else
                {
                    context.HttpContext.Response.Headers.RetryAfter = "10";
                }

                context.HttpContext.Response.ContentType = "application/json";
                await context.HttpContext.Response.WriteAsync(
                    """{"error":"Too many requests. Please retry after the indicated time.","status":429}""",
                    cancellationToken);
            };
        });

        return services;
    }

    /// <summary>
    /// Adds the ASP.NET Core rate limiter middleware to the pipeline.
    /// Placement: after UseCors(), before UseRouting()/MapControllers().
    /// </summary>
    /// <param name="app">The application builder.</param>
    /// <returns>The application builder for chaining.</returns>
    public static IApplicationBuilder UseDataProcessingRateLimiting(
        this IApplicationBuilder app)
    {
        app.UseRateLimiter();
        return app;
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    private static string GetClientIp(HttpContext httpContext)
    {
        // Prefer X-Forwarded-For when running behind a reverse proxy / ingress.
        // The first IP in the list is the originating client.
        var forwarded = httpContext.Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrEmpty(forwarded))
        {
            var firstIp = forwarded.Split(',')[0].Trim();
            if (System.Net.IPAddress.TryParse(firstIp, out _))
                return firstIp;
        }

        return httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
