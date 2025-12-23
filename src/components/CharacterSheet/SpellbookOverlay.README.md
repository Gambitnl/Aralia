# SpellbookOverlay Component

## Purpose

The `SpellbookOverlay.tsx` component is the primary user interface for managing a character's spells and limited-use resources. It renders as a full-screen, book-themed overlay, providing a clear and interactive way to view spell slots, cantrips, prepared spells, and other abilities that refresh on rests.

## Key Features

*   **Two-Page Layout**:
    *   **Left Page (Resources)**: This page is dedicated to tracking all of a character's expendable resources.
        *   **Spell Slots**: A visual representation of available spell slots for each level (1-9), shown as filled or empty dots.
        *   **Limited Abilities**: A list of other class or racial abilities (e.g., Rage, Second Wind, Channel Divinity) and their current uses versus their maximum.
        *   **Rest Buttons**: "Short Rest" and "Long Rest" buttons that dispatch actions to replenish resources according to game rules.
        *   **Spell List Toggle**: A switch that allows the user to toggle the right-hand page between showing only known/prepared spells and showing all spells available to the character's class.
    *   **Right Page (Spell List)**: This page displays the character's spells, paginated by level.
        *   **Pagination**: Users can flip through pages, with each page corresponding to a spell level (Cantrips, Level 1, Level 2, etc.).
        *   **Spell Entries**: Each spell is listed with its name, an icon, and a set of action buttons.
        *   **Actions**: Buttons for "Cast," "Prepare/Unprepare," and "Info" (which opens a detailed glossary modal for the spell). The "Cast" button is disabled if the character is out of spell slots for that level.
*   **Interactive UI**: Provides clear visual feedback on resource expenditure and spell preparation status.
*   **Glossary Integration**: The "Info" button for each spell links directly to the `SingleGlossaryEntryModal`, providing players with immediate access to spell descriptions and rules.

## Props

*   **`isOpen: boolean`**: Controls the visibility of the overlay.
*   **`character: PlayerCharacter`**: The character whose spellbook is being displayed. The component relies on the `spellbook`, `spellSlots`, and `limitedUses` properties of this object.
*   **`onClose: () => void`**: Callback to close the overlay.
*   **`onAction: (action: Action) => void`**: Callback to dispatch game actions, such as `CAST_SPELL`, `TOGGLE_PREPARED_SPELL`, `SHORT_REST`, or `LONG_REST`.

## State Management

*   **`currentPageIndex: number`**: Manages which spell level (page) is currently being viewed on the right-hand side.
*   **`showAllPossibleSpells: boolean`**: Controls the toggle for displaying all class spells versus only known spells.
*   **`infoSpellId: string | null`**: Tracks which spell's "Info" modal should be displayed.

## Dependencies
*   `src/types.ts`: For `PlayerCharacter`, `Spell`, `Action`, and related types.
*   `src/context/SpellContext.tsx`: To get the full data for all spells in the game from their IDs.
*   `./Tooltip.tsx`: Used for providing spell descriptions on hover.
*   `./SingleGlossaryEntryModal.tsx`: Used to display detailed spell information.

This component replaces the older, simpler `Spellbook.tsx`.