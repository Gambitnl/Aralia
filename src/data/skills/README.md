
# Skills Data (`src/data/skills/index.ts`)

## Purpose

The `src/data/skills/index.ts` file defines all the character skills available in the Aralia RPG, based on D&D 5th Edition. This data is crucial for character creation (allowing players to select skill proficiencies based on their class and race) and for displaying skill information in the UI (e.g., `PlayerPane.tsx`). In the future, it would also be used for skill checks during gameplay.

## Structure

The file exports a single constant:

*   **`SKILLS_DATA: Record<string, Skill>`**
    *   This is an object where each key is a unique string identifier for a skill (e.g., `'acrobatics'`, `'arcana'`). This ID is used internally to reference the skill.
    *   The value for each key is a `Skill` object, defined in `src/types.ts`.

### `Skill` Object Properties

Each `Skill` object has the following properties:

*   **`id: string`**: The unique identifier for the skill (should match the key in the `SKILLS_DATA` record).
    *   Example: `"acrobatics"`
*   **`name: string`**: The display name of the skill.
    *   Example: `"Acrobatics"`
*   **`ability: AbilityScoreName`**: The D&D ability score associated with this skill (e.g., 'Strength', 'Dexterity'). This determines which ability modifier is added to skill checks.
    *   Example: `"Dexterity"` for Acrobatics.

## Example Entry

```typescript
// From src/data/skills/index.ts
export const SKILLS_DATA: Record<string, Skill> = {
  'acrobatics': { id: 'acrobatics', name: 'Acrobatics', ability: 'Dexterity' },
  'animal_handling': { id: 'animal_handling', name: 'Animal Handling', ability: 'Wisdom' },
  'arcana': { id: 'arcana', name: 'Arcana', ability: 'Intelligence' },
  // ... more skills
};
```

## Usage

*   **Character Creation (`src/components/CharacterCreator/`)**:
    *   `SkillSelection.tsx`: Uses `SKILLS_DATA` to populate the list of available skills for the player to choose from, based on their class's `skillProficienciesAvailable` and racial grants (like Elf's "Keen Senses" or Human's "Skillful"). It also uses the skill's `ability` to display the relevant ability score modifier.
    *   Race-specific skill selection components (e.g., `HumanSkillSelection.tsx`, `CentaurNaturalAffinitySkillSelection.tsx`, `ChangelingInstinctsSelection.tsx`) use `SKILLS_DATA` to present their specific skill choices.
    *   `NameAndReview.tsx`: Uses `SKILLS_DATA` to display the names of the character's chosen skill proficiencies.
*   **`PlayerPane.tsx`**: Displays the character's proficient skills, including their names and associated ability abbreviations.
*   **`src/constants.ts`**: Imports and re-exports `SKILLS_DATA` for global access.
*   Game Mechanics (Future): Would be used to determine the ability modifier for skill checks made by the player during gameplay.

## Adding a New Skill

1.  Define a new entry in the `SKILLS_DATA` object in `src/data/skills/index.ts`.
2.  Ensure the `id` is unique and follows a consistent naming convention (e.g., lowercase with underscores).
3.  Provide the `name` and the correct associated `ability` (`AbilityScoreName`).
4.  If the skill should be available for selection by a class, add its `id` to the `skillProficienciesAvailable` array for that class in `src/data/classes/index.ts`.
5.  If it's part of a racial trait option, update the relevant race data or race-specific selection component.
