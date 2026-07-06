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
export type ActiveGeminiCredential =
  | { mode: 'apiKey'; apiKey: string }
  | { mode: 'oauth'; accessToken: string };

const STORAGE_KEY = 'aralia.ai.credentials';

const DEFAULT_STATE: AiCredentialsState = {
  geminiFallbackEnabled: false,
  geminiAuthMode: 'apiKey',
  geminiApiKey: '',
  oauthAccessToken: '',
  oauthExpiresAt: 0,
  oauthEmail: '',
};

/**
 * Skew applied when judging OAuth token validity, so a token that is about to
 * expire mid-request is treated as already expired.
 */
const OAUTH_EXPIRY_SKEW_MS = 30_000;

type Listener = () => void;
const listeners = new Set<Listener>();

let cache: AiCredentialsState | null = null;
/** Bumped on every mutation so downstream caches (e.g. the AI client) can invalidate. */
let version = 0;

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function read(): AiCredentialsState {
  if (cache) return cache;
  if (!hasStorage()) {
    cache = { ...DEFAULT_STATE };
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = { ...DEFAULT_STATE };
    } else {
      const parsed = JSON.parse(raw) as Partial<AiCredentialsState>;
      // Merge over defaults so older/partial payloads stay forward-compatible.
      cache = { ...DEFAULT_STATE, ...parsed };
    }
  } catch {
    cache = { ...DEFAULT_STATE };
  }
  return cache;
}

function write(next: AiCredentialsState): void {
  cache = next;
  version += 1;
  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage may be full or blocked (private mode). The in-memory cache
      // still reflects the change for the current session.
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

/** Returns a snapshot of the current credentials state. */
export function getAiCredentials(): AiCredentialsState {
  return read();
}

/**
 * Monotonic version counter. Consumers that cache a derived object (like the
 * GoogleGenAI client) compare this to know when to rebuild.
 */
export function getCredentialsVersion(): number {
  read();
  return version;
}

/** Subscribe to credential changes. Returns an unsubscribe function. */
export function subscribeAiCredentials(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(patch: Partial<AiCredentialsState>): void {
  write({ ...read(), ...patch });
}

export function setGeminiFallbackEnabled(enabled: boolean): void {
  update({ geminiFallbackEnabled: enabled });
}

export function setGeminiAuthMode(mode: GeminiAuthMode): void {
  update({ geminiAuthMode: mode });
}

export function setGeminiApiKey(apiKey: string): void {
  update({ geminiApiKey: apiKey.trim() });
}

export function clearGeminiApiKey(): void {
  update({ geminiApiKey: '' });
}

/**
 * Store an OAuth access token obtained from the player's own Google sign-in.
 * @param accessToken The bearer token.
 * @param expiresInSeconds Lifetime in seconds as reported by Google.
 * @param email Optional account label for display.
 * @param nowMs Injectable clock for tests.
 */
export function setOAuthToken(
  accessToken: string,
  expiresInSeconds: number,
  email = '',
  nowMs: number = Date.now(),
): void {
  update({
    oauthAccessToken: accessToken,
    oauthExpiresAt: nowMs + expiresInSeconds * 1000,
    oauthEmail: email,
    geminiAuthMode: 'oauth',
  });
}

export function clearOAuthToken(): void {
  update({ oauthAccessToken: '', oauthExpiresAt: 0, oauthEmail: '' });
}

/** True when a stored OAuth token exists and has not (nearly) expired. */
export function isOAuthTokenValid(nowMs: number = Date.now()): boolean {
  const state = read();
  return (
    !!state.oauthAccessToken &&
    state.oauthExpiresAt - OAUTH_EXPIRY_SKEW_MS > nowMs
  );
}

/**
 * Resolve the credential the player has actually configured for the selected
 * auth mode, or null if nothing usable is available. OAuth tokens that have
 * expired resolve to null so the caller can prompt for re-authentication.
 */
export function getActiveGeminiCredential(
  nowMs: number = Date.now(),
): ActiveGeminiCredential | null {
  const state = read();
  if (state.geminiAuthMode === 'oauth') {
    if (isOAuthTokenValid(nowMs)) {
      return { mode: 'oauth', accessToken: state.oauthAccessToken };
    }
    return null;
  }
  if (state.geminiApiKey) {
    return { mode: 'apiKey', apiKey: state.geminiApiKey };
  }
  return null;
}

/** True when any usable Gemini credential is configured, regardless of opt-in. */
export function hasGeminiCredential(nowMs: number = Date.now()): boolean {
  return getActiveGeminiCredential(nowMs) !== null;
}

/**
 * True when the player has opted in to the Gemini fallback AND supplied a
 * usable credential for it. This is the gate the narrative services check
 * before redirecting an unavailable-Ollama call to Gemini.
 */
export function isGeminiFallbackReady(nowMs: number = Date.now()): boolean {
  return read().geminiFallbackEnabled && hasGeminiCredential(nowMs);
}

/** Test-only: reset the in-memory cache so the next read re-hydrates. */
export function __resetAiCredentialsCacheForTests(): void {
  cache = null;
  version = 0;
}
