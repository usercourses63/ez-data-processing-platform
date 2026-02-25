/**
 * Documentation URL Utility
 *
 * Runtime environment detection for Docusaurus documentation portal URLs.
 * Supports both development (localhost:3000) and production (/docs) environments.
 *
 * Per project decisions:
 * - Development: localhost:3000/docs (standalone Docusaurus dev server)
 * - Production: /docs (path-based routing in K8s Ingress/OCP Route)
 */

/**
 * Environment detection based on hostname
 */
export const isProduction = (): boolean => {
  const hostname = window.location.hostname;
  // Development environments: localhost, 127.0.0.1, or minikube IP patterns
  const devPatterns = ['localhost', '127.0.0.1', '192.168.'];
  return !devPatterns.some((pattern) => hostname.includes(pattern));
};

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => !isProduction();

/**
 * Get the base URL for documentation portal
 *
 * Development: http://localhost:3000/docs
 * Production: /docs (relative path for path-based routing)
 *
 * @returns The base URL for the documentation portal
 */
export const getDocsBaseUrl = (): string => {
  if (isDevelopment()) {
    // In development, Docusaurus runs on port 3000 with baseUrl /docs/
    return 'http://localhost:3000/docs';
  }
  // In production, docs are served at /docs path
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
