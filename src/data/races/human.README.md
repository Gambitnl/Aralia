
# Human Race Data (`src/data/races/human.ts`)

## Purpose

The `src/data/races/human.ts` file defines the data for the Human race in the Aralia RPG. This data is based on the modern D&D design philosophy (similar to the 2024 Player's Handbook) where humans do not receive fixed ability score bonuses, but instead gain flexibility through traits like "Skillful" and "Versatile".

## Structure

The file exports a single constant:

*   **`HUMAN_DATA: Race`**
    *   This is a `Race` object (type defined in `src/types.ts`) containing all the specific details for the Human race.

### `Race` Object Properties for Human

*   **`id: string`**: `"human"`
*   **`name: string`**: `"Human"`
*   **`description: string`**: A detailed description of Humans, their ambition, and adaptability.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`). Ability Score Increases are handled by the Point Buy system.
*   **`traits: string[]`**: An array of strings describing racial traits:
    *   **Creature Type**: Humanoid.
    *   **Size**: Medium or Small.
    *   **Speed**: 30 feet.
    *   **Resourceful**: Descriptive trait, not yet mechanically implemented.
    *   **Skillful**: Grants proficiency in one skill of the player's choice. This choice is handled during character creation.
    *   **Versatile**: Grants an Origin feat of the player's choice (descriptive, as feats are not yet mechanically implemented).

## Usage

*   **`src/data/races/index.ts`**: Imports `HUMAN_DATA` and adds it to the `ALL_RACES_DATA` collection.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Human as a selectable race.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**:
    *   Handles the selection of the Human race.
    *   Routes to the `HumanSkillSelection.tsx` component for the player to choose their bonus skill proficiency granted by the "Skillful" trait.
*   **`src/components/CharacterCreator/SkillSelection.tsx`**: Recognizes if the character is Human and prevents the player from re-selecting the skill already granted by the "Skillful" trait.
*   **`src/components/PlayerPane.tsx` / `CharacterSheetModal.tsx`**: Display Human traits.
*   **`src/constants.ts`**: `HUMAN_DATA` becomes part of the globally available `RACES_DATA`.
