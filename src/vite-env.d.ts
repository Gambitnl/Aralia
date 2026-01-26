/// <reference types="vite/client" />
/// <reference path="./types/three-jsx.d.ts" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_ENABLE_DEV_TOOLS: string;
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
