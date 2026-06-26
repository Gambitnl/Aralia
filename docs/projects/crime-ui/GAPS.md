---
schema_version: 1
gap_schema: project_gap_registry
project: Crime UI
slug: crime-ui
status: complete_for_current_gap_set
status_note: ""
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 5
open_gap_count: 0
resolved_gap_count: 5
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/crime-ui/NORTH_STAR.md
tracker: docs/projects/crime-ui/TRACKER.md
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
project: Crime UI
slug: crime-ui
last_updated: "2026-06-25"
gap_count: 5
open_gap_count: 0
north_star: docs/projects/crime-ui/NORTH_STAR.md
tracker: docs/projects/crime-ui/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
highest_severity: medium
---
# Crime UI Gap Registry

Status: complete_for_current_gap_set
Last updated: 2026-06-25

Use this file for durable unresolved findings specific to Crime UI ownership.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | design_decision_deferred | Codex | `docs/projects/crime/TRACKER.md` | scope scan + 2026-06-25 Crime closeout | No dedicated suspect/report flow implementation was found in `src/components/Crime` or `src/systems/crime`. | `docs/projects/crime/GAPS.md` G6, `src/types/crime/index.ts`, `src/types/state.ts`, `src/state/reducers/crimeReducer.ts` | Future UI work now knows the absence is intentional for this stage, not an overlooked UI model. | Completed 2026-06-25: core Crime deferred suspect/report aggregate types until a guard, memory, faction, or UI caller needs structured reports. | Crime G6 proof recorded in `docs/projects/crime/AUDIT_OR_PROOF.md`. |
| G2 | done | support_needed_now | Codex | `docs/projects/crime-ui/TRACKER.md` | code scan + 2026-06-25 Crime fence contract | Fence sales previously dispatched generic `SELL_ITEM`; the live UI now dispatches a dedicated crime fence action with heat. | `FenceInterface.tsx` dispatches `SELL_FENCED_ITEM`; `actionTypes.ts` defines the payload; `characterReducer.ts` pays gold/removes item; `crimeReducer.ts` raises heat. | Core criminal consequence model is now enforceable from the fence UI path. | Completed 2026-06-25: preserve `SELL_FENCED_ITEM` as the UI-owned fence transaction contract. | Focused reducer tests in Crime core passed for fence item/gold and heat behavior. |
| G3 | done | in_scope_now | Gemini CLI | `docs/projects/crime-ui/TRACKER.md` | Iteration 4 + 2026-06-25 recheck | Heist planning modal used a local cast to enforce non-optionality on plan fields. | `HeistPlanningModal.tsx` now maps `plan.approaches` and `plan.intelGathered` directly; `HeistPlan` carries required arrays. | The modal no longer bypasses TS null-safety for heist plan arrays. | Completed before this pass; verified source still matches the closure. | `HeistPlanningModal.test.tsx` exists for UI behavior, and current source no longer contains the local cast. |
| G4 | done | support_needed_now | Gemini CLI | `docs/projects/crime-ui/TRACKER.md` | Iteration 4 + 2026-06-25 recheck | Safehouse service list was hardcoded while `ThievesGuildSystem.getAvailableServices()` was authoritative. | `ThievesGuildSafehouse.tsx` now calls `ThievesGuildSystem.getAvailableServices(membership.rank)`. | Service names, rank requirements, and costs now come from the shared system contract. | Completed before this pass; verified source still matches the closure. | `ThievesGuildSafehouse.test.tsx` exists for safehouse behavior, and current source no longer contains the hardcoded list. |
| G5 | done | workflow | Codex | `docs/projects/crime-ui/TRACKER.md` | code scan + 2026-06-25 lifecycle readout | Modal visibility and heist phase lifecycle are split across `uiReducer` and `crimeReducer` with close-on-open assumptions. | `uiReducer.ts:144-155`, `GameModals.tsx:624-659`, `crimeReducer.ts` heist planning/advance/abort cases | New UI slices can now compose against explicit lifecycle rules instead of rediscovering modal assumptions. | Completed 2026-06-25: lifecycle rules documented below; no UI code change needed. | Docs consistency audit plus focused heist/crime reducer tests. |

## Modal Lifecycle Rules

| Surface | Open condition | Close / advance action | Exclusivity rule |
|---|---|---|---|
| Thieves Guild modal | `isThievesGuildVisible` in `uiReducer` | `TOGGLE_THIEVES_GUILD` from `GameModals.tsx` close handler | Opening closes map/dev/logbook/glossary/game-guide/merchant and other listed side panels, but does not clear `activeHeist`. |
| Safehouse modal | `isThievesGuildSafehouseVisible` and `thievesGuild` in `GameModals.tsx` | `TOGGLE_THIEVES_GUILD_SAFEHOUSE` from close handler; services dispatch `USE_GUILD_SERVICE` | Opening closes the main guild modal and the same side-panel set. |
| Heist planning modal | `activeHeist && activeHeist.phase === 'Planning'` in `GameModals.tsx` | approach dispatches `SELECT_HEIST_APPROACH`; begin dispatches `ADVANCE_HEIST_PHASE`; close dispatches `ABORT_HEIST` | Heist visibility is crime-state-driven, not a UI toggle. Future modal changes must decide explicitly whether to abort, advance, or preserve `activeHeist`. |

## Classification Notes

- `adjacent_follow_up`: keeps intent and avoid scope collapse, but not a direct stop condition for Crime UI.
- `in_scope_now`: required to continue any UI heist/job flow edit without type breaks.
- `support_needed_now`: needed for safe continuation but can be resolved in the next implementation slice.

## Global Routing

- Cross-project gaps currently best handled in `docs/projects/crime` are:
  - core suspect/report schema
  - heat/notice/bounty side effects for fence and bribe services

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

