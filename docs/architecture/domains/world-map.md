# World Map

Verified: 2026-11-01 for the off-thread atlas hook (useOffThreadBridgeAtlas, 6 hook tests, headless longest task under 1 s on three screens); 2026-10-31 for retained library-town focus; 2026-10-29 for depleted-supply status, native public POI identity/pointer-capture inspection, desktop1440/1024 and native save/full reload; 2026-10-28 for embedded player marker, Find Me, phone control clearance and native Region/Local refusal. Shared navigation, drag alignment and Globe retain their 2026-10-27 scope; named exits retain 2026-10-10; other sections retain 2026-09-09.

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

A screen that needs the canonical atlas uses `useOffThreadBridgeAtlas(seed)` (`src/components/Worldforge/useOffThreadBridgeAtlas.ts`), not a `getBridgeAtlas` call in render. The hook returns a cached atlas at once through `peekBridgeAtlas`. Otherwise it builds the atlas in the worker and returns `null` until the worker result is installed, so the screen shows a preparing state. It builds synchronously only where no `Worker` exists, such as jsdom tests. The hook never starts the worker for a seed that is already cached, because the worker install replaces the cached object. Users: `StartPointSelection`, the embedded `AtlasDemo`, `SpawnPreview`, `World3DDemo` and the `startselect` and `worldforge` Design Preview steps (GG-555). `MapPane` and the `town3d` step call `prepareResponsiveAtlas` directly.

## Gameplay Atlas Wayfinding

The embedded Atlas explorer passes the party's canonical atlas cell site to
AtlasSvgView, matching MapPane. This restores the existing player marker and
Find Me control. Demonstration markers never stand in for the party.

Gameplay starts with the existing Options sheet closed so it cannot cover
Find Me. Options remains available; the standalone cartographer keeps its
desktop guidance. At world level on phones, the hierarchy sits beside Find Me
and below the zoom row. Region and Local artifact layouts stay unchanged.

Native desktop and 390-pixel phone checks confirm that Find Me receives a real
click and centers the current cell. Normal selection descends into that cell's
Region and Putivl Local without moving the party. Attempted Ground entry shows
the existing route refusal with its mapped river-corridor reason. Normal Save,
full reload and explicit Load preserve the exact manual payload and reached
candidate position/resources. Seven Atlas checks and scoped types support this
rendered evidence; they do not qualify physical arrival or a complete journey.

## Renderer Comparison

### Globe View

The shared atlas renderer offers Map / Globe. `AtlasGlobeView.tsx` loads Three only when Globe is opened, rasterizes the existing `AtlasLayers` artwork into a bounded 2048×1024 planet texture, and positions the generated region using `atlasGlobe.ts` and the atlas latitude/longitude bounds. Slate grid areas are uncharted, not generated ocean. This does not create new geography or connect opposite map edges for travel.

Drag or use arrow keys to rotate. Scroll, pinch, or use plus/minus to zoom. Reset globe or Home faces the generated region. The view redraws on interaction and texture changes, with no idle render loop. Returning to Map releases globe graphics resources and restores the flat map's pan and zoom. A graphics failure leaves Map available; switching back retries Globe.

Terrain coloring, borders, rivers, routes, feature layers, settlement dots, and state names share the existing model and layer choices. Flat-map reference decorations and hover detail stay on Map. The full political color key is inside the globe menu so it cannot cover the planet on phones. Globe is an inspection view: destination selection and travel remain on Map. It does not claim seamless generated topology at a full-world east/west seam or readable settlement labels at every globe zoom.

Verification includes 39 focused tests, scoped type checks, and browser checks at seed 1337 for rotation, reset, keyboard navigation, layer round-trip, phone sizing, and forced graphics-context loss/recovery. Captures are under `.agent/scratch/worldmap-globe/`. These are renderer checks, not end-to-end gameplay travel acceptance.

### Shared Map Navigation

The maintained SVG map offers Zoom in, Zoom out, and Fit world buttons with 44-pixel minimum targets. With the map focused, plus/minus zoom around the viewport center, Home restores the overview, and Escape clears inspection. Arrow keys still inspect neighboring cells; Enter or Space selects the inspected cell. Fit world preserves layer preferences.

Dragging uses the displayed SVG scale, so the map follows the pointer in scaled containers. Small pointer jitter does not move the map. Only the pointer that began the drag can move or release it. Canceled gestures and lost pointer capture cannot select a destination. Touch retains first-tap preview and second-tap selection; panning clears the armed destination.

Every drag animation frame publishes the same view to terrain and screen-space overlays. Labels, settlements, and player pins move before pointer release. A held-pointer browser check verified a label's 45-pixel horizontal and 25-pixel vertical displacement against the terrain; the regression test also covers player pins. The static terrain layer stays memoized.

Verification covers the shared renderer in Design Preview at seed 1337 and its focused component tests. It does not claim a new end-to-end gameplay travel acceptance. Disposable browser captures are in `.agent/scratch/worldmap-interactions/`.

### Comparison Surface

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

## Named-Exit Navigation Retirement

The grid-retirement ruling removed the legacy `Go <direction>` actions and the rectangular submap's grid-adjacency village-entry actions. `src/components/ActionPane/useActionGeneration.ts` generates interactions without reading `Location.exits`. `src/components/ActionPane/index.tsx` uses that generator.

The replacement is the cell-native World Map in `src/components/MapPane.tsx`, with atlas interaction and the Enter 3D callback for town/world entry. The retired 2D village screen is not the current map drill-down. Current recursive cell-native submaps and tactical `BattleMapData.tiles` are separate systems, not a reversal of the rectangular world-grid retirement.

`src/data/world/locations.ts` still authors `LOCATIONS.exits`. Its source comment preserves adjacency for gossip and future routing. That is intentionally retained intent, not proof of a current production consumer. `gossipLinks` remains a separate optional field in `src/types/world.ts`. Do not delete either field or reconstruct named-exit controls without a separate product decision.

The current `Location` interface and location entries have no `mapCoordinates`. Legacy-save compatibility remains governed by [ADR 0003](../../adr/0003-mapdata-tiles-grid-retirement.md), not this navigation note.

The [Grid Retirement roadmap topic](../../../public/planmap/index.html#shipped-grid-retirement) records this boundary. [Location-data guidance](../../../src/data/world/LOCATIONS.README.md#named-exit-navigation) links authors back here. The [historical retirement plan](../../superpowers/plans/2026-07-01-grid-2d-view-retirement-plan.md) records the earlier implementation; its commit and test receipts are historical, not a fresh gameplay acceptance claim.

Verification on 2026-10-10 checked 11 authored location entries, the `Location` interface, and the scoped action/map source chain. It found no direct `exits` property, literal-index, or destructuring reads in the action generator, ActionPane, SystemMenu, or MapPane. This bounded syntax check is not whole-program alias analysis or executed navigation proof. No runtime code, authored adjacency, save migration, or renderer changed.

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

## Public POI identity and area inspection

The maintained AtlasSvgView/AtlasLayers path carries each already-public marker's authored plain note name, type and source cell from buildPoiMarkers. It retains the existing cell-centroid glyph positions. No upstream legend HTML, exact entrance coordinates or hidden-site discovery is exposed.

Mouse activation opens a persistent inspection card. SVG pointer capture retargets the completed click to the root, so the root picker resolves visible POIs before cell travel as well as retaining the glyph keyboard handler. Settlement priority and drag refusal are preserved. Enter/Space inspect without bubbling into atlas travel; Escape clears inspection. Hiding the marker layer removes the interactive target and visible card. The source-cell route quote stays pinned after the pointer moves. A separate explicit area action delegates to the existing cell picker; an unavailable route disables travel. The location is explicitly approximate and does not certify an entrance, occupants or safety.

Native parent inspection qualifies mouse and Enter at1440x1000 and1024x900 on Armera Rats/brigands, with no movement/resource expenditure during inspection. Space, hidden-layer and no-route cases have focused test coverage. The first glyph-only implementation missed pointer capture and actually committed a20h46 trip; that outcome and supply cost were preserved, not rolled back. The corrected root regression first fails and then passes in the96-case affected suite. Final two-file scoped types have zero errors/zero suppressed diagnostics; the earlier six-file check is also clean.

Normal Save/Main Menu, true document reload/Continue after native inspection preserves all27 selected present groups and17 prior archives exactly, with7 seconds of loading clock. A later ordinary1.245m physical survey also preserves27/17 on its own full reload. These are source-world continuity and bounded UI proofs, not a combat victory or a confirmed nearby hostile body. The current accepted Armera state, source-hostile visibility/template/catalog gaps and next actual-play requirements are recorded in the Gameplay Flow tracker and gaps GF-G88, GF-G89, GF-G90. No deliberate new area-trip action was submitted during the repaired-card replay.

## Depleted travel supplies

The travel toolbar reports the actual depleted resource: No food carried, No water carried, or No food or water carried. It uses the existing provisioning helpers and party supply projection. An independent companion's supplies do not refill the player's stock. This remains a nonblocking status notice, preserving the starter-travel policy from agora-db71.32; route review and the existing commit path own cost and shortage decisions. The notice no longer promises free travel or claims that provisions do not exist. Verified: 2026-10-29 against an earned NPC transfer leaving1food/0water, actual1024/1440 desktop renders and31-group native reload. See the Gameplay Flow Tracker milestone for the complete receipt.


## Library accounts on the map

Verified: 2026-10-31. learnedLibraryDestinations projects a retained library municipal account into its public named town cell. It requires the actual Lore Uncovered account contract: full world, source library identity, record identity, municipal reference, same-realm target and an existing town waterworks source. Catalog drift hides the cue without rewriting the frozen account. Journal unread status does not mean the account was never read at the library; both journal states retain learned knowledge. Duplicate accounts about one town produce one cue. A zero-indexed library plot remains valid.

MapPane shows View town with the named library attribution in its existing Learned directions section. The displayed atlas and saved world must agree. Activation reuses the existing areaFocus owner, clears only local drill UI and centers the town area. It does not call the cell picker, travel, enter3D, roll encounters, write discoveries, transfer goods or reveal an exact dungeon entrance. Companion directions retain their existing owner and controls. The normal Travel interface still owns quotes and commitment.

Native Gwyn replay at 1440 × 900 starts from the actually read Menina register. The cue shows its library source, focuses Menina, and preserves accepted feet, camera and clock exactly. The route readout quotes about144 road miles/49 walking hours and a DC 51 continuous forced-march warning. This is a preview, not a committed trip or safe-access claim. A normal map hover separately quotes Stamstad at about11 miles/3h 47m, low danger, as a possible first day leg. Saved5food/5water and player agency are preserved. The23-group adoption/reload and later departure evidence belong in the gameplay Tracker, alongside GF-G109 coverage/preparation and GF-G110 circulation.

Forty affected checks pass across the map, library projection and companion directions. Three older inn-inspection tests fail identically with the exact pre-change MapPane source and the current source; their assertions are preserved and shared with the building-comfort owner. They do not qualify a clean full map suite. Four unique scoped paths and the final two-path map recheck report zero errors/zero suppressed diagnostics. Ignored receipts: menina-map-test-proof.json, menina-cue-adoption-proof.json, menina-town-focus-proof.json and menina-first-leg-stamstad-preview.json under .agent/scratch/gameplay-flow/replies. No forced travel or full journey acceptance follows from these checks.
