---
schema_version: 1
gap_schema: project_gap_registry
project: Battle Map
slug: battle-map
status: "active (G6 tactical spawn scoring implemented 2026-06-19)"
status_note: ""
registry_mode: canonical
last_updated: "2026-06-25"
gap_count: 4
open_gap_count: 3
resolved_gap_count: 1
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/battle-map/NORTH_STAR.md
tracker: docs/projects/battle-map/TRACKER.md
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
# Battle Map Gap Registry

Status: active (G6 tactical spawn scoring implemented 2026-06-19)
Last updated: 2026-06-25

Use this file for durable unresolved findings that genuinely belong to this project.

T3 decision: G2 and G3 are separate follow-up slices. Treat G2 as the runtime/pathability proof slice and keep G3 as the review-required naming decision until the Required Review Brief is resolved.
T4 proof: the G2 connectivity slice now has a focused seed-2 regression that keeps cave/dungeon maps to one connected walkable component.
G4 proof: the renderer parity slice now has a concrete checklist and focused tests covering shared state updates, overlays, and highlighting across the 2D and 3D battle-map renderers.
Research triage note, 2026-06-10: the useful spawn-placement part of the AAA-lite readability report belongs here, not in Encounter Generator. Encounter Generator decides encounter content and difficulty; `useBattleMapGeneration.ts` currently owns the spawn-zone spread that places teams onto the generated tactical map.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G5 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G5 | Code modularization audit routing | `VFXSystem.tsx` is a large render-aware VFX surface (~1083 lines) mixing spell-zone effects, weapon trails, impact particles, damage numbers, light-source glows, visibility masks, and AoE previews. Splitting without renderer-boundary proof can break zone-effect parity with the 2D overlay and the visibility mask contract. | `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/components/BattleMap/vfx/__tests__/VFXSystem.visibility.test.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G5 | VFX sub-components share render state (light levels, spell zones, visibility) with the 2D battle-map overlay; a split that moves helpers without preserving the shared-prop contract can create silent divergence between 2D and 3D combat feedback. | Define renderer-boundary proof before any VFX modularization; keep `buildTileVisibilityOverlays` export and spell-zone parity as the test anchor. | `VFXSystem.visibility.test.ts` stays green; any split plan names which sub-components move and how shared overlay props are preserved. |
| G6 | done | adjacent_follow_up | Battle Map owner | `docs/projects/battle-map/GAPS.md` | AAA-lite visual readability research triage (2026-06-10) | Spawn placement now uses deterministic tactical scoring for cover/blocked-line proximity, elevation, chokepoints, enemy distance bands, and fallback-to-nearest-walkable behavior when preferred zones are exhausted. | `src/hooks/useBattleMapGeneration.ts` (`getTacticalSpawnTiles`, `MIN_SEP`, tactical scoring helpers), `src/hooks/__tests__/useBattleMapGeneration.test.ts`, `docs/projects/battle-map/AUDIT_OR_PROOF.md` | Fights start from tactically stronger positions while preserving deterministic setup, team separation, and no-undefined character placement on dense maps. | Re-check only if spawn-zone shapes, terrain facts, or battle-map dimensions change. | `npx vitest run src/hooks/__tests__/useBattleMapGeneration.test.ts` passed 2026-06-19 with fixed-seed determinism, dense-map fallback, separation, tactical-score, and <=50ms 40x30 budget coverage. |
| CMA-G15 | not_started | adjacent_follow_up | battle-map owner | `docs/projects/code-modularization-audit/GAPS.md` CMA-G15 | Code modularization audit routing | `CharacterActor.tsx` (~697 lines) and `TerrainMesh.tsx` (~675 lines) are large 3D files mixing animation, selection decals, and terrain generation; modularization needs frame/render parity before any split. | `src/components/BattleMap/characters/CharacterActor.tsx`; `src/components/BattleMap/terrain/TerrainMesh.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G15 | A split that moves actor animation or terrain helpers without preserving render parity can break 3D battle-map visuals. | Accept or defer the inbound CMA-G15 route; if accepting, create a narrow split plan with actor/terrain render-parity proof. | Owner gap row exists and CMA-G15 status is updated to reflect acceptance or deferral. |
| G7 | not_started | adjacent_follow_up | battle-map / presentation owner | `docs/improvements/SPRITE-POSE-CONTROL-VARIANTS.md` retirement 2026-06-25 | Control-option commands have gameplay proof, but no shared visual pose/variant path exists for affected creatures. | Retired `docs/improvements/SPRITE-POSE-CONTROL-VARIANTS.md`; `src/commands/effects/UtilityCommand.ts`; `src/commands/__tests__/UtilityCommand.test.ts`; `src/hooks/useAbilitySystem.ts`; BattleMap sprite/actor surfaces | Command-control effects such as approach, flee, drop, grovel, and halt already alter gameplay. Without an optional presentation path, visual feedback can remain generic or fragment into bespoke per-effect hacks. | Define a non-blocking visual-state contract for one control option, including cache/fallback/restore behavior and whether the 2D sprite or 3D actor surface owns the first slice. | Focused command/UI proof showing gameplay still resolves if no variant exists, and rendered proof that one selected control option visibly swaps/restores presentation when an asset or state marker is available. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the core task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, environment, or another person. |

## Update Rules

- Keep gaps tied to evidence and a concrete next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md` instead of keeping them here.


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
