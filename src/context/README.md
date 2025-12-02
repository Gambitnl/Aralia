## Architecture & Design History

### Inversion of Logic: Shifting Complexity from Reducers to Action Handlers

The state management architecture follows a deliberate pattern where business logic is kept primarily within action handlers (e.g., `handleTakeItem`) rather than in the state reducers (`appReducer`). This represents an inversion of a more traditional Redux-like pattern.

**Traditional Pattern (Anti-Pattern in this codebase):**
1.  **Action Handler:** Dispatches a simple action with a minimal payload (e.g., `{ type: 'TAKE_ITEM', payload: { itemId: 'potion' } }`).
2.  **Reducer:** Contains all the complex business logic:
    *   Find the item definition.
    *   Update the player's inventory.
    *   Remove the item from the game world's location.
    *   Create a new discovery log entry.
    *   Calculate side effects.

**Current Pattern (Adopted):**
1.  **Action Handler:** Contains the rich business logic. It orchestrates the entire operation:
    *   Validates the action.
    *   Prepares all the data that needs to change (e.g., the `Item` to be added, the `DiscoveryEntry` to be created).
    *   Dispatches a single, descriptive action with a rich payload containing the pre-calculated state updates.
2.  **Reducer:** Becomes a pure function that simply applies the prepared state changes from the action's payload. It contains no business logic, making it highly predictable and easy to test.

This approach was chosen to improve **separation of concerns** and **maintainability**. Action handlers are the appropriate place for orchestrating complex operations and side effects, while reducers are dedicated to the single responsibility of applying state changes immutably.
