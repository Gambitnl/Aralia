---
schema_version: 1
gap_schema: project_gap_registry
project: Planar System
slug: planar
status: active
status_note: ""
registry_mode: canonical
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
north_star: docs/projects/planar/NORTH_STAR.md
tracker: docs/projects/planar/TRACKER.md
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
# Planar System Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | not_started | support_needed_now | Planar Spark | Planar core | `NORTH_STAR` refresh | `PlanarService` still resolves plane from `currentLocationId` prefix heuristics instead of authoritative `Location` data | `src/systems/planar/PlanarService.ts` | Wrong location-plane mapping breaks aura, rest, hazard, and combat modifier behavior when location ids are not predictable | Replace the heuristic with a resolver that uses `gameState.dynamicLocations[currentLocationId]` plus the static location map | Add regression tests for Material, Feywild, and unknown location cases |
| P2 | not_started | support_needed_now | Planar Spark | Portal mechanics | `NORTH_STAR` refresh | `PortalSystem` still treats spell requirements as stubbed false and closes some time cases as unsupported | `src/systems/planar/PortalSystem.ts` | Some portal data is effectively unopenable by design today, which can block content incorrectly | Define spell requirement semantics and extend `TimeOfDay` support | Add test cases for `spell`, `time` variants, and reason strings |
| P3 | not_started | support_needed_now | Planar Spark | Infernal mechanics/state typing | `NORTH_STAR` refresh | Infernal contracts are typed as `unknown[]` in state; breach detection and penalties stay minimal or placeholder | `src/types/state.ts`, `src/systems/planar/InfernalMechanics.ts`, `src/types/infernal.ts` | Silent type drift on save/load and weak contract enforcement are hard to validate in gameplay | Move `activeContracts` to typed `InfernalContract[]` and close the `detectBreach` decision path | Add an infernal integration test that touches active contract mutation and persisted state |
| P4 | not_started | adjacent_follow_up | Planar Spark | Hazard/rest systems | `NORTH_STAR` refresh | Hazard and rest helpers still substitute fallback location and placeholder IDs when state is incomplete | `src/systems/planar/PlanarHazardSystem.ts`, `src/systems/planar/rest.ts` | Bugs stay hidden and diagnostic signal drops when core ids are missing | Decide strict vs resilient handling and update call sites to enforce required identifiers | Add a test that intentionally passes a missing `id` and asserts explicit diagnostic behavior |
| P5 | not_started | support_needed_now | Planar Spark | Integration coverage | `NORTH_STAR` refresh | Non-combat spell and casting paths may not consistently pass `currentPlane` into command context | `src/hooks/useAbilitySystem.ts`, `src/commands/factory/SpellCommandFactory.ts`, `src/commands/effects/DamageCommand.ts`, `src/components/Combat/CombatView.tsx` | Users can see inconsistent planar modifiers depending on execution path | Audit command creation paths and ensure plane context coverage | Add a route map and tests for at least one non-combat entry path |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task is required to avoid incorrect behavior in existing mechanics |
| `support_needed_now` | Required for safe continuation of the current slice or adjacent systems |
| `adjacent_follow_up` | Useful but not required for immediate continuity |
| `out_of_scope` | Not part of the Planar slice |
| `blocked_human_decision` | Needs an explicit gameplay or design decision |
| `blocked_external_state` | Needs external input, service, or PR state |

## Route Note

These gaps belong to Planar and stay local in `docs/projects/planar/GAPS.md`.
No cross-project global gaps were added during this refresh.

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
