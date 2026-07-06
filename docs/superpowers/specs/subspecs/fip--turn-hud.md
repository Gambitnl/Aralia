# Sub-spec: In-scene turn HUD

**Parent:** `../2026-07-02-fight-in-place-combat-design.md` · **Status:** BUILT (2026-07-05, slice 2).

## Scope
The combat UI (initiative order, party/enemy panels, action economy, ability bar,
movement remaining, combat log, End Turn) shown during an in-place fight.
Delivered by REUSING CombatView's existing HUD wholesale: the `'inplace'` render
mode swaps only the center map pane for `InPlaceCombatScene` (the streamed world
+ combat token overlay); the surrounding HUD — `InitiativeTracker`,
`PartyDisplay`, `AbilityPalette`, `CombatLog`, `End Turn` — renders unchanged over
the 3D scene. Combatant tokens + active-turn ring + nameplates draw in-scene via
`InPlaceCombatLayer` (drei `<Html>` labels, same pattern as the battle map's 3D
labels).

## Resolved
- **Which CombatView components port unchanged:** ALL of the HUD pieces port
  as-is (they are callback-driven / presentational); only the map renderer is
  swapped. No world-overlay variant was needed for the HUD itself.
- **Where damage/status labels render:** token nameplates use drei `<Html>` in
  the scene (ported pattern). In-scene damage-number / status-marker labels are
  slice 3 (spell/attack presentation port); until then those read on the 2D
  board toggle. This is the documented slice-2 cut line.

## Open
None — slice-2 scope complete. In-scene damage/status labels arrive with slice 3 (spell presentation), tracked there.
