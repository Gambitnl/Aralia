# RealmSmith generators vs the Worldforge pipeline

Deepdive for Agora task `agora-3bfe`. Written 2026-09-20 by `dd-realmsmith`.
Owning plan-map topic: `realmsmith-service` (`public/planmap/topics.json:6300`).
Related domain doc: `docs/architecture/domains/town-map.md`.

## 1. Verdict

The four RealmSmith generators are an obsolete prototype suite. They have zero
importers, and Worldforge already does each job at higher fidelity. Three ideas
are worth porting before deletion: the dead-end street dressing, the named
landmark vocabulary with singleton caps, and the per-farmstead crop identity.
Worldforge has no equivalent for those three. Everything else in the suite -
terrain, road marching, bridges, docks, town walls, doodad scatter - is
superseded by named Worldforge modules listed in section 3.

## 2. Inventory

Every file below is the version in the worktree on 2026-09-20.

### `src/services/TerrainGenerator.ts` - 50 lines

Fills an 80 x 60 tile array with elevation and a tile type. It sums two Perlin
octaves, adds a radial center bias, then cuts the result at four fixed
thresholds (`TerrainGenerator.ts:16-45`).

Callers: none.

### `src/services/RoadGenerator.ts` - 342 lines

Builds a town road graph on the same tile grid. It has five parts: a plaza disc
(`:16-56`), noise-perturbed main arteries from the center to edge exits
(`:58-147`), elliptical ring roads (`:260-276`), density-scaled secondary
streets with organic turns (`:311-341`), plus bridges (`:222-258`) and docks
(`:278-309`).

Callers: none.

### `src/services/BuildingGenerator.ts` - 459 lines

Places buildings on plots beside road tiles (`:19-94`). It picks a building type
from plot size and distance to center (`:115-153`), applies a uniqueness limit
table with a downgrade chain (`:167-199`), points the door at the nearest road
(`:213-228`), and gives each building a color, roof style and wall texture
(`:230-285`). It also attaches farm fields to farmhouses (`:292-351`) and offers
three helpers used by `DoodadGenerator`: `placeWorkshopHut`, `scatterDoodads`
and `createClearing` (`:384-458`).

Callers: `src/services/DoodadGenerator.ts:5` only. That file has no caller
either, so the chain is closed.

### `src/services/DoodadGenerator.ts` - 226 lines

Adds town walls from the building bounding box (`:20-65`), scatters biome
doodads by noise (`:67-102`), puts street lamps beside main roads (`:104-132`),
and dresses road dead ends with one of four features (`:134-225`).

Callers: none.

### `src/data/realmsmithBiomes.ts` - 37 lines

One `BiomeConfig` row for each of 20 biomes. Each row names the ground, beach
and water tile types, two doodad lists, and two density numbers (`:16-37`).

Callers: `TerrainGenerator.ts:3`, `BuildingGenerator.ts:3`,
`DoodadGenerator.ts:3`. All three are orphans.

### `src/constants/realmsmith.ts` - 2 lines

`WIDTH = 80` and `HEIGHT = 60`. The whole suite is locked to that one map size.

Callers: the four generators only.

### `src/types/realmsmith.ts` - 171 lines

Seven enums plus the `Tile`, `Building` and `TownMap` interfaces.

Callers: `src/types/town.ts:8` and `src/utils/spatial/walkabilityUtils.ts:22`,
plus the four generators. This file is therefore LIVE and must stay.

### Grep evidence for "zero importers"

Search over `src/**/*.{ts,tsx}` for the pattern
`from ['"].*(TerrainGenerator|RoadGenerator|BuildingGenerator|DoodadGenerator)`
returns one hit: `src/services/DoodadGenerator.ts:5`. No other file in `src`
imports any of the four classes.

## 3. Findings

**F1. The four generators have no importer.** The only import between them is
`DoodadGenerator.ts:5`, which imports `BuildingGenerator`. See the grep evidence
in section 2.

**F2. A retirement pass already ran, and it stopped short.** The pass of
2026-09-14 (`agora-e840.5`) deleted `RealmSmithAssetPainter.ts`,
`RealmSmithTownGenerator.ts` and `src/services/realmsmith/`. The domain doc
records that the four generator files lost their last caller in that same pass
(`docs/architecture/domains/town-map.md:92-101`). Nobody removed them.

**F3. The plan map says the topic is finished.** Topic `realmsmith-service` has
`"status": "done"` and a note that says the rest was deleted
(`public/planmap/topics.json:6300-6308`). The four files disagree with that
note. The plan map lags the tree.

**F4. The same domain doc still lists retired files as current.** Lines 110 and
122-126 name `RealmSmithTownGenerator.ts`, `TownCanvas.tsx`, `VillageScene.tsx`
and `useTownController.ts` under "Verified Current Entry Points" and "Current
Domain Shape". Lines 78-84 and 92-101 say those files are gone. One doc holds
both claims.

**F5. Terrain is fully superseded.** `TerrainGenerator.ts:16-45` is 30 lines of
threshold noise on a fixed 80 x 60 grid. Worldforge derives ground from the FMG
atlas and then runs erosion and hydrology: `src/systems/worldforge/erosion/`,
`src/systems/worldforge/hydrology/`, and `src/systems/worldforge/terrain/`
(11,669 lines across 19 files). Nothing in the prototype adds a method that the
Worldforge stack lacks.

**F6. Roads, bridges, docks, walls and gates are fully superseded.** Each
RealmSmith part maps to a named Worldforge function:

| RealmSmith | Worldforge |
|---|---|
| main arteries `RoadGenerator.ts:58-147` | `townStreetNetwork.ts:488` `buildStreetNetwork` |
| edge exits `RoadGenerator.ts:73-76` | `townStreetNetwork.ts:254` `roadGateCandidates` |
| bridges `RoadGenerator.ts:222-258` | `townEngine.ts:766` `findBridges`, capped at `:1688-1719` |
| docks `RoadGenerator.ts:278-309` | `townEngine.ts:990` `assignCivicRoles`, capped at `:1656-1672` |
| town walls `DoodadGenerator.ts:20-65` | `townEngine.ts:917` `buildWalls`, water gates at `:948` |
| road tiers, plaza | `townStreetNetwork.ts:97` `TIER_WIDTH_RATIO` |

The Worldforge versions work in feet on polygon geometry. The RealmSmith
versions work on integer tiles. The tile versions cannot be ported without
losing the coordinate frame that the 3D bake needs.

**F7. Doodad scatter is superseded.** `DoodadGenerator.placeDoodads`
(`:67-102`) picks from two lists per biome. Worldforge has a 105-entry prop
catalog with referee data (`src/systems/worldforge/props/catalog.ts`), a
placement engine (`props/placementEngine.ts:1021` `placeProps`), and a ground
bridge (`bridge/groundProps.ts:316`). The street lamp of
`DoodadGenerator.ts:104-132` exists as `lantern-post`
(`props/catalog.ts:1653`).

**F8. Farm fields are superseded, but the crop identity is not.**
`townEngine.ts:1108` `buildOutskirts` grades outskirt parcels as farm, pasture
or scrub. `townEngine.ts:1269` `buildIntramuralOpenLand` adds yard, garden,
orchard, paddock and ruin. None of them names a crop. RealmSmith gives each
farmhouse one "family crop" and plants it in rows
(`BuildingGenerator.ts:300`, `:368-382`). That is a small, cheap identity signal
that Worldforge does not have.

**F9. The named landmark vocabulary is not in Worldforge.** RealmSmith has 23
building types (`src/types/realmsmith.ts:25-49`), including library, guild hall,
granary, windmill, lumber mill, school, shrine, barracks, bakery, tailor and
jeweler. Worldforge has 11 types in `town/population.ts:40-45` and 14 in
`interior/blueprintTypes.ts:47-53`. Neither list holds those landmarks.

**F10. Per-type singleton caps are not in Worldforge.** RealmSmith enforces one
temple, one library, one guild hall and so on, with a downgrade chain when the
cap is hit (`BuildingGenerator.ts:167-199`). Worldforge caps only docks and
bridges by typology (`townEngine.ts:1656-1672`, `:1688-1719`), and
`assignCivicRoles` (`:990`) puts one plaza, keep, citadel and temple per town at
ward level. `classifyBuilding` (`population.ts:182`) has no cap at all, so a
town can get any number of smithies.

**F11. Dead-end street dressing is not in Worldforge.** RealmSmith finds every
road tile with exactly one road neighbor and dresses it as nature, storage plus
a workshop hut, a cemetery, or a shrine, with one cemetery per town
(`DoodadGenerator.ts:134-225`, rule at `:176-183`). A search over
`src/systems/worldforge` for dead-end handling returns dungeon corridors only
(`dungeon/intact/circulation.ts:436`), never streets. The town graveyard module
(`townsim/graveyard.ts`) names the dead but states at its own line 38 that it
does not place anything in 3D.

**F12. The shared Perlin generator has a gradient index defect.**
`src/utils/random/realmsmithRng.ts:110-120` computes `A = perm[X] + Y` and
`B = perm[X+1] + Y`, then reads `perm[A]`, `perm[B]`, `perm[B]` again, and
`perm[B+1]`. Correct Perlin reads `perm[A]`, `perm[A+1]`, `perm[B]` and
`perm[B+1]`. The third term at `:116` must be `perm[A + 1]`, and `perm[A+1]` is
never read. The corner gradient therefore differs between vertically adjacent
lattice cells, so the field is discontinuous across horizontal lattice lines.
The two tests at `src/utils/random/__tests__/noise.test.ts:110-130` check
determinism and range only, so they do not catch it. `NoiseGenerator` is
exported from the public barrel `src/utils/random/index.ts:23`, but the four
orphans and that test file are its only users.

**F13. Two shuffle calls discard their result.** `RoadGenerator.ts:192` and
`BuildingGenerator.ts:43` call `this.rng.pick(...)` and throw the value away.
The calls only advance the RNG stream. The author intended a shuffle in both
places, because both loops then iterate the array in fixed order.

**F14. Two guard lines are unreachable.** `DoodadGenerator.ts:81-82` tests for
`WALL` and `FARM` after line 79 already returns on any type outside
`validGround`. `WALL` and `FARM` are not in `validGround`, so the two tests
never run.

**F15. A generator is constructed inside a loop.** `DoodadGenerator.ts:190`
builds a new `BuildingGenerator` for each dead end. One instance outside the
loop gives the same result, because the RNG is shared by reference.

**F16. The suite is locked to one map size.** Every file reads `WIDTH` and
`HEIGHT` from `src/constants/realmsmith.ts:1-2`. The grid is 80 x 60 tiles and
cannot change per town. Worldforge scales ward count with population and states
it is uncapped (`townEngine.ts:1023`).

## 4. Decisions for Remy

**D1. What happens to the four generator files?**

Options:
1. Delete all four now, and port nothing.
2. Port the three ideas in F8, F9 and F11 into `src/systems/worldforge/`, then
   delete all four.
3. Keep the files as a reference prototype, and add a header that says so.

Recommendation: option 2. The code cannot run and cannot be revived, because it
needs a tile grid that no live surface has. The three ideas are cheap and add
town character that Worldforge does not have today. Option 1 loses them. Option
3 repeats the 2026-09-14 outcome, where the files stayed and the plan map said
they were gone.

**D2. Do towns need the named landmark vocabulary (F9, F10)?**

Options:
1. Add the landmark types to `population.ts` `BuildingType` and give each one a
   per-town cap.
2. Keep the 11 generic types, and express a landmark only through the civic
   roles that `assignCivicRoles` already assigns.

Recommendation: option 1. A town that can hold one library, one guild hall and
two taverns reads as a place. A town of cottages, shops and smithies reads as
filler. The cost is one union type, one cap table and one interior program per
new type.

**D3. Should street dead ends carry features (F11)?**

Options:
1. Port the four-feature dressing (nature, storage, cemetery, shrine) into the
   Worldforge prop placement engine, and keep the one-cemetery rule.
2. Leave dead ends bare, and let the general prop scatter cover them.

Recommendation: option 1. The prop engine already owns the catalog and the
clearance rules, so the port is a context rule, not a new system. It also gives
`townsim/graveyard.ts` the 3D surface its own header asks for.

## 5. Follow-up work

**W1. Port the dead-end street dressing into the prop placement engine.**
Files: `src/systems/worldforge/props/placementEngine.ts`,
`src/systems/worldforge/town/townStreetNetwork.ts`.
Acceptance: street polylines expose their terminal nodes; the placement context
gains a dead-end context type; a seeded town produces at most one cemetery
cluster; a test asserts the cap and determinism.
Filed as `agora-f821.13`.

**W2. Add named landmark building types with per-town caps.**
Files: `src/systems/worldforge/town/population.ts`,
`src/systems/worldforge/interior/blueprintTypes.ts`,
`src/systems/worldforge/interior/footprint.ts`.
Acceptance: the `BuildingType` union gains the landmark types; a cap table
limits each one per town; `classifyBuilding` respects the caps; footprint and
interior programs cover every new type; a test asserts the caps at three
typologies.
Filed as `agora-f821.16`.

**W3. Give each farmstead a crop identity.**
Files: `src/systems/worldforge/town/population.ts`,
`src/systems/worldforge/town/townEngine.ts`.
Acceptance: each farmstead carries one seeded crop; the farm outskirt parcel
nearest the farmstead inherits it; a test asserts the value is stable for a
seed.
Filed as `agora-f821.20`.

**W4. Fix the Perlin gradient index in `realmsmithRng.ts`.**
File: `src/utils/random/realmsmithRng.ts:116`.
Acceptance: the third gradient reads `perm[A + 1]`; a new test asserts
continuity across a horizontal lattice line to a small tolerance; the existing
determinism and range tests still pass.
Filed as `agora-f821.25`.

**W5. Delete the four generator files after W1 to W3 land.**
Files: `src/services/TerrainGenerator.ts`, `src/services/RoadGenerator.ts`,
`src/services/BuildingGenerator.ts`, `src/services/DoodadGenerator.ts`,
`src/data/realmsmithBiomes.ts`, `src/constants/realmsmith.ts`.
Acceptance: the six files are gone; `src/types/realmsmith.ts` stays, because
`types/town.ts` and `walkabilityUtils.ts` use it; the build and the test suite
pass; `docs/architecture/domains/town-map.md` and the `realmsmith-service` topic
record the deletion.
Filed as `agora-f821.28`.

**W6. Correct the stale sections of the town-map domain doc.**
File: `docs/architecture/domains/town-map.md:107-134`.
Acceptance: "Verified Current Entry Points" and "Current Domain Shape" name only
files that exist; the retired names move under a clearly marked history heading;
no section contradicts lines 78-101.
Filed as `agora-f821.32`.

## 6. Workflow gaps

**G1. A retirement ruling closed while its orphans stayed in the tree.** The
plan-map topic `realmsmith-service` reads `done` and says the rest was deleted,
but six files survive. Filed as `WF-G190`.

**G2. One domain doc holds two opposite claims about the same files.**
`docs/architecture/domains/town-map.md` says the files are retired at lines
92-101 and lists them as current at lines 110-126. Filed as
`WF-G195`.
