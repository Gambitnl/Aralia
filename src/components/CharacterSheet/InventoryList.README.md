# InventoryList Component

## Purpose

The `InventoryList.tsx` component is responsible for rendering the player's inventory within the `CharacterSheetModal`. It displays a list of items, provides detailed tooltips for each item (including description, type, slot, weight, cost, and type-specific properties like armor stats or weapon damage), and offers context-sensitive action buttons (Use, Equip, Drop). It also calculates and displays the total weight of all items in the inventory.

This component was extracted from `CharacterSheetModal.tsx` to improve modularity and separation of concerns.

## Props

*   **`inventory: Item[]`**:
    *   **Type**: Array of `Item` objects (from `src/types.ts`).
    *   **Purpose**: The list of items currently in the player's inventory to be displayed.
    *   **Required**: Yes.

*   **`character: PlayerCharacter`**:
    *   **Type**: `PlayerCharacter` object (from `src/types.ts`).
    *   **Purpose**: The player character object. This is primarily used by the `checkCanEquipItem` utility to determine if the "Equip" button for an item should be enabled (based on proficiencies, strength requirements, etc.).
    *   **Required**: Yes.

*   **`onAction: (action: Action) => void`**:
    *   **Type**: Function, where `Action` is from `src/types.ts`.
    *   **Purpose**: A callback function invoked when an item action button (Use, Equip, Drop) is clicked. It passes an `Action` object describing the intended interaction (e.g., `{ type: 'EQUIP_ITEM', payload: { itemId: 'some_item_id' } }`).
    *   **Required**: Yes.

## Core Functionality

1.  **Total Inventory Weight Calculation**:
    *   Uses a `useMemo` hook to calculate the sum of the `weight` property of all items in the `inventory` array. Displays this as "Total Weight: X.XX lbs".

2.  **Item List Rendering**:
    *   If the inventory is empty, it displays an "Inventory is empty." message.
    *   Otherwise, it maps over the `inventory` array to render each item as a list item (`<li>`).
    *   Each item display includes:
        *   **Icon**: If `item.icon` is defined, an emoji or SVG icon is shown.
        *   **Name**: The item's name, wrapped in a `Tooltip` component.
        *   **Tooltip Content (`getItemTooltipContent`)**: A helper function formats a detailed string for the tooltip, including:
            *   Description, Type, Slot.
            *   Armor-specific details: Category, Base AC, AC Bonus, Strength Requirement, Stealth Disadvantage, Dexterity Modifier applicability.
            *   Weapon-specific details: Damage, Damage Type, Properties.
            *   Consumable effect.
            *   Weight and Cost.
        *   **Action Buttons**:
            *   **Use**: Shown for 'consumable' items. Triggers `onAction` with `type: 'USE_ITEM'`.
            *   **Equip**: Shown for 'armor' or 'weapon' items that have a `slot`.
                *   Its `disabled` state is determined by `checkCanEquipItem(character, item)`.
                *   The tooltip for the "Equip" button shows "Equip [Item Name]" if enabled, or the reason why it cannot be equipped (e.g., "Not proficient", "Requires X Strength") if disabled.
                *   Triggers `onAction` with `type: 'EQUIP_ITEM'`.
            *   **Drop**: Shown for all items. Triggers `onAction` with `type: 'DROP_ITEM'`.

3.  **Styling and Layout**:
    *   Uses Tailwind CSS for styling.
    *   The inventory list is scrollable (`max-h-60 overflow-y-auto scrollable-content`) if it exceeds a certain height.
    *   Items are displayed clearly with icons, names, and action buttons.

## Data Dependencies

*   `src/types.ts`: For `PlayerCharacter`, `Item`, and `Action` types.
*   `../utils/characterUtils.ts`: For the `checkCanEquipItem` utility function.
*   `./Tooltip.tsx`: For displaying detailed item information.

## Usage

This component is intended to be used within `CharacterSheetModal.tsx`:

```tsx
// Inside CharacterSheetModal.tsx
import InventoryList from './InventoryList';

// ...
<InventoryList 
  inventory={props.inventory}
  character={props.character}
  onAction={props.onAction}
/>
// ...
```

This ensures that the `CharacterSheetModal` remains focused on its overall layout and character stat display, while `InventoryList` handles the specifics of the inventory section.