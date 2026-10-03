# Submap Generation

Verified: 2026-09-20

A submap is one Worldforge map cell drawn as its own SVG map of smaller cells. The player drills from the world atlas into a submap, and from a submap cell into a deeper submap. The drill stops at L3.

This directory holds only this document. The live code is in `src/systems/worldforge/submap/` and `src/components/Worldforge/`.

## Where the live submap lives

| Part | File |
|---|---|
| Generator (pure, headless) | `src/systems/worldforge/submap/submapEngine.ts` |
| Atlas cell to generator input | `src/systems/worldforge/submap/l0Adapter.ts` |
| Focus cell plus its atlas neighbours | `src/systems/worldforge/submap/neighbourhood.ts` |
| SVG renderer | `src/components/Worldforge/SubmapSvgView.tsx` |
| Region-tier renderer | `src/components/Worldforge/NeighbourhoodSvgView.tsx` |
| Drill host and drill stack | `src/components/MapPane.tsx` |
| Layer toggles | `src/components/Worldforge/useDrillLayers.ts` |
| Travel graph across submap cells | `src/systems/worldforge/travel/submapTravelGraph.ts` |
| Seed paths and seeded RNG | `src/systems/worldforge/seedPath.ts`, `src/utils/random/seededRandom.ts` |

## The pipeline

1. `atlasCellToSubmapContext(atlas, cellId, worldSeedPath)` in `l0Adapter.ts` turns one FMG atlas cell into a `SubmapParentContext`. The context carries the cell polygon, a seed path, the biome **name** (not a numeric id), and the set pieces the cell inherits: burgs, road junctions, river bends, and the river and road polylines.
2. `buildAtlasNeighbourhood(atlas, focusCellId, isExplored, seedPath, opts)` in `neighbourhood.ts` builds the focus cell's context plus a context for each adjacent atlas cell. `MapPane.tsx` calls it with `submapCount: 160`.
3. `generateSubmap(ctx, { count })` in `submapEngine.ts` returns a `SubmapModel`: a boundary, a list of `SubmapCell`, the burg cell index, and the clipped polylines.
4. `SubmapSvgView` draws the model. `MapPane.tsx` keeps a `submapStack: DrillTier[]` and pushes a new tier on each drill.
5. `submapCellToChildContext(cell, parent)` turns a clicked cell into the next tier's context. The child seed path gets the segment `sub:<siteIndex>`.

## How the generator works

`generateSubmapSites` builds the site set in two steps.

- Every inherited feature is force-placed at its exact relative position. Identity travels on the feature object and is never regenerated.
- The remaining sites are scattered by rejection sampling inside the parent polygon. The default count is 60; the map passes 160.

`generateSubmap` then builds the diagram.

- Eight frame points are placed outside the bounding box, so every real site gets a bounded cell.
- `Delaunator` triangulates, and `src/systems/worldforge/fmg/voronoi.ts` builds the Voronoi cells.
- `clipPolygon` trims each cell to the parent polygon with Sutherland-Hodgman. The submap is therefore exactly the parent cell's shape.
- `clipPolylineToPolygon` trims the inherited rivers and roads to the same boundary.

### Sub-biome variation

`subBiomeFor(parentBiome, seedPath, siteIndex, blend?)` gives each cell its biome name. About 62 percent of cells keep the parent biome. The rest draw from the module-local `BIOME_VARIANTS` palette for that parent biome. Without `blend` the function sees no geometry: it has the site index only.

`SubmapSvgView.tsx` maps the biome name to a fill through its internal `BIOME_TINT` table.

### Determinism

Every draw comes from `rngFromPath(streamPath(path, '<stream>'))`, which returns a `SeededRandom`. Never use `Math.random` here. The engine uses three streams: `submap-sites` for the scatter, `subbiome:<siteIndex>` for the biome draw, and `edge-blend:<siteIndex>` for the transition band. The path-to-seed mapping in `seedPath.ts` is frozen, because a change to it breaks saved worlds. Any new feature must take a new named stream, so the existing streams keep their values.

### Gradual biome transitions

A submap cell next to a different parent-tier biome leans toward that biome, so the drill boundary is a band and not a line.

`SubmapParentContext` carries an optional `neighbourBiomes`: one `{ biome, centroid }` per adjacent parent cell, in the same coordinate frame as the context polygon. There are two producers, one per tier.

- Region tier: `buildAtlasNeighbourhood` reads the true adjacency from `atlas.pack.cells.c`, keeps the neighbours this neighbourhood actually holds, and takes each centroid from the cluster-scaled polygon.
- Every deeper tier: `submapCellToChildContext(cell, parent, siblings)` reads the parent submap own adjacency. See "Blending below the region tier" below.

`generateSubmap` has the clipped cell polygon in hand, so it passes the cell centroid to `subBiomeFor`. `edgeBlendPull` then does the geometry:

1. Skip any neighbour whose biome equals the parent biome. A same-biome edge gets no band.
2. Take the unit direction `u` from the parent bbox centre toward the neighbour centroid.
3. Measure the parent's reach along `u` as its support radius: the largest vertex projection.
4. Normalize the cell's own projection by that reach to get `t`. `t` is near 1 at the shared edge and at or below 0 on the far side.
5. Below `EDGE_BLEND_START` the cell is interior and keeps its local variant. Above it, the pull rises to `EDGE_BLEND_MAX_PULL` at the boundary, shaped by `EDGE_BLEND_FALLOFF`.
6. The strongest pull wins, so a corner cell leans toward its nearest neighbour.

The cell adopts the neighbour biome when a draw from the `edge-blend:<siteIndex>` stream falls under that pull. The band is therefore dappled, not a solid wedge.

A context with no `neighbourBiomes` produces exactly the biomes it produced before this feature existed. The blend takes its own stream, so the frozen `subbiome` stream keeps every value. `submapEngine.test.ts` pins that with a literal golden.

### Blending below the region tier

Every tier blends, not only the region tier.

Each `SubmapCell` carries `neighbours`: the site indices that share a Voronoi edge with it, taken from the submap's own Delaunay graph (`voronoi.cells.c`). That is the deeper tier's equivalent of `atlas.pack.cells.c`.

`submapCellToChildContext(cell, parent, siblings)` uses it. Pass the parent submap's cells as `siblings` and it builds the child's `neighbourBiomes`: the sub-biome of each adjacent sub-cell, with the bbox centre of that sub-cell as the centroid. The frame is the parent submap's frame, which is the frame the child polygon is already in. A neighbour with no biome, or one whose cell was dropped as degenerate, is skipped.

The child also inherits the sub-cell's OWN biome, not the whole submap's inherited biome. Drill a Wetland sub-cell of a Grassland region and the child opens as a Wetland.

`edgeBlendPull` then runs unchanged. It ignores every neighbour that matches the child's own biome, so:

- A sub-cell on a sub-biome band edge gets a band that leans toward the adjacent sub-biome.
- A sub-cell in the core of a uniform patch gets no pull at all, and keeps pure local variation.

Omit `siblings` and the child gets no `neighbourBiomes`, which is exactly the behaviour the wrapper had before this feature. `MapPane.tsx` passes the cells at both drill call sites.

Both scale helpers (`normalizeParentContextScale` and the local `normalizeCtxScale` in `MapPane.tsx`) scale the neighbour centroids with the polygon. A deeper tier is normalized to the canonical span AFTER its child context is built, so a centroid left unscaled would aim the blend in the wrong direction.

## Travel

`buildSubmapTravelGraph(model)` turns a `SubmapModel` into a travel graph. `MapPane.tsx` feeds that graph to `planRoutesFrom` in `src/systems/travel/routePlanning.ts`, with the party speed, the selected transport, and the season multiplier. Submap travel time is therefore computed from the route, not from a fixed per-move cost.

## Tests

- `src/systems/worldforge/submap/__tests__/submapEngine.test.ts`
- `src/systems/worldforge/submap/__tests__/l0Adapter.test.ts`
- `src/systems/worldforge/submap/__tests__/neighbourhood.test.ts`
- `src/components/Worldforge/__tests__/SubmapSvgView.test.tsx`
- `src/components/Worldforge/__tests__/NeighbourhoodSvgView.test.tsx`

`submapEngine.test.ts` and `neighbourhood.test.ts` pin determinism. Any change to a seed stream shows up there first.

## Algorithm ideas, not current code

These two algorithms are written up here as ideas for richer submap interiors. **Neither one runs in the live SVG submap.** The Voronoi engine above is the only generator on the drill path.

### Cellular automata for organic interiors

Implementation that exists: `src/services/cellularAutomataService.ts`.

Fill a grid with seeded noise, then smooth it over several passes. A cell becomes wall or floor from its Moore-neighbourhood count. A flood fill then finds disconnected floor regions and carves corridors between them, so the whole map stays traversable. This suits caves and dungeons.

### Wave function collapse for structured interiors

Implementation that exists: `src/services/wfcService.ts`, with rulesets in `src/config/wfcRulesets/`.

A row-by-row scan picks tiles under adjacency constraints, for example a "mountain base" tile only below a "mountain peak" tile. The row scan is cheaper than a full-entropy solver, which matters if the map is built during a render. The generator filters the tile set by biome.

## Legacy grid submap

`src/utils/spatial/submapUtils.ts` still exports `getSubmapTileInfo`, and `src/config/submapVisualsConfig.ts` still holds its per-biome visual recipes. That pair is the old tile-grid submap. It takes a numeric Aralia biome id, not a biome name. It is still read by `src/utils/context/contextUtils.ts` and `src/services/landmarkService.ts`, but it is **not** wired to the Worldforge SVG submap. Do not confuse the two paths.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"src/features/SubmapGeneration/README.md","sha256WithoutMarker":"cee0973de824deb8cf3114e72f9d7a066ac93f9a37755bd70a837ca46ad04662","markedAtUtc":"2026-06-26T00:53:11.791Z"} -->
