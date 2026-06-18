# Crafting UI Decisions

Status: active
Last updated: 2026-06-17

## Decision Log

### D-001: Shared Crafter Adapter Boundary

Date: 2026-06-09

Decision: Treat `src/components/Crafting/crafterAdapter.ts` as the Crafting UI
boundary for resolving the acting crafter from live party state.

Rationale:

- Gathering and creature harvest should not reintroduce local mock crafter
  derivation when source already has a shared adapter.
- Gathering can prefer the selected character from the open character sheet.
- Creature harvest remains anchored to the party lead until CombatView exposes a
  separate selector.

Follow-up: If combat needs a non-lead harvester, add an explicit selection prop
and proof rather than bypassing the adapter.

### D-002: Next Implementation Slice Scope — G2+G5

Date: 2026-06-17

Owner: Qoder CLI (T2 execution)

Decision point:
T2 asked to define the UI/systems boundary and what is in scope for the next
implementation slice.

Decision made:
The next implementation slice is **G2 (typing) + G5 (reducer proof)** taken as
a single pass. G3 was discovered already resolved in source. G4, G6, and G7 are
deferred as follow-ups.

Evidence discovered during T2 boundary scan:

- **G3 resolved**: `ExperimentPanel.tsx:185-194` dispatches `MODIFY_PARTY_HEALTH`
  with `{ amount: -result.damage.amount, characterIds: partyMemberIds }`. The
  reducer in `characterReducer.ts:192` handles it. Test in
  `ExperimentPanel.test.tsx:182-185` proves the dispatch.
- **G2 scope**: `UPDATE_CRAFTING_STATS` payload uses `quality: string` and
  `category: string` (actionTypes.ts:311). The reducer checks for `'ruined'`,
  `'masterwork'`, `'legendary'`. Callers dispatch `'standard'` and `'ruined'`.
  Recipe categories are already typed as
  `'potion' | 'oil' | 'poison' | 'bomb' | 'utility' | 'ink'` in
  alchemyRecipes.ts:28.
- **G5 scope**: No dedicated `craftingReducer.test.ts` exists. The reducer's
  quality/category branching is unverified.
- **G7 found**: `UPDATE_CRAFTING_STATS` is only dispatched from
  AlchemyBenchPanel. No other crafting panel dispatches stats updates.

Rationale for slice ordering:
- G2+G5 are tightly coupled: typing the action payload and testing the reducer
  branches belong in the same pass.
- G3 requires no action — it was resolved before the docs caught up.
- G4 (windowing), G6 (modularization), and G7 (stats dispatch coverage) are
  independent follow-ups that do not block the typing slice.

Follow-up:
- Implement `CraftingQuality` and `CraftingCategory` type unions in
  `types/crafting.ts`, update `actionTypes.ts`, add `craftingReducer.test.ts`.
- After G2+G5, evaluate whether G7 should be addressed (non-alchemy panels
  dispatching stats).
