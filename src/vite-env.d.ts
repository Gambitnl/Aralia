/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_DEV_TOOLS: string;
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
