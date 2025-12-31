## 2024-05-24 - Dynamic Market Events **Learning:** Creating deterministic market events based on game time (epoch) provides a stable simulation without needing persistent state in the database. **Action:** Use `generateMarketEvents(gameTime.getTime())` to simulate economy shifts; verify the economy object exists before applying modifications to avoid runtime crashes.

## 2024-05-24 - Regional Pricing Architecture (TODO) **Learning:** The current pricing model relies solely on global scarcity/surplus, missing local nuance. A robust regional economy requires linking physical locations to economic zones. **Action:** Plan to implement the following architecture:

### 1. Data Structure Updates
- **Location Interface (`src/types/world.ts`):** Add optional `regionId: string` field.
- **Location Data (`src/data/world/locations.ts`):** Map existing locations to regional keys defined in `REGIONAL_ECONOMIES` (e.g., `region_capital`, `region_coast`).

### 2. Pricing Logic Refactor (`src/utils/economyUtils.ts`)
Update `calculatePrice` to accept an optional `regionId`.
Algorithm:
```typescript
const region = REGIONAL_ECONOMIES[regionId];
if (region) {
  // Supply: Local Exports are cheap (-20%)
  if (region.exports.includes(itemCategory)) {
     multiplier -= 0.2;
  }
  // Demand: Local Imports are expensive (+20%)
  if (region.imports.includes(itemCategory)) {
     multiplier += 0.2;
  }
}
```

### 3. Integration Points
- **MerchantModal:** Must pass `currentLocation.regionId` to `calculatePrice`.
- **Loot Generation:** Adjust value of loot based on where it is found (optional future scope).

### 4. Verification Strategy
- Test that 'Fish' costs less in `Coastal Cities` than `Iron Peaks`.
- Test that 'Iron' costs less in `Iron Peaks` than `Coastal Cities`.
## 2025-12-29 - Dynamic Pricing Implementation

**Context:** The economy system had trade route simulations generating 'scarcity' and 'surplus' events, but item prices were completely static and ignored these events.
**Options considered:**
- Option A: Create a complex specialized MarketSystem class.
- Option B: Enhance the existing utility functions in  to be pure functional transformations.
**Chosen:** Option B.
**Rationale:** Keeping the logic pure and functional in  makes it easier to test (as seen in ) and easier to integrate into existing UI components like  without refactoring the entire state management flow.

**Learning:** Mapping string tags (like 'food_drink' from ItemType) to trade tags (like 'food' or 'grain' in TradeRoutes) is a critical fragility. I implemented a  helper to do fuzzy matching, but a strict Enum mapping would be better long-term.

**Action:** Future refactors should strictly type  and align it 1:1 with  or a  field to prevent 'magic string' mismatches.
## 2025-12-29 - Dynamic Pricing Implementation

**Context:** The economy system had trade route simulations generating 'scarcity' and 'surplus' events, but item prices were completely static and ignored these events.
**Options considered:**
- Option A: Create a complex specialized MarketSystem class.
- Option B: Enhance the existing utility functions in `economyUtils.ts` to be pure functional transformations.
**Chosen:** Option B.
**Rationale:** Keeping the logic pure and functional in `economyUtils.ts` makes it easier to test (as seen in `DynamicPricing.test.ts`) and easier to integrate into existing UI components like `MerchantModal` without refactoring the entire state management flow.

**Learning:** Mapping string tags (like 'food_drink' from ItemType) to trade tags (like 'food' or 'grain' in TradeRoutes) is a critical fragility. I implemented a `getItemTradeTags` helper to do fuzzy matching, but a strict Enum mapping would be better long-term.

**Action:** Future refactors should strictly type `TradeGoodType` and align it 1:1 with `ItemType` or a `ItemCategory` field to prevent 'magic string' mismatches.
