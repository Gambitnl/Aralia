---
schema_version: 1
gap_schema: project_gap_registry
project: Town Description System
slug: town-description-system
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 7
open_gap_count: 7
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/town-description-system/NORTH_STAR.md
tracker: docs/projects/town-description-system/TRACKER.md
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
# Town Description System Gap Registry

Status: active
Last updated: 2026-06-25

Use this file for durable unresolveds owned by the town-description system.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Severity | Classification | Owner | Owner confidence | Source project | Imported/global link | Decision/review state | Visual proof | Proof freshness | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | in_scope_now | medium | in_scope_now | future owner | provisional | project |  | none | none | not_recorded | `docs/projects/town-description-system/TRACKER.md` | docs/code scan | Missing shared town metadata shape and persistence lane for description data. | `src/types/world.ts`, `src/types/state.ts`, `src/services/saveLoadService.ts`, `src/services/worldSim/sites.ts` | Without a stable metadata shape, town identities and descriptions cannot survive save/load safely. | Define `TownMetadata` placement and schema in this project before implementation. | Decision written to `TRACKER.md` and reflected in `NORTH_STAR.md`. |  |
| G2 | in_scope_now | medium | in_scope_now | future owner | provisional | project |  | none | none | not_recorded | `docs/projects/town-description-system/TRACKER.md` | `src/services/villageGenerator.ts`, `src/App.tsx`, `src/components/Town/TownCanvas.tsx` | Town metadata and settlement profile are not consumed on the active rendering path. | `TownCanvas` gets `settlementInfo` as `unknown` and only uses local seed logic. | Town descriptions cannot surface cultural identity and governing style without a defined consume path. | Choose first consume path: TownCanvas direct mapping or shared metadata bridge. | Proof by code review of active `TownCanvas` entry flow. |  |
| G3 | adjacent_follow_up | low | adjacent_follow_up | future owner | provisional | project |  | none | none | not_recorded | `docs/projects/town/TRACKER.md` | `src/state/actionTypes.ts`, `src/state/reducers/townReducer.ts`, `src/hooks/actions/actionHandlers.ts`, `src/hooks/actions/handleMovement.ts`, `src/App.tsx` | Town runtime entry contracts are split across `ENTER_TOWN` and `ENTER_VILLAGE`. | `ENTER_TOWN` is in reducer/action types, `ENTER_VILLAGE` is used by handler path. | Canonical entry mismatch creates coupling risk for description handoff payloads. | Confirm owner decision for this contract split and document boundary. | Add cross-project note in `docs/projects/town/NORTH_STAR.md` and link here. |  |
| G4 | adjacent_follow_up | low | adjacent_follow_up | future owner | provisional | project |  | none | none | not_recorded | `docs/projects/town-description-system/TRACKER.md` | `src/components/Town/VillageScene.tsx`, `src/components/Town/TownCanvas.tsx` | Secondary rendering surface (`VillageScene`) has richer integration payload than active surface (`TownCanvas`). | `VillageScene` constructs `VillageActionContext` with cultural data; active flow uses `TownCanvas` stub fields. | Duplicate or orphaned context paths can produce inconsistent behavior if both surfaces evolve differently. | Decide whether `VillageScene` remains secondary or is retired for description feature. | Add explicit decision and migration note in `TRACKER.md`. |  |
| G5 | not_started | low | adjacent_follow_up | town-description-system owner | strong | world G6 T15 | `docs/projects/world/GAPS.md` G6 | none | none | recorded_2026-06-18 | `docs/projects/town-description-system/TRACKER.md` | World T15 boundary audit | Proximity-triggered town-description loading is not verified on the settlement approach path. | `src/hooks/actions/handleMovement.ts` `handleApproachSettlement` proximity TODO; `docs/projects/town-description-system/QUICK_START.md` names "no verified proximity-driven town-description loading"; `docs/projects/town-description-system/TECHNICAL_SPEC.md` excludes a live proximity-triggered town-detail loader. | World owns movement/world-event boundaries, but town-description content loading and metadata consumption belong here. Keeping this stub prevents future World agents from absorbing town content behavior just because the TODO lives near movement code. | Decide whether proximity loading belongs in the first town-description implementation slice or stays deferred until the metadata schema and active render consume path are stable. | Proof should cover a settlement-approach path triggering, queuing, or intentionally declining town-description metadata loading without changing World-owned travel/pathfinding behavior. | Routed from World G6 on 2026-06-18; Travel forced march and Events scheduler portions are already represented in their owner gap files. |
| G6 | not_started | medium | in_scope_now | town-description-system owner | strong | retired `TASKS.md` |  | none | none | recorded_2026-06-25 | `docs/projects/town-description-system/TRACKER.md` | backlog retirement pass | Description generation and first presentation surface are not yet implemented as one shared path. | Retired `docs/projects/town-description-system/TASKS.md`; `src/components/Town/TownCanvas.tsx`; `src/components/Town/VillageScene.tsx`; settlement layout/profile inputs named in `NORTH_STAR.md` | Without one shared generation and presentation path, town descriptions can become ad hoc strings split across multiple UI surfaces. | After G1/G2 settle metadata and consume path, implement one description generator that consumes settlement context plus layout features and show it in one first town surface. | Focused test/proof that generated description data is stable, persisted, and visible in the selected town surface. | Imports TASKS sections "Description Generation" and "Presentation". |
| G7 | not_started | low | adjacent_follow_up | town-description-system owner | strong | retired `TASKS.md` |  | none | none | recorded_2026-06-25 | `docs/projects/town-description-system/TRACKER.md` | backlog retirement pass | Later extensions need to stay deferred until the metadata/persistence core path exists. | Retired `docs/projects/town-description-system/TASKS.md` later/deferred sections | Rich NPC bundles, current events, landmarks, player-influenced evolution, loading/cache policy, preloading, tooltip integration, and inter-town relationships are valid expansion space but should not outrun stable town identity. | Revisit only after metadata, persistence, generation, and first presentation proof exist. | New gap rows for individual extensions should cite the completed core proof before implementation starts. | Imports TASKS sections "Later Extensions" and "Deferred Until The Core Path Exists". |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Gap blocks current project-owned implementation planning. |
| `adjacent_follow_up` | Important context sits in another project but impacts this ownership boundary. |
| `blocked_human_decision` | Needs direction from project owner before technical closure. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
