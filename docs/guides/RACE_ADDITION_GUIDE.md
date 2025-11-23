# Guide: Adding a New Character Race to Aralia RPG

This guide outlines the complete process for adding a new character race to the Aralia RPG application. This involves two main parts:
1.  **Character Creator Integration**: Making the race selectable and functional in the game.
2.  **Glossary Integration**: Adding the race's lore and details to the in-game glossary.

---

## Part 1: Character Creator Integration

This is the most critical part, ensuring the race works mechanically.

### Step 1: Define Race Game Data

*   **File Location**: `src/data/races/`
*   **Action**: Create a new TypeScript file named `[race_id].ts` (e.g., `orc.ts`).
*   **Content**: Inside this file, define and export a `Race` object.

    **Example (`src/data/races/orc.ts`):**
    ```typescript
    import { Race } from '../../types';

    export const ORC_DATA: Race = {
      id: 'orc',
      name: 'Orc',
      description: 'Orcs are known for their formidable strength and resilience...',
      abilityBonuses: [], // Leave empty for flexible ASIs handled by Point Buy.
      traits: [
        'Creature Type: Humanoid',
        'Size: Medium (about 6–7 feet tall)',
        'Speed: 30 feet',
        'Darkvision (120ft)',
        'Relentless Endurance: ...',
        // Add all other racial traits as descriptive strings.
      ],
      // Optional: Add an image URL for the RaceSelection modal.
      imageUrl: '/assets/images/races/orc.png', 
      // Optional: If the race has unique choices, define them here.
      // e.g., fiendishLegacies: FIENDISH_LEGACIES_DATA (for Tieflings)
    };
    ```

### Step 2: Register the Race

*   **File Location**: `src/data/races/index.ts`
*   **Action**: Import your new race data and add it to the `ALL_RACES_DATA` object. This makes it available to the rest of the application.

    **Example (`src/data/races/index.ts`):**
    ```typescript
    // ... other imports
    import { ORC_DATA } from './orc'; // Import your new race data

    export const ALL_RACES_DATA: Record<string, Race> = {
      // ... existing races
      [ORC_DATA.id]: ORC_DATA, // Add your new race here
    };
    ```

### Step 3: Handle Race-Specific Choices (If Applicable)

If your new race has a unique choice that needs its own screen (e.g., Tiefling Legacy, Goliath Ancestry), follow these steps. If not, you can skip to Step 4.

1.  **Update the State Machine (`src/components/CharacterCreator/state/characterCreatorState.ts`)**:
    *   **`CreationStep` Enum**: Add a new step for your race's choice (e.g., `OrcClanSelection`).
    *   **`CharacterCreationState` Interface**: Add a new property to store the selection (e.g., `selectedOrcClanId: string | null;`).
    *   **`initialCharacterCreatorState`**: Initialize your new property to `null`.
    *   **`CharacterCreatorAction` Type**: Define a new action type for the selection (e.g., `{ type: 'SELECT_ORC_CLAN'; payload: string }`). Add it to the `RaceSpecificFinalSelectionAction` union.
    *   **`characterCreatorReducer` Function**:
        *   Update `determineNextStepAfterRace` to return your new `CreationStep` when your race is selected.
        *   Update the `stepDefinitions` object to correctly handle `GO_BACK` logic from your new step and from steps that follow it.
        *   Add a `case` in `handleRaceSpecificFinalSelectionAction` for your new action type (e.g., `SELECT_ORC_CLAN`) to update the state and transition to the next step (usually `CreationStep.Class`).

2.  **Create the UI Component**:
    *   **Location**: `src/components/CharacterCreator/Race/`
    *   **Action**: Create a new `.tsx` file (e.g., `OrcClanSelection.tsx`).
    *   **Content**: This component should display the choices and call the `onSelect` prop (which dispatches your new action) when the user confirms. Refer to the existing components in this directory for examples:
        *   `ElfLineageSelection.tsx`
        *   `GiantAncestrySelection.tsx` (for Goliaths)
        *   `TieflingLegacySelection.tsx`
        *   `AarakocraSpellcastingAbilitySelection.tsx`
        *   `CentaurNaturalAffinitySkillSelection.tsx`
        *   `ChangelingInstinctsSelection.tsx`
        *   `DeepGnomeSpellcastingAbilitySelection.tsx`
        *   `DuergarMagicSpellcastingAbilitySelection.tsx`

3.  **Integrate into Character Creator (`src/components/CharacterCreator/CharacterCreator.tsx`)**:
    *   Import your new UI component.
    *   Add a `case` to the `renderStep()` function to render your component when `state.step` matches the `CreationStep` you added.

### Step 4: Update Character Assembly Logic

*   **File Location**: `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`
*   **Action**: If your race has unique traits that affect stats, or requires a specific choice, you must update the assembly logic.
    *   **`validateAllSelectionsMade`**: Add a check to ensure the player has made any required choices for your new race (e.g., `if (selectedRace.id === 'orc' && !selectedOrcClanId) return false;`).
    *   **Calculation Helpers**: If your race affects HP, speed, darkvision, or grants spells/skills, update the corresponding helper functions (`calculateCharacterMaxHp`, `calculateCharacterSpeed`, `calculateCharacterDarkvision`, `assembleFinalKnownCantrips`, `assembleFinalKnownSpells`, `assembleFinalSkills`) to include logic for your race's traits.
    *   **`generatePreviewCharacter`**: Ensure any new state properties for your race's choices are included in the final `PlayerCharacter` object that this function builds.

### Step 5: Update Display Components

*   **File Location**: `src/components/CharacterSheetModal.tsx` and `src/components/PartyPane.tsx` (for completeness).
*   **Action**: Add logic to display your new race's unique traits, if any (e.g., a section showing the chosen Orc Clan).

---

## Part 2: Glossary Integration

This part makes the race's lore discoverable in the in-game glossary.

### Step 1: Glossary Structure for Hierarchical Races

For races with sub-options (like subraces, lineages, or ancestries), a specific parent-child structure must be followed for clarity and consistency.

*   **Parent Entry (`elf.md`, `goliath.md`)**:
    *   This file should contain the general lore and common traits of the main race.
    *   It **must** include a section (e.g., inside a `<details>` block) that introduces the sub-options and explicitly tells the user to select one from the specific entries listed below it in the glossary sidebar. **Do not detail the sub-options within the parent file.**
    *   **Example from `elf.md`**:
        ```html
        <details markdown="1">
          <summary>Elven Lineage</summary>
          <div>
            <p>You are part of a lineage that grants you supernatural abilities. Choose one of the lineages from the entries below this one in the glossary...</p>
          </div>
        </details>
        ```

*   **Child Entries (`drow.md`, `goliath_ancestry_cloud.md`)**:
    *   Each child entry represents a single sub-option.
    *   This file must be **comprehensive**. It should contain a full "Traits" section that lists **both the common traits inherited from the parent race** (e.g., Darkvision, Fey Ancestry) **and the unique traits of that specific sub-option**.
    *   Every trait in this list should be wrapped in its own `<details>` and `<summary>` block for a clean, expandable UI.
    *   **Example from a subrace file**:
        ```markdown
        ---
        ## [Subrace Name] Traits
        ...
        <details>
          <summary>Fey Ancestry (Common Trait)</summary>
          <div><p>Description of Fey Ancestry...</p></div>
        </details>
        <details>
          <summary>Unique Subrace Trait</summary>
          <div><p>Description of the unique trait...</p></div>
        </details>
        ...
        ```

### Step 2: Create the Glossary Markdown File(s)

*   **Create the File(s)**: Following the structure above, create Markdown files for your race and any sub-options in the appropriate `public/data/glossary/entries/races/` subdirectories.
*   **Content**:
    *   Add YAML frontmatter to each file. Ensure the `filePath` points to the file's own location.
    *   Write the main content using Markdown and `<details>` blocks as specified in the structure above and in the main `GLOSSARY_ENTRY_DESIGN_GUIDE.md`.
    *   **For any tables (like a Draconic Ancestry table), refer to the <span data-term-id="table_creation_guide" class="glossary-term-link-from-markdown">Table Creation Guide</span> for detailed formatting instructions and best practices.**

### Step 3: Update the JSON Index (Manual Step)

*   **File**: `public/data/glossary/index/character_races.json`
*   **Action**:
    1.  Run `node scripts/generateGlossaryIndex.js` to add your new files to the index.
    2.  Manually edit `character_races.json` to create the nested `subEntries` structure. For detailed instructions, see the **"Creating Hierarchical Entries"** section in the `GLOSSARY_ENTRY_DESIGN_GUIDE.md`.

By completing both Part 1 and Part 2, you will have fully integrated a new race into the game.
