# RealmSmith generator salvage audit

Verified: 2026-09-23 against the working tree.

Ruling from Remy: "Salvage first, then delete."
Scope: the six orphan files that the RealmSmith retirement of 2026-09-14 left in the tree.
Prior study: `docs/deepdives/realmsmith-vs-worldforge.md` (Agora task `agora-3bfe`).

## 1. Result

Nothing in the six files needs to move before deletion.

The prior deepdive found three ideas with value. All three are already ported into live WorldForge code:

1. Dead-end street dressing. Ported to `src/systems/worldforge/props/placementEngine.ts:825` (`DEAD_END_WEIGHTS`) and `:847` (`placeDeadEnds`). The dead-end finder is `src/systems/worldforge/town/townStreetNetwork.ts:743` (`polylineDeadEnds`) and `:799` (`streetDeadEnds`). The one-cemetery rule is kept, and it is now independent of anchor order.
2. Named landmarks with per-town caps. Ported to `src/systems/worldforge/town/population.ts:79` (`LANDMARK_TYPES`) and `:97` (`LANDMARK_CAPS`). The caps now scale with settlement size.
3. Family crop per farmstead. Ported to `src/systems/worldforge/town/farmCrops.ts:69` (`cropForFarmstead`) and `:122` (`assignFarmCrops`).

Each live port cites its RealmSmith source line in its header comment. Every other part of the six files is either superseded by a named live module or has no live consumer.

## 2. Live systems checked

| Live system | Where | Relation to the orphans |
|---|---|---|
| 3D town | `src/systems/worldforge/town/`, `src/systems/worldforge/props/` | Polygon geometry in feet. The orphans use an 80 x 60 integer tile grid. Tile code cannot move without loss of the coordinate frame. |
| 2D combat map | `src/services/battleMapGenerator.ts` | Has its own biome table (`placeObstacles`, line 178) and ten combat biomes. It has no town biome. |
| Pixi prototype (`?pixiboard=1`) | `src/components/BattleMap/pixi/` | Draws the combat grid and tokens. It draws no buildings, roads, or doodads. |
| `src/rendering2d/` | `doodadGlyphs.ts`, `biomePalette.ts`, `lightPool.ts` | Art only. The README says no game code calls it yet. It needs no generator input from the orphans. |
| WorldForge terrain and roads | `src/systems/worldforge/terrain/`, `erosion/`, `hydrology/`, `town/townStreetNetwork.ts` | Fully covers terrain, streets, gates, bridges, and docks. |

## 3. Candidate table

Line numbers refer to the orphan file named in the first column.

| # | Candidate (file:lines) | What it is | Live system that could use it | Live equivalent | Verdict |
|---|---|---|---|---|---|
| 1 | `BuildingGenerator.ts:19-94` `placeBuildings` | Puts buildings on tiles next to road tiles. Density sets a noise threshold. | 3D town | `townEngine.ts` ward frontage packing (plot `kind: 'frontage'`, line 62) | DROP |
| 2 | `BuildingGenerator.ts:96-113` `canBuild` | Tile footprint test: ground type, no building, no doodad. | None. Tile grid only. | `townEngine.ts` plot geometry | DROP |
| 3 | `BuildingGenerator.ts:115-153` type pick by plot size and distance | Chooses one of 23 building types from plot size and distance to center. | 3D town | `population.ts` `classifyBuilding` with ward wealth and `CORE_LANDMARKS` (line 152) | DROP (ported in spirit) |
| 4 | `BuildingGenerator.ts:156-164` very-sparse downgrade chain | Swaps grand types for rustic types in the smallest towns. | 3D town | `population.ts:97` `LANDMARK_CAPS`: a type with cap 0 at a typology never appears | DROP |
| 5 | `BuildingGenerator.ts:167-199` `LIMITS` table and downgrade | Flat per-town caps for 18 types. | 3D town | `population.ts:97` `LANDMARK_CAPS`, `:144` `claimLandmark` | DROP (already ported) |
| 6 | Types not in the live port: temple, church, manor, tower, alchemist, tailor, jeweler, stable, market stall | Extra building names. | 3D town | Temple and market are civic roles in `townEngine.ts:990` `assignCivicRoles`. The others fold into `shop`, `workshop`, and `cottage`. The W2 port chose its subset. | DROP (no live consumer asks for them) |
| 7 | `BuildingGenerator.ts:213-228` door toward nearest road tile | Brute-force nearest-edge search on tiles. | 3D town | Plot `frontageEdge` (`townEngine.ts:60`) gives the street face | DROP |
| 8 | `BuildingGenerator.ts:230-285` per-type wall, roof, and texture colors | Hex tints for a 2D top-down roof. | 3D town; `rendering2d` | 3D: `town/buildingStyle.ts`, `buildingMaterials.ts`, `architectureStyle.ts`. 2D: `rendering2d/biomePalette.ts` holds only biome overrides, and no live 2D surface draws buildings. | DROP |
| 9 | `BuildingGenerator.ts:292-351` `attachFieldsToFarms` | Puts 1 to 3 crop fields beside each farmhouse. | 3D town | `townEngine.ts:1108` `buildOutskirts` (farm parcels); `farmCrops.ts:122` | DROP (already ported) |
| 10 | `BuildingGenerator.ts:294` no-farm biome list | Skips farms in DESERT, GLACIER, VOLCANIC, CRYSTAL_WASTES, BADLANDS. | 3D town | None. See section 5. | DROP (the rule does not fit; the gap is real) |
| 11 | `BuildingGenerator.ts:353-382` farm field test and crop rows | Tile test; crop on every second column. | 3D town | Farm parcel polygons in `buildOutskirts`; crop kit props in `placementEngine.ts` | DROP |
| 12 | `BuildingGenerator.ts:384-424` `placeWorkshopHut` | Adds one 2 x 2 hut at a storage dead end. | 3D town | `placeDeadEnds` storage branch places a work yard kit | DROP |
| 13 | `BuildingGenerator.ts:426-445` `scatterDoodads` | Random square scatter on ground tiles. | 3D town | `placementEngine.ts` `cluster` | DROP |
| 14 | `BuildingGenerator.ts:447-458` `createClearing` | Clears a square of tiles. | None | Prop clearance rules in `placementEngine.ts` | DROP |
| 15 | `DoodadGenerator.ts:20-65` `generateWalls` | Bounding-box wall with cut corners. | 3D town | `townEngine.ts:917` `buildWalls` with gates and water gates | DROP |
| 16 | `DoodadGenerator.ts:67-102` `placeDoodads` | Noise forest plus a secondary scatter from the biome row. | 3D town; 2D combat map | 3D: `props/placementEngine.ts`, `forests/forestsPass.ts`. 2D: `battleMapGenerator.ts:178` `placeObstacles` | DROP |
| 17 | `DoodadGenerator.ts:104-132` `placeStreetLamps` | A lamp every 6 tiles beside main roads. | 3D town; `rendering2d/lightPool.ts` | 3D: `lantern-post` in `props/catalog.ts:634`. 2D: `LIGHT_PRESETS` already holds the street lamp preset; the caller supplies positions. | DROP |
| 18 | `DoodadGenerator.ts:134-225` `decorateDeadEnds` | Four dead-end features, one cemetery per town. | 3D town | `placementEngine.ts:847` `placeDeadEnds`; `townStreetNetwork.ts:743` | DROP (already ported) |
| 19 | `RoadGenerator.ts:16-56` `generatePlaza` | Disc of road tiles with a well at the center. | 3D town | `assignCivicRoles` plaza role; `well` in `props/catalog.ts:201` | DROP |
| 20 | `RoadGenerator.ts:58-147` main arteries | Noise-curved road march from center to edge exits. | 3D town | `townStreetNetwork.ts:488` `buildStreetNetwork`, `:254` `roadGateCandidates` | DROP |
| 21 | `RoadGenerator.ts:150-157`, `:260-276` ring roads | Ellipse of road tiles at radius 12 or 22. | 3D town | Wall ring and street tiers in `townStreetNetwork.ts` | DROP |
| 22 | `RoadGenerator.ts:160-206`, `:311-341` secondary streets | Density-scaled branch streets with random turns. | 3D town | `buildStreetNetwork` | DROP |
| 23 | `RoadGenerator.ts:222-258` `tryBuildBridge` | Axis-aligned bridge up to 6 tiles over water. | 3D town | `townEngine.ts:766` `findBridges`, capped by typology | DROP |
| 24 | `RoadGenerator.ts:278-309` `createDock` | Pier with an optional T-head. | 3D town | Dock civic role in `assignCivicRoles`, capped by typology | DROP |
| 25 | `TerrainGenerator.ts:15-48` `generate` | Two noise octaves, a center bias, four fixed cut levels. | WorldForge terrain; 2D combat map | WorldForge `terrain/`, `erosion/`, `hydrology/`; `battleMapGenerator.ts` `generateBaseTerrain` | DROP |
| 26 | `realmsmithBiomes.ts:3-37` `BiomeConfig`, `BIOME_DATA` | 20 rows: ground, beach, water tiles, tree and doodad lists, densities. | 2D combat map; Pixi; `rendering2d` | `battleMapGenerator.ts:178` table; FMG biome ids 0-12 in `architectureStyle.ts:182`; `rendering2d/biomePalette.ts` for color. The RealmSmith biome names do not match either live vocabulary. | DROP |
| 27 | `constants/realmsmith.ts:1-2` `WIDTH`, `HEIGHT` | Fixed 80 x 60 map size. | None | WorldForge scales wards with population | DROP |

## 4. SALVAGE items

None.

No line in the six files must move. The three ideas with value are already live (see section 1). Each other candidate has a named live equivalent or no live consumer.

## 5. Gap found during the audit (not a salvage)

The 3D town engine does not know the biome of its burg. `townEngine.ts:1108` `buildOutskirts` grades each outskirt parcel as farm, pasture, or scrub from distance alone (line 1126). Thus a Tundra or Hot-desert burg gets grain farms and crop props.

The RealmSmith rule at `BuildingGenerator.ts:294` does not fix this:

- It uses the RealmSmith biome names, not FMG biome ids 0-12.
- It removes farms in deserts. Oasis towns do farm.
- It keeps farms in Tundra, which is the more likely wrong case.

Recommended fix: give the town plan the FMG biome id (the value `climateForBiomeId` in `architectureStyle.ts:201` already reads), and grade farm parcels by climate class. Write a new rule; do not port the RealmSmith list. This gap belongs in the WorldForge town gap tracker. This audit was read-only, so it did not file the gap.

## 6. What to delete

All six paths are tracked in git. `git ls-files <path>` returned each path. `git status --porcelain` showed no local change on any of them on 2026-09-23.

| Path | Lines | Git-tracked | Local changes |
|---|---|---|---|
| `src/services/BuildingGenerator.ts` | 459 | Yes | None |
| `src/services/DoodadGenerator.ts` | 226 | Yes | None |
| `src/services/RoadGenerator.ts` | 342 | Yes | None |
| `src/services/TerrainGenerator.ts` | 50 | Yes | None |
| `src/data/realmsmithBiomes.ts` | 37 | Yes | None |
| `src/constants/realmsmith.ts` | 2 | Yes | None |

Notes for the deletion task:

1. Keep `src/types/realmsmith.ts`. `src/types/town.ts` and `src/utils/spatial/walkabilityUtils.ts:22` still import it.
2. Two live files cite the orphans in comments only: `src/systems/worldforge/town/farmCrops.ts:9` and `src/systems/worldforge/town/population.ts:91`. The citations do not import code, so the build does not break. Change each citation to a historical note, for example "the retired RealmSmith `BuildingGenerator.ts`".
3. After the deletion, `NoiseGenerator` in `src/utils/random/realmsmithRng.ts` has no `src` consumer except its test `src/utils/random/__tests__/noise.test.ts`. The Perlin index defect (deepdive W4, `agora-f821.25`) then affects nothing live. Decide the fate of that file in its own task.
4. The deepdive lists the follow-up records: delete task `agora-f821.28` (W5), domain-doc repair `agora-f821.32` (W6), and the plan-map topic `realmsmith-service` (`public/planmap/topics.json`).
