# GAPS: Ollama Service

Status: active
Last updated: 2026-05-31

## Gap Log

- Gap: Remote provider fallback is not normalized across runtime paths.
  - Scope: runtime integration
  - Evidence: `src/hooks/useBiomeGenerator.ts` branches on provider and uses mock
    Gemini data when not using Ollama.
  - Why this is durable: gameplay paths mix local Ollama + local mock fallback;
    no shared provider adapter is documented here.
  - Next check: introduce or confirm a shared provider adapter and remove
    hardcoded mock outputs.

- Gap: Model fallback chain differs by feature.
  - Scope: model config + routing consistency
  - Evidence: hardcoded model list in `src/hooks/useBiomeGenerator.ts`
    (`mistral`, `phi4-mini`, `gemma3`) differs from
    `src/services/ollama/taskProfiles.ts` and
    `src/types/ollama.ts` fallback order.
  - Why this is durable: two local generation paths can route to different
    models for related runtime classes.
  - Next check: consolidate to one project-owned model profile source or document
    why split routing is intentional.

- Gap: `/api/ollama` endpoint ownership is inferred, not documented in this project.
  - Scope: integration contract
  - Evidence: service and hook call `/api/ollama`, but this section of the repo
    does not show who owns proxy/error/retry policy.
  - Why this is durable: recovery and observability require knowing endpoint
    ownership.
  - Next check: identify and link the endpoint owner file and document retry,
    auth, and timeout policy.

- Gap: Runtime config controls are incomplete.
  - Scope: model config state
  - Evidence: `OllamaConfig.retryAttempts` exists but no retry loop uses it;
    keepAlive usage is profile-local and partial.
  - Why this is durable: tuning may drift from declared config contract.
  - Next check: remove unused field or wire explicit retry behavior and keep_alive
    policy docs.
