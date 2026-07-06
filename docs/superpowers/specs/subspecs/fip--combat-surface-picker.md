# Sub-spec: Combat surface context-picker + dev entry

**Parent:** `../2026-07-02-fight-in-place-combat-design.md` · **Status:** BUILT (2026-07-05).

## Decision
Locked decision #3 ("view surfaces are context-picked, never competing") is
realized as one pure function, `pickCombatSurface(ctx)` in
`src/systems/combat/fightInPlace/combatSurfacePicker.ts`:

- A live streamed world → `surface: 'in-place'`, `deriveFromWorld: true` (the
  referee grid is derived from the player's local terrain patch — props become
  cover/LoS/movement).
- No live world (story encounters, travel ambushes, openings) → `surface:
  'arena'`, `deriveFromWorld: false` (the themed BattleMap3D keeps its job).

The 2D tactical board is always available regardless of the pick. The picker is
React/Three-free so it is trivially testable (4 unit tests).

## Dev entry
`window.__fipTestFight()` (console) and the `?fipfight` spawn param start a test
fight at the player's exact 3D location in `World3DWrapper`, reusing the SAME
`extractLocalTerrainPatch` + `handleStartBattleMapEncounter` path as the
hostile-proximity trigger. The world-derived grid renders on the 2D board via
CombatView's existing `extractedBattleMap` consumption.

## Cut line (slice 1)
In-scene 3D rendering of combat (actors, turn HUD, tactical-orbit camera in the
ground scene) and 3D ground picking were LATER slices; slice 1 routed the
world-derived fight to CombatView, not into the ground scene.

## Update (slice 2, 2026-07-05)
In-scene rendering + ground picking LANDED. The picker's verdict is unchanged;
what changed downstream is that CombatView now renders the in-place fight IN the
streamed world (render mode `'inplace'`) when a `fightInPlaceHandoff` is present
(`InPlaceCombatScene` + `InPlaceCombatLayer`), instead of a separate diorama. In-
scene movement is refereed by `inSceneMovement.ts`. See the parent spec's
slice-2 status block. No fake stubs.

## Open
None — the picker's slice-1 job is complete. Later slices layer placeless
site-selection/dressing on the arena branch and mesh-LOS on the in-place branch;
neither changes this routing.
