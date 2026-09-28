# Town Map

Verified: 2026-09-23 (Agora task `agora-e840.7`). This pass deleted the six
orphaned RealmSmith generator files and moved their names under "Retired Names".
The 2026-09-20 pass (Agora task `agora-f821.32`) checked every path
named as current against the worktree with a file check, removed the five deleted
town files from the current-state sections, and moved their names under the single
"Retired Names" heading below. The building generation, road surface, perimeter and
preview sections were last verified 2026-09-08 and were not re-checked in this pass.

## Building scale and real 3D inspection

Building Lab doubles both physical town-plan axes with `transformTownPlan`
before adapting its parcels, keeping roads and lots aligned and five-foot cells
unchanged. The production keep placement prefers a peripheral ward with room
for a forty-foot square before street setbacks. Keeps resolve dressed stone,
a flat slate roof, and four continuous parapets supporting their merlons.
For seed 792767481 at population 3200, the lab keep is 55 by 55 feet.
Explicit parcel bounds still limit individual buildings; the site transform
does not promise a fixed multiplier for every clipped or minimum-sized plan.
Wealthy gable trim now uses vertically connected steps instead of floating
bargeboard fragments. Building Lab supports hover labels and individual part
selection, with dimensions, floor level, and separate roof-surface selection.

Worldforge's canonical building generator uses five-foot cells. Type-specific
footprint ranges in `src/systems/worldforge/interior/footprint.ts` now reserve
larger floor areas across all fourteen building types. Town parcels remain
authoritative: explicitly constrained plots may produce smaller plans. Row
packing in `townEngine.ts` retains generated depth and avoids the former fixed
15/20-foot frontage override.

The blueprint preview and Building Identity Lab both use `PreviewBuilding3D`.
It shows canonical furnishings with the production bridge's dimensions, plus
a six-foot reference figure on one five-foot square. The figure is a measuring
aid, not a resident or a universal character height. The scene uses feet; the
streamed town converts feet to meters at 0.3048 meters per foot.

The streamed renderer batches actual outer-wall segments, openings, and
architectural details through `buildingExteriorGeometry.ts`; nearby interiors
still use the complete site-part representation. Shared fallback surface images
live in `public/assets/town-materials`, with provenance and limitations in its
README. This improves building inspection but does not establish final visual
acceptance against the Dream Loop concept.

The reviewed tavern seed 792767481 now has a 60-by-55-foot bounding envelope
(previously 40 by 40). An irregular envelope is not its usable floor area.

House surfaces share physical texture coordinates across the foot-based lab and
meter-based world. Roof courses follow the slope; plaster, thatch, slate, and
clay use construction-specific colors while retaining seeded variation. The
seven-image fallback library now includes weatherboards, brickwork, and clay
tiles. Plain timber-plaster houses receive visible framing that avoids windows.
Gable ends and the solver's roof-step skirts close the previously open roof skin.
The lab initially faces the entrance, uses rough physical surface lighting with
ink edges, and retains orbit controls and the character-scale reference.

## Real 3D road surfaces

`src/systems/world3d/roadGeometry.ts` splits road faces at terrain-cell edges
and diagonals, so their interiors follow the rendered ground as well as their
corners. This prevents triangular patches of paving from sinking into terrain.
Matching town-street endpoints receive beveled joins for each paving layer.
Road tiers have separate height bands: all plaza layers sit above avenue,
street, and lane layers, preventing lower-tier ruts from crossing plaza edging.
Flat chunks retain compact ribbons; regional road routes and colors are preserved.

## Town perimeter and skyline rendering

The streamed wall mesh has closed sides, top, footing, and gate-end faces.
It is 2.4 meters thick and rises 4.8 meters above its sampled ground, with
another 0.4 meters buried. Stone images use world-aligned physical texture
coordinates and shallow bump relief. The existing open runs preserve gate gaps.

The ground postprocessing chain composites clouds before applying final SMAA,
with composer multisampling disabled so foliage color and depth coverage agree.
Clouds render without temporal upscaling to retain thin foreground silhouettes.

## Purpose

The Town Map domain covers deterministic town and village exploration surfaces, including generated layouts, local movement, building interaction entry points, merchant access, and town-scoped rendering helpers.

## The renderer moved; the state did not

Corrected 2026-08-05. This doc named three rendering surfaces that no longer
exist:

- `Town/TownCanvas.tsx`
- `Town/VillageScene.tsx`
- `hooks/useTownController.ts`

Worldforge replaced them. A town now draws through
`src/components/Worldforge/TownPlanView.tsx` in 2D and through the ground bake
in 3D, from ONE canonical plan per (atlas, burg).

Generation and state were not retired with the renderer, and that split is the
useful fact here. `townReducer.ts` and `types/town.ts` are still live.

RETIRED 2026-09-14 (Agora task `agora-e840.5`). The RealmSmith 2D painter stack
is gone. `src/services/RealmSmithAssetPainter.ts`,
`src/services/RealmSmithTownGenerator.ts` and `src/services/realmsmith/` were
deleted. They had zero importers. Three parts were salvaged into
`src/rendering2d/`: the doodad glyphs, the biome palette, and the night light
pool. `src/types/realmsmith.ts` stays, because `types/town.ts` and
`utils/spatial/walkabilityUtils.ts` still use it.
The four generator files (`BuildingGenerator.ts`, `DoodadGenerator.ts`,
`RoadGenerator.ts`, `TerrainGenerator.ts`) had no importer either. They were
deleted 2026-09-23 with `realmsmithBiomes.ts` and `constants/realmsmith.ts`
(ruling Q9, Agora task `agora-e840.7`). The salvage review
`docs/architecture/REALMSMITH_GENERATOR_SALVAGE.md` kept no code. Every
mention of `RealmSmithTownGenerator` or `AssetPainter` below is history.

The 2026-09-20 pass removed those names from every current-state section. They
now appear only in this history block, in the "Retired Names" list and in
"Historical Drift Corrected". Those three places record what the old surfaces
did; nothing below describes a live surface by a retired name.

## Verified Current Entry Points

Each path below resolves in the worktree as of 2026-09-20:
- `src/components/Worldforge/TownPlanView.tsx`
- `src/state/reducers/townReducer.ts`
- `src/types/town.ts`
- `src/types/realmsmith.ts`

## Current Domain Shape

The domain has ONE 2D town render surface: `TownPlanView.tsx`. In 3D a town
draws through the ground bake. Both read ONE canonical plan per (atlas, burg).

State and types are separate from the renderer and outlived it:
- `src/state/reducers/townReducer.ts`
- `src/types/town.ts`
- `src/types/realmsmith.ts`, still imported by `types/town.ts` and
  `src/utils/spatial/walkabilityUtils.ts`

The six orphaned RealmSmith generator files were deleted 2026-09-23 (ruling Q9,
Agora task `agora-e840.7`). Their names are under "Retired Names". Prose comments
in `src/systems/worldforge/props/placementEngine.ts`,
`src/systems/worldforge/town/farmCrops.ts` and
`src/systems/worldforge/town/population.ts` record behavior ported out of them
and mark each file "retired 2026-09-23". Do not read those comments as live
wiring.

## Retired Names

These names appear in the history sections above and in older docs. None of
them resolves in the worktree. Do not treat any of them as current:
- `Town/TownCanvas.tsx` - renderer, replaced by Worldforge
- `Town/VillageScene.tsx` - renderer, replaced by Worldforge
- `hooks/useTownController.ts` - controller hook, went with the renderer
- `src/services/RealmSmithTownGenerator.ts` - deleted 2026-09-14, `agora-e840.5`
- `src/services/RealmSmithAssetPainter.ts` - deleted 2026-09-14, `agora-e840.5`
- `src/services/realmsmith/` - deleted 2026-09-14, `agora-e840.5`
- `src/services/BuildingGenerator.ts` - deleted 2026-09-23, `agora-e840.7`
- `src/services/DoodadGenerator.ts` - deleted 2026-09-23, `agora-e840.7`
- `src/services/RoadGenerator.ts` - deleted 2026-09-23, `agora-e840.7`
- `src/services/TerrainGenerator.ts` - deleted 2026-09-23, `agora-e840.7`
- `src/data/realmsmithBiomes.ts` - deleted 2026-09-23, `agora-e840.7`
- `src/constants/realmsmith.ts` - deleted 2026-09-23, `agora-e840.7`

## Historical Drift Corrected

The older version of this file drifted in a few concrete ways:
- it claimed a lowercase `src/services/realmsmith/**/*.ts` ownership lane; that
  directory was deleted on 2026-09-14
- it described the renderer as TownCanvas plus AssetPainter; both are gone and the
  surface is `TownPlanView.tsx`
- it named `src/components/Trade/__tests__/MerchantModal.test.tsx` as absent. That
  file DOES exist in the worktree; the 2026-09-20 pass checked it. The "not present"
  claim was itself the drift.

That older explanation should not be treated as the current implementation guide.

## Boundaries And Constraints

- Town generation remains deterministic from seed and world-position inputs.
- Town navigation should continue to respect walkability and building collision.
- Town rendering, merchant entry, and NPC-click handling can live here without making the town domain the owner of all inventory, dialogue, or combat systems.
- Broader claims like town never triggers combat directly or exit points always return to the correct submap tile should be documented carefully unless they are explicitly verified in code.

## What Is Materially Implemented

This pass verified that the town-map domain has:
- a live Worldforge 2D town surface, `TownPlanView.tsx`
- a 3D town through the ground bake, from the same canonical plan
- a town reducer and a town type lane, both still live
- `src/types/realmsmith.ts`, kept because live modules still import it

Claims this pass could NOT verify, because the surfaces that carried them were
deleted: merchant-entry actions from town and village buildings, NPC and
ambient-life interaction hooks, and in-town pan, zoom and movement controls. The
Worldforge view does not present them. Treat them as open work, not as shipped.

## Verified Test Surface

Verified tests in this pass:
- src/components/Worldforge/__tests__/TownPlanView.test.tsx
- src/components/Worldforge/__tests__/TownAgentSnapshotView.test.tsx

The four tests this section used to name covered pan, dev controls, navigation
and the town controller hook. All four went with the renderer they tested. No
replacement covers pan or navigation today, because the Worldforge view does
not present those controls.
- src/services/__tests__/strongholdService.test.ts
- src/components/Trade/__tests__/MerchantModal.test.tsx

## Open Follow-Through Questions

- Which surface should carry in-town movement, pan and zoom now that the controller hook is gone?
- Where should building-interaction and merchant-entry rules be documented: here, or in the dialogue, trade, or inventory docs?
- What replaces the NPC and ambient-life interaction hooks that went with the old canvas?
