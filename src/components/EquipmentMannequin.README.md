# EquipmentMannequin Component

## Purpose

The `EquipmentMannequin.tsx` component is responsible for rendering a visual representation of a character's equipment slots. It displays a layout resembling a humanoid figure where different types of equipment (headgear, armor, weapons, accessories) can be conceptually placed.

This component is primarily used within the `CharacterSheetModal.tsx` to show what a character has equipped or which slots are available.

## Key Features (Planned Updates)

*   **Dynamic Empty Slot Icons**: For empty slots, it will use the `DynamicMannequinSlotIcon` component. This allows the placeholder icon for armor slots (Head, Torso, Wrists, Feet) and the OffHand (Shield) slot to change based on the character's maximum armor proficiency (Unarmored, Light, Medium, Heavy).
*   **Proficiency Mismatch Warnings**: When an item is equipped, the component will check if the item's armor category exceeds the character's maximum proficiency.
    *   If a mismatch occurs (e.g., character has "Light" armor proficiency but equips "Heavy" armor, or is not proficient with "Shields" but equips one), the border of that specific slot will be highlighted (e.g., with a red border and ring) to visually indicate the issue.
    *   The tooltip for the slot will also describe the mismatch.

## Props

*   **`character: PlayerCharacter`**:
    *   **Type**: `PlayerCharacter` (from `src/types.ts`)
    *   **Purpose**: The character whose equipment slots are to be displayed.
    *   **Required**: Yes

*   **`onSlotClick?: (slot: EquipmentSlotType, item?: Item) => void`**:
    *   **Type**: Function (optional)
    *   **Purpose**: Callback for when an equipped slot is clicked (e.g., to unequip).
    *   **Required**: No

## Core Functionality (After Update)

1.  **Slot Definition**: Defines all standard equipment slots with labels, default icons (as fallbacks), and layout information.
2.  **Max Armor Proficiency**: Determines the character's max armor proficiency using `getCharacterMaxArmorProficiency` from `src/utils/characterUtils.ts`.
3.  **Displaying Slots**:
    *   **Empty Slots**: Uses `DynamicMannequinSlotIcon` to show proficiency-specific icons or fallbacks.
    *   **Equipped Slots**: Shows the item's icon or name. Checks for armor/shield proficiency mismatches and applies warning styles (e.g., red border) and updates tooltips if a mismatch is detected.
4.  **Tooltips**: Provides contextual information for each slot, including equipped item details, empty slot info, or proficiency warnings.

## SVG Icon Path Assumption
The `DynamicMannequinSlotIcon` (and by extension, this component) will assume proficiency-specific SVGs are located at paths like `/src/assets/icons/mannequin/[PROFICIENCY_LEVEL]/[SLOT_ID_LOWERCASE].svg`.
