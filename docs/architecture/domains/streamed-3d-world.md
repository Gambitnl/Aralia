# Streamed 3D World

Verified: 2026-11-03 for actual drawn-body camera samples (30 focused cases, two scoped type paths and bounded native Sedanes replay); 2026-11-03 for settled player/companion personal-space resampling (focused regressions and actual Sedanes inn-approach replay); 2026-11-02 for the staged entry's mesh-worker hand-off and the post-Stage-A scene costs (GG-573, GG-574, see "Staged entry users"; unit tests and a headless CPU profile of the World3D demo); 2026-11-01 for the World3D demo's staged ground build (GG-558, see "Staged entry users") and for the market-square field on `ChunkData` (GG-532, code and unit tests); 2026-10-29 for spell craters and pits on the drawn ground (a live in-page cut at 17,4), and for dense-ground player-camera visibility and the bounded saved-street replay, for entry-anchor labeling, bounded understory content reuse (focused checks and native buffer observation), and for ground edits on the drawn ground (unit tests and live shots in WebGL and WebGPU on 17,4); 2026-10-28 for facade material relief, player camera framing and toolbar layout, and for the world generator fixes below (rivers, still water, roads steps 1 to 5 and the market square, the town faults from the walk on 17,4, depth, horizon and frame time); 2026-10-24 for shared ground-mesh assembly; the geometry surface inventory below was last verified 2026-08-05.

## Purpose

The Streamed 3D World domain covers the walkable world the player explores in
three dimensions: terrain surface, water, town walls, roads, decks, vegetation
and the far-distance backdrop. It excludes the tactical battle map, which has
its own domain doc, and it excludes building interiors, which belong to the
interior generator.

This domain is where "what is the world made of" is answered.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/systems/world3d/chunkGeometry.ts        (terrain surface + border skirt)
- src/systems/world3d/waterGeometry.ts        (lakes and river ribbons)
- src/systems/world3d/wallGeometry.ts         (town rampart runs)
- src/systems/world3d/roadGeometry.ts         (road and street ribbons)
- src/systems/world3d/deckGeometry.ts         (dock and bridge slabs)
- src/systems/worldforge/bridge/groundChunkLoader.ts  (assembles the ground world)
- src/systems/worldforge/bridge/farShells.ts  (static distant backdrop)
- src/components/World3D/World3DScene.tsx     (the scene root)

## Staged entry users

Two screens build a generated ground through the staged worker route. `World3DWrapper` (the game's 3D entry) and `World3DDemo` (`?phase=world3d`) both call `createWorldGenClient`. The world-gen worker builds terrain and town (Stage A), then props (Stage B). `createGroundWorkerChunkLoader` then meshes chunks in a second worker. The demo resolves a `?gx/?gy` tile to its cell with `resolveWorldforgeLocationEntry` (`legacySubmapBridge.ts`) and sends a `?dcell=` cell as it is. The demo's `?seam=1` probe still builds on the main thread, because the worker request takes one cell, not a stitched pair.

Both screens set `handOffGround` on the request. `createWorldGenClient` then sends a `MessageChannel` port with it, and the world-gen worker posts the Stage A ground into that port after its reply to the page. The consumer passes the other end to `createGroundWorkerChunkLoader(ground, …, { groundPort })`. The first mesh worker reads its ground from the port and queues `load` requests until the ground arrives. A respawned mesh worker gets the page's own copy with a plain `init`. So the main thread clones the ground once, not twice (GG-573).

The page still pays one structured clone when Stage A arrives: 0.5 to 0.9 s on the demo's default town (about 700 buildings, a message of about 104 MB). The typed-array roofs (`solvedRoof`) are most of the bytes but cost little; most of the time goes to `buildings[].parts`, about 196,000 small objects that the main thread reads for walk solids and doors.

Main-thread costs after Stage A, and where each one lives now (GG-574):

- Building shells: `buildExteriorGeometry` scales one cached unit box into typed arrays. The output is byte-identical to the old per-part `BoxGeometry` path.
- Crowd: `GroundAgents` bakes one ancestry group per macrotask and draws a group only when `peekCrowdArchetype` has it.
- Sky: `sky/sharedAtmosphereTextures.ts` loads the precomputed atmosphere textures once a page, as half floats, for both `<Atmosphere>` mounts.
- Volume bubble: `createVolumeBubbleClient` posts only `VolumeBubbleGround` (six fields). `VolumeGroundBubble` keys the worker on those fields, so a Stage B props swap does not restart it. Add a field to that type before `volumeBubbleWorker.ts` reads it.
- Still on the main thread: first-use shader compile (the takram cloud passes, the scene pass and N8AO, 2.8 s in the first frame on an RTX 2070), and a re-render of every building when resident door use changes (GG-580).

## Player camera and interaction layout

World3DWrapper exposes Town Cell and To Player as explicit view commands. World3DScene samples actual avatar footing for playerCameraFrame.ts; missing or enclosed footing fails closed with feedback. The helper tries finite nearby positions using existing building-motion collision and sampled terrain sight lines. It returns a scene-local camera request and never moves the player. Combat requests retain priority. FreeRoamCameraController identifies requests by kind plus nonce, applies explicit player framing once, and preserves ordinary orbit between requests. After player framing, the controller follows accepted body motion and retracts its view before opaque mounted buildings, decks, terrain and roads. It keeps the requested heading and zoom while checking the actual figure. Complete roof and tree clearance remains unqualified.

playerCameraVisibility.ts owns the mounted-surface query. cameraGroundRaycast.ts caches mesh-local triangle candidates for dense terrain and roads, then uses exact Three intersections with live materials and transforms. It changes no ground vertices, footing or movement admission. The economy lane replays the original saved hillside through normal controls, inspects the full visible figure and measures three full queries at 14.2/11.1/11.5 ms. Normal full-document Load/resave preserves all 27 compared gameplay groups over 139 seconds. This qualifies the reached-street view; distant cut surfaces and overall world quality remain open. The affected wave passes 49 distinct assertions; the final query subset passes 19 cases and the helper/test scoped types report 0 errors/0 suppressed. See items-trade-inventory.md, Camera checks on dense town ground, for the rejected slower candidates and native proof.

InWorldHUD places the wrapped view/rest toolbar below the header so the bottom dungeon entrance card does not intercept its buttons. Player framing is unavailable while an active dungeon owns play. Actual desktop/phone clicks, same-position dungeon entry/return, 26 focused assertions and the eight-file scoped typecheck support this bounded behavior. See the gameplay-flow tracker for the played source and remaining visual limitations.

## Facade material relief

buildingMaterialParts.ts retains the generated wall runs, opening splits, row rhythm and style receipt. Wall-course dressing uses 1.5 cm relief for weatherboard/tarred board, 6 cm for logs and 4 mm for masonry; its seam tone stays near the source wall color. The prior universal 9 cm projection and strong trim tone made material courses compete with the surface maps as applied bars. Shutters, mullions, foundations, structural facade grammar and roof dressing retain their existing contrast. Ground movement already excludes these presentation tags from collision.

An isolated copy of the recovered Sana Chronicle rendered the same street before and after through normal Resume Journey and camera controls. Desktop and 390x844 phone captures were inspected. Camera pose, current supported body XYZ, game time and gold match across the comparison; phone document overflow is false. Fourteen focused material tests cover sixty production buildings, window clearance, deterministic geometry, party-wall ownership and preserved trim. The two-file scoped typecheck has zero errors or suppressed imported diagnostics. External fonts were unavailable and deliberately aborted in both comparison runs; the accepted captures use the same fallback fonts. This establishes bounded relief/readability improvement, not complete town appearance, roof quality, avatar fidelity or performance. Canonical gameplay records retain the remaining GF-G05 scope.

## Shared ground-mesh assembly

The inline ground loader and worker-compatible API call [groundChunkMesh.ts](../../../src/systems/worldforge/bridge/groundChunkMesh.ts) with the same existing terrain and vegetation samplers. This leaf owns mesh-bundle assembly and omission of empty tree, bush, and understory layers. Its loader imports are types only. It does not depend on the loader at runtime.

[groundChunkLoader.ts](../../../src/systems/worldforge/bridge/groundChunkLoader.ts) calls that leaf directly. [groundChunkWorkerCore.ts](../../../src/systems/worldforge/bridge/groundChunkWorkerCore.ts) keeps the synchronous `handleGroundChunkRequest(ground, req)` API and re-exports the existing request type. It supplies the same sampler functions to the shared leaf. GroundWorld stays plain structured-clone data; sampler functions are passed at the call sites rather than stored on it.

C18 removed the emitted loader/worker import cycle. The assembly body was moved unchanged. The worker message protocol, cache and lifecycle code, sampler implementations, LOD resolution, mesh fields, and vegetation omission rules were retained. One named-file advisory pass updated only the three owned source files and preserved their dominant line endings.

Verification on 2026-10-24: 55 existing tests pass across real worker/inline mesh parity, staged loader, terrain/ground fixtures, and the fake-worker protocol/lifecycle suite. Scoped typecheck reports zero errors and zero suppressed imported-file diagnostics. A fresh isolated-emission graph has no group containing the loader, worker core, or new leaf. This is focused source and fixture proof; an actual browser Worker run and visual placement acceptance were not performed. Placement diagnostics retained by the fixtures are recorded separately in [GG-435](../../projects/GLOBAL_GAPS.md).

## Static water follows its bed (2026-10-30)

The WebGL world's water sheets (`waterGeometry.ts`, drawn by `WaterPiece` with `getWaterSurfaceMaterial`) take their opacity and color from a depth value per vertex. Too few vertices made the water wrong under the bridge at Sinzheim (Remy: "weirdness under water"): pale see-through wedges, ghost posts, and a flat sliver of water standing on a bank.

- **River ribbons** had 5 vertices across and one row per polyline point (about 12 m), with depth from the nearest 4 m ground sample. Now: 13 across (`RIBBON_ACROSS`, about 1.5 m on an 18 m river), a row at least every 2 m (`RIBBON_ROW_STEP_M`, interpolating position, width, waterline, direction and flow), and depth from the drawn ground read bilinearly. A ground river (one with a shared waterline) drops a triangle whose three vertices are all dry, so no sheet stands on a bank; a legacy continent ribbon sits under its own ground sample by design and keeps every triangle.
- **Town water polygons** (a town-plan channel the region ribbon does not draw) were the earcut of their outline, so every vertex sat on the shore at about 0 m depth. The loader now gives each chunk slice a fine outline (split every 1.524 m, so neighbor chunks share the seam points), the ground grid points inside it, and the fine bed under every point (`townWaterFill`, read through `groundSurfaceY`, so ground edits count). `emitFilledBody` fills them with a Delaunay mesh, dropping a triangle outside the outline or over dry ground.
- **Proof:** unit tests in `waterGeometry.test.ts` (inner depth, dry drop, concave outline, ribbon rows and waterline); the same held camera under the Sinzheim bridge before and after (the channel reads as one deep sheet that fades at both banks; the stray sliver is gone). A chunk's ribbon grew from about 55 to about 900 vertices.

## Ground edits on the drawn ground (GG-533, 2026-10-29)

A spell or a tool changes the land through the world's one ground record (`groundRecord.ts`; see `world3d-river-water.md`, "The world's one ground under the river"). The drawn ground takes each edit at once, in both renderers. Every land shape stays a product of logic: the edit is a game event, and the drawn ground only reads the record.

- **Why a patch, not a rebuild.** The terrain draws one vertex every 8 m. A 3 m spell hole falls between them, so rebuilding the chunk from the grid shows nothing. Each edited place gets the footing patch instead (`terrainFootingDetail.ts` `groundEditDetail`): the coarse faces are cut into a finer grid (0.76 m edges) over the edit's box, with heights from the record, easing back to the coarse faces over 8 m (`GROUND_EDIT_BLEND_M`, one lattice step). The chunk seams stay watertight (the patch's lines cut every chunk they cross the same way).
- **One list of patches.** `TerrainPiece` takes `footingDetails`: the player's footing patch (still behind `?groundDetail=canonical`), then one patch per shape cut into the ground (`groundShapesCutInto`, saved edits replayed at build and live edits alike). A live edit bumps a version; a patch joins once its chunk ring is loaded. The game builds its ground world in a Web Worker, so the shapes replayed at build reach the main thread as data on the ground world (`groundShapes`, `artifactSeedPath`; 2026-10-30).
- **An edit removes the paving it cuts through** (`groundEditRoadCut.ts`): a hole dug in a square takes the paving with it, and a wall raised over a street buries it. Road triangles that cross an edit's outline split down to 0.4 m; the pieces inside go. The first try draped the paving into the hole 3 mm over the ground, and on the steep wall the two surfaces' fine triangles parted by more than that, so the ground showed through in a stepped dark pattern.
- **Proof (17,4, near the spawn):** a 4 m hole 2.5 m deep and a 3 m trench cut live through `window.__wf3dGround.edit`. The record's height at the hole fell from 2.14 m to -0.36 m; the drawn terrain went from 6,641 to 40,030 vertices; the shots show the hole and the trench cut cleanly through the paving in WebGL and WebGPU (`.agent/scratch/water-campaign/groundvis.mjs`).
- **Spells cut it (GG-533 step 3):** a spell that moves earth in a world-sourced fight cuts the record the same way (see `combat.md`). A crater cuts the paving at its rim (`groundShapeFootprintRadius`). Seen on screen: the cut paving edge along a crater rim is jagged in steps of about 0.4 m (`CUT_EDGE_M`).
- **Not yet readers of an edit:** trees, grass, props, buildings and the static water ribbons keep their heights, so one standing in an edit floats; a volume bubble already built does not take a live edit. A saved edit is in the coarse lattice too (it replays before the chunks build), so the 8 m ease around it can carry a shallow coarse dent; this is not yet checked on screen.



Remy saw these on tile gx=17, gy=4; the fixes are in the generators, so every tile gets them. Proof rig: `.agent/scratch/water-campaign/world3d-gen.mjs` (wide, horizon, aerial and river poses per tile; `HIDE=<regex>` hides meshes by name).

- **The pink horizon band.** `sunFromTime` mixed the fog and sky-horizon colors straight from blue to amber in linear color, which passes through rose. They now go blue to pale gold to amber (`warmRamp`). At the 18.2 h default the horizon band went from rgb 201,191,195 to 215,209,196.
- **The blue halo beside rivers.** A `water` cell's ground vertex took the water-biome blue, and the GPU blends vertex colors across each triangle (8 to 32 m). The ground loader now paints those cells `riverbed` (`terrainColor.ts`); the water meshes draw the water.
- **Flat lakes and stair-step water.** `resolveGroundWater` made a stream of any cell draining 60 cells (about 140 m^2) and a lake of any hollow deeper than 1e-9. It now passes physical limits to `deriveHydrology`: a 5 ha catchment for a stream, a 0.5 m basin depth for a lake (`lakeMinDepthEnc`), and the authored river's cells as `outlets`, so basins that drain into the river do not fill. On 17,4 the lake cells went from 109,706 to 9,665 and the deepest lake from 16 m to 1.3 m.
- **Chains of pits along rivers.** `carveRiverChannel` (`generateRegion.ts`) cut only the 100 ft samples within half a narrow river's width, so the trench was a chain of pits, and its fixed 0.04 n cut was 80 ft deep. The carve now reaches at least 0.75 of a sample spacing, keeps full depth out to half a spacing, and its depth follows the river's width (0.15 of it, 6 to 20 ft, through the elevation curve's slope). The steep trench walls had been painted gray rock beside towns.
- **Flat plateaus past the window.** Chunks outside the 914 m window repeated the border row. `sampleGroundChunk` now takes the region shell's surface there (`farShellHeightAtM` plus `FAR_SHELL_TUCK_M`).
- **A hard edge at the loaded area.** The region shell was flat-shaded with its own lighter palette. On WebGPU it now uses the streamed ground's material, both shells shade smoothly, and the shells' low land takes the window's mean ground color (`windowMeanGroundColor`).

### Rivers through towns, and the world water look

Proof rigs: `townriver.mts` (heights along a town river, cross sections, decks against the water), `world3d-pick.mjs`, `world3d-waterab.mjs` (water frame cost, shown against hidden), all in `.agent/scratch/water-campaign/`.

- **The water slab.** `computeGroundRiverWaterlines` pooled the waterline downhill over every point of the region polyline. Most points lie outside the window and read only the clamped edge row (on 17,4: 64 inside, 595 outside), so they lifted the town reach into one flat slab 4.7 m above its bed, above the land beside it and over a temple's base. Points outside the window now hold the nearest pooled value inside it.
- **One flat town trench.** `carveTownWaterBasins` cut a whole town river to one bed: the LOWEST point's water minus 4 m. On 22,9 that was a 12 m slot with walls 9 to 12 m high. A river cell now takes the surface of the centerline point it projects to (`centerlineSurfaceAtM`). A town bridge or dock took the same lowest surface and sat under its own water upstream; it now reads the surface at the deck.
- **Three water sheets on one river.** A town river drew the town body's sheet, a flat hydrology sheet over its channel cells, and the region ribbon, at three heights. `bindTownRiversToRibbons` now lets the region ribbon draw a town channel that a region river runs along (90% of its centerline within 3 m). Inside the town the ribbon takes the channel's width (`GroundPolyline.surfaceWidthM`), because the town plan placed its buildings and bridge spans for that channel; its least waterline is the town's falling surface. The body is flagged `drawnByRiverRibbon` and draws no sheet. A plan-only town river keeps its own sheet.
- **A river bed that climbs.** `carveRiverBedsDownhill` walks each region river source to mouth inside the window and lowers every cell within its drawn half width to the lowest bed upstream (lower only; building pads stay). On 17,4 a 2.1 m sill below the town had pooled the town water over its bridges.
- **A thin film at the floor of the channel.** The region waterline was the bed plus 0.5 m. It now fills the channel to `RIVER_FREEBOARD_M` (1.5 m, the town's own value) under the lower bank, and keeps at least 0.5 m of depth. The town reach and the region reach then meet at one level. Town decks take their height from this waterline after it is computed.
- **A deep river drawn as clear water.** A ribbon had two vertices across, one on each bank, so the depth encoding saw only bank depth (about 0) and the whole river drew at shoreline opacity. It now has `RIBBON_ACROSS` (5) vertices across.
- **Flat, still, unreflecting water.** On WebGPU the ripple was the WebGL material's normal map, moved by `texture.offset`, which a node texture does not apply. `WaterMesh.flow` now carries the surface flow per vertex (along the course, faster where the waterline falls), and `gpu/waterSurfaceNode.ts` moves two ripple layers along it with the two-phase flow-map method on TSL `time`. The water reflects the gradient sky by the Fresnel term (`water/waterSkyState.ts`, fed by World3DLighting), and foam gathers where moving water meets its bank and where it runs faster than 1.2 m/s. Measured cost on 12,6: about 1.8 ms per frame for all world water, inside the noise of the A/B.

### Roads as real surfaces (steps 1 and 2)

Remy: the roads did not look like roads. They were flat ribbons in one tint per tier under a plain vertex-colored material, so a plaza read as a near-white sheet (its tint #d8cbb2 reflects about 0.6 of the light; outdoor paving reflects 0.2 to 0.4).

- **Road space.** `buildRoadMesh` gives every vertex a `road` attribute: the distance along the road, the signed distance across it, its half width (meters) and its surface kind (`ROAD_SURFACE`). The distance along comes from the source line's start (`ClippedPolyline.alongM`, set by the ground loader's chunk clip), so a pattern runs on across chunk seams. Where `drapeRoadTriangles` cuts a face to the terrain, each new vertex takes the barycentric blend of road space.
- **Surface kinds.** The tier tint stays the identity on the wire and the 2D maps' color; the kind comes from it: plaza core flagstone, avenue core setts, street cobble, edging bands curb, lane core packed dirt, the lane's flat rut stripe (dropped on WebGPU), and the region tiers highway, road, trail and path.
- **The WebGPU material** (`gpu/roadSurfaceNode.ts`) draws each kind in road space with a real-world color and roughness: staggered flagstones, setts in courses across the road, Worley cobbles, long curb stones, polygonal highway paving, packed dirt with wheel ruts at the 1.4 m cart gauge (two pairs on a road wider than 6 m), two bare tracks on worn grass for a trail, a broken line for a path. Each pattern fades to its own average once a screen pixel covers more ground than its detail (`fwidth`), so it does not shimmer from above. The WebGL world keeps the vertex-colored tiers.

- **Step 3, verges (2026-10-28).** `buildRoadVergeMesh` lays a strip along each side of every road (bundle field `roadVerges`): 0.5 m beside paving, a quarter of the half width (0.6 to 1.5 m) beside dirt (`vergeWidthM`). It carries the same road space with kind `vergePaved` or `vergeDirt`, sits 4 cm under the road layers, and is drawn on WebGPU only by `getRoadVergeNodeMaterial`: transparent with no depth write, the road's own dirt going to worn grass (or dust and gutter grime beside paving), fading out along a ragged noise rim so the terrain under it shows through.

- **Step 4, road shape (2026-10-28).** The ribbon stays flat; the shape is drawn in light. Each kind sets a relief height in meters beside its albedo, and `normalNode` tilts the normal by the screen-space slope of that height (`bumpNormal`, Mikkelsen's listing 2, as three's `BumpMapNode` does for textures). Paving has a 6 cm camber (`crowned`); a lane or road is a hollow way, level in the middle and rising 8 cm into its banks (`sunkenWay`), with ruts 5 cm deep; a trail's tracks sink 3 cm; joints and cobble domes add millimeters, faded out with distance. Feet, carts and the road layers do not move. The dirt kinds' gravel is now round Worley grains of mixed size, sparse; the old square cell specks read as pixel blocks up close.
- **Step 5, junction plates (2026-10-28).** Streets of one tier that meet at an angle overlapped in the inner wedge at the same height, and their stone courses z-fought along a jagged seam. A join of three or more ends, or of two ends bent more than 20 degrees, now draws one plate: the hull of every end reaching 1.5 half widths back, 5 mm over its layer (under the next layer), laid in world x and z (`JUNCTION_PLATE_*` in `roadGeometry.ts`). A straight run keeps the flat bevel.
- **The market square (2026-10-28).** Only the square's ring of plaza-tier streets reached the bake. `canonicalTownWaterAndDecks` now also returns the plan's civic `plaza` polygons (`GroundWorld.plazas`), the chunk sampler clips them, and `buildRoadMesh` paves each in flagstones (earcut, world x and z road space). The fill sits over every street tier (`PLAZA_FILL_LIFT_M` 0.09 m) and under the square's own ring (plaza tier rank 4, 0.12 m), so a street stops at the square's edge. The clipped polygons are the ordinary field `ChunkData.plazas` (grid space) in `types.ts`, and `sampleGroundChunk` returns plain `ChunkData`. The separate `ChunkPlazas` type was removed on 2026-11-01 (GG-532).

### Town faults from Remy's walk on 17,4 (2026-10-28)

- **Streets vanished in the live river's rectangle.** The road material copied the river footprint cut; roads lie on top of the bed, so the cut is gone from `gpu/roadSurfaceNode.ts`.
- **The circle with stepped ground, and floor jitter.** The volume bubble (ADR 0002) is a lid about 30 cm over the skin, the same height as the road ribbons (`ROAD_LIFT_M` 0.3): the two fought for each pixel (jitter) and the lid hid the streets inside 64 m, in its own terraced gravel. Over the skin the bubble now builds and hands out its volume but draws nothing until a carve changes it (`VolumeGroundBubble` `hideUntilCarved`); the LAND pane (skin off) and `?volumeBubble=show` still draw it.
- **The river bed's rectangle.** In `riverSite=world` the bed (the river page's material: cobbles, gravel, soil, grass by height) replaced the world's ground over the whole 350 x 140 m solver rectangle. The swap now happens only within a corridor of the course (`RiverFootprintCut.corridor`, half the river's width plus 6 m): the world's terrain discards inside it, the bed discards outside it (`riverBedOutsideDiscard`). The bed's heights are the world's own, so the swap line has no step.
- **Bridges down in the channel, docks as bridges.** Every town deck spanned its channel and stood at water + 0.4 m, 0.3 to 2 m below its banks. `fitTownDeckToBanks` sets a bridge's top to the higher of its two end grounds, and cuts a dock to 40% of its length from the end nearest a building, at its bank's height.
- **Holes in the wall.** A water gate's gap was 4% of the town's span per side (far wider than the 12 m channel) and nothing spanned it. The gap is now the channel's half width plus 1 m, and `GroundWorld.waterGates` (apart from the gameplay `gatehouses`) builds a `waterGate` form: a tower on each bank, the wall over the water from 0.6 m above the lower bank to the rampart top (4.8 m), and an iron grille. Gate boxes now carry one outward face per side with its true normal (every vertex said "up", so gates drew near white) and the wall's stone texture.
- **The roofless keep.** `solveRoof` gave a flat roof no plane at all, only a parapet ridge, so a keep was an open box. A flat roof (and each flat wing) now gets a deck plane at the wall top.

- **Stretched streaks at the screen's bottom edge.** The river water refracts its bed read; when the bent ray's bed point projects past the screen edge, the clamped read repeats the edge row down each column (the code's own note: "a false vertical wall"). The fade back to the straight read near the edge ran only near the plunge pool and the rapids; `riverWaterMaterial.ts` now runs it everywhere. Mechanism matched to Remy's shot; the exact view was not reproduced in a rig.
- **Paving on the river bed.** With the footprint cut gone from the roads, a road that ran on through the channel drew paving under its bridge. Roads and verges now discard over the river's own water only (`riverWaterDiscard`, the corridor's `waterHalfM` = river half width + 0.5 m), so they still reach the bridge ends on the banks.

- **Wall runs did not join at the ring's corners.** `wallGeometry.ts` builds each run as one mitered band: a closed ring is detected, each corner takes the miter of its two segments (the cosine clamped at 0.35 so a sharp corner does not spike), and only an open run gets end caps.
- **Pale blue grid rectangles (the wetland pools).** See "Still water" below: marching-squares shorelines, a mud bed, pond hollows and the banks in the reflection.
- **The town floor read as paper.** `TOWN_FLOOR_RGB` is now [0.23, 0.195, 0.145] (was [0.42, 0.36, 0.27], brighter than packed earth outdoors).

### Still water: the striped lakes on 12,6

Proof rigs: `stripes.mts` (height and pond map of a window), `world3d-top.mjs` (a straight-down shot to lay beside the map), `epicea.mts` (sea share under each town apron), `basins.mts` (basins and catchment ratios), all in `.agent/scratch/water-campaign/`.

- **Stripes.** Still water was drawn as one flat rectangle per grid row (`waterRuns`), with its depth read only at the four corners, which sit on the two shores: stripes along the rows. `waterRegionLakesForChunk` now draws still water by its shoreline: each grid square that touches still water is cut along the line where the water level meets the ground (marching squares, interpolated on each edge, `stillWaterLevels` cached per world), with the bed under each point from the full ground grid (`lakes[].bedY`). The depth is exactly 0 on the shore. (The interim cut into two-cell row pieces, `RUN_PIECE_M`, is gone.)
- **The pond's bed.** A pond lay on bright grass. The terrain color pass marks each vertex under still water (1) or within a cell of it (0.5) and blends it toward the river bed's wet silt.
- **Pond hollows (2026-10-28).** A chunk vertex stands every 8 m or more; a coarse triangle between two dry vertices ran straight across a pond as a ridge, and pools read as flat sheets with straight cut edges. A vertex whose grid footprint (half a vertex spacing each way) is at least a quarter still water now sinks 0.6 m under that water (`POND_HOLLOW_M`, `POND_HOLLOW_MIN_SHARE`), so the water's own contour draws the shore at every LOD. The share keeps a 3 m puddle from sinking a 16 m crater of mud.
- **The banks in the reflection (2026-10-28).** The water reflected only sky colors, and the Fresnel term is strongest at the grazing angles where the sky horizon is palest: ponds read as white paper, rivers as white bands. In `waterSurfaceNode.ts` a reflected ray under about 13 degrees of elevation now takes the surround (`REFLECTED_SURROUND_COLOR`, a dark olive), hazed toward the sky horizon at the horizon itself.
- **The trees in the reflection (2026-10-28, GG-528).** A low-bank band alone left a forest pond reflecting sky above 13 degrees, where its trees (15 to 20 m tall) stand. `water/canopyHeightField.ts` now keeps a height map of the tree crowns in the loaded window (2 m cells, 512 texels a side, half float; crown top and widest radius measured from each grown tree's own mesh, rounded toward the rim). `World3DScene.tsx` (`CanopyFieldPublisher`, WebGPU world only) rebuilds it when the set of tree chunks changes. The water walks each reflected ray across the map at 19 fixed distances out to 90 m and takes `REFLECTED_CANOPY_COLOR` where the ray passes under a crown, so a pond reflects trees only on the sides that have them. `window.__wf3dCanopyField` reports the map; setting its `placement.z = 0` turns the tree reflection off for an A/B. Limits: under `?trees=preset` the map stays empty (those meshes are not measured, and the console says so); a lone thin tree between two far steps can be missed; a crown reads as solid, with no sky through its gaps. At 20 to 40 degrees the Fresnel term is 14 to 3 percent, so the water body color, not the reflection, sets most of a pond's tone there.
- **Deep water is dark, as the live river's is (2026-10-28).** The static water lit its deep body as a painted surface: a diffuse deep blue and a saturated blue glow (`WATER_COLOR`) that rose with depth. Once the town river on 17,4 was 4 to 5 m deep it read as a vivid blue band, about (8, 58, 103) sRGB, beside the live river's dark gray, about (65, 60, 50). In `gpu/waterSurfaceNode.ts` the deep end now takes the live river's model (`riverWaterMaterial.ts`, `uScatterClear`): the glow is `DEEP_SCATTER` (linear 0.012, 0.02, 0.014) times the sky irradiance, and the diffuse color is `DEEP_BODY_COLOR` (#1d271f). The shallow end is unchanged. Shot `deep-0` against `pick-0` (`.agent/scratch/water-campaign/shots/gen`): the far river strip went from (32, 61, 71) to (33, 43, 30). The WebGL material (`water/waterSurfaceMaterial.ts`) keeps the old colors.
- **Ponds sunk 0.55 m.** `emitLake` lowered every `lake` sheet by the legacy offset, which its own comment kept for kind-less continent lakes only. Now only a lake with no kind takes it.
- **Inland "seas".** A coastal town's plan takes its coast from the edge of the burg's whole atlas cell, squeezed into the town's frame, so a sea kilometers away became a coast at the town's edge. The 3D window had no sea there, and the apron carved a flat basin 4 m deep: on 12,6 two of them (the 4.7 m closed basin), striped through grassland. `dropInlandSeaAprons` keeps an apron only when at least a quarter of its cells lie below the atlas sea level (`WATER_LEVEL`, now exported from `generateLocal.ts`). No apron on 12,6, 17,4, 22,9 or Epicea passes; no dock or bridge stood on one.
- **A pond in every pit.** Every hollow 0.5 m deep filled, so the noisy ground carried thousands of ponds, the town square included. `deriveHydrology` now applies a water balance (`lakeCatchmentRatio`): a basin keeps a pond only when its catchment, read on the unfilled ground at the basin's low points, is at least the ratio times its area. The ratio comes from 1 + (E + S - P) / (c P) with temperate values (P 0.8, E 0.9, S 0.7 m/yr, c 0.15): 8 on dry ground, and 2 on wetland, where groundwater feeds the hollow (S = 0). Pond cells: 12,6 84,982 to 52; 17,4 9,616 to about 5,900 (wetland); 22,9 2,545 kept (wetland).

### Depth, horizon and frame time (2026-10-28)

Rigs in `.agent/scratch/water-campaign/`: `riverdepth.mts` (water depth along each river), `perfab.mjs` (frame-time A/B by hiding mesh groups), `wgsldump.mjs` (prints the failing line of a WGSL module that does not compile), `world3d-pose.mjs` with `HIDE=<regex>` and `EVAL=<js>`.

- **The river at the window floor.** The window's lowest ground is encoded 0, and the town water carve clamped its surface and bed to it: on 17,4 the lower town reach had 0.5 m of water. Encoded heights below 0 are plain numbers to `heightToMeters` and the mesh (the ground floor is -120 m), so the clamps are gone: the water stands 1.5 m under its shore and the bed 4 m under that, at the floor as everywhere. The town reach now has 4 to 5 m of water, and the downhill carve carries that bed on through the window.
- **Dark smudges on the horizon.** The post chain's GTAO rebuilds normals from depth; 500 m and more out the depth steps are coarser than the ground's relief, and it drew them as a dark noisy band along the horizon (an A/B with the AO scale at 0 removed it). `worldGpuPost.ts` now fades the AO to open between 150 and 300 m of view distance (`WORLD_GPU_AO.fadeStartM`, `fadeEndM`). Trap: the depth must be an unsampled `textureLoad` at the integer pixel; the pass's own depth node, `getViewZNode`, or a sampled read all build a size lookup, and three r172 reuses the size variable GTAO and denoise declared without declaring it again, so the shader does not compile.
- **Chunk ground past the window.** It lay 0.7 m over the far shell all the way out, closer than the depth buffer resolves at 1 km. It now sinks 4 m under the shell within 30 m of the border (`OUTSIDE_SINK_M`, `OUTSIDE_SINK_RAMP_M`); the player cannot walk there (movement clamps to the window).
- **Frame time on 12,6.** Buildings took 19 of a 31 ms frame at the aerial pose, one live-interior building about 16 ms: a live interior mounted every wall piece, floor and window as its own mesh with its own material (about 2,350 meshes for the buildings within 18 m of the player). Sharing materials alone changed nothing; the cost was the draw count. `SiteBuilding` now merges structure parts into one mesh per look (color, wall map, glow), each with a cached shared material; doors and furnishings keep their own meshes for picking. The frame went from 31 to 41 ms down to 14 to 16 ms.

Still open: straight light lines show along the coarse ground triangles in a close top view; the trees and the grass palette are Remy's call (see GLOBAL_GAPS); and the 2D town plan of a burg such as Epicea still draws a harbor that its 3D window does not have (GG-527).

## Surface inventory

A **facade** means a surface with nothing behind it. The player can reach a
place where the object stops being what it claims to be.

This inventory is the domain's core fact. Re-verify it against the source when
any entry point above changes. Every entry below was read in the code.

## Summary

| Surface | Verdict | Cost to fix |
|---|---|---|
| Town walls | Facade. Zero thickness | Low |
| Roads | Facade. Sheet over terrain | Medium |
| Decks and quays | Facade. Same as roads | Low |
| Terrain | Facade below grade | Medium |
| Water | Half fixed today | Low |
| Grass | Facade by design | Leave |
| Understory | Facade by design | Leave |
| Far distance | Facade by design | Leave |
| Buildings | Honest | None |
| Gatehouses | Honest | None |
| Interiors | Honest | None |
| Trees | Honest | None |

Three real faults. Three deliberate cheats that should stay. Four things that
were built properly.

---

## Faults

### Town walls are paper

`src/systems/world3d/wallGeometry.ts` emits **four vertices per segment**. One
vertical quad, 3.2 m tall, zero thickness.

The data carries `widthM: 1.2`. The geometry discards it.

This is the worst entry in the audit, for three reasons.

A rampart is a defensive structure. Aralia has sieges, settlement defenses and
stationed regiments. A wall you cannot stand on and cannot shelter behind
undercuts all of it.

A gatehouse rises to 5.5 m beside it and is a real tower. The two are
inconsistent, and standing next to both makes the wall look worse.

The mesh also emits both windings. That is the exact z-fight pattern this
codebase already recorded once, in the note about walls and gates chipping open.

**Fix:** extrude to the width the data already carries. Cap the top. Give it an
inner face. The wall walk then exists as a real surface.

### Roads are ribbons floating over the ground

`src/systems/world3d/roadGeometry.ts` lays a flat strip "raised slightly above"
the terrain.

This is the sheet-on-sheet complaint in its purest form. Two surfaces occupy
nearly the same place, one hovering over the other.

It causes the hard material seams, the z-fight risk, and the read of a decal
laid on a landscape rather than a track worn into it.

**Fix:** stop laying a second surface. Sample the road into the terrain itself.
The road becomes part of the ground rather than a thing on top of it.

### Terrain has no underside

`buildTerrainMesh` produces one triangle layer. A skirt exists, but only around
chunk borders, at `SKIRT_MIN_DEPTH_M = 40`.

The interior of every chunk has nothing behind it. Below grade, the world is
void.

This is the fault that the spells make urgent. A spell that digs a pit exposes
exactly this.

**Fix:** close the shell, and give the ground layers so a cut shows what it cut
through. See the ground-scar decisions in `CONTEXT.md`.

### Water was a lid

`buildWaterMesh` earcuts each body and emits upward-facing triangles only. No
underside, no bank walls, no thickness.

Half fixed on 2026-08-05. Water now carries per-vertex depth, drives its own
alpha and color from it, and renders double-sided.

**Remaining:** the shoreline reads correctly, but nothing was verified from
under the surface. That view is the proof and it has not been captured.

---

## Deliberate cheats that should stay

### Grass

Three tapered curved blades per cluster. Flat geometry.

This is correct. Grass is drawn by the hundred thousand, it is knee high, and
nobody inspects a single blade. The earlier version used two crossed quads and
was upgraded to three curved blades because the silhouette mattered. The
thickness never will.

### Understory

Fern fronds and leaflets are flat, drawn double-sided. Same reasoning as grass.

A leaf is genuinely thin. The cheat matches the subject.

### The far distance

`farShells.ts` builds two static coarse meshes and states its own nature: no
streaming, no per-frame cost.

This is a painted backdrop and it should stay one. The player never reaches it.
A backdrop that admits it is a backdrop is not a facade.

---

## Things that were built properly

### Buildings

Every building receives real interior parts from the same canonical blueprint
the occupancy system uses. The renderer builds walls rather than a solid box
whenever parts are present, and they are present for generated towns.

Wall width and depth are carried and used. Roofs are solved per style.

### Gatehouses

Real towers, 5.5 m, styled per culture family.

### Interiors

`interior/` generates rooms, doors, walls and furnishings, and the 3D bake
consumes them. Doors have real openings on a grid line. Windows track a live
clock.

### Trees

ez-tree branches are tubes with real cross-sections. A trunk is solid geometry,
not a billboard. Leaves are flat, which is correct for leaves.

---

## The pattern

Every facade here was flattened to save geometry at a time when nobody could
reach it.

Walls were scenery on a map. Roads were a line on a landscape seen from above.
Terrain was never walked below. Water was looked at from one side.

All four assumptions have since broken. The player walks the ground, the camera
goes where it likes, and spells cut into the world.

The cheats that remain correct - grass, leaves, the far horizon - are the ones
where the assumption still holds.

## Recommended order

1. **Town walls.** Smallest fix, largest visible gain, and the most
   embarrassing gap given what the game does with sieges.
2. **Terrain underside and layers.** The foundation the ground spells need.
3. **Roads into the surface.** Kills the seams and the z-fight risk together.
4. **Water from below.** Capture the proof and close it out.

Decks follow roads for free, since they share a shape.

## Last verified

2026-08-05, against the working tree. Verified by reading each geometry builder
listed under Verified Current Entry Points.

Re-verify when a geometry builder changes. A stale inventory is worse than none,
because a reader trusts it.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/architecture/domains/streamed-3d-world.md","sha256WithoutMarker":"79f00ec35d49c4a80c5f3053c31f2e2a0949c0893549b4c9514abdd4adafcfe5","markedAtUtc":"2026-08-09T20:24:28.242Z"} -->

## Understory batch reuse while walking

Actual walking exposed unnecessary understory rebuilds when World3DScene recreates identical chunk wrappers. UnderstoryField now retains one content-exact batch result per mounted field, comparing copied bytes of positions/scales/rotations/colors plus species/count/offsets; in-place changes still reach the unchanged original builder. Ten focused cases pass after nine meaningful baseline failures; three scoped paths have zero errors and zero suppressed imported diagnostics. One named-file header wave leaves World3DScene unwritten. Native normal resume/pause retains all nine instanceMatrix objects and upload versions at1821plants, with exact feet. This is bounded reuse evidence, not an FPS gain. The pre-reload GL render counter counted postprocess passes, not frames; its322 figure must not be called FPS. Native reload retains total plant count and all nine geometry assets, but variants/colors differ when the scene origin changes. The unchanged original builder hashes scene-local XZ and bins normals in scene-local cells, so world-stable visual plant identity remains open; byte-exact reloaded instance placement is not claimed.

Source: src/components/World3D/vegetation/UnderstoryField.tsx and understoryBatchCache.ts. Existing geometry, materials and layout-effect instance colors remain unchanged outside the cache lookup and advisory header. Proof: understory-content-cache-preservation.json, understory-native-identical-content-reuse.json, understory-before/after-content-cache-native.json and public-bank-inn-street-cache-replay-one-visible.png under ignored .agent/scratch/gameplay-flow/travel/. The scene-local hash/normal-grid continuity gap requires its own world-coordinate experiment; do not silently fold it into the cache repair.

## Retained entry label during ground travel

The retained GroundFocus is the Local entry anchor. Ordinary walking updates accepted feet without renaming that anchor. InWorldHUD therefore labels it "Entry: <source name>" rather than presenting it as the current location. The original source name, technical disclosure, controls and non-ground default remain. This does not supply live street names or fix camera occlusion.

Two new regressions fail before the change and all eight focused HUD cases pass afterward. Two scoped HUD paths have zero errors or suppressed diagnostics. The original Fianna full-reload/re-entry render visibly shows "Entry: Putivl — Gate 1" after a95.260092m played approach; accepted feet remain exact. Native business identity is documented in items-trade-inventory.md, under fitted business identity. Temporary screenshots and source-preservation audits stay in ignored travel scratch.

## Settled actor clearance at a crowded entrance

PlayerAvatar keeps the full sampled animation envelope while moving. At the existing half-second sample, a figure that has settled to speed≤0.05 publishes its current visible idle footprint and radius instead of permanently accumulating every past arm or wing extension. Anatomy, carried gear, neighbor sweeps, guarded turning, terrain, water and door permission remain authoritative. No feet or neighbor is moved by resampling.

This prevents a stopped figure from being caged by an invisible old animation extreme. The actual isolated Bram/Elara Sedanes play reaches and opens the Rusty Fox entry after Bram normally stows shield/mace; the paid reservation, equipment and door survive33-group full reload. Native post-fix idle measurements permit clear directions while still refusing actual nearby contact. This does not qualify the crowded inn threshold, stairs, reserved-bed arrival, keeper contact, companion following through the crowd, camera visibility or rest. Those remain open in gameplay-flow GF-G32 and its Tracker receipt.


## Actual body surfaces in player camera sightlines

playerCameraVisibility samples six extremes on the figure's actual drawn surface instead of corners of its whole bounding box. An asymmetric low tail can extend that box under empty air; testing the air against a real inn wall previously shortened an otherwise clear camera arm. Samples respect indices, draw ranges, hidden material groups and current skin/morph/world transforms. A sole-contact allowance follows a real adjacent triangle edge up to12cm, retaining ground/deck support checks without inventing raised empty-space samples. Cached vertex references avoid scanning the figure per candidate ray; selection refreshes on relevant geometry/visibility changes and periodically. Existing opaque building, deck, terrain and road queries remain in force. NPC bodies remain separate from structural occlusion.

Native Sedanes full reload and normal To Player at unchanged feet recover a six-meter street-side view. A later legitimate step into the crowded porch still leaves only a two-meter legal arm and severe resident occlusion. This accepts the phantom-point repair only; it does not establish global camera comfort, inn circulation or frame-rate performance. See gameplay-flow Tracker, A clear camera reveals an unbound companion cantrip.
