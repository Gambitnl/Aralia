/**
 * @file src/components/ui/GeminiFallbackSettings.tsx
 * @component-owner Narrative Team / Core UI
 * @status New
 *
 * Lets a player opt in to using Google Gemini for AI narration when local
 * Ollama is unavailable, authenticating with THEIR OWN credential:
 *   - a Google AI Studio API key they paste, or
 *   - an OAuth token from signing in with their own Google account.
 *
 * Nothing is baked into the app; the credential is stored only in the player's
 * browser (see src/services/ai/aiCredentials.ts). Rendered inside
 * OllamaDependencyModal.
 */

import React, { useState } from 'react';
import { Button } from './Button';
import { Checkbox, Input } from './Input';
import { useAiCredentials } from '../../hooks/useAiCredentials';
import {
  clearGeminiApiKey,
  clearOAuthToken,
  isGeminiFallbackReady,
  setGeminiApiKey,
  setGeminiAuthMode,
  setGeminiFallbackEnabled,
} from '../../services/ai/aiCredentials';
import { isGoogleOAuthConfigured, signInWithGoogle } from '../../services/ai/googleOAuth';

const API_KEY_HELP_URL = 'https://aistudio.google.com/apikey';

export const GeminiFallbackSettings: React.FC = () => {
  const creds = useAiCredentials();
  const oauthConfigured = isGoogleOAuthConfigured();

  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = isGeminiFallbackReady();
  const hasStoredKey = !!creds.geminiApiKey;

  const handleToggleFallback = (enabled: boolean) => {
    setError(null);
    setGeminiFallbackEnabled(enabled);
  };

  const handleSaveKey = () => {
    const trimmed = apiKeyDraft.trim();
    if (!trimmed) {
      setError('Enter an API key first.');
      return;
    }
    setError(null);
    setGeminiApiKey(trimmed);
    setGeminiAuthMode('apiKey');
    setApiKeyDraft('');
  };

  const handleClearKey = () => {
    setError(null);
    clearGeminiApiKey();
  };

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
      setGeminiAuthMode('oauth');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = () => {
    setError(null);
    clearOAuthToken();
    setGeminiAuthMode('apiKey');
  };

  return (
    <div
      data-testid="gemini-fallback-settings"
      className="bg-gray-800/50 border-l-4 border-sky-500/50 p-4 rounded space-y-4"
    >
      <div>
        <h3 className="text-sky-200 font-semibold mb-1">
          ✨ Prefer not to install Ollama? Use Google Gemini instead
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          Use your <strong>own</strong> Google Gemini credential to power AI narration when
          Ollama isn&apos;t running. Nothing is shared or stored on any server — your key or
          sign-in stays in this browser and calls go straight to Google from your machine.
        </p>
      </div>

      <Checkbox
        label="Use Google Gemini when Ollama isn't available"
        checked={creds.geminiFallbackEnabled}
        onChange={(e) => handleToggleFallback(e.target.checked)}
      />

      {creds.geminiFallbackEnabled && (
        <div className="space-y-4 pl-1">
          {/* Auth-mode selector (Google sign-in only shown when configured). */}
          <div
            role="radiogroup"
            aria-label="Gemini credential type"
            className="flex flex-wrap gap-4"
          >
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="radio"
                name="gemini-auth-mode"
                className="accent-amber-500"
                checked={creds.geminiAuthMode === 'apiKey'}
                onChange={() => setGeminiAuthMode('apiKey')}
              />
              Paste an API key
            </label>
            {oauthConfigured && (
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name="gemini-auth-mode"
                  className="accent-amber-500"
                  checked={creds.geminiAuthMode === 'oauth'}
                  onChange={() => setGeminiAuthMode('oauth')}
                />
                Sign in with Google
              </label>
            )}
          </div>

          {creds.geminiAuthMode === 'apiKey' ? (
            <div className="space-y-2">
              {hasStoredKey ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-emerald-300">
                    ✓ API key saved (stored locally in this browser)
                  </span>
                  <Button onClick={handleClearKey} variant="secondary" size="sm">
                    Remove key
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    type="password"
                    label="Google AI Studio API key"
                    placeholder="Paste your Gemini API key"
                    value={apiKeyDraft}
                    onChange={(e) => setApiKeyDraft(e.target.value)}
                    autoComplete="off"
                    helperText="Your key is stored only in this browser and sent only to Google."
                  />
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={API_KEY_HELP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-300 hover:text-sky-200 underline"
                    >
                      Get a free API key →
                    </a>
                    <Button onClick={handleSaveKey} variant="action" size="sm">
                      Save key
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {creds.oauthAccessToken ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-emerald-300">
                    ✓ Signed in{creds.oauthEmail ? ` as ${creds.oauthEmail}` : ' with Google'}
                  </span>
                  <Button onClick={handleSignOut} variant="secondary" size="sm">
                    Sign out
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleSignIn}
                  variant="action"
                  size="sm"
                  disabled={signingIn}
                >
                  {signingIn ? 'Signing in…' : 'Sign in with Google'}
                </Button>
              )}
              <p className="text-xs text-gray-400">
                Signs in with your own Google account. The access token is short-lived and
                kept only in this browser.
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 font-medium" role="alert">
              ⚠️ {error}
            </p>
          )}

          <p
            className={`text-xs font-medium ${ready ? 'text-emerald-400' : 'text-amber-300'}`}
            data-testid="gemini-fallback-status"
          >
            {ready
              ? 'Gemini fallback is ready. AI narration will use Gemini when Ollama is offline.'
              : 'Add a credential above to activate the Gemini fallback.'}
          </p>
        </div>
      )}
    </div>
  );
};
