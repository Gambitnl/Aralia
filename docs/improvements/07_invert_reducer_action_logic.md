
- [x] Plan Completed

# Plan: Invert Logic for Complex Reducer Actions

## 1. Purpose

The goal of this improvement is to refactor the application's state management pattern for complex actions to improve separation of concerns. Currently, some action handlers (e.g., in `useGameActions.ts`) perform minimal logic and dispatch a simple action type (like `TAKE_ITEM`), leaving the complex business logic (updating inventory, updating location state, creating a discovery log entry) to be handled inside the root reducer (`appReducer`).

This plan will invert that pattern: the action handler will contain the business logic and prepare a detailed payload, while the reducer's role will be simplified to applying a pure state update based on that payload.

## 2. Key Rules

-   All plans will be written in a checklist format.
-   All phases of the plan will be detailed, including envisioned file/folder structures and general code direction.
-   When code is envisioned, it will be heavily accompanied by comments explaining its function and dependencies.

---

## 3. Implementation Plan

We will use the `TAKE_ITEM` action as the primary example for this refactor.

### Phase 1: Redefine the Action and Payload

-   [x] **Modify Action Types**: `src/state/actionTypes.ts`
-   **Code Direction**: The action type will be renamed to be more descriptive of its effect on the state. The payload will now contain all the pre-calculated results of the business logic.
    ```typescript
    // src/state/actionTypes.ts

    // Define the rich payload that the handler will prepare.
    export interface TakeItemUpdatePayload {
      itemToAdd: Item;
      locationId: string;
      newDiscoveryEntry: DiscoveryEntry;
    }

    export type AppAction =
      // ... other actions
      // | { type: 'TAKE_ITEM'; payload: { item: Item; locationId: string } } // <--- DEPRECATED
      | { type: 'APPLY_TAKE_ITEM_UPDATE'; payload: TakeItemUpdatePayload } // <--- NEW
      // ... other actions
    ```

### Phase 2: Relocate Business Logic to the Action Handler

-   [x] **Modify Action Handler**: `src/hooks/actions/handleItemInteraction.ts`
-   **Code Direction**: The `handleTakeItem` function will now be responsible for all the logic that was previously in the reducer.
    ```typescript
    // src/hooks/actions/handleItemInteraction.ts
    /**
     * Handles the 'take_item' action. This function now contains the business logic
     * to validate the action, create a discovery log entry, and prepare a payload
     * for the reducer to apply.
     *
     * DEPENDS ON:
     * - ../../types (for Action, Item, DiscoveryEntry, etc.)
     * - ../../constants (for ITEMS, LOCATIONS)
     * - Global gameState (for gameTime, currentLocationId)
     *
     * DISPATCHES:
     * - 'APPLY_TAKE_ITEM_UPDATE' action with a rich payload.
     */
    export async function handleTakeItem({
      action,
      gameState,
      dispatch,
      addMessage, // Still used for player-facing messages
    }: HandleTakeItemProps): Promise<void> {
      // 1. Validation (remains the same)
      if (!action.targetId) { /* ... error handling ... */ return; }
      const itemToTake = ITEMS[action.targetId];
      // ... other validation ...

      // 2. Business Logic (MOVED FROM REDUCER)
      // Create the new discovery entry that will be added to the log.
      const newDiscoveryEntry: DiscoveryEntry = {
          id: crypto.randomUUID(), // Generate ID here
          gameTime: gameState.gameTime.toLocaleTimeString(/* ... */),
          type: DiscoveryType.ITEM_ACQUISITION,
          title: `Item Acquired: ${itemToTake.name}`,
          content: `You found and picked up ${itemToTake.name}. ${itemToTake.description}`,
          source: { type: 'LOCATION', id: gameState.currentLocationId, name: LOCATIONS[gameState.currentLocationId]?.name },
          flags: [{ key: 'itemId', value: itemToTake.id, label: itemToTake.name }],
          // timestamp and isRead will be set by the logReducer
      };

      // 3. Prepare the Payload
      const updatePayload: TakeItemUpdatePayload = {
          itemToAdd: itemToTake,
          locationId: gameState.currentLocationId,
          newDiscoveryEntry: newDiscoveryEntry,
      };

      // 4. Dispatch the new, descriptive action with the rich payload.
      dispatch({ type: 'APPLY_TAKE_ITEM_UPDATE', payload: updatePayload });

      // The action handler can still be responsible for the immediate player feedback.
      addMessage(`You take the ${itemToTake.name}.`, 'system');

      // Reset other contexts as before
      dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
      // ...
    }
    ```

### Phase 3: Simplify the Reducer

-   [x] **Modify Reducers**: `src/state/reducers/characterReducer.ts` and `src/state/reducers/logReducer.ts` (or wherever the logic is split).
-   **Code Direction**: The reducer's job becomes much simpler. It no longer contains business logic; it only applies the state changes described in the payload.
    ```typescript
    // src/state/reducers/characterReducer.ts & worldReducer.ts (or wherever state is managed)

    // The reducer for the 'APPLY_TAKE_ITEM_UPDATE' action
    case 'APPLY_TAKE_ITEM_UPDATE': {
      const { itemToAdd, locationId, newDiscoveryEntry } = action.payload;

      // --- PURE STATE UPDATE - NO LOGIC, JUST APPLICATION ---

      // 1. Update Inventory (in characterReducer)
      const inventoryUpdate = {
          inventory: [...state.inventory, itemToAdd],
      };

      // 2. Update Location's Items (in worldReducer)
      const worldUpdate = {
          dynamicLocationItemIds: {
              ...state.dynamicLocationItemIds,
              [locationId]: state.dynamicLocationItemIds[locationId]?.filter(id => id !== itemToAdd.id) || [],
          },
      };
      
      // 3. Update Discovery Log (in logReducer)
      const logUpdate = {
          discoveryLog: [newDiscoveryEntry, ...state.discoveryLog],
          unreadDiscoveryCount: state.unreadDiscoveryCount + 1,
      };

      // The root reducer will combine these partial state updates.
      // This example shows how the logic is now just about applying pre-calculated data.
      return { ...inventoryUpdate, ...worldUpdate, ...logUpdate };
    }
    ```

### Phase 4: Verification and Further Refactoring

-   [x] **Test**: Thoroughly test the "Take Item" functionality to ensure inventory, location items, and the discovery log all update correctly.
-   [ ] **Identify Other Candidates**: Review `appReducer` for other complex action cases (e.g., complex spell effects, quest updates) that could benefit from the same inversion pattern and apply this refactor to them.
