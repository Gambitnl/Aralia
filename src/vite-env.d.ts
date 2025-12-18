/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_DEV_TOOLS: string;
  // Other env vars can be added here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
