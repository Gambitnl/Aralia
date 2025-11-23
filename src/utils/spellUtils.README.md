# Spell Utilities (`src/utils/spellUtils.ts`)

## Purpose

The `spellUtils.ts` module provides centralized helper functions related to character spellcasting. Its primary purpose is to act as a single source of truth for determining a character's complete list of known cantrips and spells, aggregating them from various sources like class features, racial traits, and subclass benefits.

## Functions

### `getCharacterSpells(character: PlayerCharacter, allSpellsData: Record<string, Spell>): CharacterSpells`
*   **Purpose**: To calculate and return the definitive list of cantrips and spells a character knows. This function is the single source of truth for spell aggregation, preventing logic duplication across different UI components.
*   **Parameters**:
    *   `character: PlayerCharacter`: The full character object. The function uses properties like `character.spellbook`, `character.race.id`, and `character.selectedElvenLineageId` to determine spell sources.
    *   `allSpellsData: Record<string, Spell>`: The complete record of all spells available in the game (typically `SPELLS_DATA` from `src/constants.ts`), used to look up full `Spell` objects from spell IDs.
*   **Returns**: An object of type `CharacterSpells` with two properties:
    *   `cantrips: Spell[]`: A de-duplicated and sorted array of all cantrips the character knows.
    *   `spells: Spell[]`: A de-duplicated and sorted array of all level 1+ spells the character knows.
*   **Logic**:
    1.  **Initializes** empty sets for cantrips and spells to handle de-duplication automatically.
    2.  **Class Spells**: If the `character.spellbook` property exists, it iterates through the `cantrips`, `knownSpells`, and `preparedSpells` ID arrays, looks up the full `Spell` object from `allSpellsData`, and adds them to the appropriate sets.
    3.  **Racial Spells**: It contains a series of checks for different races (`Aasimar`, `Elf`, `Tiefling`, etc.) and their specific sub-options (`Elven Lineage`, `Fiendish Legacy`). If a character matches, it adds the spells granted by those traits to the sets.
    4.  **Finalization**: Converts the sets to arrays and sorts them for consistent display (cantrips alphabetically, spells by level then alphabetically).

## Usage

This utility is primarily used by display components that need to show a character's full spell list, such as `PlayerPane.tsx` or a detailed view in `CharacterSheetModal.tsx`.

```tsx
// Example in a component
import { getCharacterSpells } from '../utils/spellUtils';
import { SPELLS_DATA } from '../constants';
import { PlayerCharacter } from '../types';

interface MyComponentProps {
  character: PlayerCharacter;
}

const MyComponent: React.FC<MyComponentProps> = ({ character }) => {
  const { cantrips, spells } = getCharacterSpells(character, SPELLS_DATA);

  // ... now use the 'cantrips' and 'spells' arrays to render the UI ...
};
```

## Benefits

*   **Single Source of Truth**: Consolidates all spell aggregation logic into one place. Any new race or class that grants spells only requires an update to this single function.
*   **Decoupling**: UI components no longer need to contain complex logic to figure out which spells a character has. They simply call this function.
*   **Maintainability**: Easier to debug and update spell-granting rules without having to search through multiple components.
*   **Supports Refactoring**: Central to the effort of moving away from storing full `Spell` objects on the `PlayerCharacter` state and instead deriving them from spell IDs.
