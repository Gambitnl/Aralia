# Sub-spec: 3D ground picking

**Parent:** `../2026-07-02-fight-in-place-combat-design.md` · **Status:** BUILT (2026-07-05, slice 2).

## Scope
Click a world position in the streamed 3D scene during an in-place fight →
referee cell → legality. Delivered as an invisible ground-pick plane spanning the
extracted patch (`InPlaceCombatLayer`): a pointer-down raycast yields a scene
point converted back to world meters, routed through the invisible referee
(`inSceneMovement.ts`: `worldMetersToPatchTile` → `validateInSceneMove`, a pure
BFS port of the 2D board's reachability, 11 TDD tests). A legal move commits via
the SAME `turnManager.executeAction` the board uses. The 2D Locale map's
click-to-move proved the state contract; this brings picking to the 3D view.

## Resolved
- **Terrain-only vs terrain+props:** picking resolves to a referee TILE, and the
  patch already imprints prop cover/blocks-move/blocks-sight (slice 1), so a pick
  onto a blocked tile is rejected. Prop-aware AoE targeting is slice 3.
- **Hover feedback:** the active player carries a soft reachable-area disc
  (world-space, terrain-planted); a per-cell hover cursor decal is deferred to
  the slice-3 spell-presentation port.

## Open
None — slice-2 scope complete. Slice 3 (in-scene spell/AoE targeting) layers on top; it does not reopen picking.
