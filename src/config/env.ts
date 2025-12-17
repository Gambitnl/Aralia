/**
 * @file src/config/env.ts
 * Centralized environment variable access and validation.
 * This file acts as the single source of truth for all environment-dependent configuration.
 */

// Define the shape of our environment configuration
interface EnvConfig {
  API_KEY: string;
  BASE_URL: string;
  DEV: boolean;
  VITE_ENABLE_DEV_TOOLS: boolean;
}

// Access raw environment variables
// Note: process.env is shimmed in vite.config.ts for API_KEY
const RAW_ENV = {
  API_KEY: process.env.API_KEY || process.env.GEMINI_API_KEY || '',
  BASE_URL: import.meta.env.BASE_URL,
  DEV: import.meta.env.DEV,
  // Parse 'true', '1', 'on' as true for VITE_ENABLE_DEV_TOOLS
  VITE_ENABLE_DEV_TOOLS: import.meta.env.VITE_ENABLE_DEV_TOOLS
    ? ['true', '1', 'on'].includes((import.meta.env.VITE_ENABLE_DEV_TOOLS || '').toLowerCase())
    : undefined,
};

/**
 * The consolidated Environment Configuration object.
 */
export const ENV: EnvConfig = {
  API_KEY: RAW_ENV.API_KEY,
  BASE_URL: RAW_ENV.BASE_URL,
  DEV: RAW_ENV.DEV,
  // If not explicitly set, fall back to DEV to mirror previous “always on in dev” behavior.
  VITE_ENABLE_DEV_TOOLS: RAW_ENV.VITE_ENABLE_DEV_TOOLS ?? RAW_ENV.DEV,
};

/**
 * Validates critical environment variables.
 * Call this at application startup.
 */
export function validateEnv() {
  const missing: string[] = [];

  if (!ENV.API_KEY) {
    // API_KEY is technically optional for the app to start, but required for AI features.
    // We log a warning instead of throwing, to match aiClient behavior.
    console.warn('config/env: API_KEY is missing. AI features will be disabled.');
  }

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    // throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Normalize a relative asset path against the configured BASE_URL.
 */
export function assetUrl(path: string): string {
  // Note: use /^\// not /^\\/ - double backslash breaks esbuild parser
  return `${ENV.BASE_URL}${path.replace(/^\//, '')}`;
}
