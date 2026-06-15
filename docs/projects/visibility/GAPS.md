---
schema_version: 1
gap_schema: project_gap_registry
project: Visibility
slug: visibility
status: active
status_note: Preserved as routed_reference to avoid flattening existing gap provenance.
registry_mode: routed_reference
last_updated: "2026-06-05"
gap_count: 5
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/visibility/NORTH_STAR.md
tracker: docs/projects/visibility/TRACKER.md
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
# Visibility Gap Registry

Status: active
Last updated: 2026-06-05
Owner: Worker A
Parent tracker: `docs/projects/visibility/TRACKER.md`

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| V-G1 | active | in_scope_now | Worker A | `docs/projects/visibility/TRACKER.md` | Scope pass | Visibility outputs are not wired into map rendering, so hidden/visible tile filtering is not guaranteed in UI. | `src/hooks/combat/useVisibility.ts`; `rg -l -F "useVisibility" src/components src/hooks` | Without integration, the engine calculates visibility but does not enforce it in presentation. | Add a concrete rendering contract and consumption points in combat map surfaces. | One integration proof showing renderer consumes `visibleTiles` or equivalent. |
| V-G2 | not_started | support_needed_now | Worker A | `docs/projects/visibility/TRACKER.md` | Types/doc scan | Environment/visibility conversion remains implicit (`fog`, `lightly_obscured`, `heavily_obscured`, `magical_darkness`). | `src/types/environment.ts`, `src/types/combat.ts`, `src/systems/environment/EnvironmentSystem.ts`, `src/systems/underdark/UnderdarkMechanics.ts` | Gameplay can under-model weather and obscuration if no canonical mapping exists. | Define conversion rules and where they execute (visibility system, combat hooks, or environment system). | Add focused proof row when the first mapping is implemented. |
| V-G3 | not_started | support_needed_now | Worker A | `docs/projects/visibility/TRACKER.md` | Source scan | Deprecated LOS bridge still exists and may hide import drift. | `src/utils/lineOfSight.ts` + `src/utils/spatial/lineOfSight.ts` | Non-fatal now, but complicates migration and ownership boundaries. | Remove dependency bridge only after all callsites are migrated and tested. | Confirm no production import of bridge path. |
| V-G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/visibility/TRACKER.md` | Source scan | Duplicate and inconsistent lighting checks exist across visibility and attack factories. | `src/hooks/combat/useTargetValidator.ts`, `src/commands/factory/AbilityCommandFactory.ts`, `src/systems/visibility/VisibilitySystem.ts` | Divergence can create inconsistent LOS or disadvantage outcomes in edge cases. | Add shared policy surface for "visibility effect for an attack" decision before behavior changes. | Align one test fixture across both paths and record parity in next tracker row. |
| V-G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/GLOBAL_GAPS.md` | Design scan | Renderer-layer ownership may belong with combat-map project if it owns tile visibility display policy. | `src/components/BattleMap/*`, `docs/architecture/COMBAT_MAP_ENGINE.md` | Could widen visibility ownership incorrectly and duplicate UI contracts. | Route this ownership decision to the combat map subsystem before work starts. | Add routed decision with owner in `docs/projects/GLOBAL_GAPS.md` if confirmed. |

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
