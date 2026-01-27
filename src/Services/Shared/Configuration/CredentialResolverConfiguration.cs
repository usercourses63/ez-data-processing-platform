using k8s;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using DataProcessing.Shared.Services;

namespace DataProcessing.Shared.Configuration;

/// <summary>
/// Configuration for credential resolution from Kubernetes Secrets
/// v0.2.0: External File Access Support
/// </summary>
public static class CredentialResolverConfiguration
{
    /// <summary>
    /// Add KubernetesCredentialResolver to DI container
    /// Automatically detects in-cluster vs local development configuration
    /// </summary>
    /// <param name="services">Service collection</param>
    /// <param name="configuration">Application configuration</param>
    /// <returns>Service collection for chaining</returns>
    public static IServiceCollection AddCredentialResolver(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Get default namespace from config (ConfigMap: Credentials__SecretNamespace)
        var defaultNamespace = configuration.GetValue<string>("Credentials__SecretNamespace")
            ?? "ez-platform";

        // Create Kubernetes client configuration
        // Automatically uses in-cluster config in K8s, or ~/.kube/config locally
        KubernetesClientConfiguration k8sConfig;
        try
        {
            k8sConfig = KubernetesClientConfiguration.IsInCluster()
                ? KubernetesClientConfiguration.InClusterConfig()
                : KubernetesClientConfiguration.BuildDefaultConfig();
        }
        catch (Exception ex)
        {
            // Fallback: If Kubernetes config fails, log warning but continue
            // This allows services to run without K8s (e.g., local development without kubeconfig)
            var tempLogger = services.BuildServiceProvider().GetRequiredService<ILogger<KubernetesCredentialResolver>>();
            tempLogger.LogWarning(ex, "Failed to load Kubernetes configuration. Credential resolution will not work.");

            // Register a no-op resolver that always throws
            services.AddSingleton<ICredentialResolver, NoOpCredentialResolver>();
            return services;
        }

        var kubernetesClient = new Kubernetes(k8sConfig);

        // Register IKubernetes as singleton
        services.AddSingleton<IKubernetes>(kubernetesClient);

        // Register KubernetesCredentialResolver with default namespace
        services.AddSingleton<ICredentialResolver>(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<KubernetesCredentialResolver>>();
            var k8s = sp.GetRequiredService<IKubernetes>();
            return new KubernetesCredentialResolver(k8s, logger, defaultNamespace);
        });

        return services;
    }
}

/// <summary>
/// No-op credential resolver for environments without Kubernetes access
/// Used as fallback when K8s config cannot be loaded
/// </summary>
internal class NoOpCredentialResolver : ICredentialResolver
{
    public Task<ServerCredentials> ResolveAsync(string secretRef, CancellationToken cancellationToken = default)
    {
        throw new CredentialResolutionException(
            secretRef,
            "Kubernetes credential resolution is not available. Check Kubernetes configuration.");
    }

    public Task<bool> ExistsAsync(string secretRef, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(false);
    }
}
