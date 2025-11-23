
# Items Data (`src/data/items/index.ts`)

## Purpose

The `src/data/items/index.ts` file defines all the item data for the Aralia RPG. This includes weapons, consumables, quest items, treasures, notes, and any other interactable objects players can find or acquire. This data is used for populating locations, managing player inventory, and potentially for item interaction mechanics.

## Structure

The file exports a single constant:

*   **`ITEMS: Record<string, Item>`**
    *   This is an object where each key is a unique string identifier for an item (e.g., `'rusty_sword'`, `'healing_potion'`). This ID is used internally to reference the item.
    *   The value for each key is an `Item` object, defined in `src/types.ts`.

### `Item` Object Properties

Each `Item` object has the following properties:

*   **`id: string`**: The unique identifier for the item (should match the key in the `ITEMS` record).
    *   Example: `"rusty_sword"`
*   **`name: string`**: The display name of the item.
    *   Example: `"Rusty Sword"`
*   **`description: string`**: A textual description of the item.
    *   Example: `"An old, pitted sword. It has seen better days."`
*   **`type: 'weapon' | 'consumable' | 'key' | 'treasure' | 'note'`**: The category or type of the item. This helps in organizing items and can be used for specific game logic (e.g., how a 'consumable' is used versus a 'weapon').
    *   Example: `"weapon"` for Rusty Sword, `"consumable"` for Healing Potion.
*   **`effect?: string`**: An optional string describing the item's effect if used or equipped. This is currently a simple string but could be expanded into a more structured format for complex effects.
    *   Example: `"heal_25"` for Healing Potion.

## Example Entry

```typescript
// From src/data/items/index.ts
export const ITEMS: Record<string, Item> = {
  'rusty_sword': {
    id: 'rusty_sword',
    name: 'Rusty Sword',
    description: 'An old, pitted sword. It has seen better days.',
    type: 'weapon'
  },
  'healing_potion': {
    id: 'healing_potion',
    name: 'Healing Potion',
    description: 'A vial of glowing red liquid. Looks restorative.',
    type: 'consumable',
    effect: 'heal_25' // Example effect
  },
  // ... more items
};
```

## Usage

*   **`src/constants.ts`**:
    *   Imports and re-exports `ITEMS` for global access.
    *   `LOCATIONS` data in `src/constants.ts` references item IDs in their `itemIds` array to specify which items can be found in a particular location.
*   **`App.tsx`**:
    *   Uses `ITEMS` to get full item details when displaying items in a location (`itemsInCurrentLocation` in `ActionPane`) or in the player's inventory (`PlayerPane`).
    *   The `take_item` action in `processAction` uses `ITEMS` to add the correct item object to the player's inventory.
*   **`PlayerPane.tsx`**: Displays items from the player's inventory, showing their name and description.
*   **`ActionPane.tsx`**: Displays items available to be taken from the current location.

## Adding a New Item

1.  Define a new entry in the `ITEMS` object in `src/data/items/index.ts`.
2.  Ensure the `id` is unique and follows a consistent naming convention (e.g., lowercase with underscores).
3.  Provide the `name`, `description`, and `type`.
4.  Optionally, add an `effect` string if applicable.
5.  To place the item in the game world, add its `id` to the `itemIds` array of one or more `Location` objects in `src/constants.ts` (or wherever `LOCATIONS` data is managed).
