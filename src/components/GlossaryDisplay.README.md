
# GlossaryDisplay Component

## Purpose

The `GlossaryDisplay.tsx` component is a reusable UI element responsible for rendering a list of icons and their meanings. It's designed to be used as a legend or glossary for visual elements within the game, such as map icons or submap features.

## Props

*   **`items: GlossaryItem[]`**:
    *   **Type**: Array of `GlossaryItem` objects (from `src/types.ts`).
    *   **Purpose**: An array of items to be displayed in the glossary. Each `GlossaryItem` should contain an `icon` (string, typically an emoji) and its `meaning` (string). It can also have an optional `category`.
    *   **Required**: Yes. If empty or not provided, the component renders `null`.

*   **`title?: string`**:
    *   **Type**: `string` (optional)
    *   **Purpose**: A title to be displayed at the top of the glossary section.
    *   **Default**: `"Icon Glossary"`

## Core Functionality

1.  **Deduplication**: Before rendering, the component filters the `items` prop to ensure that each icon is listed only once, even if it appears multiple times in the input array with the same meaning. This prevents redundant entries in the legend.
2.  **Rendering**:
    *   If `items` is empty after deduplication, the component renders nothing (`null`).
    *   Otherwise, it displays the provided `title`.
    *   It then maps over the unique `GlossaryItem`s and renders each one as a list item (`<li>`).
    *   Each list item shows the `icon` followed by its `meaning`.

## Styling

*   Uses Tailwind CSS for styling.
*   The glossary is presented in a styled container (`bg-gray-700 bg-opacity-80 p-3 rounded-md shadow-lg border border-gray-600`).
*   The title is styled distinctly (`text-sm font-semibold text-amber-300`).
*   List items are formatted with the icon slightly larger and to the left of its meaning.

## Usage

This component is used by:
*   **`MapPane.tsx`**: To display a legend for world map icons (biomes, player location, undiscovered areas).
*   **`SubmapPane.tsx`**: To display a legend for submap feature icons within a modal.

Example:
```tsx
import GlossaryDisplay from './GlossaryDisplay';
import { GlossaryItem } from '../types';

const mapLegendItems: GlossaryItem[] = [
  { icon: '🌲', meaning: 'Forest Biome' },
  { icon: '📍', meaning: 'Your Current Location' },
  // ... other items
];

// In another component's render method:
<GlossaryDisplay items={mapLegendItems} title="Map Legend" />
```

## Data Dependencies

*   `src/types.ts`: For the `GlossaryItem` type definition.

## Accessibility

*   The title provides context for the list.
*   Content is structured as an unordered list (`<ul>`, `<li>`) for semantic correctness.
*   Icons typically rely on their associated text meaning for accessibility, as they are decorative.

## Future Considerations

*   Allow grouping items by `category` if provided in `GlossaryItem`.
*   More sophisticated styling options if needed.
