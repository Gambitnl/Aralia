# Crafting UI Runbook

Status: active
Last updated: 2026-06-09

## Before Editing

1. Read `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and `AUDIT_OR_PROOF.md`.
2. Confirm whether the next slice is G3 or G2.
3. Keep Crafting UI changes scoped to panel, adapter, and action-boundary work.

## Current Safe Resume Path

Start with G3: resolve the experimental damage handling contract for
`src/components/Crafting/ExperimentPanel.tsx`.

Use G2 after that if the action-typing slice is still needed.

## Verification

For shared-crafter changes, run:

`npm run test -- --run src/components/Crafting/__tests__/craftingCrafterAdapter.test.ts src/components/Crafting/__tests__/GatheringPanel.test.tsx src/components/Crafting/__tests__/CreatureHarvestPanel.test.tsx`

For action typing or reducer-boundary changes, add or name a reducer-focused
proof row before claiming G2 is complete.
