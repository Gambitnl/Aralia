
# Centaur Race Data (`src/data/races/centaur.ts`)

## Purpose

The `src/data/races/centaur.ts` file defines the data for the Centaur race in the Aralia RPG. This data is based on "Mordenkainen Presents: Monsters of the Multiverse," adapted to use the game's flexible Ability Score Increase system (Point Buy).

## Structure

The file exports a single constant:

*   **`CENTAUR_DATA: Race`**
    *   This is a `Race` object (type defined in `src/types.ts`) containing all the specific details for the Centaur race.

### `Race` Object Properties for Centaur

*   **`id: string`**: `"centaur"`
*   **`name: string`**: `"Centaur"`
*   **`description: string`**: A detailed description of Centaurs, their Feywild origins, and equine build.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`). Ability Score Increases are handled by the Point Buy system.
*   **`traits: string[]`**: An array of strings describing racial traits. Key traits include:
    *   **Creature Type**: Fey.
    *   **Size**: Medium.
    *   **Speed**: 40 feet.
    *   **Charge**: A special bonus action attack after moving.
    *   **Equine Build**: Affects carrying capacity and climbing.
    *   **Hooves**: Defines their natural unarmed strikes.
    *   **Natural Affinity**: Grants proficiency in one skill chosen from a specific list (Animal Handling, Medicine, Nature, or Survival). This choice is handled during character creation.

## Usage

*   **`src/data/races/index.ts`**: Imports `CENTAUR_DATA` and adds it to the `ALL_RACES_DATA` collection.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Centaur as a selectable race.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**:
    *   Handles the selection of the Centaur race.
    *   Routes to the `CentaurNaturalAffinitySkillSelection.tsx` component for the player to choose their skill proficiency.
    *   Includes the chosen skill (`selectedCentaurNaturalAffinitySkillId`) in the final `PlayerCharacter` object.
*   **`src/components/CharacterCreator/SkillSelection.tsx`**: Prevents the player from selecting the skill already granted by Natural Affinity as a class skill.
*   **`src/components/PlayerPane.tsx` / `CharacterSheetModal.tsx`**: Display Centaur traits.
*   **`src/constants.ts`**: `CENTAUR_DATA` becomes part of the globally available `RACES_DATA`.
