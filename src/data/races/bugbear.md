# Bugbear Race Data (`src/data/races/bugbear.ts`)

## Purpose

The `src/data/races/bugbear.ts` file defines the data for the Bugbear race in the Aralia RPG. This data is based on "Mordenkainen Presents: Monsters of the Multiverse" (pg. 8), adapted to the game's flexible Ability Score Increase system (Point Buy).

## Structure

The file exports a single constant:

*   **`BUGBEAR_DATA: Race`**
    *   This is a `Race` object (type defined in `src/types.ts`) containing all the specific details for the Bugbear race.

### `Race` Object Properties for Bugbear

*   **`id: string`**: `"bugbear"`
*   **`name: string`**: `"Bugbear"`
*   **`description: string`**: A detailed description of Bugbears, their fey origins, and general characteristics.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`). Ability Score Increases are handled by the Point Buy system or Flexible ASI step.
*   **`traits: string[]`**: An array of strings describing racial traits:
    *   **Creature Type**: Humanoid (and goblinoid).
    *   **Size**: Medium.
    *   **Speed**: 30 feet.
    *   **Darkvision**: 60 feet.
    *   **Fey Ancestry**: Advantage on saving throws against being charmed.
    *   **Long-Limbed**: Increased reach for melee attacks.
    *   **Powerful Build**: Counts as one size larger for carrying capacity and related checks.
    *   **Sneaky**: Grants proficiency in the Stealth skill and allows moving/stopping in spaces suitable for Small creatures.
    *   **Surprise Attack**: Extra damage on attacks against creatures that haven't taken a turn in combat.
    *   **Languages**: Common and Goblin.
    *   A note about flexible ASIs (handled by the character creation system).
*   Other race-specific fields like `elvenLineages`, `gnomeSubraces`, etc., are `undefined`.

## Usage

*   **`src/data/races/index.ts`**: Imports `BUGBEAR_DATA` and adds it to `ALL_RACES_DATA`.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Bugbear as a race option.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**: Handles Bugbear selection and flow (to Flexible ASI, then Class).
*   **`src/components/CharacterCreator/SkillSelection.tsx`**: Recognizes Bugbears and automatically grants Stealth proficiency, disabling it as a class choice.
*   **`src/components/CharacterCreator/hooks/useCharacterAssembly.ts`**: The `assembleFinalSkills` function ensures Stealth is included.
*   **`src/components/PlayerPane.tsx` / `CharacterSheetModal.tsx`**: Display Bugbear traits.
*   **`src/constants.ts`**: `BUGBEAR_DATA` becomes part of the globally available `RACES_DATA`.
