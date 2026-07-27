# Ground 3D real water surface

Decision (Remy, 2026-07-18): build a real water surface for ground-mode 3D. Captured on the plan map as `ground3d-water-surface`. This spec records the problem, the recommended approach, and the open calls. Build waits for Remy's go.

## Problem

Rivers in ground-mode 3D have no water surface. The river ribbon mesh renders 0.5 m below the carved riverbed (`waterGeometry.emitRibbon`: terrain sample minus `WATER_DROP_M`), so it is always hidden inside the terrain. What the player sees as "water" is the bare carved bed painted with the water-biome vertex tint.

This breaks every read that depends on a waterline:

- Nothing can look submerged. A ford causeway cannot sit "in" the water — it can only sit on blue-painted ground (found 2026-07-17 while building the 3D ford treatment).
- Bridges cross tinted dirt, not water. Piers and abutments have no waterline to meet (found while fixing the inland-bridge burial bug, task_8657df36).
- Objects cast hard, crisp shadows onto the "water" as if it were a gym floor — because it is terrain.
- Banks have no shoreline edge; wet and dry blend only by vertex-color interpolation.

## Evidence

- `src/systems/world3d/waterGeometry.ts` — ribbon Y = `waterHeightAt(bed) - WATER_DROP_M`; always under the carved bed it samples.
- Ford work 2026-07-17/18: the causeway had to invent its own waterline (deepest-bed heuristic, then water-biome gating) because no shared water surface exists. Proof shots in `.agent/scratch/ford-shots/`.
- Bridge burial fix 2026-07-17: bridge decks likewise anchor to terrain samples, not water.

## Recommended approach

One shared waterline, computed once, rendered once, and used by everything.

1. Compute a per-river waterline: for each river corridor, waterline Y per centerline point = carved bed + channel depth, smoothed so it never flows uphill downstream. Store it on `GroundWorld`.
2. Render the ribbon AT the waterline instead of under the bed, widened to cover the water-biome extent (today the ribbon is often narrower than the tinted bed).
3. Expose `riverWaterlineAt(x, z)` from the ground loader. Fords, bridges, docks, and props anchor to it — this replaces the ford's channel-floor heuristic and the bridge's terrain-ceiling sampling where water matters.
4. Material: keep the stylized flat look; slight translucency is an open call (see below).

## Alternatives considered

- Flat per-window water level: wrong for rivers that drop across a window; rejected.
- Screen-space water shader over water-biome cells: larger renderer change, does not give other systems a queryable waterline; rejected for this slice.

## Blast radius

- `waterGeometry.ts` (ribbon Y and width), `groundChunkLoader.ts` (waterline computation and anchors), chunk types.
- BattleMap's `WaterSystem` is a separate surface and stays untouched.
- Terrain carve stays as-is — the bed remains visible through/under the new surface.
- Visual goldens and the ford/bridge deck tests will need re-anchoring to the shared waterline.

## Open

- Translucent water (bed visible through it) or opaque stylized water — Remy look call.
- Whether lakes and coastal ocean adopt the same surface in this slice or later.
- Whether the water plane receives shadows (likely no — flat unlit or matcap-style).
- Depth constant vs per-river discharge-scaled depth.
