/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/ai/aiProviderSettings.ts
 *
 * Single source of truth for the player's AI-text-provider choice and the
 * Groq credentials that back the "Groq cloud" option. UI (the Ollama
 * dependency modal) and the runtime router both read/write through here, so
 * there is exactly one place that knows the localStorage keys and defaults.
 *
 * SECURITY (locked decision, 2026-07-06): the Groq API key is USER-ENTERED and
 * lives ONLY in this browser's localStorage. It is NEVER read from
 * import.meta.env, a Vite `define`, or any build-time constant — that class of
 * mistake leaked the Gemini key. Nothing in this module (or the Groq provider)
 * touches the bundle for the key; grep for `import.meta.env` here returns
 * nothing on purpose.
 */

export type AiTextProvider = 'ollama' | 'groq';

/** Default Groq model — a fast, capable OpenAI-compatible chat model. */
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

/** Default provider — local Ollama, matching the pre-Groq behavior. */
export const DEFAULT_AI_TEXT_PROVIDER: AiTextProvider = 'ollama';

/** localStorage keys. Namespaced so they don't collide with other prefs. */
const LS_PROVIDER = 'aralia.ai.textProvider';
const LS_GROQ_KEY = 'aralia.ai.groqApiKey';
const LS_GROQ_MODEL = 'aralia.ai.groqModel';

/**
 * Guarded localStorage access. SSR / test / private-mode safe: any environment
 * without a usable localStorage behaves as "no settings stored" rather than
 * throwing.
 */
function readItem(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch {
    // Storage may be full or blocked (private mode). A failed write is not
    // fatal — the caller simply keeps the previous (or default) setting.
  }
}

function removeItem(key: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch {
    /* no-op — see writeItem */
  }
}

/** The currently selected AI text provider (defaults to `ollama`). */
export function getAiTextProvider(): AiTextProvider {
  return readItem(LS_PROVIDER) === 'groq' ? 'groq' : DEFAULT_AI_TEXT_PROVIDER;
}

/** Persist the AI text provider choice. */
export function setAiTextProvider(provider: AiTextProvider): void {
  writeItem(LS_PROVIDER, provider === 'groq' ? 'groq' : 'ollama');
}

/** The user-entered Groq API key, or '' if none is stored. */
export function getGroqApiKey(): string {
  return (readItem(LS_GROQ_KEY) ?? '').trim();
}

/**
 * Store (or clear) the Groq API key. An empty/whitespace value removes it so
 * `hasGroqApiKey()` correctly reports unavailable.
 */
export function setGroqApiKey(key: string): void {
  const trimmed = (key ?? '').trim();
  if (trimmed) {
    writeItem(LS_GROQ_KEY, trimmed);
  } else {
    removeItem(LS_GROQ_KEY);
  }
}

/** True when a non-empty Groq key is stored — the availability signal. */
export function hasGroqApiKey(): boolean {
  return getGroqApiKey().length > 0;
}

/** The Groq model to use (defaults to {@link DEFAULT_GROQ_MODEL}). */
export function getGroqModel(): string {
  const stored = (readItem(LS_GROQ_MODEL) ?? '').trim();
  return stored || DEFAULT_GROQ_MODEL;
}

/** Persist a Groq model override; empty value restores the default. */
export function setGroqModel(model: string): void {
  const trimmed = (model ?? '').trim();
  if (trimmed) {
    writeItem(LS_GROQ_MODEL, trimmed);
  } else {
    removeItem(LS_GROQ_MODEL);
  }
}

/**
 * Convenience snapshot for the router and UI — one read of every setting.
 */
export interface AiProviderSettings {
  provider: AiTextProvider;
  groqApiKey: string;
  groqModel: string;
  hasGroqKey: boolean;
}

export function getAiProviderSettings(): AiProviderSettings {
  const groqApiKey = getGroqApiKey();
  return {
    provider: getAiTextProvider(),
    groqApiKey,
    groqModel: getGroqModel(),
    hasGroqKey: groqApiKey.length > 0,
  };
}
