/**
 * @file src/config/env.ts
 * Centralized environment variable access and validation.
 * This file acts as the single source of truth for all environment-dependent configuration.
 */
interface EnvConfig {
    API_KEY: string;
    IMAGE_API_KEY: string;
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
/**
 * The consolidated Environment Configuration object.
 */
export declare const ENV: EnvConfig;
/**
 * Validates critical environment variables.
 * Call this at application startup.
 */
export declare function validateEnv(): void;
/**
 * Normalize a relative asset path against the configured BASE_URL.
 */
export declare function assetUrl(path: string): string;
export {};
