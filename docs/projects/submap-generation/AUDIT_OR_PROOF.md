# Submap Generation Audit And Proof

Status: merged-reference
Last updated: 2026-06-09

## Proof Summary

- User clarification on 2026-06-09 routes Submap Generation evidence into the
  active Submap pre-deprecation extraction project. Assign through
  `docs/projects/submap/` G4, not this project as a separate lane.
- `src/features/SubmapGeneration` is currently a thin documentation surface
  rather than an executable feature module.
- The live generation contract is implemented in
  `src/hooks/useSubmapProceduralData.ts`.
- The main consumers of that contract are
  `src/components/Submap/SubmapPane.tsx` and `src/components/Minimap.tsx`.
- Visual layering is shared through `src/components/Submap/submapVisuals.ts`
  and the flattened grid helper in `src/components/Submap/useSubmapGrid.ts`.

## Contract Split

- Generation owner:
  - `src/hooks/useSubmapProceduralData.ts`
- Projection consumers:
  - `src/components/Submap/SubmapPane.tsx`
  - `src/components/Minimap.tsx`
- Visual projection helpers:
  - `src/components/Submap/submapVisuals.ts`
  - `src/components/Submap/useSubmapGrid.ts`

The hook owns the deterministic generation inputs and emits the shared output
contract. The consumers project that output into rendered tiles, tooltips, and
minimap pixels without taking over generation ownership.

## Contract Evidence

- Inputs:
  - `submapDimensions`
  - `currentWorldBiomeId`
  - `parentWorldMapCoords`
  - `worldSeed`
  - optional `seededFeaturesConfig`
  - optional `adjacentBiomeIds`
- Outputs:
  - `simpleHash`
  - `activeSeededFeatures`
  - `pathDetails`
  - `caGrid`
  - `wfcGrid`
  - `biomeBlendContext`
- Ordering:
  - CA takes precedence for cave and dungeon biomes.
  - WFC only runs when CA is absent and the biome family is supported.
  - Paths layer after terrain.
  - Seeded features layer after paths.
  - Scatter visuals layer last.

## Split Notes

- `biomeBlendContext` is available for consumers that provide
  `adjacentBiomeIds`.
- The current main consumer still treats adjacency as optional. Because Submap
  work is deprecated, this remains migration evidence rather than a follow-up
  implementation target.
- `src/features/SubmapGeneration` stays evidence-only; it should not be read as
  the executable owner of the contract.

## Iteration Note

This proof note exists so future cold-start agents do not have to reconstruct
the contract from chat history. It intentionally stays short and source-backed.
Forward implementation and extraction work must be assigned through
`docs/projects/submap/`.
