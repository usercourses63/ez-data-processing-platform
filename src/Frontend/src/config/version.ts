// Version information for the EZ Platform Frontend
// This file is automatically updated during the build process

export const VERSION_INFO = {
  version: 'v0.1.14',
  buildDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  environment: process.env.NODE_ENV || 'development',
  gitCommit: process.env.REACT_APP_GIT_COMMIT || 'unknown',
  gitBranch: process.env.REACT_APP_GIT_BRANCH || 'main',
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
