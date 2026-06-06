# 3D Combat Map North Star

Status: active
Last updated: 2026-05-31

## Purpose

Create a durable cold-start handoff for the combat 3D map renderer used in tactical combat.
The project is responsible for 3D map parity and production quality, while preserving existing combat mechanics and existing 2D behavior.

## Scope and Boundaries

In scope:
- BattleMap3D rendering for combat in `CombatView`.
- 3D renderer parity with the live 2D combat flow.
- Engine constraints, baseline performance targets, and MVP quality boundaries.
- Cross-surface integration with `BattleMap.tsx`, `CombatView.tsx`, and hook-based combat logic.

Out of scope:
- `World3D` world-scale exploration work.
- `ThreeDModal` exploration modal work.
- Combat rule changes, action economy changes, or spell logic.

## Files and Systems Map

- `src/components/BattleMap/BattleMap3D.tsx` (live R3F root)
- `src/components/BattleMap/terrain/*` (terrain, water, vegetation, decals)
- `src/components/BattleMap/camera/CameraController.tsx`
- `src/components/BattleMap/characters/CharacterActor.tsx`
- `src/components/BattleMap/vfx/*` (combat VFX and ambient world cues)
- `src/services/battleMapGenerator.ts` and `src/config/mapConfig.ts` (dimensions + deterministic generation)
- `src/components/BattleMap/BattleMap.tsx` and `src/components/BattleMap/BattleMapDemo.tsx` (2D and demo parity surfaces)
- `src/components/Combat/CombatView.tsx` (toggle host and pop-out container)

## Implemented State

- R3F combat map is live and integrated behind the 2D/3D mode switch in `CombatView`.
- Battle maps support five biomes: forest, cave, dungeon, desert, swamp.
- Deterministic map generation exists for 40x30 maps through `BattleMapGenerator`.
- The 3D subtree is substantially implemented:
  - terrain mesh, grid overlay, grass layer, water, trees/obstacles layer, VFX and particle layer, character actors, lights.
- Engine references already define the stack: three.js WebGL (`three`), `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`.

## Dashboard Card Schema

Project: 3D Combat Map
Slug: 3d-combat-map
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/3d-combat-map
Gap signal: 4 open gaps; G1 closed this pass
Protocol: living project doc set
Next step: Keep the tracker aligned while T4 adds the next verification checklist.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Engine Constraints and MVP Boundary

- MVP is a parity and quality gate, not a rules rewrite: 3D should be the visual front-end swap for combat while hooks keep logic.
- Target quality remains 60 fps on GTX 1060+ class desktop hardware.
- Current engine constraints in use:
  - Browser + three.js rendering via `<Canvas>`.
  - Post effects are optional by budget; SSAO is currently a known stability issue in this codepath.
  - Deterministic generator input for fairness and reproducibility.
- MVP boundary for this project:
  - Implement all required 3D combat-map quality outcomes only within combat flow.
  - Keep 2D/3D behavior parity for movement, targeting, AoE, turn flow, and combat messages.
  - Do not merge unrelated 3D pathways.

## MVP Acceptance Criteria

The next implementation slice can treat the MVP boundary as stable when:

- `BattleMap3D` stays inside combat flow and does not absorb exploration-path behavior.
- 2D and 3D modes preserve movement, targeting, AoE, turn flow, and combat messages.
- `CombatView` pop-out and return preserve the active render mode and lifecycle state.
- The renderer stays inside the 60 fps target on GTX 1060+ class desktop hardware for the documented combat map size.
- Any enabled post-processing path is explicit about its budget and stability tradeoffs.

Not required for MVP:

- `World3D` exploration, chunk streaming, or world-scale traversal behavior.
- `ThreeDModal` travel and modal-exploration behavior.
- Combat rule changes, action economy changes, or spell logic changes.
- Shared renderer standardization across the combat, exploration, and modal 3D surfaces.

## Relationships to Nearby 3D Systems

- `battle-map`/`BattleMap3D` is the only combat renderer in this project.
- `World3D` is a separate pathway for exploration/map streaming and uses `WORLD3D_DEMO`/world chunks.
- `ThreeDModal` is an exploration modal with independent movement and travel callbacks, and is not the combat renderer.
- This project should preserve clear contracts so future renderer reuse does not mix combat movement/state flow with exploration flow.

## Open Questions

1. Should SSAO and post-processing usage remain required in MVP, or be made optional by render mode profile?
2. Should `CombatView` pop-out 3D mode include stronger external sync for render mode and lifecycle state?
3. How strict should the 60 fps requirement be in the coldest test hardware profile before relaxing effects?

## Resume Path

1. Read this file.
2. Read `docs/projects/3d-combat-map/TRACKER.md`.
3. Read `docs/projects/3d-combat-map/GAPS.md`.
4. Continue from top-priority open gap.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
