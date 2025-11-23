
# Aarakocra Race Data (`src/data/races/aarakocra.ts`)

## Purpose

The `src/data/races/aarakocra.ts` file defines the data for the Aarakocra race in the Aralia RPG. This data is based on "Mordenkainen Presents: Monsters of the Multiverse," adapted to use the game's flexible Ability Score Increase system (Point Buy).

## Structure

The file exports a single constant:

*   **`AARAKOCRA_DATA: Race`**
    *   This is a `Race` object (type defined in `src/types.ts`) containing all the specific details for the Aarakocra race.

### `Race` Object Properties for Aarakocra

*   **`id: string`**: `"aarakocra"`
*   **`name: string`**: `"Aarakocra"`
*   **`description: string`**: A detailed description of the Aarakocra, their origins, and physical appearance.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`). Ability Score Increases are handled by the Point Buy system.
*   **`traits: string[]`**: An array of strings describing racial traits. Key traits include:
    *   **Creature Type**: Humanoid.
    *   **Size**: Medium.
    *   **Speed**: 30 feet.
    *   **Flight**: Grants a flying speed equal to walking speed, with restrictions for medium or heavy armor.
    *   **Talons**: Defines their natural unarmed strikes.
    *   **Wind Caller**: Grants the ability to cast *Gust of Wind* starting at 3rd level. The spellcasting ability for this spell (Intelligence, Wisdom, or Charisma) is chosen by the player during character creation.
*   **`imageUrl?: string`**: An optional URL for a race image, used in the `RaceSelection` modal.

## Usage

*   **`src/data/races/index.ts`**: Imports `AARAKOCRA_DATA` and adds it to the `ALL_RACES_DATA` collection.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Aarakocra as a selectable race.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**:
    *   Handles the selection of the Aarakocra race.
    *   Routes to the `AarakocraSpellcastingAbilitySelection.tsx` component for the player to choose their spellcasting ability for the "Wind Caller" trait.
    *   Includes the chosen ability (`aarakocraSpellcastingAbility`) in the final `PlayerCharacter` object.
*   **`src/components/PlayerPane.tsx` / `CharacterSheetModal.tsx`**: Display Aarakocra traits.
*   **`src/constants.ts`**: `AARAKOCRA_DATA` becomes part of the globally available `RACES_DATA`.
