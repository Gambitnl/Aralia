# Groq inference toggle — design

Status: specced (build starting)
Date: 2026-07-06

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

## To resolve during build

- Exact response-shape adaptation between Groq's OpenAI schema and each Ollama client return type (resolved by reading the real interface during build).
- Where the "switch back to Ollama" and "current provider" indicator best live beyond the modal (dev menu / settings) — modal-only is enough for slice 1.
</content>
