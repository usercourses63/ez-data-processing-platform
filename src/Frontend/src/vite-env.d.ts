/// <reference types="vite/client" />

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // Add more environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
