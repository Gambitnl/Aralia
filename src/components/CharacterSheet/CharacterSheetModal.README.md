# CharacterSheetModal Component

## Purpose

The `CharacterSheetModal.tsx` component provides a modal dialog interface to display detailed information about a player character. It is designed to show character stats, skills, spells, an equipment mannequin, and an inventory with interaction options (the inventory part is now handled by the `InventoryList.tsx` component). This modal is typically opened when a player interacts with a character element in the `PartyPane`.

## Props

*   **`isOpen: boolean`**:
    *   **Type**: `boolean`
    *   **Purpose**: Controls the visibility of the modal. If `true`, the modal is displayed; otherwise, it's hidden.
    *   **Required**: Yes

*   **`character: PlayerCharacter | null`**:
    *   **Type**: `PlayerCharacter` object (from `src/types.ts`) or `null`.
    *   **Purpose**: The character data to be displayed in the sheet. If `null` (or if `isOpen` is `false`), the modal does not render.
    *   **Required**: Yes (when `isOpen` is true)

*   **`inventory: Item[]`**:
    *   **Type**: Array of `Item` objects.
    *   **Purpose**: The player's current inventory. This is passed to the `InventoryList` component.
    *   **Required**: Yes.

*   **`onClose: () => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function that is invoked when the modal requests to be closed (e.g., by clicking the "X" button, the "Close" button, or pressing the Escape key).
    *   **Required**: Yes

*   **`onAction: (action: Action) => void`**:
    *   **Type**: Function.
    *   **Purpose**: Callback to dispatch actions related to inventory items (Equip, Unequip, Use, Drop) or unequipping items from the mannequin. This is passed to `InventoryList` and used by `EquipmentMannequin` interaction.
    *   **Required**: Yes.

## Core Functionality

1.  **Modal Display**:
    *   Renders as a fixed-position overlay with a semi-transparent background, centering its content on the screen.
    *   The main modal content is displayed in a styled panel.

2.  **Content Sections**:
    *   **Header**: Displays the character's name and a close button ("X").
    *   **Main Content Area (Grid Layout)**:
        *   **Column 1 (Character Details)**: Displays core stats (Vitals, Ability Scores), skills, and selected class/racial features (Fighting Style, Divine Domain, Giant Ancestry, Fiendish Legacy).
        *   **Column 2 (Spells & Inventory)**:
            *   **Spells**: Lists known cantrips and spells with their levels and descriptions available via tooltips.
            *   **Inventory**: Renders the **`InventoryList.tsx`** component, passing `inventory`, `character`, and `onAction` props to it. The `InventoryList` component handles the display of items, tooltips, action buttons, and total inventory weight.
        *   **Column 3 (Equipment)**: Renders the `EquipmentMannequin.tsx` component, showing currently equipped items. Clicking an equipped item in the mannequin triggers an "Unequip" action via the `onAction` prop.
    *   **Footer**: Contains a "Close" button.

3.  **Closing Mechanism**:
    *   The modal can be closed via the "X" button, the "Close" button, or the `Escape` key. All trigger the `onClose` callback.

## State Management

The `CharacterSheetModal` is largely stateless regarding its content, receiving `character` and `inventory` data via props. Its visibility (`isOpen`) is also prop-controlled. It uses an internal `useEffect` hook for the Escape key listener.

## Data Dependencies

*   `src/types.ts`: For `PlayerCharacter`, `Item`, `EquipmentSlotType`, `Action` types.
*   `./EquipmentMannequin.tsx`: Renders the equipment display.
*   `./InventoryList.tsx`: Renders the inventory display.
*   `../utils/characterUtils.ts`: For `getAbilityModifierString`.
*   `../constants.ts`: For `RACES_DATA`, `SPELLS_DATA`, `GIANT_ANCESTRIES`, `TIEFLING_LEGACIES` to look up details for display.

## Styling

*   Uses Tailwind CSS for a consistent dark theme and layout.
*   The modal panel is designed for readability of dense character information.

## Accessibility
*   The modal has `aria-modal="true"` and `role="dialog"`.
*   The main title of the modal is linked via `aria-labelledby`.
*   Close buttons and interactive item buttons (within `InventoryList`) have appropriate `aria-label` attributes.
*   Tooltips are used to provide additional information accessibly.

## Future Enhancements
*   Full focus trapping and restoration for accessibility.
*   More detailed spell information display if needed.