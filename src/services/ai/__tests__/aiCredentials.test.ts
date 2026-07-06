import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetAiCredentialsCacheForTests,
  clearGeminiApiKey,
  clearOAuthToken,
  getActiveGeminiCredential,
  getAiCredentials,
  hasGeminiCredential,
  isGeminiFallbackReady,
  isOAuthTokenValid,
  setGeminiApiKey,
  setGeminiAuthMode,
  setGeminiFallbackEnabled,
  setOAuthToken,
} from '../aiCredentials';

describe('aiCredentials', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetAiCredentialsCacheForTests();
  });

  it('defaults to disabled with no credential', () => {
    const state = getAiCredentials();
    expect(state.geminiFallbackEnabled).toBe(false);
    expect(state.geminiAuthMode).toBe('apiKey');
    expect(hasGeminiCredential()).toBe(false);
    expect(isGeminiFallbackReady()).toBe(false);
    expect(getActiveGeminiCredential()).toBeNull();
  });

  it('resolves an API-key credential once saved', () => {
    setGeminiApiKey('  my-key  ');
    expect(getAiCredentials().geminiApiKey).toBe('my-key'); // trimmed
    expect(getActiveGeminiCredential()).toEqual({ mode: 'apiKey', apiKey: 'my-key' });
    expect(hasGeminiCredential()).toBe(true);
  });

  it('is only "ready" when opted in AND credentialed', () => {
    setGeminiApiKey('key');
    expect(isGeminiFallbackReady()).toBe(false); // not opted in yet
    setGeminiFallbackEnabled(true);
    expect(isGeminiFallbackReady()).toBe(true);
    clearGeminiApiKey();
    expect(isGeminiFallbackReady()).toBe(false); // opted in but no credential
  });

  it('persists across a cache reset (localStorage round-trip)', () => {
    setGeminiFallbackEnabled(true);
    setGeminiApiKey('persisted');
    __resetAiCredentialsCacheForTests();
    const state = getAiCredentials();
    expect(state.geminiFallbackEnabled).toBe(true);
    expect(state.geminiApiKey).toBe('persisted');
  });

  it('treats OAuth tokens as valid only before expiry', () => {
    const now = 1_000_000;
    setOAuthToken('tok', 3600, 'me@example.com', now);
    expect(isOAuthTokenValid(now)).toBe(true);
    expect(getActiveGeminiCredential(now)).toEqual({ mode: 'oauth', accessToken: 'tok' });
    // After expiry the credential resolves to null.
    const afterExpiry = now + 3600 * 1000 + 1;
    expect(isOAuthTokenValid(afterExpiry)).toBe(false);
    expect(getActiveGeminiCredential(afterExpiry)).toBeNull();
  });

  it('setOAuthToken switches auth mode to oauth and clears cleanly', () => {
    const now = 1_000_000;
    setOAuthToken('tok', 3600, '', now);
    expect(getAiCredentials().geminiAuthMode).toBe('oauth');
    clearOAuthToken();
    expect(getAiCredentials().oauthAccessToken).toBe('');
    expect(getActiveGeminiCredential(now)).toBeNull();
  });

  it('in oauth mode, a saved API key is ignored', () => {
    setGeminiApiKey('key');
    setGeminiAuthMode('oauth');
    // No OAuth token yet → nothing usable even though a key exists.
    expect(getActiveGeminiCredential()).toBeNull();
  });
});
