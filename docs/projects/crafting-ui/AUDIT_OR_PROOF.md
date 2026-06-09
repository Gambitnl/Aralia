# Crafting UI Audit Or Proof

Status: active
Last updated: 2026-06-09

## G1 Proof Note

The shared crafter boundary for Crafting UI is now explicit in source and in the project docs.

### Evidence

- `src/components/Crafting/crafterAdapter.ts` resolves the acting crafter from live party state instead of fabricating a local mock.
- `src/components/Crafting/GatheringPanel.tsx` uses the shared adapter and prefers the selected character from the open character sheet when one is present.
- `src/components/Crafting/CreatureHarvestPanel.tsx` uses the same shared adapter and stays on the current party lead until CombatView exposes a separate selector.
- Focused regression coverage exists in:
  - `src/components/Crafting/__tests__/craftingCrafterAdapter.test.ts`
  - `src/components/Crafting/__tests__/GatheringPanel.test.tsx`
  - `src/components/Crafting/__tests__/CreatureHarvestPanel.test.tsx`

### Verification

- `npm run test -- --run src/components/Crafting/__tests__/craftingCrafterAdapter.test.ts src/components/Crafting/__tests__/GatheringPanel.test.tsx src/components/Crafting/__tests__/CreatureHarvestPanel.test.tsx`

Local re-run result: 3 files passed, 6 tests passed on 2026-06-09.

### Notes

- G1 is now closed in `docs/projects/crafting-ui/GAPS.md`.
- G3 remains the next contract decision for the experiment damage path.
