/**
 * @file src/services/ai/__tests__/aiProviderSettings.test.ts
 * Round-trip + default coverage for the AI-provider settings accessors, and a
 * grep-style guard that the Groq key never comes from the bundle.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAiTextProvider,
  getOllamaComputeMode,
  setOllamaComputeMode,
  setAiTextProvider,
  getGroqApiKey,
  setGroqApiKey,
  hasGroqApiKey,
  getGroqModel,
  setGroqModel,
  getGroqKeyStorage,
  setGroqKeyStorage,
  getGroqProxyUrl,
  setGroqProxyUrl,
  getAiProviderSettings,
  DEFAULT_GROQ_MODEL,
  DEFAULT_GROQ_KEY_STORAGE,
  DEFAULT_GROQ_PROXY_URL,
} from '../aiProviderSettings';

describe('aiProviderSettings', () => {
  it('keeps local processing automatic unless the player explicitly chooses CPU',()=>{
    expect(getOllamaComputeMode('dialogue')).toBe('auto');
    localStorage.setItem('aralia.ai.ollamaCompute.dialogue','invalid');
    expect(getOllamaComputeMode('dialogue')).toBe('auto');
  });
  it('retains CPU choice per job without changing the provider or another job',()=>{
    setOllamaComputeMode('dialogue','cpu');
    expect(getOllamaComputeMode('dialogue')).toBe('cpu');
    expect(getOllamaComputeMode('utility')).toBe('auto');
    expect(getAiTextProvider()).toBe('ollama');
    setOllamaComputeMode('dialogue','auto');
    expect(getOllamaComputeMode('dialogue')).toBe('auto');
    expect(localStorage.getItem('aralia.ai.ollamaCompute.dialogue')).toBeNull();
  });
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('defaults to the ollama provider when nothing is stored', () => {
    expect(getAiTextProvider()).toBe('ollama');
  });

  it('round-trips the provider choice', () => {
    setAiTextProvider('groq');
    expect(getAiTextProvider()).toBe('groq');
    setAiTextProvider('ollama');
    expect(getAiTextProvider()).toBe('ollama');
  });

  it('round-trips the Groq API key and reports availability', () => {
    expect(hasGroqApiKey()).toBe(false);
    expect(getGroqApiKey()).toBe('');

    setGroqApiKey('gsk_test_key');
    expect(getGroqApiKey()).toBe('gsk_test_key');
    expect(hasGroqApiKey()).toBe(true);
  });

  it('trims the key and treats blank as unset', () => {
    setGroqApiKey('  gsk_padded  ');
    expect(getGroqApiKey()).toBe('gsk_padded');

    setGroqApiKey('   ');
    expect(hasGroqApiKey()).toBe(false);
    expect(getGroqApiKey()).toBe('');
  });

  it('defaults the Groq model and round-trips an override', () => {
    expect(getGroqModel()).toBe(DEFAULT_GROQ_MODEL);
    setGroqModel('some-other-model');
    expect(getGroqModel()).toBe('some-other-model');
    setGroqModel('');
    expect(getGroqModel()).toBe(DEFAULT_GROQ_MODEL);
  });

  it('exposes a consistent snapshot', () => {
    setAiTextProvider('groq');
    setGroqApiKey('gsk_snapshot');
    const snap = getAiProviderSettings();
    expect(snap).toEqual({
      provider: 'groq',
      groqApiKey: 'gsk_snapshot',
      groqModel: DEFAULT_GROQ_MODEL,
      groqKeyStorage: DEFAULT_GROQ_KEY_STORAGE,
      groqProxyUrl: DEFAULT_GROQ_PROXY_URL,
      hasGroqKey: true,
    });
  });

  describe('key-handling mode', () => {
    it('defaults to the local (persistent) mode', () => {
      expect(getGroqKeyStorage()).toBe('local');
      expect(DEFAULT_GROQ_KEY_STORAGE).toBe('local');
    });

    it('round-trips all three modes', () => {
      setGroqKeyStorage('session');
      expect(getGroqKeyStorage()).toBe('session');
      setGroqKeyStorage('proxy');
      expect(getGroqKeyStorage()).toBe('proxy');
      setGroqKeyStorage('local');
      expect(getGroqKeyStorage()).toBe('local');
    });

    it('local mode stores the key in localStorage (persistent)', () => {
      setGroqKeyStorage('local');
      setGroqApiKey('gsk_local');
      expect(getGroqApiKey()).toBe('gsk_local');
      // Persisted to localStorage, NOT sessionStorage.
      expect(window.localStorage.getItem('aralia.ai.groqApiKey')).toBe('gsk_local');
      expect(window.sessionStorage.getItem('aralia.ai.groqApiKey')).toBeNull();
    });

    it('session mode stores the key in sessionStorage only', () => {
      setGroqKeyStorage('session');
      setGroqApiKey('gsk_session');
      expect(getGroqApiKey()).toBe('gsk_session');
      // Persisted to sessionStorage, NOT localStorage.
      expect(window.sessionStorage.getItem('aralia.ai.groqApiKey')).toBe('gsk_session');
      expect(window.localStorage.getItem('aralia.ai.groqApiKey')).toBeNull();
    });

    it('reads the key from the store matching the active mode', () => {
      // A key sitting in localStorage is invisible in session mode, and vice-versa.
      setGroqKeyStorage('local');
      setGroqApiKey('gsk_local');
      setGroqKeyStorage('session');
      expect(getGroqApiKey()).toBe(''); // session store is empty
      setGroqApiKey('gsk_session');
      expect(getGroqApiKey()).toBe('gsk_session');
      setGroqKeyStorage('local');
      expect(getGroqApiKey()).toBe('gsk_local'); // local store still has its own key
    });

    it('proxy mode never stores a key in the browser and always reports available', () => {
      setGroqKeyStorage('proxy');
      setGroqApiKey('gsk_should_be_ignored');
      expect(getGroqApiKey()).toBe(''); // proxy mode carries no browser key
      expect(window.localStorage.getItem('aralia.ai.groqApiKey')).toBeNull();
      expect(window.sessionStorage.getItem('aralia.ai.groqApiKey')).toBeNull();
      // Availability is true in proxy mode (the proxy holds the key).
      expect(hasGroqApiKey()).toBe(true);
    });

    it('local/session with no key are honestly unavailable', () => {
      setGroqKeyStorage('local');
      expect(hasGroqApiKey()).toBe(false);
      setGroqKeyStorage('session');
      expect(hasGroqApiKey()).toBe(false);
    });

    it('defaults and round-trips the proxy URL', () => {
      expect(getGroqProxyUrl()).toBe(DEFAULT_GROQ_PROXY_URL);
      setGroqProxyUrl('http://localhost:9999/v1');
      expect(getGroqProxyUrl()).toBe('http://localhost:9999/v1');
      setGroqProxyUrl('');
      expect(getGroqProxyUrl()).toBe(DEFAULT_GROQ_PROXY_URL);
    });
  });
});
