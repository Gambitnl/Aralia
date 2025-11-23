
# Deep Gnome Race Data (`src/data/races/deep_gnome.ts`)

## Purpose

The `src/data/races/deep_gnome.ts` file defines the data for the **standalone Deep Gnome (Svirfneblin) race** in the Aralia RPG. This data is based on the information provided for Deep Gnomes in "Mordenkainen Presents: Monsters of the Multiverse" (pg. 11), adapted to the game's flexible Ability Score Increase system (Point Buy).

This represents Deep Gnomes as a distinct primary race choice available during character creation, separate from any "Deep Gnome" subrace option that might be available for the standard Gnome race.

## Structure

The file exports a single constant:

*   **`DEEP_GNOME_DATA: Race`**
    *   This is a `Race` object (type defined in `src/types.ts`) containing all the specific details for the Deep Gnome race.

### `Race` Object Properties for Deep Gnome

*   **`id: string`**: `"deep_gnome"`
*   **`name: string`**: `"Deep Gnome (Svirfneblin)"`
*   **`description: string`**: A detailed description of Deep Gnomes, their connection to the Underdark, and their general characteristics.
*   **`abilityBonuses?: RacialAbilityBonus[]`**: This is an empty array (`[]`). Ability Score Increases are handled by the Point Buy system during character creation, as per the game's design ("increase one score by 2 and increase a different score by 1, or increase three different scores by 1").
*   **`traits: string[]`**: An array of strings, where each string describes a racial trait. Key traits include:
    *   **Creature Type**: Humanoid. Also considered a gnome for prerequisites.
    *   **Size**: Small.
    *   **Speed**: 30 feet.
    *   **Darkvision**: Superior Darkvision with a range of 120 feet.
    *   **Gift of the Svirfneblin**: Grants the ability to cast *Disguise Self* (starting at 3rd character level) and *Nondetection* (starting at 5th character level). The spellcasting ability for these spells (Intelligence, Wisdom, or Charisma) is chosen by the player during character creation via the `DeepGnomeSpellcastingAbilitySelection.tsx` component. Spells can be cast once per Long Rest without a spell slot, or using appropriate spell slots if available.
    *   **Gnomish Magic Resistance**: Advantage on Intelligence, Wisdom, and Charisma saving throws against spells.
    *   **Svirfneblin Camouflage**: Advantage on Dexterity (Stealth) checks, usable a number of times equal to proficiency bonus per long rest. (Note: Usage tracking and specific mechanical enforcement of this trait in varied terrain are not yet fully implemented in game logic).
    *   **Languages**: Common and one other language (typically Undercommon or Gnomish).
*   `elvenLineages`, `gnomeSubraces`, `giantAncestryChoices`, `fiendishLegacies`: These are `undefined` for the standalone Deep Gnome race as it does not have these specific sub-options.

## Usage

*   **`src/data/races/index.ts`**: Imports `DEEP_GNOME_DATA` and includes it in the `ALL_RACES_DATA` collection, making it available for selection.
*   **`src/components/CharacterCreator/RaceSelection.tsx`**: Displays Deep Gnome as a selectable race.
*   **`src/components/CharacterCreator/CharacterCreator.tsx`**:
    *   Handles the selection of the Deep Gnome race.
    *   Routes to the `DeepGnomeSpellcastingAbilitySelection.tsx` step for the player to choose their spellcasting ability for "Gift of the Svirfneblin".
    *   Includes the chosen ability (`deepGnomeSpellcastingAbility`) and granted spells (`Disguise Self`, `Nondetection`) in the final `PlayerCharacter` object.
*   **`src/components/PlayerPane.tsx`**: Displays Deep Gnome traits, including their Darkvision (120ft), Gnomish Magic Resistance, Svirfneblin Camouflage, and the spells from Gift of the Svirfneblin along with the chosen spellcasting ability.
*   **`src/constants.ts`**: `DEEP_GNOME_DATA` becomes part of `RACES_DATA` which is exported for global access.

## Adding or Modifying Deep Gnome Data

*   To modify traits, edit the strings within the `traits` array in `DEEP_GNOME_DATA`.
*   Ensure that any spells referenced (like 'disguise_self', 'nondetection') exist in `src/data/spells/index.ts`. Their details (level, description) are sourced from there.
*   If new player choices are introduced for Deep Gnomes (beyond the spellcasting ability for Gift of the Svirfneblin), `src/types.ts` (for `PlayerCharacter`) and `src/components/CharacterCreator/CharacterCreator.tsx` would need corresponding updates.
*   Mechanical implementations (like proficiency bonus-based uses or level gating for spells) are handled in game logic components, not directly in this data file.
