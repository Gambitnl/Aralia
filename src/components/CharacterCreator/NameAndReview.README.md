# NameAndReview Component

## Purpose

The `NameAndReview.tsx` component is the final step in character creation. It allows the player to name their character and review all their selections (race, class, ability scores, skills, features, spells) before finalizing the character.

## Props

*   **`characterPreview: PlayerCharacter`**:
    *   **Type**: `PlayerCharacter` (from `src/types.ts`)
    *   **Purpose**: A `PlayerCharacter` object containing all selections made so far. This object is assembled by helper functions within `CharacterCreator.tsx` using the current creation state. It includes pre-calculated derived stats (HP, AC, Speed, Darkvision) and fully aggregated spell and skill lists, ensuring the preview is consistent with the final character data.
    *   **Required**: Yes

*   **`onConfirm: (name: string) => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function invoked when the character is confirmed (e.g., "Begin Adventure!" button is clicked). It passes the character's chosen name.
    *   **Required**: Yes

*   **`onBack: () => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function invoked when the player clicks the "Back" button, allowing navigation to the previous step in character creation.
    *   **Required**: Yes

*   **`initialName?: string`**:
    *   **Type**: `string` (optional)
    *   **Purpose**: An optional initial value for the character name input field. Useful if the player is returning to this step after having entered a name previously.
    *   **Default**: `''`

## State Management

*   **`name: string`**:
    *   Stores the character's name as entered by the player in the input field.
    *   Initialized with `initialName` prop.

## Core Functionality

1.  **Displaying Character Summary**:
    *   Takes the `characterPreview` object (which is generated using helper functions from `CharacterCreator.tsx` to ensure accuracy) and displays its key attributes in a readable format. This includes:
        *   Race (and subrace/lineage/ancestry details).
        *   Class.
        *   Final Ability Scores (using `getAbilityModifierString` from `src/utils/characterUtils.ts` to format modifiers).
        *   Selected Skills (fully aggregated).
        *   Chosen class features (Fighting Style, Divine Domain).
        *   Known Cantrips and Spells (fully aggregated, including class and racial sources).
        *   Calculated HP, AC, Speed, and Darkvision range.
    *   The summary section is scrollable if the content is extensive.

2.  **Name Input**:
    *   Provides a text input field for the player to enter their character's name.
    *   The input is `required`.

3.  **Submission**:
    *   The form submission (triggered by the "Begin Adventure!" button) calls `handleSubmit`.
    *   `handleSubmit` prevents default form action and, if the name is not empty, calls the `onConfirm` prop with the trimmed name.
    *   The "Begin Adventure!" button is disabled if the name input is empty.

4.  **Navigation**:
    *   The "Back" button calls the `onBack` prop.

## Data Dependencies

*   **`src/types.ts`**: For `PlayerCharacter`, `AbilityScoreName`, `Spell`, `Skill` types.
*   **`src/constants.ts`**: For `RACES_DATA`, `SPELLS_DATA`, `SKILLS_DATA`, `GIANT_ANCESTRIES`, `TIEFLING_LEGACIES` (used to look up names and details for display based on IDs in `characterPreview`).
*   **`src/utils/characterUtils.ts`**: For the `getAbilityModifierString` utility function.

## Styling

*   Uses Tailwind CSS for layout and styling.
*   The summary section is designed for readability.
*   The name input field and action buttons are clearly styled.

## Accessibility

*   The name input field has an associated `label` and `aria-required="true"`.
*   Buttons have clear `aria-label` attributes.
*   The "Begin Adventure!" button's disabled state is visually indicated.