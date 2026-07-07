# Groq inference toggle — design

Status: built; extended with user-chosen key-handling modes + CSP fix (2026-07-07)
Date: 2026-07-06 (extended 2026-07-07)

## Problem

The game's text generation (NPC dialogue, opening scene, oracle, rumors) runs on a local Ollama server. When Ollama is down, that content path is dead and the early game is unplayable. There is already an "Ollama is unavailable" message; today it only lets you retry or dismiss.

## Decision

Add **Groq** (a fast, OpenAI-compatible cloud model API) as a second text provider the player can switch to **by an explicit toggle** on that Ollama message. This is a deliberate provider *choice*, not silent graceful degradation — one real path at a time, chosen consciously, failing honestly if Groq is unreachable. It does not touch the no-fallback rule.

Two decisions locked with Remy (2026-07-06):

1. **Key storage: user-entered, in-browser only.** The toggle asks the player for a Groq API key and stores it in this browser's `localStorage`. The key is **never** placed in the client bundle or a Vite `define` — that is the exact mistake that leaked the Gemini key. The static deployed game can use it too, because each user brings their own key on their own machine.
2. **Scope: every Ollama text call.** When the provider is set to Groq, all current Ollama text generation routes to Groq — dialogue and any other local-model text use. Nothing stays silently pointed at a dead Ollama. Image/portrait/scene generation (a separate Gemini/GoogleGenAI path) is out of scope.

## Shape

- **Provider setting** (`localStorage`): `aiTextProvider: 'ollama' | 'groq'` (default `ollama`) + `groqApiKey: string`. A tiny typed accessor module so callers and UI share one source of truth. Optional `groqModel` (default `llama-3.3-70b-versatile`).
- **Groq text provider**: a module that speaks OpenAI-compatible chat to `https://api.groq.com/openai/v1/chat/completions` with `Authorization: Bearer <key>`, and **adapts responses to the same shape the Ollama client already returns**, so callers do not change. It implements the text methods the Ollama client exposes (generate / chat / task-aware variants) — matched against the real `OllamaClient` interface.
- **Router at the Ollama-client boundary**: the existing text facade checks `aiTextProvider` and delegates to Ollama or Groq. All existing callers keep calling the same facade.
- **Availability**: with Groq selected, "available" means a key is present (and, on first real call, the request succeeds); no `/tags` probe. Failures surface honestly (bad key, rate limit, no network) via the existing error surface — not a silent swap back.
- **Logging**: route Groq calls through the same central AI-log sink the Ollama client uses (do not double-log at call sites).
- **Toggle UI** on `OllamaDependencyModal`: a "Use Groq cloud instead" control that takes/holds the key (localStorage), flips the provider to `groq`, and dismisses/retries. A way to switch back to Ollama. (This file lives under `src/components/**`, the 2D-UI fleet's territory — lock it via Agora before editing; 409 = coordinate.)

## Extension (2026-07-07): user-chosen key-handling modes

Remy's decision: don't pick one storage strategy for the player — **offer all of them** and let the player choose the security trade-off. Added `groqKeyStorage: 'local' | 'session' | 'proxy'` (default `local`) plus `groqProxyUrl` (default `http://localhost:8787/v1`) to `aiProviderSettings.ts`.

- **local** — key in `localStorage`. Persists across sessions (prior behavior). Convenient, but XSS-readable if the app is ever compromised.
- **session** — key in `sessionStorage`. Cleared when the tab closes; smaller theft window, nothing on disk.
- **proxy** — **no key in the browser at all.** `groqTextProvider` POSTs keyless (no `Authorization` header) to `${groqProxyUrl}/chat/completions`; a local OpenAI-compatible proxy injects the key server-side. XSS-proof for the key. The game only points at a URL — it never runs the proxy (the agent-matrix free-router serves this shape).

Mechanics:
- The key accessors (`getGroqApiKey`/`setGroqApiKey`) read/write from the store the active mode selects; proxy mode holds no key (always `''`) and its setter is a no-op.
- `hasGroqApiKey()` (the availability signal) is `true` in proxy mode regardless of any browser key; local/session require a stored key.
- `groqTextProvider.resolveEndpoint()` branches the URL + headers on mode. No-fallback preserved: local/session with no key → `NO_GROQ_KEY`; proxy with no URL → `NO_GROQ_PROXY_URL`; an unreachable proxy fails honestly on the real call. Never a silent swap back to Ollama.
- Modal (`OllamaDependencyModal.tsx`): a Persistent / Session-only / Local proxy radio selector, showing a key field for local/session or a proxy-URL field for proxy, each with a one-line plain-English safety note.

## CSP fix (2026-07-07)

`index.html`'s CSP `connect-src` allowed Gemini + `localhost:*` but not Groq's host, so the direct (local/session) Groq fetch was blocked. Added `https://api.groq.com` to the `connect-src` allowlist (tight — no other directive weakened; `localhost:*` already covers the proxy option).

## Resolved during build

- Exact response-shape adaptation between Groq's OpenAI schema and each Ollama client return type (resolved by reading the real interface).
- Where the "switch back to Ollama" and "current provider" indicator best live beyond the modal (dev menu / settings) — modal-only is enough for slice 1.
</content>
