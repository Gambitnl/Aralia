# Crafting UI Runbook

Status: active
Last updated: 2026-06-17

## Before Editing

1. Read `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and `AUDIT_OR_PROOF.md`.
2. Confirm whether the next slice is G2+G5 (typing + reducer proof).
3. Keep Crafting UI changes scoped to panel, adapter, and action-boundary work.

## Current Safe Resume Path

Start with G2+G5: tighten `UPDATE_CRAFTING_STATS` payload typing and add
`craftingReducer.test.ts`.

After G2+G5, evaluate G7 (stats dispatch coverage for non-alchemy panels).
G4 and G6 remain follow-up work.

## Verification

For shared-crafter changes, run:

`npm run test -- --run src/components/Crafting/__tests__/craftingCrafterAdapter.test.ts src/components/Crafting/__tests__/GatheringPanel.test.tsx src/components/Crafting/__tests__/CreatureHarvestPanel.test.tsx`

For G2+G5 typing and reducer changes, run:

`npm run typecheck`
`npm run test -- --run src/state/reducers/__tests__/craftingReducer.test.ts`

For experiment damage regression, run:

`npm run test -- --run src/components/Crafting/__tests__/ExperimentPanel.test.tsx`
