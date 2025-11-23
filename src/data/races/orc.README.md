
# Orc Race Data (`src/data/races/orc.ts`)

## Purpose

The `src/data/races/orc.ts` file defines the data for the Orc race in the Aralia RPG. This data is based on the modern D&D design philosophy (Player's Handbook, pg. 195), where Orcs do not have fixed ability score bonuses, but instead have powerful racial traits.

## Structure

The file exports a single constant:

*   **`ORC_DATA: Race`**
    *   This is a `Race` object (type defined in `src/types.ts`) containing all the specific details for the Orc race.

### `Race` Object Properties for Orc

*   **`id: string`**: `"orc"`
*   **`name: string`**: `"Orc"`
*   **`description: string`**: A detailed description of Orcs, their creation by Gruumsh, and their physical characteristics.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`). Ability Score Increases are handled by the Point Buy system.
*   **`traits: string[]`**: An array of strings describing racial traits:
    *   **Creature Type**: Humanoid.
    *   **Size**: Medium.
    *   **Speed**: 30 feet.
    *   **Adrenaline Rush**: Allows taking the Dash action as a Bonus Action and gaining temporary hit points.
    *   **Darkvision**: 120 feet.
    *   **Relentless Endurance**: Can drop to 1 hit point instead of 0 once per long rest.

## Usage

*   **`src/data/races/index.ts`**: Imports `ORC_DATA` and adds it to the `ALL_RACES_DATA` collection.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Orc as a selectable race.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**: Handles Orc selection and proceeds to the next steps without a race-specific choice screen.
*   **`src/components/PlayerPane.tsx` / `CharacterSheetModal.tsx`**: Display Orc traits.
*   **`src/constants.ts`**: `ORC_DATA` becomes part of the globally available `RACES_DATA`.
