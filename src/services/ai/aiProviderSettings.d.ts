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
export declare const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
/** Default provider — local Ollama, matching the pre-Groq behavior. */
export declare const DEFAULT_AI_TEXT_PROVIDER: AiTextProvider;
/** Default key-handling mode — persistent localStorage (prior behavior). */
export declare const DEFAULT_GROQ_KEY_STORAGE: GroqKeyStorage;
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
export declare const DEFAULT_GROQ_PROXY_URL = "/__groq/v1";
/** The currently selected AI text provider (defaults to `ollama`). */
export declare function getAiTextProvider(): AiTextProvider;
/** Persist the AI text provider choice. */
export declare function setAiTextProvider(provider: AiTextProvider): void;
/**
 * The current Groq key-handling mode (defaults to `local`). The mode itself is
 * a preference, not a secret, so it always lives in localStorage.
 */
export declare function getGroqKeyStorage(): GroqKeyStorage;
/**
 * Persist the key-handling mode. Switching AWAY from a key-bearing mode does
 * NOT auto-migrate the key between stores — the caller re-enters/saves the key
 * for the newly-selected store, and `proxy` intentionally keeps no key at all.
 */
export declare function setGroqKeyStorage(mode: GroqKeyStorage): void;
/** The local proxy base URL for `proxy` mode (defaults to {@link DEFAULT_GROQ_PROXY_URL}). */
export declare function getGroqProxyUrl(): string;
/** Persist a proxy-URL override; empty value restores the default. */
export declare function setGroqProxyUrl(url: string): void;
/**
 * The user-entered Groq API key for the ACTIVE mode, or '' if none is stored.
 * `local` reads localStorage, `session` reads sessionStorage, `proxy` never
 * carries a key in the browser (always '').
 */
export declare function getGroqApiKey(): string;
/**
 * Store (or clear) the Groq API key in the store selected by the active mode.
 * An empty/whitespace value removes it so `hasGroqApiKey()` correctly reports
 * unavailable. No-op in `proxy` mode (the browser must hold no key there).
 */
export declare function setGroqApiKey(key: string): void;
/**
 * The availability signal for the active mode:
 *   - `local`/`session` — a non-empty key is stored in the matching store.
 *   - `proxy`           — always true; the browser holds no key, the proxy does.
 *                         (A truly unreachable proxy fails honestly on first call.)
 */
export declare function hasGroqApiKey(): boolean;
/** The Groq model to use (defaults to {@link DEFAULT_GROQ_MODEL}). */
export declare function getGroqModel(): string;
/** Persist a Groq model override; empty value restores the default. */
export declare function setGroqModel(model: string): void;
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
export declare function getAiProviderSettings(): AiProviderSettings;
