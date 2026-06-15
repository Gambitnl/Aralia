---
schema_version: 1
gap_schema: project_gap_registry
project: Environment System
slug: environment
status: active
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-09"
gap_count: 0
open_gap_count: 0
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/environment/NORTH_STAR.md
tracker: docs/projects/environment/TRACKER.md
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
project: Environment System
slug: environment
last_updated: \"2026-06-09\"
gap_count: 0
open_gap_count: 0
north_star: docs/projects/environment/NORTH_STAR.md
tracker: docs/projects/environment/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
---
# Environment System Gap Registry

Status: active
Last updated: 2026-06-09

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Local context notes

- The above gaps are aligned with `docs/projects/environment/TRACKER.md` and should be treated as the local default scope unless re-routed by a stricter domain owner.
- No cross-project or orphaned gaps were added to `docs/projects/GLOBAL_GAPS.md` yet.
- This pass removed the `G1` blocking runtime wiring gap and resolved `G2`; `G3`, `G4`, and `G5` are now resolved as well, while runtime weather progression and seeded replay remain live and the legacy weather bridge remains in place for compatibility.

### Runtime progression proof (2026-06-09)

- Implemented `resolveBiomeId` + daily `updateWeather` progression in `src/state/reducers/worldReducer.ts`.
- Wired `daysPassed` cadence through `ADVANCE_TIME`, with `TimeOfDay` derived from progressive day timestamps.
- Added reducer tests in `src/state/reducers/__tests__/worldReducer.test.ts` to verify:
  - day-advance triggers weather update,
  - non-day advance does not trigger weather update,
  - `coord_x_y` biome lookup is used for map-tile locations.

### Seeded replay proof (2026-06-09)

- Added explicit seeded RNG plumbing for weather progression in `src/state/reducers/worldReducer.ts` and seeded voyage/crew plumbing in `src/state/reducers/navalReducer.ts`.
- Updated `src/systems/environment/WeatherSystem.ts`, `src/systems/naval/VoyageManager.ts`, `src/systems/naval/CrewManager.ts`, `src/data/naval/voyageEvents.ts`, and `src/types/naval.ts` to avoid ambient/random-date sources on the active replay path.
- Added replay-stability tests in:
  - `src/systems/environment/__tests__/WeatherSystem.test.ts`
  - `src/systems/naval/__tests__/VoyageManager.test.ts`
  - `src/state/reducers/__tests__/worldReducer.test.ts`
  - `src/state/reducers/__tests__/navalReducer.test.ts`

## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Non-canonical registry mode: `routed_reference` | Existing gap rows or prose carry compact, routed, merged-reference, or decision-history context. | Forcing the canonical row shape now could invent missing ownership/proof metadata or flatten provenance. | Preserve this section until a row-by-row migration can map each current field losslessly. |
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
