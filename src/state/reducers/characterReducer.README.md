
# Character Slice Reducer (`characterReducer.ts`)

## Purpose

The `characterReducer.ts` module contains a "slice" reducer that is responsible for managing all state changes directly related to the player characters. This includes the party composition, inventory, equipment, and character resources like spell slots and limited-use abilities.

## Core Functionality

The `characterReducer` function takes the full `GameState` and an `AppAction` as input and returns a `Partial<GameState>` containing only the fields it has modified.

It handles actions related to:
*   **Party Management**:
    *   `SET_PARTY_COMPOSITION`: Updates the main `party` array based on changes made in the `PartyEditorModal`.
*   **Item & Inventory Management**:
    *   `EQUIP_ITEM`: Moves an item from inventory to a character's `equippedItems` and recalculates derived stats like Armor Class.
    *   `UNEQUIP_ITEM`: Moves an item from `equippedItems` back to the main inventory and recalculates stats.
    *   `DROP_ITEM`: Removes an item from inventory and adds it to the current location's item list.
    *   `USE_ITEM`: Handles the effect of using a consumable item (e.g., healing) and removes it from inventory.
*   **Resource Management**:
    *   `CAST_SPELL`: Decrements the appropriate spell slot for a character.
    *   `USE_LIMITED_ABILITY`: Decrements the uses of a character's special ability (e.g., Second Wind).
    *   `TOGGLE_PREPARED_SPELL`: Edits a saved preparation plan using verified spell levels; active spells stay unchanged until an eligible long rest. Reset discards only the plan.
    *   `SHORT_REST`: Restores short-rest abilities, applies Hit Dice healing, and updates Hit Dice pools.
    *   `LONG_REST`: Applies eligible recovery and valid spell plans, preserving denied/downed members. Hit Dice recovery follows the campaign edition. See `docs/architecture/domains/rest-and-recovery.md` for provisions, cooldown and paid-bed permission.

### Helper Logic
The reducer uses utility functions from `src/utils/characterUtils.ts` (like `calculateArmorClass`) to correctly update derived character stats whenever equipment changes.

## Usage

This reducer is imported and used by the root reducer in `src/state/appState.ts`. It is not intended to be used directly by components.
