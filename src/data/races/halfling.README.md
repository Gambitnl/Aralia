
# Halfling Race Data (`src/data/races/halfling.ts`)

## Purpose

The `src/data/races/halfling.ts` file defines the data for the Halfling race in the Aralia RPG. This data is based on the Player's Handbook (pg. 193), adapted to the modern design philosophy where fixed ability score increases are handled by the Point Buy system rather than being part of the race data itself. This version does not feature distinct subraces.

## Structure

The file exports a single constant:

*   **`HALFLING_DATA: Race`**
    *   This is a `Race` object (type defined in `src/types.ts`) containing all the specific details for the Halfling race.

### `Race` Object Properties for Halfling

*   **`id: string`**: `"halfling"`
*   **`name: string`**: `"Halfling"`
*   **`description: string`**: A detailed description of Halflings, their culture, and general disposition.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`).
*   **`traits: string[]`**: An array of strings describing the core racial traits:
    *   **Creature Type**: Humanoid.
    *   **Size**: Small.
    *   **Speed**: 30 feet.
    *   **Brave**: Advantage on saving throws against being Frightened.
    *   **Halfling Nimbleness**: Can move through the space of larger creatures.
    *   **Luck**: Can reroll a 1 on a d20 test.
    *   **Naturally Stealthy**: Can attempt to hide when obscured by a larger creature.

## Usage

*   **`src/data/races/index.ts`**: Imports `HALFLING_DATA` and adds it to the `ALL_RACES_DATA` collection.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Halfling as a selectable race.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**: Handles Halfling selection and proceeds to the next steps without a race-specific choice screen.
*   **`src/components/PlayerPane.tsx` / `CharacterSheetModal.tsx`**: Display Halfling traits.
*   **`src/constants.ts`**: `HALFLING_DATA` becomes part of the globally available `RACES_DATA`.
