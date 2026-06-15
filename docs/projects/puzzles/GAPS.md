---
schema_version: 1
gap_schema: project_gap_registry
project: Puzzles System
slug: puzzles
status: "active (PZ-007 decision recorded 2026-06-10; implementation lane open)"
status_note: ""
registry_mode: canonical
last_updated: "2026-06-10"
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
north_star: docs/projects/puzzles/NORTH_STAR.md
tracker: docs/projects/puzzles/TRACKER.md
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
# Puzzles System Gap Registry

Status: active (PZ-007 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| PZ-003 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/TRACKER.md` | Dependency scan | `Lock.keyId` is defined but never used to unlock in lock resolution logic. | `src/systems/puzzles/types.ts`, `src/systems/puzzles/lockSystem.ts`, `src/components/puzzles/LockpickingModal.tsx` | Key-based progression is incomplete and can block future lock content authoring. | Decide whether key matching is puzzle-system owned or inventory-system owned, then make it deterministic. | One production-oriented acceptance test that covers both pick and key paths. |
| PZ-007 | not_started | in_scope_now | Worker A (decision: Remy 2026-06-10) | `docs/projects/puzzles/TRACKER.md` | Runtime caller scan | No gameplay caller yet invokes `getPuzzleHint`; the live helper exists but the project has not picked a runtime owner for `Puzzle` objects. Decided 2026-06-10 (DECISION_BLITZ D13): a dedicated puzzle-facing runtime surface is approved; Puzzles owns the runtime `Puzzle` instance and the hint UI contract. | `src/systems/puzzles/puzzleSystem.ts`, `src/systems/puzzles/__tests__/puzzleSystem.test.ts`, `src/components/puzzles/LockpickingModal.tsx`, `src/components/layout/GameModals.tsx`, `src/hooks/actions/actionHandlers.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D13 | Players still cannot ask for a puzzle hint from gameplay, so the helper is only half of the flow. | Implementation lane open: build the puzzle-facing runtime surface and wire the first gameplay `getPuzzleHint` caller there. | A source-backed callsite or UI action that exercises `getPuzzleHint` in real play, plus a focused runtime caller test. |
| PZ-004 | not_started | support_needed_now | Worker A | `docs/projects/puzzles/TRACKER.md` | Character model scan | Legacy `character.stats` fallback remains the primary source for several puzzle checks despite TODOs marking a pending migration. | `src/systems/puzzles/lockSystem.ts`, `src/systems/puzzles/pressurePlateSystem.ts`, `src/systems/puzzles/secretDoorSystem.ts`, `src/types/character.ts` | Mixed model usage risks incorrect check math as systems move to the modern shape. | Confirm the migration target and keep shim behavior stable in the interim. | Add a follow-up checklist and pass/fail marker after the migration scope is finalized. |
| PZ-005 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/TRACKER.md` | Integration TODO sweep | Mechanism, secret door, pressure plate, and arcane glyph systems still note TODOs for Submap/BattleMap/spell integration. | `src/systems/puzzles/mechanism.ts`, `src/systems/puzzles/secretDoorSystem.ts`, `src/systems/puzzles/pressurePlateSystem.ts`, `src/systems/puzzles/arcaneGlyphSystem.ts` | State changes happen in isolation and may never be visible to movement or rendering systems. | Hand this off to map/world integration with explicit dependencies before puzzle visibility expectations are set. | Keep this out of the lockpicking slice unless the world-rendering dependency is accepted first. |
| PZ-006 | not_started | adjacent_follow_up | Worker A | `docs/projects/puzzles/TRACKER.md` | Skills integration sweep | `skillChallengeSystem` remains marked as a 4e-style abstraction with TODO integration into Dialogue. | `src/systems/puzzles/skillChallengeSystem.ts` | Social and combat challenges cannot be consumed by narrative scenes until a host integration exists. | Decide whether dialogue or the puzzle system owns the challenge loop, then route the work. | Close or route this gap from a social-integration owner before feature slice work begins. |

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
