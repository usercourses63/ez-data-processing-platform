using DataProcessing.DataSourceManagement.Models;
using k8s;
using k8s.Models;

namespace DataProcessing.DataSourceManagement.Services;

/// <summary>
/// Queries the Kubernetes API for pod, service, and cluster status.
/// Uses the k8s.IKubernetes client registered via AddKubernetesClient.
/// v0.2.0: SignalR Real-Time Updates (MON-07)
/// </summary>
public class KubernetesMonitoringService : IKubernetesMonitoringService
{
    private readonly IKubernetes _kubeClient;
    private readonly ILogger<KubernetesMonitoringService> _logger;
    private const string Namespace = "ez-platform";

    // Map of known EZ Platform service names to display names and ports
    private static readonly Dictionary<string, (string DisplayName, int Port)> KnownServices = new()
    {
        ["datasource-management"] = ("DataSource Management", 5001),
        ["metrics-configuration"] = ("Metrics Configuration", 5002),
        ["validation"] = ("Validation", 5003),
        ["scheduling"] = ("Scheduling", 5004),
        ["invalid-records"] = ("Invalid Records", 5007),
        ["fileprocessor"] = ("File Processor", 5008),
        ["output"] = ("Output", 5009),
        ["filediscovery"] = ("File Discovery", 5006),
    };

    public KubernetesMonitoringService(
        IKubernetes kubeClient,
        ILogger<KubernetesMonitoringService> logger)
    {
        _kubeClient = kubeClient;
        _logger = logger;
    }

    public async Task<List<PodStatusDto>> GetPodStatusesAsync(CancellationToken ct)
    {
        try
        {
            var pods = await _kubeClient.CoreV1.ListNamespacedPodAsync(Namespace, cancellationToken: ct);
            var result = new List<PodStatusDto>();

            foreach (var pod in pods.Items)
            {
                var restarts = pod.Status?.ContainerStatuses?
                    .Sum(cs => cs.RestartCount) ?? 0;

                var age = pod.Metadata?.CreationTimestamp.HasValue == true
                    ? FormatAge(DateTime.UtcNow - pod.Metadata.CreationTimestamp.Value)
                    : "unknown";

                // Extract service name from pod labels
                var service = pod.Metadata?.Labels != null && pod.Metadata.Labels.TryGetValue("app", out var appLabel)
                    ? appLabel : "unknown";

                result.Add(new PodStatusDto
                {
                    Name = pod.Metadata?.Name ?? "unknown",
                    Service = service,
                    Status = MapPodPhase(pod.Status?.Phase),
                    Restarts = restarts,
                    Cpu = GetResourceValue(pod, "cpu"),
                    Memory = GetResourceValue(pod, "memory"),
                    Age = age,
                    Node = pod.Spec?.NodeName ?? "unknown"
                });
            }

            return result;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to get pod statuses from Kubernetes API");
            return new List<PodStatusDto>();
        }
    }

    public async Task<List<ServiceStatusDto>> GetServiceStatusesAsync(CancellationToken ct)
    {
        try
        {
            var endpoints = await _kubeClient.CoreV1.ListNamespacedEndpointsAsync(Namespace, cancellationToken: ct);
            var result = new List<ServiceStatusDto>();

            foreach (var ep in endpoints.Items)
            {
                var name = ep.Metadata?.Name ?? "unknown";

                // Only include known EZ Platform services
                if (!KnownServices.TryGetValue(name, out var info))
                    continue;

                var hasReadyAddresses = ep.Subsets?.Any(s => s.Addresses?.Count > 0) == true;

                result.Add(new ServiceStatusDto
                {
                    Id = name,
                    Name = name,
                    DisplayName = info.DisplayName,
                    Status = hasReadyAddresses ? "healthy" : "error",
                    Port = info.Port
                });
            }

            // Add any known services not found in endpoints as "unknown"
            foreach (var (svcName, info) in KnownServices)
            {
                if (!result.Any(r => r.Name == svcName))
                {
                    result.Add(new ServiceStatusDto
                    {
                        Id = svcName,
                        Name = svcName,
                        DisplayName = info.DisplayName,
                        Status = "unknown",
                        Port = info.Port
                    });
                }
            }

            return result;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to get service statuses from Kubernetes API");
            return new List<ServiceStatusDto>();
        }
    }

    public async Task<ClusterInfoDto> GetClusterInfoAsync(CancellationToken ct)
    {
        try
        {
            var clusterInfo = new ClusterInfoDto();

            // Get K8s version
            try
            {
                var version = await _kubeClient.Version.GetCodeAsync(ct);
                clusterInfo.Version = $"{version.Major}.{version.Minor}";
            }
            catch
            {
                clusterInfo.Version = "unknown";
            }

            // Get node count
            try
            {
                var nodes = await _kubeClient.CoreV1.ListNodeAsync(cancellationToken: ct);
                clusterInfo.NodeCount = nodes.Items.Count;
            }
            catch
            {
                clusterInfo.NodeCount = 0;
            }

            // Get pod counts
            var pods = await _kubeClient.CoreV1.ListNamespacedPodAsync(Namespace, cancellationToken: ct);
            clusterInfo.TotalPods = pods.Items.Count;
            clusterInfo.HealthyPods = pods.Items.Count(p =>
                p.Status?.Phase is "Running" or "Succeeded");

            return clusterInfo;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to get cluster info from Kubernetes API");
            return new ClusterInfoDto();
        }
    }

    private static string MapPodPhase(string? phase) => phase switch
    {
        "Running" => "Running",
        "Pending" => "Pending",
        "Failed" => "Failed",
        "Succeeded" => "Succeeded",
        _ => "Unknown"
    };

    private static string FormatAge(TimeSpan age)
    {
        if (age.TotalDays >= 1)
            return $"{(int)age.TotalDays}d";
        if (age.TotalHours >= 1)
            return $"{(int)age.TotalHours}h";
        if (age.TotalMinutes >= 1)
            return $"{(int)age.TotalMinutes}m";
        return $"{(int)age.TotalSeconds}s";
    }

    private static string GetResourceValue(V1Pod pod, string resourceName)
    {
        var container = pod.Spec?.Containers?.FirstOrDefault();
        if (container?.Resources?.Requests == null)
            return "0";

        return container.Resources.Requests.TryGetValue(resourceName, out var value)
            ? value.ToString()
            : "0";
    }
}
