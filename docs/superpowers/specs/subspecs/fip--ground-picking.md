# Sub-spec: 3D ground picking

**Parent:** `../2026-07-02-fight-in-place-combat-design.md` · **Status:** parked (genuinely new tech — nothing like it exists in the scene yet).

## Scope
Click/hover a world position in the streamed 3D scene: raycast → ground meters → referee cell. Foundation for movement targeting, AoE placement, and any in-scene interaction. The 2D Locale map's click-to-move proves the state contract (`SET_PLAYER_GROUND_POS` sink); this brings the same to the 3D view.

## Open
- Picking against terrain only vs terrain + props (cover targeting needs props).
- Hover feedback (cell highlight? world-space cursor decal?).
