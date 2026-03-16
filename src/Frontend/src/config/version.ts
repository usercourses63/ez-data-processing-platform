// Version information for the EZ Platform Frontend
// Values are injected at build time by Vite (see vite.config.ts `define`)

declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
declare const __GIT_COMMIT__: string;
declare const __GIT_BRANCH__: string;

export const VERSION_INFO = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
  buildDate: typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString().split('T')[0],
  environment: import.meta.env.MODE || 'development',
  gitCommit: typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'unknown',
  gitBranch: typeof __GIT_BRANCH__ !== 'undefined' ? __GIT_BRANCH__ : 'unknown',
};

export const getVersionString = (): string => {
  return `${VERSION_INFO.version} (${VERSION_INFO.buildDate})`;
};

export const getFullVersionInfo = (): string => {
  const parts = [
    `Version: ${VERSION_INFO.version}`,
    `Build: ${VERSION_INFO.buildDate}`,
    `Env: ${VERSION_INFO.environment}`,
  ];

  if (VERSION_INFO.gitCommit !== 'unknown') {
    parts.push(`Commit: ${VERSION_INFO.gitCommit}`);
  }

  if (VERSION_INFO.gitBranch !== 'unknown' && VERSION_INFO.gitBranch !== 'main') {
    parts.push(`Branch: ${VERSION_INFO.gitBranch}`);
  }

  return parts.join(' | ');
};
