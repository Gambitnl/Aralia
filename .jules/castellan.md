## 2024-05-22 - Stronghold Resource Initialization
**Learning:** When adding new resource types (like `intel`) to `StrongholdResources`, ensure that:
1. The `createStronghold` factory initializes the value explicitly.
2. The `processDailyUpkeep` or any state modifier handles potential `undefined` values gracefully (`val || 0`) if legacy data might exist, though rigorous factory updates are preferred.
Failure to do so can lead to `NaN` propagation in resource calculations.

**Action:** Review all factory functions whenever a type interface is expanded.
