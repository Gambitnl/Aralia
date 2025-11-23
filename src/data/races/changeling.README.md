
# Changeling Race Data (`src/data/races/changeling.ts`)

## Purpose

The `src/data/races/changeling.ts` file defines the data for the Changeling race in the Aralia RPG. This data is based on "Mordenkainen Presents: Monsters of the Multiverse," adapted to use the game's flexible Ability Score Increase system (Point Buy).

## Structure

The file exports a single constant:

*   **`CHANGELING_DATA: Race`**
    *   This is a `Race` object (type defined in `src/types.ts`) containing all the specific details for the Changeling race.

### `Race` Object Properties for Changeling

*   **`id: string`**: `"changeling"`
*   **`name: string`**: `"Changeling"`
*   **`description: string`**: A detailed description of Changelings and their shape-altering nature.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`). Ability Score Increases are handled by the Point Buy system.
*   **`traits: string[]`**: An array of strings describing racial traits. Key traits include:
    *   **Creature Type**: Fey.
    *   **Size**: Medium or Small.
    *   **Speed**: 30 feet.
    *   **Changeling Instincts**: Grants proficiency in two skills chosen from a specific list (Deception, Insight, Intimidation, Performance, or Persuasion). This choice is handled during character creation.
    *   **Shapechanger**: The core ability to alter one's physical appearance.

## Usage

*   **`src/data/races/index.ts`**: Imports `CHANGELING_DATA` and adds it to the `ALL_RACES_DATA` collection.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Changeling as a selectable race.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**:
    *   Handles the selection of the Changeling race.
    *   Routes to the `ChangelingInstinctsSelection.tsx` component for the player to choose their two skill proficiencies.
    *   Includes the chosen skills (`selectedChangelingInstinctSkillIds`) in the final `PlayerCharacter` object.
*   **`src/components/CharacterCreator/SkillSelection.tsx`**: Prevents the player from selecting the skills already granted by Changeling Instincts as a class skill.
*   **`src/components/PlayerPane.tsx` / `CharacterSheetModal.tsx`**: Display Changeling traits.
*   **`src/constants.ts`**: `CHANGELING_DATA` becomes part of the globally available `RACES_DATA`.
