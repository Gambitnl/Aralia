# Glossary Component

## Purpose

The `Glossary.tsx` component displays an extensive, expandable D&D Basic Rules glossary within a modal overlay. It allows players to browse and reference game rules, terms, monster information, and character creation details directly within the application.

## Props

*   **`isOpen: boolean`**:
    *   **Type**: `boolean`
    *   **Purpose**: Controls the visibility of the Glossary modal. If `true`, the modal is displayed; otherwise, it's hidden.
    *   **Required**: Yes

*   **`onClose: () => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function invoked when the modal requests to be closed (e.g., by clicking the "X" button in the header or pressing the Escape key).
    *   **Required**: Yes

## Core Functionality

1.  **Modal Display**:
    *   Renders as a fixed-position overlay with a semi-transparent background, ensuring it appears above other game UI elements.
    *   The main modal content is displayed in a styled panel, designed for readability and navigation of large amounts of text.

2.  **Expandable Sections**:
    *   Utilizes nested HTML `<details>` and `<summary>` elements to create an accordion-style interface.
    *   Main categories (Players, Dungeon Masters, Monsters, Rules Glossary) are top-level `<details>` elements.
    *   Sub-categories (e.g., "Playing the Game" under "Players", "Creature Stat Blocks" under "Monsters") are nested `<details>` elements.
    *   Clicking a `<summary>` toggles the visibility of its corresponding content.

3.  **Content Structure**:
    *   The content is derived from the D&D Beyond Basic Rules structure provided in the user prompt.
    *   Lists of terms or items are rendered as `<ul>` elements.
    *   Long lists (e.g., monster names, main rules glossary terms) use multi-column CSS layout (`columns-1 sm:columns-2 md:columns-3 lg:columns-4`) for better readability on wider screens.

4.  **Styling**:
    *   Uses Tailwind CSS for all styling, ensuring consistency with the application's dark theme.
    *   `<summary>` elements are styled to look like clickable headers.
    *   `<details>` elements have borders and distinct background colors for visual separation.
    *   The content area within the modal is scrollable (`overflow-y-auto scrollable-content`) to handle the extensive glossary information.

5.  **Closing Mechanism**:
    *   The modal can be closed by:
        *   Clicking the "X" button in the header.
        *   Pressing the `Escape` key (handled by an effect hook).
    *   Both actions trigger the `onClose` callback.

6.  **Focus Management**:
    *   When the modal opens, focus is automatically set to the first focusable element (the close 'X' button) using `firstFocusableElementRef.current?.focus()`.

## Accessibility

*   The modal has `aria-modal="true"` and `role="dialog"`.
*   The main title of the modal is linked via `aria-labelledby="glossary-title"`.
*   The close button has an `aria-label`.
*   `<details>` and `<summary>` elements are inherently keyboard accessible. Users can navigate between summaries using Tab and toggle them open/closed using Enter or Space.

## Data Dependencies (Updated 2026-01-08)

The content of the glossary is dynamic and driven by JSON data files located in `/public/data/glossary/entries/`. 

1.  **JSON Entries**: Each term is a JSON file containing metadata (id, category, tags) and content (markdown).
2.  **Automated Index**: A central index system (`/public/data/glossary/index/main.json`) points to category-specific indices.
3.  **Index Generation**: The index files are maintained by the `scripts/generateGlossaryIndex.js` script, which scans the entries directory and regenerates the catalogs.
4.  **Context Loading**: `GlossaryContext.tsx` fetches these indices on application mount to provide efficient search and navigation without loading all entry content upfront.

For a detailed guide on adding new content, see the [Glossary Contributor Guide](file:///c:/Users/gambi/Documents/Git/AraliaV4/Aralia/docs/guides/@GLOSSARY-CONTRIBUTOR-GUIDE.md).

## Usage

Typically rendered conditionally in `App.tsx` based on `gameState.isGlossaryVisible`.

```tsx
// Example in App.tsx
import Glossary from './components/Glossary';
// ...
{gameState.isGlossaryVisible && (
  <Glossary
    isOpen={gameState.isGlossaryVisible}
    onClose={() => dispatch({ type: 'TOGGLE_GLOSSARY_VISIBILITY' })}
  />
)}
```

The `TOGGLE_GLOSSARY_VISIBILITY` action is dispatched from other UI elements, such as a "Glossary" button in `ActionPane.tsx`.