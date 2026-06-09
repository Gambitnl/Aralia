# Battle Map Parity Checklist

Status: active
Last updated: 2026-06-08

This checklist is the durable proof gate for the 2D and 3D battle-map renderers.
It records the shared state surfaces that must stay aligned before any future
renderer behavior expansion.

## Scope

- CombatView owns `mapData` and pushes map updates through the shared combat
  hooks.
- `BattleMap.tsx` renders the 2D grid, tile overlays, and combat-map overlays.
- `BattleMap3D.tsx` renders the parallel 3D scene, grid, VFX, and creature
  highlights from the same shared state.
- `useBattleMapGeneration.ts` remains hook-shaped in filename only; the naming
  contract is documented separately and is not part of this checklist gate.

## Checklist

| Area | 2D renderer proof | 3D renderer proof | Status |
|---|---|---|---|
| State updates | `BattleMap` receives `mapData`, `turnState`, `turnManager`, and `abilitySystem` from `CombatView` and routes shared map state into tile and overlay rendering. | `BattleMap3D` receives the same shared map state and forwards it into terrain, grid, VFX, and actor layers. | checked |
| Movement highlight | `BattleMapTile` shows `validMoves` and `activePath` with distinct move/path overlays. | `GridOverlay` receives the same `validMoves`, `activePath`, and `actionMode` inputs. | checked |
| Target highlight | `BattleMapTile` shows valid targets with the red target overlay and keeps teleport preview tiles visually distinct. | `CharacterActor` receives the same `isTargetable` state and `targetingMode`, while the scene keeps targetable actors and preview markers visible. | checked |
| Overlay state | `BattleMapOverlay` receives live spell zones, delayed effects, light sources, movement cues, AoE preview, teleport preview, and assigned teleport destinations. | `VFXSystem` receives the same overlay family in 3D form, plus light-level / visible-tile data for the tactical mask. | checked |

## Proof

- `src/components/BattleMap/__tests__/BattleMap.parity.test.tsx`
- `src/components/BattleMap/__tests__/BattleMap3D.parity.test.tsx`
- `src/components/BattleMap/__tests__/BattleMap.visibility.test.tsx`
- `src/components/BattleMap/__tests__/BattleMap3D.visibility.test.tsx`

## Resume Rule

Before any future behavior expansion that changes movement, targeting, overlays,
or visibility, read this checklist first and re-run the focused parity tests.
