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
- Dock/bridge decks now clear the resolved water height instead of a shore sample; one deck read as a pale slab hovering over the bank in the after-shot and wants its own look pass.
- Only burg Hajdured was checked. A town whose river enters and leaves at very different heights, and an inland town with no coast at all, are both unverified.
- **The open world's seas and lakes are painted TERRAIN, not water** (found 2026-07-28, see below). Deciding whether they get a real water surface is the biggest open item in this spec, and it is a separate feature from the town water bodies.
- Water is static: no wave motion, no shoreline foam, no wet-sand band. The sheet is near-opaque now, so nothing animates or catches a moving highlight.

## Rivers above sea level — fixed 2026-07-27

Remy spotted "a huge chasm in the middle of the town" in-game at Hajdured, then asked the question that found the real bug: **how can a river be above sea level?** It can, everywhere except its mouth — that slope is what makes it flow. The code could not express that.

**What was wrong.** `GroundWaterBody` carried a single `surfaceY`, documented as "flat", covering both "river channel / harbour apron". The river/coast distinction existed upstream in `getCanonicalTownWaterFeatures` and was discarded by `buildTownWaterBodies`, which returned untagged polygons. So sea, lake, and river all got one flat height.

**Why it showed up as a chasm.** Depths were authored in ENCODED height units and converted with `heightToMeters`, which multiplies by `MAX_TERRAIN_HEIGHT_M × VERTICAL_EXAGGERATION / 100` = ×18. The "shallow" `WATER_SURFACE_DROP_ENC = 1.5` was really 27 m and `WATER_BED_DROP_ENC = 4` was a 72 m pit. Hajdured stands at ~15 m (encoded 0.83), so `max(0, 0.83 − 1.5)` clamped to 0 and every water mesh rendered at −0.55 m — measured live on all 8 of them, 15 m below the ground above it. Any town under ~27 m had this; towns above it looked fine, which is why it hid.

**The fix.**
- `TownWaterBody` now carries `kind: 'sea' | 'river'`, and rivers carry their centerline plus a ring-vertex→centerline index map (`bufferPolylineToChannelIndexed`).
- `GroundWaterBody` gains `kind` (`sea | lake | river`) and, for rivers, `centerlineM` with a resolved height per point.
- `carveTownWaterBasins` resolves per kind: **sea** flat at 0 (no sampling, no drop — dropping the sea below zero buries it under its own floor); **river** per centerline point from the land it crosses, forced non-increasing downstream so it can never flow uphill; **lake** flat at the LOWEST shore sample around its ring, not the centroid alone — a harbour apron reaches 40% of a town's width and one sample cannot describe it.
- Depths are authored in METERS (`WATER_SURFACE_DROP_M`, `WATER_BED_DROP_M`) and converted through a new `metersToHeight` in `config.ts`, the inverse of `heightToMeters`.
- The bed is carved from the body's own resolved water height, so bed and surface can no longer disagree.
- `waterSurfaceYAt` in `waterGeometry.ts` gives each polygon vertex its height: flat bodies use the single value, rivers project the vertex onto the centerline and interpolate. This is per-vertex at render time because chunk clipping invents vertices that no loader-side array could cover; the centerline is deliberately NOT clipped, so heights do not step at chunk seams.

**Correction the same day: "sea level is zero" was wrong here.** The first pass pinned `kind: 'sea'` aprons to y=0 on the reasoning that sea level defines zero. That holds in the world frame, but these heights are the town artifact's LOCAL 0..100 grid, and this burg's shore sits at ~16 m in it — so the apron went 16 m under its own beach, reintroducing the exact burial the fix had just removed (measured: water quads at worldY 0 beneath terrain at 16.44). Sea aprons now take their waterline from `shoreEdge`, the shoreline segment the apron was extruded from, never from its offshore corners (which sample ground far from the water) and never from a global zero. After: the same bodies sit at y 16.89–19.24, at the local ground rather than beneath it.

**What "adding water" turned out to mean.** Photographing the result showed a large blue-grey expanse that reads like slate. It is not water and never was: raycasts through the frame hit vertex-coloured TERRAIN (289-vert chunk meshes) and a sand band, never the water material. The open world's seas and lakes at this scale are **terrain painted a water colour**, so they are lit as ground — no transparency, no specular, no motion. Raising the water sheet's opacity (0.86 → 0.96, kept: it stops a carved bed reading through real water) changed that frame not at all, which is the proof. Giving those bodies an actual water surface is unbuilt and is now the headline open item above.

**Proof (live, burg Hajdured).** Before: all 8 water meshes at y = −0.55 with terrain at 14.98 / 13.76 / 5.27 above them. After: surfaces vary WITHIN a single mesh — 11.93→13.22, 9.24→12.0, 0→9.29 — which is a river descending, while the sea apron sits flat at 0. The chasm is gone from the frame. Of 38 sampled water vertices, 20 sit above the bed and 18 tuck under the bank, which is what a channel rim should do. Tests: 21 across `townWaterBodies` and the new `waterSurfaceY` suite (sea flat at zero, lake flat at 400 m, river descends and interpolates, both banks level, clamped past the ends, legacy untagged bodies still flat); main-tree sweep 1710 passed, and the 2D/3D town-identity merchant test still binds the same plot ids.
