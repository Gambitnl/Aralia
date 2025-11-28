- [x] Plan Completed

# Plan: Refactor `PlayerCharacter` Type for Scalability

## 1. Purpose

The goal of this improvement is to refactor the `PlayerCharacter` interface in `src/types.ts`. Currently, a new optional property is added for every unique racial choice (e.g., `aarakocraSpellcastingAbility`, `selectedElvenLineageId`), which is not scalable and clutters the core character type. This plan will replace these specific properties with a single, generic `racialSelections` object, making the type cleaner and simplifying the addition of new races.

## 2. Key Rules

-   All plans will be written in a checklist format.
-   All phases of the plan will be detailed, including envisioned file/folder structures and general code direction.
-   When code is envisioned, it will be heavily accompanied by comments explaining its function and dependencies.

---

## 3. Implementation Plan

### Phase 1: Update Core Type Definition

-   [x] **Modify File**: `src/types.ts`
-   **File and Folder Structure**: This change is contained entirely within the main types file.
-   **Envisioned Code Change**:
    ```typescript
    // src/types.ts

    // Define a new, flexible interface for racial selection data.
    // This can hold any combination of choices a race might offer.
    export interface RacialSelectionData {
      // For choices from a list, like Elven Lineage, Giant Ancestry, Fiendish Legacy.
      choiceId?: string;
      // For spellcasting ability choices made for racial traits.
      spellAbility?: AbilityScoreName;
      // For skill choices like Changeling Instincts or Centaur's Natural Affinity.
      skillIds?: string[];
    }

    export interface PlayerCharacter {
      // ... existing core properties like name, race, class, abilityScores, etc. ...

      // --- DEPRECATED PROPERTIES TO BE REMOVED ---
      // selectedDraconicAncestry?: DraconicAncestryInfo;
      // selectedElvenLineageId?: ElvenLineageType;
      // elvenLineageSpellcastingAbility?: AbilityScoreName;
      // selectedGnomeSubraceId?: GnomeSubraceType;
      // gnomeSubraceSpellcastingAbility?: AbilityScoreName;
      // selectedGiantAncestryBenefitId?: GiantAncestryType;
      // selectedFiendishLegacyId?: FiendishLegacyType;
      // fiendishLegacySpellcastingAbility?: AbilityScoreName;
      // aarakocraSpellcastingAbility?: AbilityScoreName;
      // airGenasiSpellcastingAbility?: AbilityScoreName;
      // selectedCentaurNaturalAffinitySkillId?: string;
      // selectedChangelingInstinctSkillIds?: string[];
      // deepGnomeSpellcastingAbility?: AbilityScoreName;
      // duergarMagicSpellcastingAbility?: AbilityScoreName;
      // --- END DEPRECATED ---

      // --- NEW GENERIC STRUCTURE ---
      // This object will hold all racial choices, keyed by a descriptive identifier.
      racialSelections: Record<string, RacialSelectionData>;
    }
    ```

### Phase 2: Refactor Character Creation State & Logic

-   [x] **Modify State File**: `src/components/CharacterCreator/state/characterCreatorState.ts`
    -   **Code Direction**:
        1.  **Update `CharacterCreationState`**: Replace all the individual racial selection properties with the new `racialSelections: Record<string, RacialSelectionData>` object.
        2.  **Update Reducer Logic**: Refactor the `characterCreatorReducer`. Actions that previously set a single property (e.g., `SELECT_ELVEN_LINEAGE`) will now add or update an entry in the `racialSelections` object.
            ```typescript
            // Example of new reducer logic for an action
            case 'SELECT_ELVEN_LINEAGE':
              return {
                ...state,
                racialSelections: {
                  ...state.racialSelections,
                  'elven_lineage': { // A descriptive key for this choice
                    choiceId: action.payload.lineageId,
                    spellAbility: action.payload.spellAbility
                  }
                },
                step: CreationStep.Class
              };
            ```

### Phase 3: Update Character Assembly Hook

-   [x] **Modify Hook**: `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`
    -   **Code Direction**: This is a critical step. All helper functions within this hook must be updated to read from the new `racialSelections` object.
        1.  **`validateAllSelectionsMade`**: Change checks from `if (!state.selectedElvenLineageId)` to `if (!state.racialSelections['elven_lineage']?.choiceId)`.
        2.  **`calculateCharacterSpeed`**: This function will now need to access `state.racialSelections['elven_lineage']?.choiceId` to check for Wood Elf.
        3.  **`calculateCharacterDarkvision`**: Similarly, will need to check `racialSelections` for Drow lineage.
        4.  **`assembleCastingProperties`**: Will need to read from `racialSelections` to find racial spellcasting abilities and granted spells.
        5.  **`generatePreviewCharacter`**: Will populate the final `PlayerCharacter` object's `racialSelections` from the state.

### Phase 4: Update All Display and Logic Components

-   [x] **Perform a Global Refactor**: This change will touch many files that read from the `PlayerCharacter` object. A careful, systematic update is required for each.
    -   `src/components/CharacterCreator/NameAndReview.tsx`
    -   `src/components/CharacterSheetModal.tsx`
    -   `src/utils/characterUtils.ts` (specifically `getCharacterRaceDisplayString`)
    -   Any other component or utility that displays or uses racial choice information.
    -   **Code Direction**: In each file, change logic like `character.selectedElvenLineageId` to `character.racialSelections['elven_lineage']?.choiceId`. This ensures the entire application uses the new, scalable data structure.