# ChangelingInstinctsSelection Component

## Purpose

The `ChangelingInstinctsSelection.tsx` component is a dedicated step in the character creation process for Changeling characters. It allows the player to choose **two** skill proficiencies from a list of five options (Deception, Insight, Intimidation, Performance, or Persuasion) as granted by their "Changeling Instincts" racial trait.

This component is rendered by `CharacterCreator.tsx` when a player selects "Changeling" as their race and the character creation flow proceeds to the `CreationStep.ChangelingInstincts`.

## Props

*   **`onSkillsSelect: (skillIds: string[]) => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function that is invoked when the player confirms their choice of two skills. It passes an array containing the `id`s of the two selected skills (e.g., `['deception', 'insight']`).
    *   **Required**: Yes

*   **`onBack: () => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function that is invoked when the player clicks the "Back" button. It typically navigates the user to the previous step in the character creation flow (Race Selection).
    *   **Required**: Yes

## State Management

*   **`selectedSkillIds: Set<string>`**:
    *   Stores a `Set` of `id`s for the skills currently selected by the player for their Changeling Instincts trait.
    *   Initialized to an empty `Set`.
    *   Updated when the player toggles a skill checkbox. The component logic ensures that no more than two skills can be added to the set.

## Core Functionality

1.  **Displaying Skill Options**:
    *   The component defines a list of skill IDs eligible for Changeling Instincts: `CHANGELING_INSTINCTS_SKILL_CHOICES_IDS` (Deception, Insight, Intimidation, Performance, Persuasion).
    *   It fetches the full `Skill` objects for these IDs from `SKILLS_DATA` (imported from `src/constants.ts`).
    *   It maps over these skill objects to render a checkbox and label for each option, displaying the skill name and its associated ability score (e.g., "Deception (Cha)").

2.  **Selection Handling**:
    *   When a player clicks on a skill's checkbox:
        *   If the skill is already selected, it's deselected.
        *   If the skill is not selected and less than two skills are already selected, the skill is added to the `selectedSkillIds` set.
        *   If two skills are already selected, no more skills can be added until one is deselected.
    *   The UI visually highlights the selected skills and provides feedback on how many skills are currently selected out of the required two.

3.  **Submission**:
    *   The "Confirm Skills" button is enabled only when exactly two skills have been selected.
    *   Clicking "Confirm Skills" calls the `handleSubmit` function, which converts the `selectedSkillIds` set to an array and invokes the `onSkillsSelect` prop.

4.  **Navigation**:
    *   The "Back to Race" button invokes the `onBack` prop, allowing the user to return to the main race selection screen.

## Data Dependencies

*   **`SKILLS_DATA` (from `src/constants.ts`)**: A record containing all available `Skill` objects, keyed by skill ID. Used to display skill names and associated abilities.

## Styling

*   Styling is handled using Tailwind CSS.
*   Selected skill checkboxes and labels are visually distinct.
*   The layout provides clear instructions and feedback to the user, including a counter for selected skills.

## Accessibility

*   Each skill checkbox has an associated label for better click targeting and screen reader compatibility. `aria-label` is used for the input itself.
*   The selected state is visually indicated.
*   Buttons for navigation ("Back", "Confirm") have clear labels.
*   The "Confirm Skills" button is `disabled` until exactly two skills are selected.