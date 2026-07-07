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
import { ENV } from "../config/env";
import {
  getActiveGeminiCredential,
  getCredentialsVersion,
  hasGeminiCredential,
} from "./ai/aiCredentials";
import { createOAuthGeminiClient } from "./ai/oauthGeminiClient";

/**
 * The slice of the GoogleGenAI surface the app actually uses. Kept structurally
 * loose so both the real SDK client and the OAuth REST adapter satisfy it and
 * are interchangeable. Consumers still see the precise SDK types via the `ai`
 * proxy, which is typed as GoogleGenAI.
 */
interface ActiveAiClient {
  models: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateContent: (...args: any[]) => Promise<any>;
  };
}

// Optional build-time instance for deployments that bake in a key.
let buildTimeInstance: GoogleGenAI | null = null;
if (ENV.API_KEY) {
  buildTimeInstance = new GoogleGenAI({ apiKey: ENV.API_KEY });
} else {
  // Not an error: the app runs on local Ollama by default, and players can
  // supply their own Gemini credential at runtime for the fallback.
  console.info(
    "aiClient: no build-time Gemini API key. Gemini features use the player's own runtime credential (API key or Google sign-in) when configured."
  );
}

// Runtime client cache. Rebuilt when the active credential changes.
let cachedClient: ActiveAiClient | null = null;
let cachedFingerprint = "";

/** Lazily read the current OAuth token for the REST adapter. */
function currentOAuthToken(): string {
  const cred = getActiveGeminiCredential();
  return cred?.mode === "oauth" ? cred.accessToken : "";
}

/**
 * Resolve the client backing the current credential, or the build-time
 * instance, or null when nothing is configured.
 */
function resolveActiveClient(): ActiveAiClient | null {
  const cred = getActiveGeminiCredential();
  if (!cred) {
    return buildTimeInstance;
  }

  // Fingerprint API-key clients by the key (so pasting a new key rebuilds);
  // OAuth clients read the token lazily, so a plain 'oauth' tag is enough and
  // token refreshes don't force a rebuild.
  const fingerprint =
    cred.mode === "apiKey" ? `key:${cred.apiKey}` : "oauth";
  const versioned = `${getCredentialsVersion()}:${fingerprint}`;

  if (cachedClient && cachedFingerprint === versioned) {
    return cachedClient;
  }

  cachedClient =
    cred.mode === "apiKey"
      ? new GoogleGenAI({ apiKey: cred.apiKey })
      : createOAuthGeminiClient(currentOAuthToken);
  cachedFingerprint = versioned;
  return cachedClient;
}

/**
 * Checks if a usable Gemini credential is available (runtime or build-time).
 * @returns {boolean} True if Gemini calls can be made.
 */
export const isAiEnabled = (): boolean => {
  return hasGeminiCredential() || !!buildTimeInstance;
};

/**
 * Returns the active AI client, or throws if none is configured.
 * @throws {Error} If no credential is available.
 */
export const getAiClient = (): ActiveAiClient => {
  const client = resolveActiveClient();
  if (!client) {
    throw new Error(
      "AI client is not initialized. Provide a Gemini API key or sign in with Google in the AI settings."
    );
  }
  return client;
};

/**
 * The shared Gemini client instance, resolved dynamically per access so it
 * always reflects the current runtime credential.
 *
 * @example
 * await ai.models.generateContent(...)
 */
export const ai = new Proxy({} as GoogleGenAI, {
  get: (target, prop) => {
    const client = resolveActiveClient();
    if (client) {
      return Reflect.get(client as object, prop);
    }
    // Allow constructor/prototype probing without throwing (used by tooling).
    if (prop === "constructor" || prop === "prototype") {
      return Reflect.get(target, prop);
    }
    throw new Error(
      `Gemini API Client accessed but not initialized. Accessing '${String(
        prop
      )}' failed. Provide a Gemini API key or sign in with Google.`
    );
  },
});
