# Ollama Service Gap Registry

Status: active
Last updated: 2026-06-12

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|
| OLL-G1 | open | in_scope_now | Ollama Service / runtime integration | Remote provider fallback is not normalized across runtime paths. | `src/hooks/useBiomeGenerator.ts` branches on provider and uses mock Gemini data when not using Ollama. | Gameplay paths mix local Ollama and local mock fallback; no shared provider adapter is documented here. | Introduce or confirm a shared provider adapter, then remove the hardcoded mock output path. | One runtime path uses the shared adapter and produces matching output shape for Ollama/Gemini. |
| OLL-G2 | open | in_scope_now | Ollama Service / model routing | Model fallback chain differs by feature. | Hardcoded model list in `src/hooks/useBiomeGenerator.ts` (`mistral`, `phi4-mini`, `gemma3`) differs from `src/services/ollama/taskProfiles.ts` and `src/types/ollama.ts` fallback order. | Related generation paths can route to different local models for similar tasks. | Consolidate to one project-owned model profile source or document why split routing is intentional. | A single documented fallback source is referenced by both paths. |
| OLL-G3 | open | blocked_external_state | External runtime / dev server owner | `/api/ollama` endpoint ownership is inferred, not documented in this project. | Service and hook call `/api/ollama`, but this project does not show who owns proxy/error/retry policy. | Recovery and observability require knowing endpoint ownership. | Identify and link the endpoint owner file and document retry, auth, and timeout policy. | Owner confirmation plus linked source of truth for proxy behavior. |
| OLL-G4 | open | in_scope_now | Ollama config / runtime | Runtime config controls are incomplete. | `OllamaConfig.retryAttempts` exists but no retry loop uses it; keepAlive usage is profile-local and partial. | Tuning may drift from declared config contract. | Remove unused field or wire explicit retry behavior and keep_alive policy docs. | Config contract and runtime behavior match. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
