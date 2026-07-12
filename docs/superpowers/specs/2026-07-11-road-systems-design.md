# Road systems: mechanical + visual enrichment

**Date:** 2026-07-11
**Status:** BUILT 2026-07-11 — all five slices landed (10 tasks + final review + fix wave, 194 files / 1738 targeted tests green, tsc baseline unchanged); remaining items in Open
**Goal (Remy's words):** "enrich the world with proper road systems that both work mechanically as well as visually. different road types. different movement speeds during travel. paths that go into forest areas that becomes less visible and hard to follow. etc"

## Front-loaded summary

Aralia already generates and draws a road network, but it is mechanically dead and visually flat. This spec makes roads real in five slices:

1. Fix the wiring bug that makes the road network invisible to travel.
2. Split roads into four land tiers (highway, road, trail, path), each with its own speed, danger, and look.
3. Grade off-road travel speed by biome (forest slower than plains).
4. Make paths and trails fade in forest: dimmer on the map, and a Survival roll to follow — fail and you drift off course.
5. Make 3D ribbons tier-aware and stamp worn ground under faint paths.

## What exists today (exploration findings)

**Generation — complete.** `src/systems/worldforge/fmg/routes-generator.ts` is a full FMG Routes port: main roads connect capitals per landmass (Urquhart graph + A*), trails connect all burgs, sea routes connect ports. Runs as step 24 of world gen (`generateWorld.ts:250,332`). Stored as `pack.routes` (`Route { i, group: 'roads'|'trails'|'searoutes', points: [x,y,cellId][] }`) and as canonical `AtlasRoute { id, cellIds, kind }` (`artifacts.ts:85-90`, adapter `atlasArtifact.ts:208-232`).

**2D render — basic.** Canvas: `atlasDraw.ts:801-833`. SVG: `atlasSvg.ts:305-317` (`buildRoutes`), `AtlasLayers.tsx:171-181`. In-game view has a Routes layer toggle, default ON (`AtlasSvgView.tsx:171,188`). Roads = solid brown `#8b5a2b`, trails = grey dashed, sea = light-blue dashed. No tier language beyond that, no fading, no bridges.

**Travel mechanics — roads are inert.** Live travel is `routePlanning.ts` (Dijkstra, `edgeMinutes = miles / (speedMph × terrainMod) × 60`, lines 147-152). Terrain classifier `atlasTravelGraph.ts:102-144`: road cells → `'road'`, 8 `DIFFICULT_BIOMES` → `'difficult'` (×0.5), everything else `'open'` (×1.0). **Bug:** `buildRoadCells` (`atlasTravelGraph.ts:75-81`) reads `r.cells ?? []`, but generated routes carry only `points` — the road set is always empty. So the road terrain class, the road danger-halving (`danger()` ×0.5), and the road exemption from getting lost never fire. Road terrainMod is also 1.0 — even when fixed, a road today only *avoids* the difficult penalty; it never grants a bonus. Forest = plains = ×1.0. The FMG per-biome movement `cost[]` (`fmg/biomes.ts:84-86`) is used by world gen only, never by travel. The maritime twin (`multiModalAtlasGraph.ts`) duplicates the terrain/danger tables and must mirror any change.

**Getting lost — built, mostly dormant.** `navDrift.ts` (`deriveNavDrift`) rolls one seeded Survival check per committed land trip vs the hardest terrain crossed (`TERRAIN_NAVIGATION_DCS`: road/trail 0, open 5, difficult 15); failure = wrong-direction drift + 1d6 hours. Wired in `MapPane.tsx:854-862`, applied in `App.tsx:733-748`. Because the road set is empty, roads never grant their exemption.

**3D — pipeline exists, tiers dropped.** Rural routes flow atlas → `RegionRoad { kind: 'road'|'trail', widthFt: 40|20 }` (`generateRegion.ts:891-921`) → `world.roads` (`groundChunkLoader.ts:553-557`) → chunk clip → `buildRoadMesh` (`roadGeometry.ts:32-82`, flat tinted triangle-strip ribbon, +0.3 m) → `RoadPiece` (`World3DScene.tsx:289-303`, vertex colors, no texture). **Gap:** `regionPolylinesToGround` (`groundChunkLoader.ts:288-309`) drops `kind` and sets no `colorHex`, so every rural road and trail is the same `#a08b62` dirt ribbon. Town streets already do tiering right (`STREET_TIERS` avenue/street/lane in `townPlanAdapter.ts:39-43`). `LocalFeature.kind: 'path'` is typed (`artifacts.ts:194`) but never rendered. Terrain has a per-cell `materialIndex` channel with `dirt` and `paved` already in the palette (`terrainColor.ts`, `groundWorldAdapter.ts:69-78`) — the cheap route to worn-path ground.

**Checks plumbing.** Party Survival modifier pattern: `MapPane.tsx:146-147,255`. Skill checks: `checkUtils.ts` `rollAbilityCheck`. SeededRandom: max-exclusive `nextInt`, `rngFromPath(streamPath(seedPath, '<concern>'))` convention.

## Design

### 1. Road taxonomy

`kind: 'highway' | 'road' | 'trail' | 'path' | 'searoute'` (replaces `'road' | 'trail' | 'searoute'`).

| Tier | What it is | Source network |
|---|---|---|
| highway | Paved trunk route between capitals | FMG main-roads network (capitals) |
| road | Packed-earth link between towns | Trail network edges whose endpoints include a large burg (population ≥ town threshold or port) |
| trail | Cart track between villages | Remaining trail-network edges |
| path | Faint foot-track to wilderness POIs and shortcuts | NEW generation pass |
| searoute | Shipping lane | Unchanged |

Tier assignment happens in `routes-generator.ts`: main roads emit `highway`; the all-burg trail network splits into `road`/`trail` by endpoint burg importance. The FMG `Route.group` gains the new groups; the artifact adapter maps them 1:1 to `AtlasRoute.kind`. Atlas artifacts are derived deterministically from the seed, so no save migration is needed — regeneration picks up the new kinds.

**Path generation pass (new):** after trails, for each burg, connect to up to N nearby wilderness markers/POIs within a radius via the same A* cost surface, and add occasional trail-to-trail shortcuts through forest. Deterministic (`streamPath(seed, 'routes:paths')`). Paths never replace an existing road/trail link; they only add faint connections. Volume kept low (tunable) so the map does not spider.

### 2. Travel speed model

Replace the binary terrain modifier with: `effectiveSpeed = speedMph × terrainFactor(cell)`.

- **Off-road:** `terrainFactor = biomeSpeedFactor[biome]`, derived from the FMG biome `cost[]` (normalized: grassland 1.0 → forest ~0.75 → taiga/tundra ~0.6 → wetland/rainforest ~0.5 → glacier 0.25). One table, one place.
- **On a route:** the route tier sets the factor and *overrides or softens* the biome penalty — a cleared road through forest is as fast as through plains:

| Tier | Speed factor | Biome penalty | Danger multiplier | Navigation DC |
|---|---|---|---|---|
| highway | 1.5 | ignored | 0.4 | 0 (cannot get lost) |
| road | 1.25 | ignored | 0.5 | 0 |
| trail | 1.1 | 50% softened | 0.7 | 0 open-country; 5 in deep forest |
| path | 1.0 | 25% softened | 0.9 | 5 open; 8 in forest; 12 in deep forest |

Forest terms used throughout: **forest** = tropical seasonal (5) and temperate deciduous (6); **deep forest** = tropical rainforest (7), temperate rainforest (8), and taiga (9).
| off-road | biome factor | full | 1.0 | 5 open / 15 difficult (today's values) |

"Softened" means `factor = lerp(biomeFactor, 1.0, softening)`. All numbers live in one tunables module (see Tunables) — they are starting values, expected to be tuned after play.

**Shared classification module.** The terrain/danger tables are currently duplicated between `atlasTravelGraph.ts` and `multiModalAtlasGraph.ts`. This work extracts one shared `routeTerrain.ts` (classifier + factor tables) consumed by both, so land and multimodal travel cannot drift apart. This is a targeted improvement in code the feature must touch anyway.

**Bug fix first:** `buildRoadCells` gains the same defensive read the sea-lane builder already has (`r.cells ?? r.points.map(p => p[2])`) and splits the one road set into per-tier maps (`cellId → tier`). A failing test proving generated routes produce road cells lands before the fix (TDD).

### 3. Fading forest paths (visibility + getting lost)

Per-cell, per-route-segment **visibility**: `visible | faint | overgrown`.

- Forest (5, 6) makes `path` segments **faint**; deep forest (7, 8, 9) makes them **overgrown**. Trails become **faint** only in deep forest. Roads and highways never fade (they are maintained).
- Mechanics: the navigation DC ladder above feeds `deriveNavDrift` — the governing DC of a trip is the worst (visibility, tier) cell crossed. Failing the Survival check keeps today's consequence (wrong-direction drift + 1d6 h) with new messaging: "The path fades among the trees — you lose the trail." The 1d6 hours *is* the bushwhacking cost; no separate speed-downgrade bookkeeping.
- The travel readout names the risk before commit: route summary gains "follows a faint forest path" wording so the player can choose the long road instead.
- No new lost-state machinery is invented: this deepens the existing seeded navDrift roll. One real path, no cosmetic fallback.

### 4. 2D visual language (canvas + SVG, both tiers of render)

| Tier | Stroke |
|---|---|
| highway | Double stroke: dark casing + warm sienna fill, widest |
| road | Solid brown `#8b5a2b` (today's road look) |
| trail | Dashed grey (today's trail look), thinner |
| path | Dotted, thinnest, base opacity 0.55 |
| searoute | Unchanged |

- **Forest fade, literally on the map:** path/trail polylines are split into segments by cell; segments in forest biomes drop opacity (faint ≈ 0.35, overgrown ≈ 0.2) so a path visibly dissolves as it enters deep woods.
- Stroke widths follow the existing zoom-aware convention (`fitK/view.k` scaling as used elsewhere in `AtlasSvgView`).
- Bridges: where a highway/road crosses a river cell, draw a short perpendicular tick glyph (stretch goal within the 2D slice; cheap because both rivers and routes carry cellIds).
- Both `atlasDraw.ts` (canvas) and `atlasSvg.ts`/`AtlasLayers.tsx` (SVG) get the same language from one shared style table so the two renderers cannot diverge.

### 5. 3D visual language

- `regionPolylinesToGround` carries `kind` through and assigns per-tier `widthFt` + `colorHex` (mirroring how town streets use `STREET_TIERS`): highway 44 ft pale flagstone `#c9b79a`, road 40 ft packed earth `#a08b62`, trail 20 ft lighter worn `#b5a077`, path 8 ft faint `#9aa07a`. `GroundPolyline.colorHex` already flows untouched to the ribbon vertex colors — this is the one-function seam the exploration verified.
- `generateRegion.ts` route → `RegionRoad` mapping extends to the new kinds (today it collapses to road|trail).
- **Faint paths in 3D:** paths do not render as continuous solid ribbons. The path centerline is split into a deterministic keep/skip patch cycle, so a faint path reads as a broken wear-line through undergrowth. Terrain-material stamping (`LocalTerrain.materialIndex → 'dirt'` under paths) is deferred to a beautification pass — the patch cycle delivers the read with a fraction of the surface area.
- Textured (UV-mapped) ribbons for highways are explicitly deferred to a later beautification pass.

## Tunables (single source of truth)

One module `src/systems/worldforge/travel/roadTunables.ts` exports every number above: tier speed factors, biome softening, danger multipliers, navigation DC ladder, biome speed factors, the burg population threshold that splits road from trail, path-generation radius/count, 2D opacities/widths, 3D widths/colors. Rationale: these are gameplay-feel constants and Remy will tune them; they must not be scattered.

## Out of scope (seams documented, not built)

- Travel pace (slow/normal/fast) in the live path — seam: `planRoutesFrom` `opts.speedMph` × `PACE_MODIFIERS`.
- Animated moving-party marker / staged travel progress.
- Seasons/weather modifying visibility — the visibility function takes a context object so this can bolt on.
- 3D bridge geometry; 2D gets the tick glyph only.
- Traffic simulation and road wear evolution.
- The legacy `TravelCalculations.ts`/`travelService.ts` stack stays untouched (unwired today, separate cleanup).

## Slices (build order)

1. **Mechanics foundation** — `buildRoadCells` fix (TDD), shared `routeTerrain.ts` classifier, graded biome speeds, tier speed/danger tables wired into both graph builders. Pure logic, fully unit-testable.
2. **Tiered generation** — routes-generator tier split + path generation pass; artifact/types/adapter updates; region mapping extends kinds.
3. **2D visual language** — shared style table, canvas + SVG strokes, forest fade, bridge ticks (stretch). Eyeball gate: atlas screenshots to Remy.
4. **Fading-path mechanic** — visibility classification, navDrift DC ladder integration, bushwhack downgrade, route-summary wording.
5. **3D ribbons + worn ground** — kind-aware `regionPolylinesToGround`, new-tier `RegionRoad`, path terrain stamping. Eyeball gate: shoot.mjs captures.

Slice 1 has no dependency on 2; slices 3 and 5 depend on 2; slice 4 depends on 1 (and reads tiers from 2).

## Test strategy

- TDD throughout (failing test first per slice).
- Slice 1: unit tests on the classifier (road cell detection from generated routes, tier factors, biome grading, both graph builders agreeing via the shared module).
- Slice 2: deterministic generation tests (same seed → same tiers/paths; tier invariants: capitals sit on highways, every path touches a burg or POI).
- Slice 4: seeded navDrift tests across the DC ladder (visible path never rolls, faint forest path rolls DC 8, failure downgrades speed).
- Slices 3/5: render smoke tests + mandatory visual eyeball (goldens alone insufficient per standing rule).
- Existing travel tests will shift where times change; expected diffs are part of slice 1's review.

## Open

- Tier speed/danger numbers are starting values — tune after first playthrough feel.
- Bridge glyphs (2D stretch) may slip to a polish pass.
- Whether paths should also target dungeons/lairs as POI endpoints once the dungeon placement work lands.
- **Owner decision (found during build):** FMG's internal `hasRoad`/`getConnectivityRate` helpers feed burg population generation. Giving town-tier roads the spec's new connectivity weights swings capital populations up to ~7× — a world-break. The build preserved old world output exactly (highways inherit the old road weights); adopting the spec's literal weights is deferred to Remy.
- **Owner decision (found during build):** burg populations are assigned AFTER routes generate, so the road-vs-trail split currently anchors on capitals and ports only; the population threshold is wired but inert until burg population assignment moves earlier in the pipeline.
- **Live eyeball gaps:** in-game 3D rural road ribbons and the in-game hover readout (with the faint-path warning) still need a live playthrough look. Headless proof exists for both 2D renderers, the 3D town harness, and all mechanics are test-pinned.
- Submap and Neighbourhood views still draw every route with the old single road stroke (`l0Adapter.ts` labels all routes `kind: 'road'`) — separate renderers, backlog item.
- Warning wording nuance: the pre-commit warning says "faint forest path" even when the fading segment is a trail (deep forest) or when the worst hazard on the trip is trackless wilds; consider "may be hard to follow" wording in a polish pass.
