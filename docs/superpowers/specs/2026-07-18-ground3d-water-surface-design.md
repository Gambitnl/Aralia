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

## The town river is missing from the 3D bake — open, 2026-07-29

**The finding, and it is a divergence not a rendering bug.** Burg Epicea's 2D Town Plan draws a river straight through the town, with bridges over it. The 3D bake for the same town produces NO town water bodies at all. Proven by substitution: re-enabling the town-quad water emission changed the rendered scene by exactly nothing — 64 sheets and 41 levels before and after, byte-identical. If `ground.waterBodies` held anything, those sheets would have appeared.

So `canonicalTownWaterAndDecks` → `getCanonicalTownWaterFeatures(townAtlas, burgId)` is returning no rivers for a town whose plan has one. The canonical-town contract exists precisely to stop 2D and 3D disagreeing about the same place, so this is worth treating as a contract break rather than a water problem.

Corroborating scan across all `WORLD_BATTLE_SCENARIO_PRESETS` (seed 42): **zero** authored river bodies anywhere. Water bodies only appear where a town does (`towns=1 → bodies=1`), and that one body is a coast apron. Even the presets named `river-bridge-crossing` and `river-ford-crossing` have `bodies=0` — those are wilderness cells, where rivers ride a different path entirely (`data.rivers` ribbons via `emitRibbon`, untouched by any of this work).

**Not reproducible in a test yet.** Baking Epicea's cell directly (`seed 903674813, cell 2186`) yields `towns=0`, because the game centers its window with a `centerPx` the test does not have. Finding how the running game picks that window is the first step for whoever takes this.

**Remy's direction (2026-07-29), in priority order:** water existing at all comes first; then the town generator should make better rivers; and town rivers should connect to WORLD rivers — which he doubts happens today. That last one is untested and worth checking early, because a town river that does not meet the region river is the same divergence seen from the other end.

**State left behind:** the town-quad emission is ON again (so any town that does produce water bodies will draw them) and its width is capped at `TOWN_RIVER_MAX_HALF_WIDTH_FT` (20 ft half-width, ~12 m river) instead of 3% of the town's span per side, which is what produced the 52 m slabs.

## Let the land decide — 2026-07-28/29

Remy, after seeing water sunk under the hillside: "can't you make water act naturally... like real water dynamics?" He then chose to let the terrain decide rather than keep patching rules. Right call — three hand-made rules had each failed in turn (crude quads → 52 m slabs; one flat level per body → river buried 13 m under a hill; per-cell bank levels → better but still mine).

**Built (`terrainHydrology.ts`), the two standard steps, once per bake:**
- **Depression filling** (priority flood): every hollow is raised to the height it would spill at. A lake's flat surface falls out of the terrain instead of out of a rule.
- **Flow accumulation**: on the filled surface each cell drains to its steepest downhill neighbour and flow adds up, so a river appears where water genuinely collects and grows downstream.

Water height then comes from the ground it stands on, so it cannot sit above its bank or under a hill by construction.

**Measured in-game, before → after:**

| | flat-level rule | land decides |
|---|---|---|
| distinct water levels | 1 | **45** |
| sheets under ground | 8 of 8 | 18 of 64 |
| worst burial | **13.01 m** | **0.98 m** |

The remaining ~1 m is a cell-centre probe catching a bank on a narrow channel, not water under a hill.

**Then Remy: "where's the water...?"** — the town had ponds and no river. Hydrology alone cannot find a town's river: the window is small and flat, and flow never reaches the threshold. But the river IS authored — the atlas knows its course and the 2D map draws it.

**Fix written, NOT verified live.** `resolveGroundWater` takes the COURSE from the authored centerline (`rasterizeChannel`, 3 m each side, round brush, half-cell stepping so diagonals leave no gaps) and the HEIGHT from the land (`waterLevelsByCell`, each cell just below its own bank). Unit-tested (45 tests in the water modules, 13 in hydrology), typecheck clean, 592 suite tests green.

**But it does not take effect in the running world.** After the change the scene still shows 64 sheets at 45 levels — byte-identical to before — and a probe log placed inside `resolveGroundWater` never appeared in the page console, including after a cache-busting reload. So that code is not executing for the live bake. Chunk generation runs in a Web Worker (`groundChunkWorkerCore.ts` / `createGroundWorkerChunkLoader.ts`), which is the prime suspect (stale worker bundle, or a second bake path that does not call this). **Next step is to find which code actually bakes the live GroundWorld before trusting any further water work** — three separate water changes have now been judged against a world that may not be running them.

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

## Water never drew at all — the winding bug (found + fixed 2026-07-28)

Remy: "i don't actually see water in town. i do however see it way off in the distance." He was right, and every height fix above was necessary but not sufficient. **The water sheets were being culled.**

`earcut`'s output winding follows its input ring, and these rings come out clockwise, so every water triangle faced DOWN. Back-face culling goes by winding, not by the normal attribute — and every vertex normal here says `(0,1,0)`, so the geometry claimed to face up while being drawn face-down. Result: invisible from any camera above the surface, which is all of them.

Measured in the live scene, water isolated against a grey background:

| | pixels drawn | blue-dominant |
|---|---|---|
| before (FrontSide) | **0** | 0 |
| test with DoubleSide | 24,864 | — |
| after the winding fix (FrontSide) | **24,864** | **24,864** |

Fixed by orienting the triangles in `pushUpwardTriangles` (`waterGeometry.ts`) rather than switching the material to `DoubleSide` — a sheet drawn from both sides is two coplanar face sets, the z-fighting trap that already bit the town walls and gates. 6 tests pin it, including a sloped surface, since a river is not flat.

This also explains the earlier confusion: every "water" photographed before this fix — the big blue-grey expanse, the dark channel through town — was water-COLOURED TERRAIN. No water mesh had ever rendered.

**A new water look shipped with it** (`water/waterSurfaceMaterial.ts`): a procedural tiling ripple normal map (the sheets are 2-triangle quads, so detail cannot come from geometry), scrolled on two axes at different rates, plus emissive tied to the water colour so dusk makes it darker rather than browner, plus low roughness for a sun sheen. UVs are derived from WORLD x/z so the ripple does not restart at chunk seams. Motivation was measured: a pixel on the river read RGB (86,84,71) against dirt at (91,87,74) — five points apart and not blue-dominant.

**Still not visible in play, and why.** Two things remain after the culling fix. First, water renders very dark at dusk — against the near-black sky it still does not read, so the brightness/time-of-day response is unsettled. Second, the harbour apron polygon covers ground that stands above its own water level, so the sheet is correctly buried under most of it: 4 of 5 samples on the 117×127 apron have terrain above the water. Both point the same way — water should be derived from the actual water CELLS rather than from crude quads, which is what `findWaterRegions` was built for and is still unwired.

**Proof (live, burg Hajdured).** Before: all 8 water meshes at y = −0.55 with terrain at 14.98 / 13.76 / 5.27 above them. After: surfaces vary WITHIN a single mesh — 11.93→13.22, 9.24→12.0, 0→9.29 — which is a river descending, while the sea apron sits flat at 0. The chasm is gone from the frame. Of 38 sampled water vertices, 20 sit above the bed and 18 tuck under the bank, which is what a channel rim should do. Tests: 21 across `townWaterBodies` and the new `waterSurfaceY` suite (sea flat at zero, lake flat at 400 m, river descends and interpolates, both banks level, clamped past the ends, legacy untagged bodies still flat); main-tree sweep 1710 passed, and the 2D/3D town-identity merchant test still binds the same plot ids.
