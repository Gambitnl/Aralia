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

import { ENV } from '../../config/env';
import { setOAuthToken } from './aiCredentials';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/** Minimal shape of the GIS token response we consume. */
interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GisTokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
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
export function isGoogleOAuthConfigured(): boolean {
  return !!ENV.GOOGLE_CLIENT_ID;
}

let scriptPromise: Promise<void> | null = null;

/** Lazily load the GIS client script exactly once. */
function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google sign-in is only available in the browser.'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google sign-in script.')));
      // If it already loaded before we attached listeners, resolve on next tick.
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Google sign-in script.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Best-effort lookup of the signed-in account's email for display only.
 * Requires the userinfo.email scope; failures are non-fatal.
 */
async function fetchUserEmail(accessToken: string): Promise<string> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { email?: string };
    return data.email ?? '';
  } catch {
    return '';
  }
}

/**
 * Run the interactive Google sign-in / consent flow and persist the resulting
 * access token via the credentials store. Resolves with the stored token, or
 * rejects if the flow fails or is dismissed by the user.
 */
export async function signInWithGoogle(): Promise<{ accessToken: string; email: string; expiresIn: number }> {
  if (!isGoogleOAuthConfigured()) {
    throw new Error('Google OAuth is not configured for this deployment (missing client ID).');
  }
  await loadGisScript();

  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google sign-in failed to initialize.');
  }

  const response = await new Promise<GisTokenResponse>((resolve, reject) => {
    let settled = false;
    const tokenClient = oauth2.initTokenClient({
      client_id: ENV.GOOGLE_CLIENT_ID,
      scope: ENV.GOOGLE_OAUTH_SCOPE,
      callback: (resp) => {
        if (settled) return;
        settled = true;
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
        } else {
          resolve(resp);
        }
      },
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        reject(new Error(err.message || err.type || 'Google sign-in was cancelled.'));
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });

  const accessToken = response.access_token;
  if (!accessToken) {
    throw new Error('Google sign-in did not return an access token.');
  }
  const expiresIn = response.expires_in ?? 3600;
  const email = await fetchUserEmail(accessToken);

  setOAuthToken(accessToken, expiresIn, email);
  return { accessToken, email, expiresIn };
}
