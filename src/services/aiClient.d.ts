/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file aiClient.ts
 * This service module centralizes access to the Google Gemini client.
 *
 * Credential resolution (highest priority first):
 *   1. The player's OWN runtime credential — an API key they pasted or an OAuth
 *      token from signing in with Google (see ./ai/aiCredentials.ts). This is
 *      the primary path: nothing is baked into the app, and the credential
 *      lives only in the player's browser.
 *   2. A build-time API key (ENV.API_KEY) for self-hosted deployments that
 *      choose to bake one in. Optional — most deployments leave it unset.
 *
 * All Gemini-backed services (gemini/core, gemini/encounters, ttsService)
 * import the shared `ai` proxy and `isAiEnabled()` from here, so switching
 * credentials at runtime transparently reroutes every one of them.
 *
 * Pattern: Singleton Proxy. We use a Proxy so `ai` can be exported safely even
 * when no credential is configured; property access throws a descriptive error
 * only if actually used without a credential.
 */
import { GoogleGenAI } from "@google/genai";
/**
 * The slice of the GoogleGenAI surface the app actually uses. Kept structurally
 * loose so both the real SDK client and the OAuth REST adapter satisfy it and
 * are interchangeable. Consumers still see the precise SDK types via the `ai`
 * proxy, which is typed as GoogleGenAI.
 */
interface ActiveAiClient {
    models: {
        generateContent: (...args: any[]) => Promise<any>;
    };
}
/**
 * Checks if a usable Gemini credential is available (runtime or build-time).
 * @returns {boolean} True if Gemini calls can be made.
 */
export declare const isAiEnabled: () => boolean;
/**
 * Returns the active AI client, or throws if none is configured.
 * @throws {Error} If no credential is available.
 */
export declare const getAiClient: () => ActiveAiClient;
/**
 * The shared Gemini client instance, resolved dynamically per access so it
 * always reflects the current runtime credential.
 *
 * @example
 * await ai.models.generateContent(...)
 */
export declare const ai: GoogleGenAI;
export {};
