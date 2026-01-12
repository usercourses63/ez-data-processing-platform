import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr(),
    tsconfigPaths()
  ],

  server: {
    host: '127.0.0.1',  // Use IPv4 explicitly to avoid IPv6 permission issues
    port: 3002,  // Using 3002 instead of 3000 due to port conflict
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false
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
