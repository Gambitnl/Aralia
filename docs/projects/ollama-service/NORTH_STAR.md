---
schema_version: 1
project: Ollama Service
slug: ollama-service
category: Service / AI Integration
main_category: "Interface & Experience"
subcategory: "UI Shell & Components"
status: partial
last_updated: 2026-06-05
confidence: medium
evidence: docs/projects/ollama-service
gap_signal: "4 open project gaps; local/remote boundary and /api/ollama ownership remain unresolved"
protocol: living project doc set
next_step: Confirm the shared provider adapter and /api/ollama owner, then record the verification path in the tracker.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# NORTH_STAR: Ollama Service

Status: active
Last updated: 2026-06-05

## Why This Project Exists

The Ollama Service project owns Aralia's local LLM integration path. It routes
game tasks to installed models, builds task-specific prompts, parses structured
LLM output, and exposes a stable facade used by companion systems and fallback
paths.

## Scope

- In scope: local model routing and request orchestration in
  `src/services/ollama`, type contracts in `src/types/ollama.ts`, and direct
  callers that use `OllamaService` or local Ollama task services.
- Adjacent but out of scope for docs-only work: implementation rewrites, model
  pull/check tooling, and remote-provider rollout work.

## Dashboard Card Schema

Project: Ollama Service
Slug: ollama-service
Category: Service / AI Integration
Status: partial
Confidence: medium
Evidence: docs/projects/ollama-service
Gap signal: 4 open project gaps; local/remote boundary and `/api/ollama` ownership remain unresolved
Protocol: living project doc set
Next step: Confirm the shared provider adapter and `/api/ollama` owner, then record the verification path in the tracker.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## File Map

- `src/services/ollama/client.ts`: HTTP client, endpoint calls, and config.
- `src/services/ollama/router.ts`: task-level model resolution with fallback chain.
- `src/services/ollama/taskProfiles.ts`: task registry and default model params.
- `src/services/ollama/index.ts`: compatibility facade (`OllamaService`) exports.
- `src/services/ollama/banter.ts`, `conversation.ts`, `reaction.ts`,
  `facts.ts`: feature-level generation flows.
- `src/services/ollama/jsonParser.ts`: JSON repair/parsing helpers.
- `src/types/ollama.ts`: config schema, task taxonomy, result/error types.
- `src/services/ollamaTextService.ts`: narrative wrappers for some Gemini-backed game
  paths.

## Implemented State

- Task-aware routing exists end-to-end: task profile -> router -> `/tags` model
  discovery -> generate/chat call.
- Error envelope is implemented across services (`NETWORK_ERROR`, `TIMEOUT`,
  `PARSE_ERROR`, `UNKNOWN`) with structured metadata.
- Integration behavior includes:
  - companion banter and player-directed/escalation lines,
  - continuation and summary for conversations,
  - event reactions,
  - fact extraction for companions,
  - location/encounter/gossip/action outcome generators.
- Startup gating exists via `OllamaService.isAvailable()` and `useOllamaCheck`.
- Tests exercise service errors and endpoint shape under `src/services/__tests__`.

## Integration Notes

- Primary runtime callsite: `src/services/ollama` and `src/services/ollamaTextService.ts`.
- Hook integrations: `useCompanionBanter`, `useCompanionCommentary`,
  `useConversation`, `useOllamaCheck`, and `useBiomeGenerator`.
- Action handlers mostly call `geminiService` directly for some flows, with Ollama
  consumed through the above hooks.
- Local/remote provider split is not globally abstracted; `useBiomeGenerator`
  directly branches on `provider` and only has a real Ollama branch plus Gemini
  placeholder mock.

## Open Checks

1. Verify endpoint contract for `/api/ollama` and confirm whether the Vite proxy or a backend owner is the canonical source of retry/auth/timeout policy.
2. Confirm whether `retryAttempts` is now required in `OllamaConfig` or should
   be removed.
3. Align task profiles/params with current gameplay tuning by running a small
   end-to-end model smoke test set.

## Resume Path

1. Read this file.
2. Review `TRACKER.md` for active next steps.
3. Review `GAPS.md` for durability decisions.
4. Re-scan `src/services/ollama` before touching behavior.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
