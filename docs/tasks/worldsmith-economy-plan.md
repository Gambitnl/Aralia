# Worldsmith Task: Living Economy System

## Goal
Implement a dynamic economy where world events (e.g., droughts, surpluses) visibly impact market prices, making the world feel reactive and interconnected.

## 1. Refactor GameState
- [ ] Add `economy` to `GameState` in `src/types/index.ts`.
- [ ] Initialize `economy` in `src/state/appState.ts` with default values.
- [ ] Deprecate/Ignore `merchantModal.economy` (it was unused anyway).

## 2. Implement Economy Logic
- [ ] Create `src/utils/economyUtils.ts` to handle price calculations.
  - `calculatePrice(item: Item, economy: EconomyState, transactionType: 'buy' | 'sell'): number`
  - Logic: Check `economy.marketFactors.scarcity` (increase price) and `surplus` (decrease price) against item tags/types.
- [ ] Write tests for `economyUtils.ts`.

## 3. Update World Events
- [ ] Update `src/systems/world/WorldEventManager.ts`.
  - Modify `handleMarketShift` to actually update `GameState.economy`.
  - Define specific events (e.g., "Iron Shortage" adds 'weapon', 'armor' to scarcity).
  - Ensure events expire or cycle (handled by `processWorldEvents` logic or duration).

## 4. Connect UI
- [ ] Update `src/components/MerchantModal.tsx`.
  - Use `calculatePrice` from `economyUtils` for displaying prices and for the `buyItem`/`sellItem` actions.
  - Add visual indicators for price shifts (e.g., Green/Red arrows or text).

## 5. Verification
- [ ] Unit tests for `economyUtils`.
- [ ] Verify build passes.
- [ ] Verify UI shows modified prices during events.

## 6. Pre-commit
- [ ] Run `npm test`.
- [ ] Check for lint errors.
