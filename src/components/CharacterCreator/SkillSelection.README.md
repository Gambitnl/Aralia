
# SkillSelection Component

## Purpose

The `SkillSelection.tsx` component allows the player to select a number of skill proficiencies for their character from a list available to their chosen class. It also handles special skill choices or grants from racial traits, such as:
*   Elf's "Keen Senses" (player chooses one from Perception, Insight, Survival).
*   Human's "Skillful" (player chooses one skill from all available skills in a preceding step; this component ensures it's accounted for).
*   Bugbear's "Sneaky" (automatically grants Stealth proficiency).
*   Centaur's "Natural Affinity" (player chooses one from Animal Handling, Medicine, Nature, or Survival in a preceding step).
*   Changeling's "Changeling Instincts" (player chooses two from Deception, Insight, Intimidation, Performance, or Persuasion in a preceding step).

The component prevents the player from selecting class skills that are already granted by these racial traits, using a **Tooltip** to indicate the source of such grants.

## Props

*   **`charClass: CharClass`**:
    *   **Type**: `CharClass` (from `src/types.ts`)
    *   **Purpose**: The character's selected class. Determines `numberOfSkillProficiencies` and `skillProficienciesAvailable`.
    *   **Required**: Yes

*   **`abilityScores: AbilityScores`**:
    *   **Type**: `AbilityScores` (from `src/types.ts`)
    *   **Purpose**: Final ability scores, used to display skill modifiers.
    *   **Required**: Yes

*   **`race: Race`**:
    *   **Type**: `Race` (from `src/types.ts`)
    *   **Purpose**: Selected race, for Elf's Keen Senses and identifying other racial skill grants.
    *   **Required**: Yes

*   **`selectedHumanSkill: Skill | null`**:
    *   **Type**: `Skill` or `null`
    *   **Purpose**: Skill from Human's "Skillful" trait.
    *   **Required**: Yes (passed as `null` if not Human).

*   **`selectedCentaurNaturalAffinitySkillId?: string | null`**:
    *   **Type**: `string` (skill ID) or `null`
    *   **Purpose**: Skill ID from Centaur's "Natural Affinity".
    *   **Required**: No.

*   **`selectedChangelingInstinctSkillIds?: string[] | null`**:
    *   **Type**: Array of `string` (skill IDs) or `null`
    *   **Purpose**: Skill IDs from Changeling's "Changeling Instincts".
    *   **Required**: No.

*   **`onSkillsSelect: (skills: Skill[]) => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback with final selected `Skill` objects.
    *   **Required**: Yes

*   **`onBack: () => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback to navigate to the previous step.
    *   **Required**: Yes

## State Management

*   **`selectedClassSkillIds: Set<string>`**: IDs of skills chosen from the class list.
*   **`selectedKeenSensesSkillId: string | null`**: ID of skill chosen for Elf's Keen Senses.

## Core Functionality

1.  **Displaying Class Skills**:
    *   Lists skills available to `charClass`.
    *   Shows skill name, associated ability, and modifier.
    *   Checkboxes for selection, disabled if max class skills are reached.
    *   If a skill is racially granted (Human's "Skillful", Bugbear's "Sneaky", Centaur's "Natural Affinity", Changeling's "Instincts"), it's marked "(Racial)", its checkbox is disabled, and a **Tooltip** (from `../Tooltip.tsx`) explains the source.

2.  **Elf Keen Senses Selection**:
    *   If `race.id === 'elf'`, allows choosing one skill (Insight, Perception, Survival) via radio buttons.

3.  **Submission (`handleSubmit`)**:
    *   Validates correct number of class skills and Keen Senses selection (if Elf).
    *   Combines selected class skills with all applicable racially granted skills (Human, Elf, Bugbear, Centaur, Changeling), ensuring no duplicates.
    *   Calls `onSkillsSelect` with the final list.

4.  **Navigation**: "Back" and "Confirm Skills" buttons.

## Data Dependencies

*   `src/constants.ts`: `SKILLS_DATA`.
*   Props: `charClass`, `abilityScores`, `race`, `selectedHumanSkill`, `selectedCentaurNaturalAffinitySkillId`, `selectedChangelingInstinctSkillIds`.
*   `../Tooltip.tsx`: For displaying information about racially granted skills.

## Styling

Tailwind CSS. Selected skills highlighted. Disabled options styled. Tooltips used for racial grants.

## Accessibility

Checkboxes and radio buttons labeled. Disabled states clear. Tooltips provide context.
