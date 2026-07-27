/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/services/ai/aiCredentials.ts
 *
 * Runtime store for the player's OWN Google Gemini credentials.
 *
 * Aralia's narrative AI runs on local Ollama by default. When Ollama is not
 * available, the player may opt in to fall back to Google Gemini using a
 * credential they supply themselves — either:
 *   - a Google AI Studio API key (https://aistudio.google.com/apikey), or
 *   - an OAuth access token obtained by signing in with their own Google
 *     account (see ./googleOAuth.ts).
 *
 * NOTHING is baked into the app: no shared key ships with Aralia. The
 * credential lives only in the player's browser (localStorage) and is sent
 * only to Google's API from the player's own machine. This module is the
 * single source of truth for reading/writing that credential and for deciding
 * whether the Gemini fallback is "ready".
 *
 * SECURITY NOTE: an API key stored in localStorage is readable by any script
 * running on the page. This is an accepted trade-off for a client-only app
 * where the key belongs to the player (their key, their quota). Players who
 * prefer not to persist a key can use the OAuth path, whose token is
 * short-lived and expires automatically.
 */
export type GeminiAuthMode = 'apiKey' | 'oauth';
export interface AiCredentialsState {
    /** Whether to fall back to Gemini when Ollama is unavailable. */
    geminiFallbackEnabled: boolean;
    /** Which Gemini credential the player intends to use. */
    geminiAuthMode: GeminiAuthMode;
    /** The player's own Google AI Studio API key (plaintext, local only). */
    geminiApiKey: string;
    /** The player's own OAuth access token (short-lived). */
    oauthAccessToken: string;
    /** Epoch ms when the OAuth token expires (0 when none). */
    oauthExpiresAt: number;
    /** Optional display label for the signed-in Google account. */
    oauthEmail: string;
}
/** A resolved, currently-usable Gemini credential. */
export type ActiveGeminiCredential = {
    mode: 'apiKey';
    apiKey: string;
} | {
    mode: 'oauth';
    accessToken: string;
};
type Listener = () => void;
/** Returns a snapshot of the current credentials state. */
export declare function getAiCredentials(): AiCredentialsState;
/**
 * Monotonic version counter. Consumers that cache a derived object (like the
 * GoogleGenAI client) compare this to know when to rebuild.
 */
export declare function getCredentialsVersion(): number;
/** Subscribe to credential changes. Returns an unsubscribe function. */
export declare function subscribeAiCredentials(listener: Listener): () => void;
export declare function setGeminiFallbackEnabled(enabled: boolean): void;
export declare function setGeminiAuthMode(mode: GeminiAuthMode): void;
export declare function setGeminiApiKey(apiKey: string): void;
export declare function clearGeminiApiKey(): void;
/**
 * Store an OAuth access token obtained from the player's own Google sign-in.
 * @param accessToken The bearer token.
 * @param expiresInSeconds Lifetime in seconds as reported by Google.
 * @param email Optional account label for display.
 * @param nowMs Injectable clock for tests.
 */
export declare function setOAuthToken(accessToken: string, expiresInSeconds: number, email?: string, nowMs?: number): void;
export declare function clearOAuthToken(): void;
/** True when a stored OAuth token exists and has not (nearly) expired. */
export declare function isOAuthTokenValid(nowMs?: number): boolean;
/**
 * Resolve the credential the player has actually configured for the selected
 * auth mode, or null if nothing usable is available. OAuth tokens that have
 * expired resolve to null so the caller can prompt for re-authentication.
 */
export declare function getActiveGeminiCredential(nowMs?: number): ActiveGeminiCredential | null;
/** True when any usable Gemini credential is configured, regardless of opt-in. */
export declare function hasGeminiCredential(nowMs?: number): boolean;
/**
 * True when the player has opted in to the Gemini fallback AND supplied a
 * usable credential for it. This is the gate the narrative services check
 * before redirecting an unavailable-Ollama call to Gemini.
 */
export declare function isGeminiFallbackReady(nowMs?: number): boolean;
/** Test-only: reset the in-memory cache so the next read re-hydrates. */
export declare function __resetAiCredentialsCacheForTests(): void;
export {};
