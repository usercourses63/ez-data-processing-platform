using k8s;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using DataProcessing.Shared.Services;

namespace DataProcessing.Shared.Configuration;

/// <summary>
/// Configuration for Kubernetes client and NAS resource management services.
/// Supports both in-cluster (K8s/OCP pod) and local development (kubeconfig) modes.
/// v0.2.0: NAS/NFS Architecture Support
/// </summary>
public static class KubernetesConfiguration
{
    /// <summary>
    /// Add Kubernetes client and NAS resource service to DI container.
    /// Auto-detects environment: in-cluster config for K8s/OCP pods, kubeconfig fallback for local development.
    /// </summary>
    /// <param name="services">Service collection</param>
    /// <param name="configuration">Application configuration</param>
    /// <returns>Service collection for chaining</returns>
    /// <remarks>
    /// Configuration options:
    /// - Kubernetes:Context - kubeconfig context name (default: "minikube")
    /// - Kubernetes:KubeConfigPath - optional override for kubeconfig file path
    /// - Kubernetes:Namespace - default namespace for operations (default: "ez-platform")
    /// </remarks>
    public static IServiceCollection AddKubernetesClient(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Register Kubernetes client as singleton
        services.AddSingleton<k8s.Kubernetes>(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<k8s.Kubernetes>>();

            try
            {
                // Try in-cluster config first (for K8s/OCP pods)
                var config = KubernetesClientConfiguration.InClusterConfig();
                // Workaround: .NET OpenSSL X509Chain.Build NullReferenceException on some container runtimes
                config.SkipTlsVerify = true;
                logger.LogInformation("Using in-cluster Kubernetes configuration");
                return new k8s.Kubernetes(config);
            }
            catch (k8s.Exceptions.KubeConfigException)
            {
                // Fall back to kubeconfig for local development
                var contextName = configuration["Kubernetes:Context"] ?? "minikube";
                var kubeConfigPath = configuration["Kubernetes:KubeConfigPath"];

                KubernetesClientConfiguration config;
                if (!string.IsNullOrEmpty(kubeConfigPath))
                {
                    config = KubernetesClientConfiguration.BuildConfigFromConfigFile(
                        kubeConfigPath,
                        contextName);
                    logger.LogInformation(
                        "Using kubeconfig from path {KubeConfigPath} with context {Context}",
                        kubeConfigPath,
                        contextName);
                }
                else
                {
                    config = KubernetesClientConfiguration.BuildConfigFromConfigFile(
                        currentContext: contextName);
                    logger.LogInformation("Using default kubeconfig with context {Context}", contextName);
                }

                return new k8s.Kubernetes(config);
            }
        });

        // Also register as IKubernetes interface for dependency injection
        services.AddSingleton<IKubernetes>(sp => sp.GetRequiredService<k8s.Kubernetes>());

        // Register NasResourceService
        services.AddSingleton<INasResourceService, NasResourceService>();

        return services;
    }

    /// <summary>
    /// Convenience method to add only NasResourceService when Kubernetes client is already registered.
    /// Use this when AddCredentialResolver has already registered IKubernetes.
    /// </summary>
    /// <param name="services">Service collection</param>
    /// <returns>Service collection for chaining</returns>
    public static IServiceCollection AddNasResourceService(this IServiceCollection services)
    {
        services.AddSingleton<INasResourceService, NasResourceService>();
        return services;
    }
}
