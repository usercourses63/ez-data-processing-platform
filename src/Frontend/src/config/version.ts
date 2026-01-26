// Version information for the EZ Platform Frontend
// This file is automatically updated during the build process

export const VERSION_INFO = {
  version: 'v0.1.15',
  buildDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  environment: import.meta.env.MODE || 'development',
  gitCommit: import.meta.env.VITE_GIT_COMMIT || 'unknown',
  gitBranch: import.meta.env.VITE_GIT_BRANCH || 'main',
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
    parts.push(`Commit: ${VERSION_INFO.gitCommit.substring(0, 7)}`);
  }

  if (VERSION_INFO.gitBranch !== 'main') {
    parts.push(`Branch: ${VERSION_INFO.gitBranch}`);
  }

  return parts.join(' | ');
};
