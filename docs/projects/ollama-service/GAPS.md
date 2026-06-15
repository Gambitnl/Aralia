---
schema_version: 1
gap_schema: project_gap_registry
project: Ollama Service
slug: ollama-service
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-13"
gap_count: 4
open_gap_count: 4
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/ollama-service/NORTH_STAR.md
tracker: docs/projects/ollama-service/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
# Ollama Service Gap Registry

Status: active
Last updated: 2026-06-13

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|
| OLL-G1 | open | in_scope_now | Ollama Service / runtime integration | Remote provider fallback is not normalized across runtime paths. | `src/hooks/useBiomeGenerator.ts` branches on provider and uses mock Gemini data when not using Ollama. | Gameplay paths mix local Ollama and local mock fallback; no shared provider adapter is documented here. | Introduce or confirm a shared provider adapter, then remove the hardcoded mock output path. | One runtime path uses the shared adapter and produces matching output shape for Ollama/Gemini. |
| OLL-G2 | open | in_scope_now | Ollama Service / model routing | Model fallback chain differs by feature. | Hardcoded model list in `src/hooks/useBiomeGenerator.ts` (`mistral`, `phi4-mini`, `gemma3`) differs from `src/services/ollama/taskProfiles.ts` and `src/types/ollama.ts` fallback order. | Related generation paths can route to different local models for similar tasks. | Consolidate to one project-owned model profile source or document why split routing is intentional. | A single documented fallback source is referenced by both paths. |
| OLL-G3 | open | in_scope_now | Vite dev proxy / Ollama Service | `/api/ollama` endpoint behavior is only partially documented. | `vite.config.ts` owns the dev proxy route and now returns `{ models: [] }` for offline `/api/ollama/tags`; service and hook call `/api/ollama`. | Recovery and observability require knowing endpoint ownership and which failures are soft startup dependency checks versus hard generation failures. | Document retry, auth, and timeout policy for the proxy/client boundary. | Source-of-truth note links `vite.config.ts`, `src/services/ollama/client.ts`, and one startup/generation failure check. |
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
