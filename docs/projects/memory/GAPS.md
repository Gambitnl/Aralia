---
schema_version: 1
gap_schema: project_gap_registry
project: Memory System
slug: memory
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-07-09"
gap_count: 4
open_gap_count: 2
resolved_gap_count: 2
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/memory/NORTH_STAR.md
tracker: docs/projects/memory/TRACKER.md
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
# Memory System Gap Registry

Status: active
Last updated: 2026-06-09

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Purpose
Track unresolved Memory System work that is visible in the current codebase and needed before full trust can be placed in save/load, AI prompt context, and memory event coverage.

Current state: The 2026-06-09 code pass closed G5 by moving Gemini item formatting to the canonical world helper and adding proof coverage. G1-G4 remain open, and G4 now has source-backed coverage for the direct social-check recency slice, the first-contact recency slice, the targeted custom-prompt recency slice, and the egregious witness-gossip recency slice.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | schema_normalization | Worker A | `docs/projects/memory/TRACKER.md` | Bounded scan of `src/types` + reducers | Two live memory models: `NpcMemory` in `src/types/world.ts` and `NPCMemory` in `src/types/memory.ts` are not unified, and reducers/handlers contain placeholder casts. | `src/types/world.ts`, `src/types/memory.ts`, `src/state/reducers/npcReducer.ts`, `src/hooks/actions/handleGeminiCustom.ts` | Inconsistent shapes increase runtime casting risk and make event producers hard to reason about. | RESOLVED 2026-07-09 (MERGE, additive/behavior-preserving): canonical = the live `NpcMemory`. `KnownFact` extended with optional `factKey`/`confidence`/`significance` + widened `source` union; `NpcMemory`'s half-merged fields tightened (`interactions: Interaction[]`, `attitude: number`, `discussedTopics: Record<string,number>`); `NPCMemory` now aliases the canonical type; save/load backfills the new fields from `strength`. tsc 635 (no regression), 28/28 memory/npc/gemini tests green. | Verify reducer tests compile without shape-cast workarounds. |
| G2 | resolved | ownership | Worker A | `docs/projects/memory/TRACKER.md` | Bounded scan of memory utilities and handlers | `src/systems/memory/MemorySystem.ts` is currently orphaned and not called by gameplay action handlers. | `src/systems/memory/MemorySystem.ts`, `src/systems/memory/__tests__/MemorySystem.test.ts`, `src/hooks/actions/handleNpcInteraction.ts`, `src/hooks/actions/handleResourceActions.ts` | Duplicate lanes will drift unless ownership is explicit. | RESOLVED 2026-07-09: the `npcReducer` lane is the runtime owner. The orphan `MemorySystem.ts` (zero live callers) + its test were deleted; the richer helpers in `memoryUtils.ts` were repointed onto the canonical shape. | Decision recorded in docs + follow-up plan change in `NORTH_STAR.md`. |
| G3 | active | serialization | Worker A | `docs/projects/memory/TRACKER.md` | Bounded scan of `appState` load path | Load migration handles only legacy `knownFacts` string arrays; no broad schema checksum or unknown-field normalization exists. | `src/state/appState.ts`, `src/state/initialState.ts`, `src/types/world.ts` | Save/load can silently keep stale shapes and degrade memory behavior over time. | Add explicit migration policy + invariants for memory fields (`disposition`, suspicion, disposition timestamps, goals). | Add migration fixture test in memory-relevant save/load test path. |
| G4 | active | coverage | Worker A | `docs/projects/memory/TRACKER.md` | Bounded scan of action handlers | Not all social-producing pathways emit memory actions; only some talk/custom/rest/world event branches do today. The direct social-check branch now stamps interaction recency, the first-contact dialogue branch does too when it creates the met fact, the targeted custom-prompt branch does too when it attaches to an NPC, and egregious witness gossip now refreshes witness recency after gossip lands, but the remaining combat and ritual branches are still not fully mapped. | `src/hooks/actions/handleGeminiCustom.ts`, `src/hooks/actions/handleGeminiCustom.test.ts`, `src/hooks/actions/handleNpcInteraction.ts`, `src/hooks/actions/__tests__/handleNpcInteraction.test.ts`, `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleWorldEvents.ts`, `src/state/actionTypes.ts` | Gameplay can become inconsistent: same social outcome may change disposition once but not record facts elsewhere. | Build and maintain explicit action-to-memory mapping matrix before adding additional social mechanics. | Add checks for one representative combat path and one ritual path, then keep the prompt-branch coverage in sync with the matrix. |

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
