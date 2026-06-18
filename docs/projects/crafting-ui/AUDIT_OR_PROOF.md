# Crafting UI Audit Or Proof

Status: active
Last updated: 2026-06-17

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
- G3 was the next contract decision for the experiment damage path.

## G3 Resolution Proof (discovered 2026-06-17)

G3 was found already resolved in source during the T2 boundary scan.

### Evidence

- `src/components/Crafting/ExperimentPanel.tsx:185-194` dispatches `MODIFY_PARTY_HEALTH` with `{ amount: -result.damage.amount, characterIds: partyMemberIds }` when `result.damage` is truthy.
- `src/state/reducers/characterReducer.ts:192` handles `MODIFY_PARTY_HEALTH`, applying damage to specific characters (when IDs provided) or all party members.
- `src/state/actionTypes.ts:137` types `MODIFY_PARTY_HEALTH` payload as `{ amount: number; characterIds?: string[] }`.
- `src/components/Crafting/__tests__/ExperimentPanel.test.tsx:182-185` proves the dispatch: `type: 'MODIFY_PARTY_HEALTH', payload: { amount: -6, characterIds: ['party-lead', 'party-ally'] }`.

### Conclusion

The experiment damage contract is fully resolved. Explosion damage routes through the shared party-health reducer with test coverage. The docs gap was stale — source moved ahead of the documentation.

## T2 Boundary Scan Summary (2026-06-17)

| Area | Status | Evidence |
|---|---|---|
| Crafter adapter (G1) | resolved | crafterAdapter.ts + 3 test files |
| Experiment damage (G3) | resolved | ExperimentPanel.tsx:185-194 + test proof |
| Action typing (G2) | open | actionTypes.ts:311 uses `string` for quality/category |
| Reducer proof (G5) | open | No craftingReducer.test.ts exists |
| Stats dispatch coverage (G7) | open | Only AlchemyBenchPanel dispatches UPDATE_CRAFTING_STATS |
| Windowing pattern (G4) | follow-up | Only AlchemyBenchPanel uses WindowFrame |
| Modularization (G6) | follow-up | CMA-G13 routed |
