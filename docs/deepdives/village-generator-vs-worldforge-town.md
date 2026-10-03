# Deepdive: villageGenerator against Worldforge town and interiors

Board task: agora-c0af. Written 2026-09-20 by dd-village.
Planning surfaces: Plan Map topics `village-biome-flavor-coverage`
(`public/planmap/topics.json:1529`), `shipped-grid-retirement`
(`public/planmap/topics.json:1223`), `wf-interiors`
(`public/planmap/topics.json:965`), `building-generator`
(`public/planmap/topics.json:300`).
Retirement record: `docs/superpowers/plans/2026-07-01-grid-2d-view-retirement-plan.md`.

## 1. Verdict

`src/services/villageGenerator.ts` is dead code, not a fallback and not a
prototype. It is the generator for the 2D village view that the grid-retirement
program deleted on 2026-07-01. No production file imports it. Its only importer
is its own test, and that test never calls `generateVillageLayout`. Worldforge
supersedes it completely: `townEngine.ts` builds the town plan, `TownPlanView`
draws that same plan in 2D inside the live World Map, and the interior pipeline
gives each building rooms. Do not delete the file yet. Two things still depend on
its neighborhood: the type `VillagePersonality` is live, and the Plan Map records
the village personality profiles as shipped although no player can reach them.

## 2. Inventory

| File | Lines | What it does | Who calls it |
|---|---|---|---|
| `src/services/villageGenerator.ts` | 703 | Builds a 48 x 32 tile matrix for one village (line 460-461). It rolls a `VillagePersonality`, carves axial and winding roads, stamps a 6 x 6 plaza (line 497), a well, a market, two guard posts, up to 4 shops and 10 to 22 houses (line 563). It returns tiles plus rectangular footprints. Also exports `findBuildingAt` (line 618) and `describeBuilding` (line 638). | NOBODY in production. The only importer is `src/services/villageGenerator.test.ts:2`, which imports `findBuildingAt` and three types. `generateVillageLayout` (line 452) has zero call sites in the repository. |
| `src/systems/worldforge/town/townEngine.ts` | 1927 | The Voronoi ward town generator. `generateTownPlan` (line 1445) subdivides a burg footprint into wards, packs party-wall building plots along ward frontage, adds streets, walls, gates, civic structures, outskirts and open land. `typologyForPopulation` (line 1013) and `scaleProfile` (line 1025) set the size class from population. | Live. `src/systems/worldforge/town/canonicalTown.ts:38` wraps it as the one plan per (atlas, burgId). `src/components/MapPane.tsx:68,860,1273` draws that plan in the World Map. `src/systems/worldforge/bridge/groundChunkLoader.ts:73-75` builds the 3D ground town from it. `src/systems/worldforge/townsim/townSimRegistration.ts:35`, `registerBurgMerchants.ts:28` and `buildingHistoryCompaction.ts:39` run the town simulation on it. Plus 16 more modules named in the file header (line 7). |
| `src/systems/worldforge/interior/program.ts` | 610 | Gives every room on a floor a purpose. `assignPurposes` (line 339) finds corridors, makes the largest room the headline room for the building type, then fills required and optional slots. `assignUpperPurposes` (line 570) does the upper floors and consumes the bedroom queue. | Live. `src/systems/worldforge/interior/generateBuilding.ts:58,313,349` calls both functions. `src/systems/worldforge/interior/briefProgram.ts:26` reads `HEADLINE`. `generateBuilding` feeds `blueprintForPlot` (`generateInterior.ts:171`), which `groundChunkLoader.ts:3157` and `bridge/interiorParts.ts:342` use to build the interiors you walk into. |

Supporting files in the same neighborhood:

| File | Lines | Status |
|---|---|---|
| `src/services/villageGenerator.test.ts` | 77 | Tests `findBuildingAt` against a hand-made layout only. It never runs the generator. |
| `src/data/villagePersonalityProfiles.ts` | 166 | `resolveVillageIntegrationProfile` (line 146). Its only production caller is `villageGenerator.ts:467`. The other importer is its own test. |
| `src/types/village.ts` | 28 | LIVE. `VillagePersonality` is read by `src/state/reducers/townReducer.ts:14`, `src/systems/npc/backgroundBrief.ts:30` and `src/utils/world/settlementGeneration.ts:22`. Keep this file. |
| `src/utils/world/settlementGeneration.ts` | 302 | Only `src/utils/world/index.ts:22` re-exports it. No file calls `determineSettlementInfo`, `generateSettlementParameters`, `getSettlementTypeForRace`, `createPersonalityFromSettlementType` or `shouldGenerateCharacterDrivenSettlement`. |
| `src/config/submapVisualsConfig.ts` lines 149-162 | 14 | `villageBuildingVisuals` has one importer: `villageGenerator.ts:2`. The other exports in the same file feed `submapUtils.ts:25` and stay. |
| `src/components/Town/VillageScene.README.md` | 20 | Documents `VillageScene.tsx`, which does not exist. |
| `src/components/Worldforge/TownPlanView.tsx` | 1239 | The live 2D settlement view. It draws the canonical town plan as SVG. |

## 3. Findings

1. **`generateVillageLayout` has no caller.** A repository-wide grep for the
   symbol returns only its definition (`src/services/villageGenerator.ts:452`).
   No dynamic import, no barrel and no string reference reaches it.
   `src/services/` has no index barrel.

2. **The view that used it was deleted.**
   `docs/superpowers/plans/2026-07-01-grid-2d-view-retirement-plan.md:17-18`
   records slice 1a as "retired the 2D village view (`TownCanvas` + 13 files)"
   and slice 1b as "removed the dead village-view plumbing".
   `src/state/reducers/townReducer.ts:5-8` says the same in code:
   "That 2D village view was retired in the grid-retirement program".

3. **`VillageScene.tsx` is gone but its README is not.**
   `src/components/Town/VillageScene.README.md` still describes canvas
   rendering, building hitboxes and a `VILLAGE_VIEW` game phase. The component
   file is absent from `src/components/Town/`, and the plan
   (`2026-07-01-grid-2d-view-retirement-plan.md:147-150`) states that
   `GamePhase.VILLAGE_VIEW` became the reserved placeholder
   `RESERVED_RETIRED_VILLAGE_VIEW`.

4. **The retirement program kept the file for a circular reason.**
   `docs/superpowers/2026-07-01-grid-retirement-handover.md:70` keeps
   `utils/spatial/submapUtils.ts` because its `createSeededRandom` feeds
   `landmarkService` and `villageGenerator`. `villageGenerator` was itself
   already unreachable at that time. `submapUtils` is still correctly kept,
   because `landmarkService.ts`, `quirkGenerator.ts`, `speechProfile.ts` and
   `templeUtils.ts` also use `createSeededRandom`.

5. **Worldforge already does the 2D job.** `src/components/MapPane.tsx:1273`
   bottoms the drill out into `getCanonicalTownPlan`, and line 1540 renders
   `TownPlanView` with that plan. The comment at `MapPane.tsx:1267-1270` states
   the intent: "the 2D town is byte-identical to the 3D ground town for the same
   burg". `villageGenerator` produces a separate, unrelated layout from
   different seeds, so it cannot serve as a fallback for that view.

6. **Worldforge covers every feature `villageGenerator` claims, at higher
   fidelity.** Plaza, temple, keep, citadel, dock and bridge are `CivicKind`
   (`townEngine.ts:110`). Population and size class are `TownTypology` and
   `scaleProfile` (`townEngine.ts:112,1025`). Wealth per ward is
   `assignWardWealth` (`town/population.ts`). Culture and material are
   `architectureStyle.ts` (33893 bytes) and `buildingMaterials.ts`. Shops and
   trades are `BuildingType` in `town/population.ts`. Interiors are the
   `interior/` pipeline.

7. **The village personality profiles are shipped but unreachable.** Plan Map
   topic `village-biome-flavor-coverage` (`public/planmap/topics.json:1529`) is
   `"status": "done"`, `"verified": "2026-09-09"`, and it claims that "every
   biome ... reads with its own flavor". The resolver it names,
   `resolveVillageIntegrationProfile`, has exactly one production caller:
   `villageGenerator.ts:467`. No player can see any of those profiles. The
   Plan Map entry is therefore true about the code and false about the game.

8. **`settlementGeneration.ts` is a second dead layer.** It holds 15 authored
   settlement archetypes (`SETTLEMENT_TYPES`, line 39) and five exported
   functions. Only the barrel `src/utils/world/index.ts:22` re-exports them.
   Nothing calls them. It is, however, the only place that maps a race to a
   settlement personality, so it is content worth keeping.

9. **`villageGenerator.ts` carries content that Worldforge does not have.** The
   `CulturalTileType` union (line 33-46) names 24 culture-specific structures:
   treehouses, stone halls, hide tents, longhouses, totem poles, docks,
   lighthouses, shipwrights, fish markets, magic academies, arcane towers,
   healer huts, alchemist shops, caravan stops, nomad yurts and shrines.
   `townEngine.ts` has 14 `BuildingType` values and 6 `CivicKind` values, none
   of them culture-keyed in that way. Delete the file and this list goes with
   it.

10. **The type layer must survive any cleanup.** `src/types/village.ts` defines
    `VillagePersonality` and `VillageIntegrationProfile`. `VillagePersonality`
    is live through `OPEN_TEMPLE`, which `src/hooks/actions/actionHandlers.ts:551`
    dispatches and `src/state/reducers/townReducer.ts:21` handles to build a
    temple with `generateVillageTemple`. `src/systems/npc/backgroundBrief.ts:41-44`
    also reuses its biome-style and culture vocabulary.

11. **Two docs point at project files that do not exist.**
    `docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md:94` routes village work
    to `docs/projects/town/GAPS.md` G3 and
    `docs/projects/town-description-system/GAPS.md` G6. Neither file exists.
    The same row cites `TownCanvas.tsx` and `VillageScene.tsx` as current
    evidence; both are deleted.

12. **The interior pipeline has no village equivalent and needs none.**
    `program.ts` runs per building plot, not per settlement. It is called from
    `generateBuilding.ts`, which `blueprintForPlot` wraps, which the 3D ground
    loader and the 2D building identity lab both consume. `villageGenerator`
    has no interior concept at all: its buildings are colored rectangles.

## 4. Decisions for Remy

### Decision 1: what happens to `villageGenerator.ts`

The file is 703 lines of unreachable code. It is also the only record of 24
culture-keyed settlement structures.

Options:

- **A. Delete it now**, with `villageGenerator.test.ts`,
  `villageBuildingVisuals` (`submapVisualsConfig.ts:149-162`) and
  `VillageScene.README.md`. Keep `src/types/village.ts`. About 800 lines go.
- **B. Harvest, then delete.** First move the 24 culture-keyed structure names
  and the biome/race style rules into Worldforge data (a culture table next to
  `architectureStyle.ts`), then delete the file.
- **C. Keep it frozen** and mark it clearly as retired, in case a fast abstract
  settlement view returns.

Recommendation: **B**. Option A throws away authored content that Worldforge
does not yet have, and that content is the real value in the file. Option C
leaves a 703-line file that reads like a live system and that a future agent
will trip on again, as the grid-retirement handover already did (finding 4).
Harvest first, delete second.

### Decision 2: what happens to the village personality profiles

`resolveVillageIntegrationProfile` and `SETTLEMENT_TYPES` hold authored
settlement flavor that no player can reach (findings 7 and 8). The Plan Map
says this work is shipped.

Options:

- **A. Wire them to Worldforge.** Make the canonical town plan carry a
  `VillagePersonality`, derived from the burg, and let `TownPlanView` and the
  town simulation read the integration profile for names, taglines and
  encounter hooks.
- **B. Retire them.** Delete `villagePersonalityProfiles.ts` and
  `settlementGeneration.ts`, and change the Plan Map topic status from `done`
  to `superseded`.
- **C. Leave them.** Keep the files and correct only the Plan Map entry.

Recommendation: **A**. The profiles answer a question Worldforge has not
answered: what a settlement FEELS like. `townEngine` gives geometry, population
and wealth, but no tagline, no cultural signature and no encounter hooks. The
burg already has the inputs the resolver needs (population, biome, water). This
is a small wiring job with visible payoff in the town plan and in the town
crier and rumor systems.

### Decision 3: whether an abstract settlement view is still wanted

`villageGenerator` produced a settlement in about 5 ms of array writes.
`generateTownPlan` runs a Voronoi subdivision, street network, population pass
and architecture pass.

Options:

- **A. No.** The canonical town plan is the only settlement model. Every
  surface reads it.
- **B. Yes, as a level of detail.** Keep a cheap abstract settlement for
  distant or off-screen settlements, and build it from the canonical plan, not
  from a second generator.

Recommendation: **A** for now, **B** only if a measurement shows the town plan
is too slow for a real surface. `MapPane` already caches the plan per burg, and
no performance complaint about town generation appears in the Plan Map.

## 5. Follow-up work

Filed on the board under campaign `agora-f821`:

1. **agora-f821.17** (priority 3) - Harvest the culture-keyed settlement
   vocabulary out of `villageGenerator.ts` into Worldforge data. Blocked on
   Decision 1.
2. **agora-f821.21** (priority 4) - Wire `resolveVillageIntegrationProfile` to the
   canonical town so the shipped biome flavor is reachable. Blocked on
   Decision 2.
3. **agora-f821.26** (priority 2) - Delete `VillageScene.README.md`, which
   documents a component that does not exist.
4. **agora-f821.33** (priority 3) - Correct the Plan Map topic
   `village-biome-flavor-coverage`, which says shipped about code with no
   reachable consumer.
5. **agora-f821.34** (priority 4) - Fix `RETIREMENT_LEDGER.md:94`, which routes to
   two project gap files that do not exist and cites two deleted components.

## 6. Workflow gaps

Filed with `gap add --project workflow`:

1. **WF-G188** - The Plan Map records a topic as `done` and `verified` when the
   code exists, with no check that any production caller reaches it.
   `village-biome-flavor-coverage` has been `done` since 2026-07-22 and was
   re-verified on 2026-09-09, although its only consumer has been dead since
   2026-07-01.
2. **WF-G192** - `task new` prints `--category <name>` in its usage line but
   never lists the valid category names, and `task lint` accepts only a task id.
   An agent must guess a category and find out later whether it was right.
