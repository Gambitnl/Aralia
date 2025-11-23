
# Classes Data (`src/data/classes/index.ts`)

## Purpose

The `src/data/classes/index.ts` file defines all the player character classes available in the Aralia RPG (e.g., Fighter, Cleric, Wizard). This data is fundamental to the character creation process, determining a character's hit points, proficiencies, starting features, spellcasting abilities (if any), and options for class-specific choices like Fighting Styles or Divine Domains. It also includes fields for stat recommendations to guide players during ability score allocation.

## Structure

The file exports a single constant:

*   **`CLASSES_DATA: Record<string, Class>`** (Note: `Class` is aliased as `CharClass` in some files to avoid keyword conflict)
    *   This is an object where each key is a unique string identifier for a class (e.g., `'fighter'`, `'cleric'`). This ID is used internally to reference the class.
    *   The value for each key is a `Class` object, defined in `src/types.ts`.

Internal constants like `FIGHTING_STYLES_DATA`, `LIFE_DOMAIN`, `CLERIC_SPELL_LIST`, etc., are defined within this file to structure the data before assembling the final `CLASSES_DATA` export.

### `Class` Object Properties

Each `Class` object has numerous properties, including:

*   **`id: string`**: Unique class identifier.
*   **`name: string`**: Display name (e.g., "Fighter").
*   **`description: string`**: A brief overview of the class.
*   **`hitDie: number`**: The die type used for hit points (e.g., `10` for a d10).
*   **`primaryAbility: AbilityScoreName[]`**: Array of primary ability scores for the class.
*   **`savingThrowProficiencies: AbilityScoreName[]`**: Abilities in which the class grants saving throw proficiency.
*   **`skillProficienciesAvailable: string[]`**: A list of skill IDs from which the player can choose their skill proficiencies.
*   **`numberOfSkillProficiencies: number`**: The number of skills the player can choose from the available list.
*   **`armorProficiencies: string[]`**: List of armor types the class is proficient with (e.g., "All armor", "Light armor").
*   **`weaponProficiencies: string[]`**: List of weapon types the class is proficient with (e.g., "Simple weapons", "Martial weapons").
*   **`features: ClassFeature[]`**: Array of features gained by the class at various levels (currently focused on Level 1).
    *   Each `ClassFeature` has `id`, `name`, `description`, and `levelAvailable`.
*   **`fightingStyles?: FightingStyle[]`**: (For Fighter) An array of `FightingStyle` options.
*   **`divineDomains?: DivineDomain[]`**: (For Cleric) An array of `DivineDomain` options. Each domain includes its own features and domain spells.
*   **`spellcasting?: { ability: AbilityScoreName; knownCantrips: number; knownSpellsL1: number; spellList: string[]; }`**: (For spellcasting classes like Cleric, Wizard)
    *   `ability`: The spellcasting ability for the class.
    *   `knownCantrips`: Number of cantrips known at Level 1.
    *   `knownSpellsL1`: Number of Level 1 spells known/prepared at Level 1.
    *   `spellList`: An array of spell IDs available to this class.
*   **`statRecommendationFocus?: AbilityScoreName[]`**: An optional array of `AbilityScoreName`s suggesting primary stats for players to focus on during Point Buy.
*   **`statRecommendationDetails?: string`**: Optional textual advice or rationale for the stat recommendations.

## Example Entry (Fighter)

```typescript
// Simplified from src/data/classes/index.ts
export const CLASSES_DATA: Record<string, CharClass> = {
  'fighter': {
    id: 'fighter', name: 'Fighter', description: 'Masters of combat...',
    hitDie: 10, primaryAbility: ['Strength', 'Dexterity'], /* ... */
    fightingStyles: Object.values(FIGHTING_STYLES_DATA),
    statRecommendationFocus: ['Strength', 'Dexterity', 'Constitution'],
    statRecommendationDetails: "Prioritize Strength OR Dexterity. Constitution is vital..."
  },
  // ... other classes
};
```

## Usage

*   **Character Creation (`src/components/CharacterCreator/`)**:
    *   `ClassSelection.tsx`: Uses `CLASSES_DATA` to display available classes for selection.
    *   `AbilityScoreAllocation.tsx`: Uses the `statRecommendationFocus` and `statRecommendationDetails` from the selected class to display the Stat Recommender.
    *   `SkillSelection.tsx`: Uses `numberOfSkillProficiencies` and `skillProficienciesAvailable`.
    *   `FighterFeatureSelection.tsx`, `ClericFeatureSelection.tsx`, `WizardFeatureSelection.tsx`: Use class-specific data like `fightingStyles`, `divineDomains`, and `spellcasting` information.
    *   The main `CharacterCreator.tsx` uses this data to guide the creation steps and assemble the final `PlayerCharacter` object.
*   **`PlayerPane.tsx`**: Displays the character's class name and potentially class-specific features.
*   **`src/constants.ts`**: Imports and re-exports `CLASSES_DATA` for global access.

## Adding a New Class

1.  Define any class-specific structures (like new types of domains, fighting styles, or unique feature sets) if necessary.
2.  Create a new entry in the `CLASSES_DATA` object in `src/data/classes/index.ts`.
3.  Populate all required fields of the `Class` type.
4.  Define `statRecommendationFocus` and `statRecommendationDetails` to guide players.
5.  If the class has unique selection choices at Level 1 (beyond standard skill/spell selection), you may need to:
    *   Add new properties to the `Class` type in `src/types.ts`.
    *   Create a new feature selection component in `src/components/CharacterCreator/Class/`.
    *   Update `CharacterCreator.tsx` to include a new `CreationStep` and logic to render this component.
6.  Ensure any new spell lists reference valid spell IDs from `src/data/spells/index.ts`.
