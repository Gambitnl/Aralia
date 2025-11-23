# DynamicMannequinSlotIcon Component

## Purpose

The `DynamicMannequinSlotIcon.tsx` component is responsible for dynamically loading and displaying an SVG icon for an empty equipment slot on the character mannequin. The specific icon displayed depends on the character's maximum armor proficiency level (Unarmored, Light, Medium, Heavy) and the type of equipment slot (e.g., Head, Torso).

If a proficiency-specific SVG icon cannot be found at the expected file path, this component gracefully falls back to rendering a default placeholder icon provided via props.

## Props

*   **`characterProficiency: ArmorProficiencyLevel`**:
    *   **Type**: `'unarmored' | 'light' | 'medium' | 'heavy'` (from `src/types.ts`)
    *   **Purpose**: The character's derived maximum armor proficiency. Used to construct the path to the appropriate SVG icon.
    *   **Required**: Yes

*   **`slotType: EquipmentSlotType`**:
    *   **Type**: `EquipmentSlotType` (e.g., 'Head', 'Torso', 'Feet', from `src/types.ts`)
    *   **Purpose**: The type of the equipment slot for which the icon is being displayed. Used to construct the path to the SVG icon.
    *   **Required**: Yes

*   **`fallbackIcon: JSX.Element`**:
    *   **Type**: `JSX.Element`
    *   **Purpose**: The React element to render if the proficiency-specific SVG icon cannot be loaded. This is typically the original default static icon for that slot type (e.g., `<HeadIcon />`).
    *   **Required**: Yes

## Core Functionality

1.  **SVG Path Construction**:
    *   Constructs a path like `/src/assets/icons/mannequin/[PROFICIENCY_LEVEL_LOWERCASE]/[SLOT_ID_LOWERCASE].svg`.
    *   *Note*: These paths must be correctly handled by the build system/dev server.

2.  **SVG Rendering**:
    *   Uses an `<img>` tag to render the SVG.

3.  **Error Handling & Fallback**:
    *   If the `<img>` tag's `onError` event fires, it renders the `fallbackIcon`.

## Styling

*   The `<img>` tag and the `fallbackIcon` are styled with `className="w-full h-full object-contain"` for consistent scaling.

## Usage

Used by `EquipmentMannequin.tsx` for empty slots.
```tsx
// Example:
// <DynamicMannequinSlotIcon
//   characterProficiency={'medium'}
//   slotType={'Head'}
//   fallbackIcon={<HeadIcon />}
// />
```

## Dependencies
*   `src/types.ts`: For `ArmorProficiencyLevel` and `EquipmentSlotType`.
