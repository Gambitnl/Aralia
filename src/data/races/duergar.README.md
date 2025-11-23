# Duergar Race Data (`src/data/races/duergar.ts`)

## Purpose

The `src/data/races/duergar.ts` file defines the data for the Duergar race in the Aralia RPG. This data is based on "Mordenkainen Presents: Monsters of the Multiverse" (pg. 12), adapted to the game's flexible Ability Score Increase system (Point Buy).

Duergar are presented as a distinct primary race choice available during character creation.

## Structure

The file exports a single constant:

*   **`DUERGAR_DATA: Race`**
    *   This is a `Race` object (type defined in `src/types.ts`) containing all the specific details for the Duergar race.

### `Race` Object Properties for Duergar

*   **`id: string`**: `"duergar"`
*   **`name: string`**: `"Duergar"`
*   **`description: string`**: A detailed description of Duergar, their Underdark origins, psionic alterations, and typical lifespan.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`). Ability Score Increases are handled by the Point Buy system during character creation, as per the source material ("increase one score by 2 and increase a different score by 1, or increase three different scores by 1").
*   **`traits: string[]`**: An array of strings, where each string describes a racial trait. Key traits include:
    *   **Creature Type**: Humanoid. Also considered a dwarf for any prerequisite or effect that requires you to be a dwarf.
    *   **Size**: Medium.
    *   **Speed**: 30 feet.
    *   **Darkvision**: Superior Darkvision with a range of 120 feet.
    *   **Duergar Magic**: Grants the ability to cast *Enlarge/Reduce* on oneself (starting at 3rd character level) and *Invisibility* on oneself (starting at 5th character level). The spellcasting ability for these spells (Intelligence, Wisdom, or Charisma) is chosen by the player during character creation via the `DuergarMagicSpellcastingAbilitySelection.tsx` component. Spells can be cast once per Long Rest without a spell slot, or using appropriate spell slots if available.
    *   **Dwarven Resilience**: Advantage on saving throws against being poisoned and resistance to poison damage.
    *   **Psionic Fortitude**: Advantage on saving throws against being charmed or stunned.
    *   **Languages**: Common and one other language (typically Dwarvish or Undercommon, player's choice).
*   `elvenLineages`, `gnomeSubraces`, `giantAncestryChoices`, `fiendishLegacies`: These are `undefined` for the Duergar race as it does not have these specific sub-options.

## Usage

*   **`src/data/races/index.ts`**: Imports `DUERGAR_DATA` and includes it in the `ALL_RACES_DATA` collection, making it available for selection.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Duergar as a selectable race.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**:
    *   Handles the selection of the Duergar race.
    *   Routes to the `DuergarMagicSpellcastingAbilitySelection.tsx` step for the player to choose their spellcasting ability for "Duergar Magic".
    *   Includes the chosen ability (`duergarMagicSpellcastingAbility`) and granted spells (`Enlarge/Reduce`, `Invisibility`) in the final `PlayerCharacter` object.
*   **`src/components/PlayerPane.tsx`**: Displays Duergar traits, including their Darkvision (120ft), Dwarven Resilience, Psionic Fortitude, Duergar Magic, and the chosen spellcasting ability.
*   **`src/constants.ts`**: `DUERGAR_DATA` becomes part of `RACES_DATA` which is exported for global access.

## Adding or Modifying Duergar Data

*   To modify traits, edit the strings within the `traits` array in `DUERGAR_DATA`.
*   Ensure that any spells referenced (like 'enlarge_reduce', 'invisibility') exist in `src/data/spells/index.ts`. Their details (level, description) are sourced from there.
*   Mechanical implementations (like proficiency bonus-based uses or level gating for spells) are handled in game logic components, not directly in this data file.
