# PartyPane Component

## Purpose

The `PartyPane.tsx` component displays interactive elements for each party member, primarily focusing on their name, Armor Class (AC) with a shield icon, and a dynamic health bar. Initially, it is designed to show only the main player character but can be extended to display multiple party members. This component replaces the more detailed `PlayerPane` in the main game view, offering a more compact status overview.

Clicking on a character's button in the `PartyPane` now opens the `CharacterSheetModal` for that character, allowing the player to view detailed stats and equipment.

## Props

*   **`playerCharacter: PlayerCharacter`**:
    *   **Type**: `PlayerCharacter` (from `src/types.ts`)
    *   **Purpose**: The data object for the player character to be displayed.
    *   **Required**: Yes

*   **`onViewCharacterSheet: (character: PlayerCharacter) => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback function invoked when a character's button is clicked. It passes the `PlayerCharacter` object of the clicked character, typically to trigger the opening of the `CharacterSheetModal`.
    *   **Required**: Yes

*   **`partyMembers?: PlayerCharacter[]` (Future)**:
    *   **Type**: Array of `PlayerCharacter` objects.
    *   **Purpose**: For displaying other members of the player's party.
    *   **Required**: No (for initial implementation focusing on the player).

## Core Functionality

1.  **Character Display (`PartyCharacterButton` sub-component)**:
    *   Each character is represented by a styled, clickable `<button>`.
    *   **Name**: The character's name is displayed prominently.
    *   **Armor Class (AC)**:
        *   Displayed to the right of the character's name.
        *   Uses an SVG shield icon.
        *   The character's AC value is shown as text centered inside the shield icon.
    *   **Health Bar**:
        *   A visual representation of the character's current HP relative to their maximum HP.
        *   The filled portion of the bar is typically reddish (e.g., `bg-red-600`).
        *   The background of the bar shows the "empty" portion (e.g., `bg-gray-500` or a darker red).
        *   The width of the filled portion is dynamically calculated as `(character.hp / character.maxHp) * 100%`.
        *   Text displaying "Current HP / Max HP" (e.g., "85/100 HP") is overlaid on the bar for clarity.
    *   Displays character's race and class below the health bar.
    *   The button is focusable and clickable. Clicking it invokes the `onViewCharacterSheet` prop with the character's data.
    *   The button's `aria-label` includes the character's name, AC, and HP status, and indicates it opens the character sheet.

2.  **Party Pane Layout**:
    *   The main `PartyPane` component provides a container for one or more `PartyCharacterButton`s.
    *   It includes a title like "Party".
    *   The pane is scrollable if many party members are displayed.

## Styling

*   Uses Tailwind CSS for a consistent look and feel with the rest of the application.
*   Health bars are styled for clear visual feedback on character status.
*   Shield icon and AC value are styled for clarity and visual appeal.
*   Buttons are designed to be easily identifiable and interactive.

## Integration

*   In `App.tsx`, `PartyPane` replaces `PlayerPane` in the main game layout.
*   It receives the `playerCharacter` from the global game state and the `onViewCharacterSheet` callback from `App.tsx`.
*   The display of inventory and detailed character stats (ability scores, skills, spells) previously handled by `PlayerPane` in this screen location is not part of `PartyPane`'s current scope; these details are now intended for the `CharacterSheetModal`.

## Future Enhancements

*   Displaying multiple party members.
*   Adding status effect icons near character buttons.
*   Visual feedback for low health (e.g., pulsing bar, color change).

## Accessibility
*   Character buttons have `aria-label` attributes providing character name, AC, health status, and the action of viewing details.
*   Health bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
*   The shield icon is decorative (`aria-hidden="true"`) as its value is part of the button's main `aria-label`.