/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/services/ai/oauthGeminiClient.ts
 *
 * Minimal REST adapter that lets the app call the Gemini (Generative Language)
 * API with an OAuth bearer token instead of an API key.
 *
 * WHY THIS EXISTS: the @google/genai browser SDK hard-requires an `apiKey` in
 * its constructor, so it cannot be used for the "Sign in with Google" path
 * where the player authenticates with their own OAuth token. This adapter
 * exposes just the surface the app consumes — `client.models.generateContent`
 * — so it can be dropped in wherever the SDK client is used (see aiClient.ts).
 *
 * It translates the SDK-style request `{ model, contents, config }` into the
 * REST body the endpoint expects, sends the token as `Authorization: Bearer`,
 * and returns a response object shaped like the SDK's GenerateContentResponse
 * (exposing `.text` plus the raw `candidates`) so existing callers work
 * unchanged.
 */
/** The subset of an SDK generateContent request that callers in this app use. */
interface GenerateContentArgs {
    model: string;
    contents: unknown;
    config?: Record<string, unknown>;
}
/** Response wrapper mirroring the fields the app reads off the SDK response. */
interface AdapterResponse {
    readonly text: string | undefined;
    candidates?: unknown;
    promptFeedback?: unknown;
    usageMetadata?: unknown;
}
/**
 * Build a minimal client that calls Gemini with an OAuth bearer token.
 * @param getAccessToken Lazily returns the current token, so token refreshes
 *   are picked up without rebuilding the client.
 */
export declare function createOAuthGeminiClient(getAccessToken: () => string): {
    models: {
        generateContent: (args: GenerateContentArgs) => Promise<AdapterResponse>;
    };
};
export type OAuthGeminiClient = ReturnType<typeof createOAuthGeminiClient>;
export {};
