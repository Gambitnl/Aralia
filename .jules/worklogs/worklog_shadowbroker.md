## 2025-12-29 - Decision: Reuse SELL_ITEM for Fence Mechanics

**Context:** Implementing the "Fence" service for the Thieves Guild, allowing players to sell items at a markdown.
**Options considered:**
- Option A: Create a new `FENCE_ITEM` action in `crimeReducer`. This would keep crime logic separate but duplicate the inventory removal logic.
- Option B: Reuse `SELL_ITEM` action in `characterReducer`. This action already accepts an `itemId` and a `value` (price).
**Chosen:** Option B.
**Rationale:** The `SELL_ITEM` reducer logic is robust and exactly what we need (remove item, add gold). By calculating the "fenced price" in the UI layer (`FenceInterface`) and passing it as the `value` payload, we avoid code duplication and reduce the surface area for bugs. The "crime" aspect is the access to the interface and the price calculation, not the transaction itself.
