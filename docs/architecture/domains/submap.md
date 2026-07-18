# Submap (Retired Legacy Domain)

## Current Authority

The former rectangular/Pixi Submap runtime is retired. Its pane, tiles,
painters, procedural hooks, inspect payloads, toggle state, Compass entry, and
grid movement handler were deleted during the completed grid-retirement work.
No production UI can open the legacy surface.

Local exploration now belongs to the Worldforge tiered-navigation stack:

- `src/components/MapPane.tsx` owns the world-to-region/local drill stack.
- `src/components/Worldforge/SubmapSvgView.tsx` renders generated submaps.
- `src/components/Worldforge/NeighbourhoodSvgView.tsx` renders neighbourhood tiers.
- `src/systems/worldforge/submap/` owns deterministic Voronoi generation.
- The absorbed Worldforge specification at `docs/superpowers/specs/2026-07-14-absorbed-worldforge.md`
  and Plan Map topic `shipped-cartography` own successor interaction and 3D-handoff gaps.

## Verified Reachable Flow

The 2026-07-11 whole-game audit exercised the replacement directly. A water
cell exposed terrain detail and an honest disabled descent; a land cell exposed
terrain, biome, state, province, culture, religion, population, and river data;
descent generated an L1 region; Ascend returned to the world atlas. The focused
replacement renderer/MapPane matrix passed 21/21 with no page errors.

## Remaining Successor Work

Retirement did not mean every intended local-navigation feature was replaced.
The current Worldforge local `Travel` mode is preview-only and still drills like
Explore; it has no truthful commit/failure/cancel path and its marker origin is
a burg/centroid heuristic rather than canonical locale coordinates. That work
is registered as Worldforge WF-G15, not as a reason to resurrect Submap.

The 2D-to-3D path is cell-native at the atlas tier, but selected-leaf handoff
and cell/anchor identity invariants remain Worldforge WF-G13/WF-G14. The
historical Submap G12 row is routed there.

## Historical Boundary

Older documentation named `SubmapPane`, `SubmapTile`, `SubmapRendererPixi`,
`useSubmapProceduralData`, quick travel, and inspectable tiles as live entry
points. Those names are retained in Git history and the retired project registry
for provenance, but they are not valid cold-start implementation guidance.

New local exploration work must extend Worldforge's cell-native hierarchy and
must not recreate a parallel rectangular grid or the deleted pane contracts.
