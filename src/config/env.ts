/**
 * @file src/config/env.ts
 * Centralized environment configuration.
 * Validates and exports environment variables and build constants.
 */

interface EnvConfig {
  API: {
    KEY: string | undefined;
  };
  APP: {
    BASE_URL: string;
    IS_DEV: boolean;
  };
}

// Accessing process.env.API_KEY because it is defined in vite.config.ts using define replacement
const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('⚠️ config: API_KEY is missing. AI features will not work.');
}

export const env: EnvConfig = {
  API: {
    KEY: apiKey,
  },
  APP: {
    BASE_URL: import.meta.env.BASE_URL,
    IS_DEV: import.meta.env.DEV,
  },
};
