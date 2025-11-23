
# Tiefling Race Data (`src/data/races/tiefling.ts`)

## Purpose

The `src/data/races/tiefling.ts` file defines the data for the Tiefling race in the Aralia RPG. This data is based on the Player's Handbook (pg. 197), adapted to use the game's flexible Ability Score Increase system. It includes the base Tiefling traits and the various "Fiendish Legacy" options that players can choose from.

## Structure

The file exports two main constants:

1.  **`FIENDISH_LEGACIES_DATA: FiendishLegacy[]`**:
    *   An array of `FiendishLegacy` objects, where each object defines a specific legacy (Abyssal, Chthonic, Infernal).
    *   Each legacy includes its description, resistance type, and the spell IDs it grants at levels 1, 3, and 5.

2.  **`TIEFLING_DATA: Race`**:
    *   This is a `Race` object (type defined in `src/types.ts`) containing the core details for the Tiefling race.
    *   It contains a `fiendishLegacies` property, which is assigned the `FIENDISH_LEGACIES_DATA` array.

### `Race` Object Properties for Tiefling

*   **`id: string`**: `"tiefling"`
*   **`name: string`**: `"Tiefling"`
*   **`description: string`**: A detailed description of Tieflings and their fiendish heritage.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`).
*   **`traits: string[]`**: An array of strings describing racial traits, including:
    *   **Creature Type**: Humanoid.
    *   **Size**: Medium or Small.
    *   **Speed**: 30 feet.
    *   **Darkvision**: 60 feet.
    *   **Fiendish Legacy**: The core racial choice that grants supernatural abilities. This choice is handled during character creation.
    *   **Otherworldly Presence**: Grants the *Thaumaturgy* cantrip.
*   **`fiendishLegacies: FiendishLegacy[]`**: Contains the array of legacy options for the selection component.

## Usage

*   **`src/data/races/index.ts`**: Imports both `TIEFLING_DATA` and `FIENDISH_LEGACIES_DATA` (aliased as `TIEFLING_LEGACIES_DATA`), adding the former to `ALL_RACES_DATA` and re-exporting the latter for easy access.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Tiefling as a selectable race.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**:
    *   Handles the selection of the Tiefling race.
    *   Routes to the `TieflingLegacySelection.tsx` component for the player to choose their legacy and associated spellcasting ability.
    *   Includes the chosen legacy (`selectedFiendishLegacyId`) and ability (`fiendishLegacySpellcastingAbility`) in the final `PlayerCharacter` object.
*   **`src/components/PlayerPane.tsx` / `CharacterSheetModal.tsx`**: Display Tiefling traits and the details of the chosen legacy.
*   **`src/constants.ts`**: `TIEFLING_DATA` and `TIEFLING_LEGACIES_DATA` become part of the globally available data.
