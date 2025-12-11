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
  VITE_ENABLE_DEV_TOOLS: ['true', '1', 'on'].includes(
    (import.meta.env.VITE_ENABLE_DEV_TOOLS || '').toLowerCase()
  ),
};

/**
 * The consolidated Environment Configuration object.
 */
export const ENV: EnvConfig = {
  API_KEY: RAW_ENV.API_KEY,
  BASE_URL: RAW_ENV.BASE_URL,
  DEV: RAW_ENV.DEV,
  // Default to TRUE if not set, to preserve existing behavior where the flag was hardcoded true.
  // In a real prod scenario, we might default to false.
  // However, the previous code was `export const USE_DUMMY_CHARACTER_FOR_DEV = true;`
  // So we default to true unless explicitly disabled via VITE_ENABLE_DEV_TOOLS='false'.
  // actually, let's make it configurable. If VITE_ENABLE_DEV_TOOLS is present, use it.
  // If not present, default to TRUE for now to minimize breakage, OR better:
  // Default to `DEV` mode.
  VITE_ENABLE_DEV_TOOLS: import.meta.env.VITE_ENABLE_DEV_TOOLS
    ? ['true', '1', 'on'].includes((import.meta.env.VITE_ENABLE_DEV_TOOLS || '').toLowerCase())
    : true, // Legacy default was true.
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
