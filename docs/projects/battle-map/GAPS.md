# Battle Map Gap Registry

Status: active (G3 decided 2026-06-10; review gate cleared)
Last updated: 2026-06-10

Use this file for durable unresolved findings that genuinely belong to this project.

T3 decision: G2 and G3 are separate follow-up slices. Treat G2 as the runtime/pathability proof slice and keep G3 as the review-required naming decision until the Required Review Brief is resolved.
T4 proof: the G2 connectivity slice now has a focused seed-2 regression that keeps cave/dungeon maps to one connected walkable component.
G4 proof: the renderer parity slice now has a concrete checklist and focused tests covering shared state updates, overlays, and highlighting across the 2D and 3D battle-map renderers.
Research triage note, 2026-06-10: the useful spawn-placement part of the AAA-lite readability report belongs here, not in Encounter Generator. Encounter Generator decides encounter content and difficulty; `useBattleMapGeneration.ts` currently owns the spawn-zone spread that places teams onto the generated tactical map.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G5 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G5 | Code modularization audit routing | `VFXSystem.tsx` is a large render-aware VFX surface (~1083 lines) mixing spell-zone effects, weapon trails, impact particles, damage numbers, light-source glows, visibility masks, and AoE previews. Splitting without renderer-boundary proof can break zone-effect parity with the 2D overlay and the visibility mask contract. | `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/components/BattleMap/vfx/__tests__/VFXSystem.visibility.test.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G5 | VFX sub-components share render state (light levels, spell zones, visibility) with the 2D battle-map overlay; a split that moves helpers without preserving the shared-prop contract can create silent divergence between 2D and 3D combat feedback. | Define renderer-boundary proof before any VFX modularization; keep `buildTileVisibilityOverlays` export and spell-zone parity as the test anchor. | `VFXSystem.visibility.test.ts` stays green; any split plan names which sub-components move and how shared overlay props are preserved. |
| G6 | not_started | adjacent_follow_up | Battle Map owner | `docs/projects/battle-map/GAPS.md` | AAA-lite visual readability research triage (2026-06-10) | Spawn placement is still zone-random with minimum separation; it does not yet score cover, elevation, chokepoints, line-of-sight pressure, or dense-map fallback quality. | `src/hooks/useBattleMapGeneration.ts` (`SpawnConfig`, `getSpawnTiles`, `MIN_SEP`, TODO for exhausted spawn tiles), `src/services/battleMapGenerator.ts` (elevation, LoS blockers, obstacle/cover-like terrain) | Fights can start fair but tactically flat: teams may spawn in weak positions, miss obvious cover/high-ground affordances, or leave characters unpositioned on dense maps. | Replace or wrap zone-random selection with a deterministic tile scoring pass that stays inside the existing 40x30 map-gen budget: score walkable candidate tiles using separation, cover/LoS blockers nearby, elevation advantage, chokepoint proximity, enemy distance bands, and fallback-to-nearest-walkable behavior when the preferred zone is exhausted. | Fixed-seed tests prove no character starts undefined, formations stay separated, high-cover/high-elevation candidates outrank exposed tiles, and the scoring pass completes within the documented <=50ms budget on a 40x30 map. |
| CMA-G15 | not_started | adjacent_follow_up | battle-map owner | `docs/projects/code-modularization-audit/GAPS.md` CMA-G15 | Code modularization audit routing | `CharacterActor.tsx` (~697 lines) and `TerrainMesh.tsx` (~675 lines) are large 3D files mixing animation, selection decals, and terrain generation; modularization needs frame/render parity before any split. | `src/components/BattleMap/characters/CharacterActor.tsx`; `src/components/BattleMap/terrain/TerrainMesh.tsx`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G15 | A split that moves actor animation or terrain helpers without preserving render parity can break 3D battle-map visuals. | Accept or defer the inbound CMA-G15 route; if accepting, create a narrow split plan with actor/terrain render-parity proof. | Owner gap row exists and CMA-G15 status is updated to reflect acceptance or deferral. |

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
