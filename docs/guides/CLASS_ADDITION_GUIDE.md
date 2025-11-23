# Guide: Adding a New Character Class to Aralia RPG

This guide outlines the complete process for adding a new character class (e.g., "Sorcerer," "Warlock," "Paladin") to the Aralia RPG application. This guide reflects the current, refactored architecture using a centralized state reducer and character assembly hook.

## 1. Define Class Game Data

*   **File**: `src/data/classes/index.ts`
*   **Action**: Add a new entry for your class within the `CLASSES_DATA` object.
*   **Details**:
    *   Define its `id`, `name`, `description`, `hitDie`, `primaryAbility`, `savingThrowProficiencies`.
    *   Specify `skillProficienciesAvailable` (list of skill IDs) and `numberOfSkillProficiencies`.
    *   List `armorProficiencies` and `weaponProficiencies`.
    *   Define any level 1 `features` (using the `ClassFeature` type).
    *   **Spellcasting**: If it's a spellcasting class, add a `spellcasting` object with `ability`, `knownCantrips`, `knownSpellsL1`, and a `spellList`.
    *   **Class-Specific Choices**: If the class has unique choices at level 1 (like a Fighter's Fighting Style), define the data for these choices and add the corresponding optional property to the `Class` type in `src/types.ts`.
    *   **Stat Recommendations**:
        *   Add `statRecommendationFocus: AbilityScoreName[]`.
        *   Add `statRecommendationDetails: string`.
        *   Add `recommendedPointBuyPriorities: AbilityScoreName[]`.

    **Example Snippet (Illustrative for a new "Sorcerer" class):**
    ```typescript
    // In src/data/classes/index.ts

    const SORCERER_SPELL_LIST = ['fire_bolt', 'mage_hand', /* ... */ ];

    export const CLASSES_DATA: Record<string, CharClass> = {
      // ... existing classes ...
      'sorcerer': {
        id: 'sorcerer',
        name: 'Sorcerer',
        description: 'An innate spellcaster drawing power from a magical bloodline or event.',
        hitDie: 6,
        primaryAbility: ['Charisma'],
        savingThrowProficiencies: ['Constitution', 'Charisma'],
        skillProficienciesAvailable: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
        numberOfSkillProficiencies: 2,
        armorProficiencies: [],
        weaponProficiencies: ['Daggers', 'Slings', 'Quarterstaffs'],
        spellcasting: {
          ability: 'Charisma',
          knownCantrips: 4,
          knownSpellsL1: 2,
          spellList: SORCERER_SPELL_LIST,
        },
        statRecommendationFocus: ['Charisma', 'Constitution'],
        statRecommendationDetails: "Charisma fuels your magic. Constitution helps you survive.",
        recommendedPointBuyPriorities: ['Charisma', 'Constitution', 'Dexterity', 'Wisdom', 'Intelligence', 'Strength'],
      },
    };
    ```

## 2. Update Application Types (If Necessary)
*   **File**: `src/types.ts`
*   **Action**: If you added a new type of class-specific choice (like a `SorcererBloodline`), define its interface here.

## 3. Create Feature Selection UI (If Necessary)
*   **Location**: `src/components/CharacterCreator/Class/`
*   **Action**: If your class has a unique choice that requires its own selection screen, create a new `.tsx` component for it (e.g., `SorcererFeatureSelection.tsx`).
*   **Details**: This component will receive a `dispatch` function via props and will call it with a specific action type, rather than calling a simple `useState` setter. Refer to `FighterFeatureSelection.tsx` for an example.

### Handling Complex Feature Selections (e.g., Ranger)
Some classes may require multiple types of choices on a single feature selection screen. For example, the Ranger needs to select both a **Fighting Style** and **Prepared Spells**. In this case, the feature selection component (`RangerFeatureSelection.tsx`) handles the local state for each choice (the selected style, the chosen spells, etc.).

When the user confirms their selections, the component dispatches a **single action** with a complex payload containing all the choices.

**Example Action Dispatch for Ranger:**
```typescript
// In RangerFeatureSelection.tsx
const handleConfirm = () => {
    // ... validation ...
    dispatch({
        type: 'SELECT_RANGER_FEATURES',
        payload: { 
            style: selectedFightingStyle, 
            spellsL1: selectedSpells, 
            cantrips: selectedCantrips // Only if Druidic Warrior was chosen
        }
    });
}
```

This pattern keeps the `CharacterCreator`'s state logic clean while allowing for complex, multi-part selection UIs.

## 4. Integrate into CharacterCreator State Machine

This is the most critical part of the integration and reflects the `useReducer` architecture.

*   **File**: `src/components/CharacterCreator/state/characterCreatorState.ts`
*   **Actions**:
    1.  **Add Step**: Add a new step to the `CreationStep` enum for your new feature selection screen.
    2.  **Update State Interface**: Add properties to the `CharacterCreationState` interface to hold the new selection's data (e.g., `selectedSorcererBloodline: string | null;` or `selectedFightingStyle: FightingStyle | null;`).
    3.  **Update Initial State**: Update `initialCharacterCreatorState` to initialize your new properties to `null`.
    4.  **Define Action**: Define a new action type in `CharacterCreatorAction` and add it to the `ClassFeatureFinalSelectionAction` union. This action can have a complex payload, as seen with the Ranger example above.
    5.  **Update Reducer**: Update the `characterCreatorReducer` function to handle your new action. The `case` for your action should update all relevant state properties from the payload and transition the `step` to `CreationStep.NameAndReview`.
    6.  **Update Back Navigation**: Update the `stepDefinitions` object to correctly handle `GO_BACK` logic from your new step and from steps that follow it.

*   **File**: `src/components/CharacterCreator/CharacterCreator.tsx`
*   **Actions**:
    1.  **Import Component**: Import your new UI component from `src/components/CharacterCreator/Class/`.
    2.  **Render Step**: Add a `case` to the `renderStep()` function to render your new component when the `state.step` matches the `CreationStep` you added.
    3.  **Create Callback**: Create a `handle[NewFeature]Select` callback function that dispatches the action you created. Pass this callback as a prop to your new UI component.

## 5. Update Character Assembly Logic
*   **File**: `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`
*   **Action**: If your class affects stats or requires a specific choice, you must update the assembly logic within this hook.
    *   **`validateAllSelectionsMade`**: Add a check to ensure the new class's specific choices have been made (e.g., `if (state.selectedClass.id === 'ranger' && !state.selectedFightingStyle) return false;`).
    *   **Calculation Helpers**: If your class affects HP, speed, darkvision, or grants spells/skills, update the corresponding helper functions (`calculateCharacterMaxHp`, `calculateCharacterSpeed`, `calculateCharacterDarkvision`, `assembleCastingProperties`, `assembleFinalSkills`) to include logic for your new class.
    *   **`generatePreviewCharacter`**: Ensure any new state properties for your class's choices are included in the final `PlayerCharacter` object that this function builds.

## 6. Create Glossary Entry
*   **File Location**: `public/data/glossary/entries/classes/[class_id].md`
*   **Action**: Create a new Markdown file for your class.
*   **Content**:
    *   Follow the structure of the most recent class files (`druid.md`, `paladin.md`).
    *   Add YAML frontmatter with `id`, `title`, `category`, `tags`, `excerpt`, and `filePath`.
    *   **CRITICAL**: The main body of your glossary entry (feature descriptions, etc.) should **not** use raw HTML tags like `<details>` for structure. The `GlossaryContentRenderer` component now automatically creates collapsible sections from `###` Markdown headings.
    *   **Tables**:
        *   For the main "At a Glance" summary table at the top, you **MAY** use custom HTML (wrapped in `<div class="not-prose">`) to achieve the specific required layout, as seen in `paladin.md`.
        *   For all other tables (like feature progressions), you **MUST** use standard GitHub-Flavored Markdown syntax.
        *   Refer to `docs/guides/TABLE_CREATION_GUIDE.md` for detailed instructions.
    *   Use `<span data-term-id="...">` to link to other relevant glossary terms.

## 7. Update Glossary Index
*   **Action**: Run the indexer script `node scripts/generateGlossaryIndex.js`. This will find your new `.md` file and add its frontmatter data to `public/data/glossary/index/character_classes.json`.
*   **Manual Edit (For Hierarchy)**: If your new class has subclasses, you must then manually edit `character_classes.json` to move the subclass entries into the `subEntries` array of the parent class object. Refer to the **"Creating Hierarchical Entries"** section in the `GLOSSARY_ENTRY_DESIGN_GUIDE.md` for instructions.