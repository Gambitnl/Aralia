# CentaurNaturalAffinitySkillSelection Component

## Purpose

The `CentaurNaturalAffinitySkillSelection.tsx` component is a dedicated step in the character creation process for Centaur characters. It allows the player to choose one skill proficiency from a list of four options (Animal Handling, Medicine, Nature, or Survival) as granted by their "Natural Affinity" racial trait.

This component is rendered by `CharacterCreator.tsx` when a player selects "Centaur" as their race and the character creation flow proceeds to the `CreationStep.CentaurNaturalAffinitySkill`.

## Props

*   **`onSkillSelect: (skillId: string) => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function that is invoked when the player confirms their choice of skill. It passes the `id` of the selected skill (e.g., 'animal_handling', 'medicine').
    *   **Required**: Yes

*   **`onBack: () => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function that is invoked when the player clicks the "Back" button. It typically navigates the user to the previous step in the character creation flow (Race Selection).
    *   **Required**: Yes

## State Management

*   **`selectedSkillId: string | null`**:
    *   Stores the `id` of the skill currently selected by the player for their Natural Affinity trait.
    *   Initialized to `null`.
    *   Updated when the player clicks on one of the skill option buttons.

## Core Functionality

1.  **Displaying Skill Options**:
    *   The component defines a list of skill IDs: `NATURAL_AFFINITY_SKILL_CHOICES_IDS` (Animal Handling, Medicine, Nature, Survival).
    *   It fetches the full `Skill` objects for these IDs from `SKILLS_DATA` (imported from `src/constants.ts`).
    *   It maps over these skill objects to render a button for each option, displaying the skill name and its associated ability score (e.g., "Animal Handling (Wis)").

2.  **Selection Handling**:
    *   When a player clicks on a skill button, the `selectedSkillId` state is updated.
    *   The UI visually highlights the selected skill.

3.  **Submission**:
    *   The "Confirm Skill" button is enabled only when a skill has been selected.
    *   Clicking "Confirm Skill" calls the `handleSubmit` function, which in turn invokes the `onSkillSelect` prop with the `selectedSkillId`.

4.  **Navigation**:
    *   The "Back to Race" button invokes the `onBack` prop, allowing the user to return to the main race selection screen.

## Data Dependencies

*   **`SKILLS_DATA` (from `src/constants.ts`)**: A record containing all available `Skill` objects, keyed by skill ID. Used to display skill names and associated abilities.

## Styling

*   Styling is handled using Tailwind CSS.
*   Selected skill buttons are visually distinct from unselected ones.
*   The layout provides clear instructions and feedback to the user.

## Accessibility

*   Each skill button has an `aria-label` for screen readers.
*   The selected state is indicated using `aria-pressed`.
*   Buttons for navigation ("Back", "Confirm") have clear labels.
*   The "Confirm Skill" button is `disabled` until a selection is made.