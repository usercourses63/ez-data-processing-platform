import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Read version from package.json
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const gitCommit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'unknown'; } })();
const gitBranch = (() => { try { return execSync('git rev-parse --abbrev-ref HEAD').toString().trim(); } catch { return 'unknown'; } })();
const buildDate = new Date().toISOString().split('T')[0];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr(),
    tsconfigPaths()
  ],

  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version}`),
    __BUILD_DATE__: JSON.stringify(buildDate),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __GIT_BRANCH__: JSON.stringify(gitBranch),
  },

  server: {
    host: '127.0.0.1',  // Use IPv4 explicitly to avoid IPv6 permission issues
    port: 3002,  // Using 3002 instead of 3000 due to port conflict
    allowedHosts: ['host.docker.internal', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false
      },
      '/hubs': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },

  build: {
    outDir: 'build',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-antd': ['antd', '@ant-design/icons'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-monaco': ['monaco-editor', '@monaco-editor/react'],
          'vendor-utils': ['lodash', 'axios', 'moment', 'ajv']
        }
      }
    },
    // Increase chunk size warning limit for Monaco Editor
    chunkSizeWarningLimit: 1500
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'antd',
      '@ant-design/icons',
      '@tanstack/react-query',
      'i18next',
      'react-i18next',
      'lodash',
      'axios',
      'moment',
      'ajv'
    ]
  },

  // Define environment variable prefix
  envPrefix: 'VITE_',

  // Resolve configuration
  resolve: {
    alias: {
      // Add any path aliases if needed
    }
  }
});
