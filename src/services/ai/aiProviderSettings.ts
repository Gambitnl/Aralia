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
 * NEVER read from import.meta.env, a Vite `define`, or any build-time constant
 * — that class of mistake leaked the Gemini key. Nothing in this module (or the
 * Groq provider) touches the bundle for the key; grep for `import.meta.env`
 * here returns nothing on purpose.
 *
 * The player picks HOW the key is handled ({@link GroqKeyStorage}): persist it
 * in localStorage (`local`), keep it in sessionStorage only (`session`), or
 * never store it in the browser and route through a local proxy (`proxy`). The
 * key accessors read/write from the store the active mode selects.
 */

export type AiTextProvider = 'ollama' | 'groq';

/**
 * How the Groq API key is handled — the player picks the trade-off:
 *   - `local`   — key in localStorage (persists across sessions; current default).
 *                 Convenient, but readable by any script that runs in the page,
 *                 so an XSS compromise of the app could exfiltrate it.
 *   - `session` — key in sessionStorage (cleared when the tab closes). Same
 *                 XSS surface while the tab is open, but a much smaller theft
 *                 window and nothing left on disk.
 *   - `proxy`   — NO key in the browser at all. Requests go to a local
 *                 OpenAI-compatible proxy ({@link getGroqProxyUrl}) that injects
 *                 the key server-side. XSS-proof for the key.
 */
export type GroqKeyStorage = 'local' | 'session' | 'proxy';

/** Default Groq model — a fast, capable OpenAI-compatible chat model. */
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

/** Default provider — local Ollama, matching the pre-Groq behavior. */
export const DEFAULT_AI_TEXT_PROVIDER: AiTextProvider = 'ollama';

/** Default key-handling mode — persistent localStorage (prior behavior). */
export const DEFAULT_GROQ_KEY_STORAGE: GroqKeyStorage = 'local';

/**
 * Default local-proxy base URL (OpenAI-compatible). The provider appends
 * `/chat/completions`.
 *
 * This is a SAME-ORIGIN path served by the Vite dev server itself (see
 * scripts/vite-plugins/groqProxyManager.ts). The dev server injects the Groq
 * key — read from Windows Credential Manager — so the key never enters the
 * browser and the proxy is always available while `npm run dev` runs (nothing
 * to start by hand). For non-Vite contexts, `npm run groq-proxy` still serves
 * the same shape on http://localhost:8787/v1.
 */
export const DEFAULT_GROQ_PROXY_URL = '/__groq/v1';

/** localStorage keys. Namespaced so they don't collide with other prefs. */
const LS_PROVIDER = 'aralia.ai.textProvider';
const LS_GROQ_KEY = 'aralia.ai.groqApiKey';
const LS_GROQ_MODEL = 'aralia.ai.groqModel';
const LS_GROQ_KEY_STORAGE = 'aralia.ai.groqKeyStorage';
const LS_GROQ_PROXY_URL = 'aralia.ai.groqProxyUrl';

type WebStorageKind = 'local' | 'session';

/**
 * Resolve the requested Web Storage, or null when it is unavailable (SSR /
 * test / private-mode). Callers treat null as "no settings stored".
 */
function getStore(kind: WebStorageKind): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Guarded Web Storage read. SSR / test / private-mode safe: any environment
 * without a usable store behaves as "no settings stored" rather than throwing.
 * Defaults to localStorage; the key accessors pass `session` for session mode.
 */
function readItem(key: string, kind: WebStorageKind = 'local'): string | null {
  try {
    return getStore(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string, kind: WebStorageKind = 'local'): void {
  try {
    getStore(kind)?.setItem(key, value);
  } catch {
    // Storage may be full or blocked (private mode). A failed write is not
    // fatal — the caller simply keeps the previous (or default) setting.
  }
}

function removeItem(key: string, kind: WebStorageKind = 'local'): void {
  try {
    getStore(kind)?.removeItem(key);
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

/**
 * The current Groq key-handling mode (defaults to `local`). The mode itself is
 * a preference, not a secret, so it always lives in localStorage.
 */
export function getGroqKeyStorage(): GroqKeyStorage {
  const stored = readItem(LS_GROQ_KEY_STORAGE);
  return stored === 'session' || stored === 'proxy' || stored === 'local'
    ? stored
    : DEFAULT_GROQ_KEY_STORAGE;
}

/**
 * Persist the key-handling mode. Switching AWAY from a key-bearing mode does
 * NOT auto-migrate the key between stores — the caller re-enters/saves the key
 * for the newly-selected store, and `proxy` intentionally keeps no key at all.
 */
export function setGroqKeyStorage(mode: GroqKeyStorage): void {
  writeItem(
    LS_GROQ_KEY_STORAGE,
    mode === 'session' || mode === 'proxy' ? mode : 'local'
  );
}

/** The local proxy base URL for `proxy` mode (defaults to {@link DEFAULT_GROQ_PROXY_URL}). */
export function getGroqProxyUrl(): string {
  const stored = (readItem(LS_GROQ_PROXY_URL) ?? '').trim();
  return stored || DEFAULT_GROQ_PROXY_URL;
}

/** Persist a proxy-URL override; empty value restores the default. */
export function setGroqProxyUrl(url: string): void {
  const trimmed = (url ?? '').trim();
  if (trimmed) {
    writeItem(LS_GROQ_PROXY_URL, trimmed);
  } else {
    removeItem(LS_GROQ_PROXY_URL);
  }
}

/**
 * Which Web Storage backs the key for a given mode. `proxy` never stores a key,
 * so this is only meaningful for `local`/`session`; we map it to localStorage
 * defensively (reads/writes are no-ops for proxy since the UI never calls them).
 */
function keyStoreFor(mode: GroqKeyStorage): WebStorageKind {
  return mode === 'session' ? 'session' : 'local';
}

/**
 * The user-entered Groq API key for the ACTIVE mode, or '' if none is stored.
 * `local` reads localStorage, `session` reads sessionStorage, `proxy` never
 * carries a key in the browser (always '').
 */
export function getGroqApiKey(): string {
  const mode = getGroqKeyStorage();
  if (mode === 'proxy') return '';
  return (readItem(LS_GROQ_KEY, keyStoreFor(mode)) ?? '').trim();
}

/**
 * Store (or clear) the Groq API key in the store selected by the active mode.
 * An empty/whitespace value removes it so `hasGroqApiKey()` correctly reports
 * unavailable. No-op in `proxy` mode (the browser must hold no key there).
 */
export function setGroqApiKey(key: string): void {
  const mode = getGroqKeyStorage();
  if (mode === 'proxy') return;
  const store = keyStoreFor(mode);
  const trimmed = (key ?? '').trim();
  if (trimmed) {
    writeItem(LS_GROQ_KEY, trimmed, store);
  } else {
    removeItem(LS_GROQ_KEY, store);
  }
}

/**
 * The availability signal for the active mode:
 *   - `local`/`session` — a non-empty key is stored in the matching store.
 *   - `proxy`           — always true; the browser holds no key, the proxy does.
 *                         (A truly unreachable proxy fails honestly on first call.)
 */
export function hasGroqApiKey(): boolean {
  if (getGroqKeyStorage() === 'proxy') return true;
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
  groqKeyStorage: GroqKeyStorage;
  groqProxyUrl: string;
  hasGroqKey: boolean;
}

export function getAiProviderSettings(): AiProviderSettings {
  const groqApiKey = getGroqApiKey();
  return {
    provider: getAiTextProvider(),
    groqApiKey,
    groqModel: getGroqModel(),
    groqKeyStorage: getGroqKeyStorage(),
    groqProxyUrl: getGroqProxyUrl(),
    hasGroqKey: hasGroqApiKey(),
  };
}
