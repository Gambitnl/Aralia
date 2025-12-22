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
