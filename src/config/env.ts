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
  VITE_ENABLE_PORTRAITS: boolean;
  /**
   * Public Google OAuth 2.0 client ID used for the optional "Sign in with
   * Google" path to the Gemini fallback. This is NOT a secret and NOT an API
   * key — it only identifies this deployment of Aralia to Google's consent
   * screen. When empty, the OAuth button is hidden and players use the
   * API-key path instead. Set via VITE_GOOGLE_CLIENT_ID by whoever deploys.
   */
  GOOGLE_CLIENT_ID: string;
  /** OAuth scopes requested when signing in with Google (space-separated). */
  GOOGLE_OAUTH_SCOPE: string;
}

// Access raw environment variables
// Strategy: Prefer strict Vite env vars (VITE_GEMINI_API_KEY).
// Fallback: Use process.env only outside browser contexts for legacy support or non-Vite runtimes.

const getApiKey = () => {
  // 1. Try modern Vite env var
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  // 2. In non-browser runtimes, use legacy shims (process.env.API_KEY / process.env.GEMINI_API_KEY)
  // Note: verify shim existence before access to avoid ReferenceError in strict ESM if shim is missing
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.env) {
    return process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  }
  return '';
};

const getImageApiKey = () => {
  // --- IMAGE GENERATION API KEY RESOLUTION PATH ---
  // The application resolves the Image Gen API Key in the following order:
  // 1. VITE_IMAGE_API_KEY (Vite .env or System Env) - Highest priority, specific to images.
  // 2. IMAGE_API_KEY / GEMINI_IMAGE_API_KEY (Process Env) - Legacy/System fallback for specific image key.
  // 3. API_KEY (General Fallback) - If no specific image key is found, we reuse the general Gemini API Key.
  //
  // This value is eventually exposed as `ENV.IMAGE_API_KEY`.
  // Consumers (like `src/services/PortraitService.ts` or `scripts/workflows/gemini/core/image-gen-mcp.ts`) import `ENV`
  // and use `ENV.IMAGE_API_KEY` to authenticate requests to the Gemini Imagen 3 model.

  // 1. Check for modern Vite-injected environment variable (specific to images)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_IMAGE_API_KEY) {
    return import.meta.env.VITE_IMAGE_API_KEY;
  }

  // 2. Check for legacy node-style process.env variables (specific to images)
  // This often catches System Environment Variables named 'IMAGE_API_KEY' or 'GEMINI_IMAGE_API_KEY'
  if (typeof process !== 'undefined' && process.env) {
    const specificKey = process.env.IMAGE_API_KEY || process.env.GEMINI_IMAGE_API_KEY;
    if (specificKey) return specificKey;
  }

  // 3. Fallback to the general API Key
  // If no image-specific key is provided, we assume the main GEMINI_API_KEY (e.g. from System Env)
  // is authorized for both text and image generation.
  return getApiKey();
};

const getGoogleClientId = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    return import.meta.env.VITE_GOOGLE_CLIENT_ID;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
  }
  return '';
};

// Default scope for calling the Gemini (Generative Language) API on behalf of
// the signed-in user. `cloud-platform` authorizes generateContent when the
// user's Google Cloud project has the Generative Language API enabled; the
// `userinfo.email` scope is only used to label the connected account in the UI.
const DEFAULT_GOOGLE_OAUTH_SCOPE =
  'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email';

const getGoogleOAuthScope = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_OAUTH_SCOPE) {
    return import.meta.env.VITE_GOOGLE_OAUTH_SCOPE;
  }
  if (typeof process !== 'undefined' && process.env && process.env.VITE_GOOGLE_OAUTH_SCOPE) {
    return process.env.VITE_GOOGLE_OAUTH_SCOPE;
  }
  return DEFAULT_GOOGLE_OAUTH_SCOPE;
};

const RAW_ENV = {
  API_KEY: getApiKey(),
  IMAGE_API_KEY: getImageApiKey(),
  GOOGLE_CLIENT_ID: getGoogleClientId(),
  GOOGLE_OAUTH_SCOPE: getGoogleOAuthScope(),
  BASE_URL: (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.BASE_URL : '/',
  DEV: (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.DEV : true,

  // Parse 'true', '1', 'on' as true for VITE_ENABLE_DEV_TOOLS
  VITE_ENABLE_DEV_TOOLS: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_DEV_TOOLS)
    ? ['true', '1', 'on'].includes((import.meta.env.VITE_ENABLE_DEV_TOOLS || '').toLowerCase())
    : undefined,

  // Parse 'true', '1', 'on' as true for VITE_ENABLE_PORTRAITS
  VITE_ENABLE_PORTRAITS: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_PORTRAITS)
    ? ['true', '1', 'on'].includes((import.meta.env.VITE_ENABLE_PORTRAITS || '').toLowerCase())
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
  GOOGLE_CLIENT_ID: RAW_ENV.GOOGLE_CLIENT_ID,
  GOOGLE_OAUTH_SCOPE: RAW_ENV.GOOGLE_OAUTH_SCOPE,
  BASE_URL: normalizedBaseUrl,
  DEV: RAW_ENV.DEV,
  // If not explicitly set, fall back to DEV to mirror previous “always on in dev” behavior.
  VITE_ENABLE_DEV_TOOLS: RAW_ENV.VITE_ENABLE_DEV_TOOLS ?? RAW_ENV.DEV,
  // If not explicitly set, allow portraits in dev by default.
  VITE_ENABLE_PORTRAITS: RAW_ENV.VITE_ENABLE_PORTRAITS ?? RAW_ENV.DEV,
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
