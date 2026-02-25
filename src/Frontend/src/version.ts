// Version information injected during CI/CD build
// Placeholders are replaced by sed in Dockerfile during Docker build
//
// Usage in React components:
//   import { APP_VERSION, COMMIT_SHA } from './version';
//   <div>Version: {APP_VERSION} ({COMMIT_SHA})</div>

export const APP_VERSION = '__VERSION__';
export const COMMIT_SHA = '__COMMIT_SHA__';
