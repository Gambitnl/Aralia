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
*   **`type: 'weapon' | 'consumable' | 'key' | 'treasure' | 'note' | 'armor' | 'accessory'`**: The category or type of the item.
*   **`icon?: string`**: Optional. An emoji or simple SVG path data string for displaying a visual icon for the item in the UI.
    *   Example: `"🗡️"` for a sword, `"🧪"` for a potion.
*   **`slot?: EquipmentSlotType`**: Optional. If the item is equippable, this indicates the slot it occupies (e.g., 'MainHand', 'Torso').
*   **`effect?: string`**: An optional string describing the item's effect if used or equipped.
    *   Example: `"heal_25"` for Healing Potion.
*   **Armor-Specific Properties** (e.g., `armorCategory`, `baseArmorClass`, `addsDexterityModifier`, `maxDexterityBonus`, `strengthRequirement`, `stealthDisadvantage`, `armorClassBonus`): Refer to `src/types.ts` for details.
*   **Weapon-Specific Properties** (e.g., `damageDice`, `damageType`, `properties`, `isMartial`): Refer to `src/types.ts` for details.
*   **`donTime?: string`**: Optional. Time to put on armor.
*   **`doffTime?: string`**: Optional. Time to take off armor.
*   **`weight?: number`**: Optional. Weight of the item in pounds.
*   **`cost?: string`**: Optional. Cost of the item, typically in GP.


## Example Entry

```typescript
// From src/data/items/index.ts
export const ITEMS: Record<string, Item> = {
  'rusty_sword': {
    id: 'rusty_sword',
    name: 'Rusty Sword',
    icon: '🗡️',
    description: 'An old, pitted sword. It has seen better days.',
    type: 'weapon',
    slot: 'MainHand',
    damageDice: "1d6",
    damageType: "Slashing",
    weight: 2,
    cost: "10 GP"
  },
  'healing_potion': {
    id: 'healing_potion',
    name: 'Healing Potion',
    icon: '🧪',
    description: 'A vial of glowing red liquid. Looks restorative.',
    type: 'consumable',
    effect: 'heal_25',
    weight: 0.5,
    cost: "50 GP"
  },
  // ... more items
};
```

## Usage

*   **`src/constants.ts`**: Imports and re-exports `ITEMS` for global access.
*   **`src/data/world/locations.ts`**: `Location` objects can reference item IDs in their `itemIds` array.
*   **`App.tsx`**: Manages player inventory and interacts with `ITEMS` data for actions.
*   **`CharacterSheetModal.tsx`**: Displays inventory items with their icons, names, and tooltips (including weight and cost).
*   **`ActionPane.tsx`**: Lists items available in the current location.

## Adding a New Item

1.  Define a new entry in the `ITEMS` object in `src/data/items/index.ts`.
2.  Provide `id`, `name`, `description`, `type`.
3.  Optionally, add `icon`, `slot`, `effect`, weight, cost, and other type-specific properties.
4.  To place the item in the game world, add its `id` to the `itemIds` array of one or more `Location` objects.