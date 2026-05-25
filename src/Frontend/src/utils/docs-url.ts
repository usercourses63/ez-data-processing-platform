/**
 * Documentation URL Utility
 *
 * Resolution order for getDocsBaseUrl():
 *   1. window.EZ_CONFIG.docsUrl  — Helm-injected runtime config (production primary path)
 *   2. http://{hostname}:30800   — auto-detect for dev/local against a K8s NodePort
 *   3. /docs                     — last-resort fallback for path-routed ingress
 *
 * The runtime-config path is set per-deploy via Helm:
 *   helm install ... --set services.frontend.config.docsUrl=https://docs.example.com
 * which becomes EZ_DOCS_URL env var on the frontend pod, which docker-entrypoint.sh
 * writes into /usr/share/nginx/html/config.js before exec-ing nginx.
 */

declare global {
  interface Window {
    EZ_CONFIG?: {
      docsUrl?: string;
    };
  }
}

/**
 * Check if hostname is in RFC1918 private IP range or localhost
 */
const isPrivateNetwork = (hostname: string): boolean => {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.startsWith('192.168.')) return true;
  if (hostname.startsWith('10.')) return true;
  // 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) return true;
  return false;
};

/**
 * Environment detection based on hostname
 */
export const isProduction = (): boolean => {
  return !isPrivateNetwork(window.location.hostname);
};

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => !isProduction();

/**
 * Get the base URL for documentation portal
 *
 * Development: http://{hostname}:30800/docs (K8s NodePort)
 * Production: /docs (relative path for path-based routing)
 *
 * @returns The base URL for the documentation portal
 */
export const getDocsBaseUrl = (): string => {
  // 1. Runtime config injected by Helm at deploy time wins.
  const configured = window.EZ_CONFIG?.docsUrl;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  // 2. Dev/local fallback: K8s NodePort heuristic.
  if (isDevelopment()) {
    return `http://${window.location.hostname}:30800`;
  }

  // 3. Last-resort: path-based ingress route.
  return '/docs';
};

/**
 * Get URL for a specific documentation page
 *
 * @param path - The documentation path (e.g., 'user-guide-he', 'components/schema-editor')
 * @returns Full URL to the documentation page
 */
export const getDocsUrl = (path?: string): string => {
  const baseUrl = getDocsBaseUrl();
  if (!path) {
    return baseUrl;
  }
  // Ensure path doesn't start with slash to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${baseUrl}/${cleanPath}`;
};

/**
 * Get URL for Hebrew user guide
 *
 * @returns URL to the Hebrew user guide
 */
export const getHebrewUserGuideUrl = (): string => {
  return getDocsUrl('user-guide-he');
};

/**
 * Get URL for component documentation
 *
 * @param component - Component name (e.g., 'schema-editor', 'nas-devices')
 * @returns URL to the component documentation
 */
export const getComponentDocsUrl = (component: string): string => {
  return getDocsUrl(`components/${component}`);
};

/**
 * Open documentation in a new browser tab
 *
 * @param path - Optional path within documentation
 */
export const openDocsInNewTab = (path?: string): void => {
  const url = getDocsUrl(path);
  window.open(url, '_blank', 'noopener,noreferrer');
};

export default getDocsUrl;
