# World Map

Verified: 2026-09-09

## Purpose

The world map shows one generated world at region scale. It supports start-point selection, travel planning, discovery, and the move into Region, Local, and Ground views.

The visual renderer does not own geography or save state. Aralia's atlas and game state remain the authority.

## Canonical Data And Renderer

`getBridgeAtlas(worldSeed)` in `src/systems/worldforge/bridge/legacySubmapBridge.ts` returns the canonical atlas for a seed. The same `FmgAtlasResult` supplies geometry, cells, states, cultures, religions, provinces, settlements, routes, and related labels to every maintained world-map surface.

`src/components/Worldforge/AtlasSvgView.tsx` is the maintained interactive renderer. It draws the canonical atlas and owns the shared map interaction behavior, including pan, zoom, layers, labels, markers, and cell selection.

These player-facing surfaces use that pipeline:

- `src/components/Worldforge/StartPointSelection.tsx`
- `src/components/Worldforge/SpawnPreview.tsx`
- `src/components/MapPane.tsx`
- `src/components/Worldforge/AtlasDemo.tsx`

`src/components/Worldforge/responsiveAtlasCore.ts` and the responsive preparation worker build the same SVG model away from the main thread. They do not create a second world.

## Renderer Comparison

Design Preview exposes a developer comparison at `/Aralia/misc/design.html?step=worldforge`.

`src/components/DesignPreview/steps/PreviewWorldforge.tsx` calls `getBridgeAtlas` once for the selected seed and gives that same atlas object to both panels:

- the left panel uses `AtlasMapView`, the retired canvas renderer, as a visual reference
- the right panel uses `AtlasSvgView`, the maintained player renderer

The panels deliberately keep independent pan and zoom state. The retired panel also has a reference lens selector. Use the canonical panel's Layers menu when comparing equivalent data overlays.

This comparison is for design review only. It lets developers identify useful color and texture treatments before moving them into the maintained SVG system. It must not turn the canvas renderer back into a player route or a second source of geography.

## Retired Canvas Boundary

`src/components/Worldforge/AtlasMapView.tsx` and `src/components/Worldforge/atlasDraw.ts` preserve the retired canvas artwork as reference material. No player-facing component imports `AtlasMapView`.

The old `phase=worldforge` route remains closed. The active World Generation route is opened with the `worldmap=1` query and uses `AtlasSvgView`.

`src/components/Worldforge/__tests__/duplicateCanvasRetirement.test.ts` protects this boundary. The only allowed React import of `AtlasMapView` is the clearly labeled Design Preview comparison.

## Legacy Tile-Grid Model (retired)

The world once had a second data model: `MapData` in `src/types/world.ts` - a
`gridSize` plus `tiles: MapTile[][]`, a dense 30x20 rectangular array. It is
retired. `mapData` left `GameState` and the save format on 2026-06-30, and the
2026-09-09 pass (agora-608b) finished the residue: `MapData.tiles` is now
optional and deprecated, and every click, 3D-entry and observation contract
carries `WorldCellView` - a cell-native payload holding the canonical atlas
`cellId` - instead of a synthesized `MapTile` whose coordinates were always
`(0, 0)`.

Nothing in the running game constructs or reads a `MapData`. One consumer
remains and cannot migrate: `migrateMapDataToWorldDataV2` in
`src/state/migrations/worldDataMigration.ts` backfills `worldData` for a pre-v2
save, and that save's grid is the only surviving record of its biomes. The
field is kept for it, not deleted.

Do not reintroduce a rectangular world grid. The inventory, the per-consumer
verdicts and the deletion criterion are in
`docs/adr/0003-mapdata-tiles-grid-retirement.md`.

Note that `BattleMapData.tiles` (`src/types/combat.ts`) is an unrelated model -
the tactical combat board - and is not covered by this retirement.

## Scale Hierarchy

`AtlasDemo` preserves the supported drill-down hierarchy:

1. Atlas
2. Region
3. Local
4. Ground

The Atlas level uses `AtlasSvgView`. Lower levels extend the same world rather than replacing the atlas with an unrelated map authority.

## Constraints

- A seed must resolve to one canonical atlas across start selection, World Generation, MapPane, and Design Preview.
- Cell identity and travel hooks must remain stable when the renderer changes.
- Visual improvements from the canvas reference must be ported into `AtlasSvgView` or its shared SVG layers.
- Renderer preferences must remain scoped so developer comparisons do not overwrite player settings.
- Desktop and narrow layouts need rendered browser proof. Source inspection alone is not visual proof.
- Removing reference code needs a separate decision after any useful artistic treatments have been transferred.

## Open Follow-Through

- Compare each canvas reference lens with its SVG equivalent and record the useful color, texture, coastline, relief, and label treatments.
- Move selected treatments into the SVG renderer through small, independently verified changes.
- Retire the reference renderer only when the design comparison no longer exposes useful differences.
