# GAPS: Ollama Service

Status: active
Last updated: 2026-06-05

## Gap Log

| Gap | Classification | Evidence | Why it matters | Owner | Next action | Next proof |
|---|---|---|---|---|---|---|
| Remote provider fallback is not normalized across runtime paths. | in_scope_now | `src/hooks/useBiomeGenerator.ts` branches on provider and uses mock Gemini data when not using Ollama. | Gameplay paths mix local Ollama and local mock fallback; no shared provider adapter is documented here. | Ollama Service / runtime integration | Introduce or confirm a shared provider adapter, then remove the hardcoded mock output path. | One runtime path uses the shared adapter and produces matching output shape for Ollama/Gemini. |
| Model fallback chain differs by feature. | in_scope_now | Hardcoded model list in `src/hooks/useBiomeGenerator.ts` (`mistral`, `phi4-mini`, `gemma3`) differs from `src/services/ollama/taskProfiles.ts` and `src/types/ollama.ts` fallback order. | Related generation paths can route to different local models for similar tasks. | Ollama Service / model routing | Consolidate to one project-owned model profile source or document why split routing is intentional. | A single documented fallback source is referenced by both paths. |
| `/api/ollama` endpoint ownership is inferred, not documented in this project. | blocked_external_state | Service and hook call `/api/ollama`, but this project does not show who owns proxy/error/retry policy. | Recovery and observability require knowing endpoint ownership. | External runtime / dev server owner | Identify and link the endpoint owner file and document retry, auth, and timeout policy. | Owner confirmation plus linked source of truth for proxy behavior. |
| Runtime config controls are incomplete. | in_scope_now | `OllamaConfig.retryAttempts` exists but no retry loop uses it; keepAlive usage is profile-local and partial. | Tuning may drift from declared config contract. | Ollama config / runtime | Remove unused field or wire explicit retry behavior and keep_alive policy docs. | Config contract and runtime behavior match. |
