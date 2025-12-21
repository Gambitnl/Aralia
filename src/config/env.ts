/**
 * @file src/config/env.ts
 * Centralized environment variable access and validation.
 * This file acts as the single source of truth for all environment-dependent configuration.
 */

// Define the shape of our environment configuration
interface EnvConfig {
  API_KEY: string;
  IMAGE_API_KEY: string;  // Separate key for Gemini image generation
  BASE_URL: string;
  DEV: boolean;
  VITE_ENABLE_DEV_TOOLS: boolean;
}

// Access raw environment variables
// Strategy: Prefer strict Vite env vars (VITE_GEMINI_API_KEY).
// Fallback: Use process.env shims (defined in vite.config.ts) for legacy support or non-Vite contexts.
// TODO: Avoid shipping API_KEY to the client bundle; route AI calls through a server/proxy and leave ENV.API_KEY empty in browser builds.

const getApiKey = () => {
  // 1. Try modern Vite env var
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  // 2. Try legacy shim (process.env.API_KEY or process.env.GEMINI_API_KEY)
  // Note: verify shim existence before access to avoid ReferenceError in strict ESM if shim is missing
  if (typeof process !== 'undefined' && process.env) {
    return process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  }
  return '';
};

const getImageApiKey = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_IMAGE_API_KEY) {
    return import.meta.env.VITE_IMAGE_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.IMAGE_API_KEY || process.env.GEMINI_IMAGE_API_KEY || '';
  }
  return '';
};

const RAW_ENV = {
  API_KEY: getApiKey(),
  IMAGE_API_KEY: getImageApiKey(),
  BASE_URL: (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.BASE_URL : '/',
  DEV: (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.DEV : true,

  // Parse 'true', '1', 'on' as true for VITE_ENABLE_DEV_TOOLS
  VITE_ENABLE_DEV_TOOLS: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_DEV_TOOLS)
    ? ['true', '1', 'on'].includes((import.meta.env.VITE_ENABLE_DEV_TOOLS || '').toLowerCase())
    : undefined,
};

// Ensure BASE_URL always has a trailing slash for consistency
const normalizedBaseUrl = RAW_ENV.BASE_URL.endsWith('/')
  ? RAW_ENV.BASE_URL
  : `${RAW_ENV.BASE_URL}/`;

/**
 * The consolidated Environment Configuration object.
 */
export const ENV: EnvConfig = {
  API_KEY: RAW_ENV.API_KEY,
  IMAGE_API_KEY: RAW_ENV.IMAGE_API_KEY,
  BASE_URL: normalizedBaseUrl,
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
  // Check if the path is an absolute URL (http:// or https://)
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  // Ensure BASE_URL has a trailing slash
  const baseUrl = ENV.BASE_URL.endsWith('/') ? ENV.BASE_URL : `${ENV.BASE_URL}/`;

  // Note: use /^\// not /^\\/ - double backslash breaks esbuild parser
  return `${baseUrl}${path.replace(/^\//, '')}`;
}
