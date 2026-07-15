# InteriorPlan lossy-view consumer audit (Agora abeb9634, 2026-07-14)

Blindspot #5 follow-up. Question: which consumers still read the legacy lossy
`InteriorPlan` instead of `blueprintForPlot`, and does the loss bite?

## Headline

No live bug exists today. The production 3D path reads the rich blueprint for
every lossy aspect. The lossy adapter survives only in dead code and tests.

- The collapse site is `src/systems/worldforge/interior/generateInterior.ts:274-319`
  (L-rooms → bboxes at :164-171; windows/wall edges dropped at :189-194;
  basements excluded at :297-314). Its own doc-comment declares all three losses.
- The live bake path (`groundChunkLoader.ts:1504 → interiorParts.ts:289`)
  unconditionally computes `blueprintForPlot` (:314). The legacy
  bbox/fake-window/no-basement branch (`interiorParts.ts:774-960,1155-1161`) is
  reachable only by passing `precomputedPlan` without `precomputedBlueprint`,
  which no production caller does (only a synthetic test plan).

## Consumers (11 total: 2 production, 9 tests)

| Consumer | Verdict | Why |
|---|---|---|
| `roster/generateTownRoster.ts:145-160` (bedroom counts) | KEEP | collapse preserves room count/role 1:1; bedrooms never in basements — capacity math equals the blueprint's |
| `bridge/interiorParts.ts` legacy `else` branch | NEEDS-DECISION | dead in production; ~120 lines of lossy code + the adapter could retire (see follow-up task) |
| `bridge/groundChunkLoader.ts` | KEEP | consumes bridge output, downstream of the blueprint path |
| 9 test files (generateInterior, interiorBuild, interiorParts, roster x2, groundDeltas, pipeline, memo) | KEEP | they lock the collapse/fallback behavior; retire alongside the adapter |

Already migrated (reference implementations): `bridge/buildingOccupancy.ts`
(handles level -1), `world3d/buildingModels.ts`, `world3d/buildingSceneModel.ts`,
`PreviewBlueprint.tsx`.

## Follow-up posted to the board

Retire the dead legacy branch in `interiorParts.ts` + the `generateInterior`
adapter, sourcing envelope/storeys from the blueprint. Pure cleanup, no player-
visible change; `buildingOccupancy.ts` is the pattern to copy. Posted as an open
Agora task referencing this report.
