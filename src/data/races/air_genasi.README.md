
# Air Genasi Race Data (`src/data/races/air_genasi.ts`)

## Purpose

The `src/data/races/air_genasi.ts` file defines the data for the Air Genasi race in the Aralia RPG. This data is based on "Mordenkainen Presents: Monsters of the Multiverse," adapted to use the game's flexible Ability Score Increase system (Point Buy).

## Structure

The file exports a single constant:

*   **`AIR_GENASI_DATA: Race`**
    *   This is a `Race` object (type defined in `src/types.ts`) containing all the specific details for the Air Genasi race.

### `Race` Object Properties for Air Genasi

*   **`id: string`**: `"air_genasi"`
*   **`name: string`**: `"Air Genasi"`
*   **`description: string`**: A detailed description of Air Genasi, their djinn heritage, and physical appearance.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`). Ability Score Increases are handled by the Point Buy system.
*   **`traits: string[]`**: An array of strings describing racial traits. Key traits include:
    *   **Creature Type**: Humanoid.
    *   **Size**: Medium or Small.
    *   **Speed**: 35 feet.
    *   **Darkvision**: 60 feet.
    *   **Unending Breath**: Can hold breath indefinitely.
    *   **Lightning Resistance**: Resistance to lightning damage.
    *   **Mingle with the Wind**: Grants the *Shocking Grasp* cantrip, and the ability to cast *Feather Fall* (at 3rd level) and *Levitate* (at 5th level). The spellcasting ability for these spells (Intelligence, Wisdom, or Charisma) is chosen by the player during character creation.

## Usage

*   **`src/data/races/index.ts`**: Imports `AIR_GENASI_DATA` and adds it to the `ALL_RACES_DATA` collection.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Air Genasi as a selectable race.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**:
    *   Handles the selection of the Air Genasi race.
    *   Routes to the `AirGenasiSpellcastingAbilitySelection.tsx` component for the player to choose their spellcasting ability for the "Mingle with the Wind" trait.
    *   Includes the chosen ability (`airGenasiSpellcastingAbility`) in the final `PlayerCharacter` object.
*   **`src/components/PlayerPane.tsx` / `CharacterSheetModal.tsx`**: Display Air Genasi traits.
*   **`src/constants.ts`**: `AIR_GENASI_DATA` becomes part of the globally available `RACES_DATA`.
