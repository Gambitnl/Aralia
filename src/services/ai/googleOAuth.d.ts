/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/services/ai/googleOAuth.ts
 *
 * Thin wrapper around Google Identity Services (GIS) for the optional
 * "Sign in with Google" path to the Gemini fallback.
 *
 * The player signs in with THEIR OWN Google account and Aralia receives a
 * short-lived OAuth access token scoped to the Generative Language API. The
 * token belongs to the player (their account, their quota) and is stored only
 * in their browser (see ./aiCredentials.ts). Aralia never sees the player's
 * password and no shared credential ships with the app.
 *
 * This flow requires a PUBLIC OAuth client ID (ENV.GOOGLE_CLIENT_ID) registered
 * by whoever deploys Aralia. A client ID is not a secret and not an API key —
 * it merely identifies the app to Google's consent screen. When no client ID
 * is configured, `isGoogleOAuthConfigured()` returns false and callers should
 * fall back to the API-key path.
 */
/** Minimal shape of the GIS token response we consume. */
interface GisTokenResponse {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
}
interface GisTokenClient {
    requestAccessToken: (overrides?: {
        prompt?: string;
    }) => void;
}
interface GoogleOAuth2 {
    initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GisTokenResponse) => void;
        error_callback?: (error: {
            type?: string;
            message?: string;
        }) => void;
    }) => GisTokenClient;
}
declare global {
    interface Window {
        google?: {
            accounts?: {
                oauth2?: GoogleOAuth2;
            };
        };
    }
}
/** Whether a Google OAuth client ID is configured for this deployment. */
export declare function isGoogleOAuthConfigured(): boolean;
/**
 * Run the interactive Google sign-in / consent flow and persist the resulting
 * access token via the credentials store. Resolves with the stored token, or
 * rejects if the flow fails or is dismissed by the user.
 */
export declare function signInWithGoogle(): Promise<{
    accessToken: string;
    email: string;
    expiresIn: number;
}>;
export {};
