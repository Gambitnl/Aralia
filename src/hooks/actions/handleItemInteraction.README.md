
# Item Interaction Handlers (`handleItemInteraction.ts`)

## Purpose

The `handleItemInteraction.ts` module contains a suite of functions for processing all player actions related to inventory and world items.

## Functions

### `handleTakeItem(props: HandleTakeItemProps): Promise<void>`

*   **Purpose**: Manages the `take_item` action.
*   **Logic**:
    1.  Validates that the `targetId` corresponds to a real item defined in `ITEMS`.
    2.  Checks that the item is present in the current location's dynamic item list (`gameState.dynamicLocationItemIds`).
    3.  If valid, it dispatches a `TAKE_ITEM` action. The reducer is responsible for moving the item from the location to the player's inventory and adding a discovery log entry.
    4.  This handler is `async` to maintain a consistent structure with other action handlers, even though its own logic is synchronous before the dispatch.

### `handleEquipItem(dispatch, payload): void`
### `handleUnequipItem(dispatch, payload): void`
### `handleUseItem(dispatch, payload): void`
### `handleDropItem(dispatch, payload): void`

*   **Purpose**: These are simple, synchronous "pass-through" functions. They exist to keep the action-handling logic organized and consistent within the modular structure.
*   **Logic**: Each function takes the `dispatch` function and a specific `payload` (e.g., `EquipItemPayload`). It immediately dispatches the corresponding action type (`EQUIP_ITEM`, `UNEQUIP_ITEM`, etc.) with the received payload. All complex logic for these actions (e.g., modifying character stats for equipment, consuming an item, updating inventory) is handled directly and synchronously within `appReducer`.

## Design Philosophy

This module separates the asynchronous, potentially complex logic of `take_item` (which could involve checks or AI interactions in the future) from the synchronous, deterministic state changes of equipping, using, or dropping items that are already in the player's possession.

## Dependencies
*   `../constants.ts`: For `ITEMS` data.
*   `actionHandlerTypes.ts`: For shared function signature types.
