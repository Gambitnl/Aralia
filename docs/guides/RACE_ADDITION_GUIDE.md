# Guide: Adding a New Character Race to Aralia RPG

This guide outlines the complete process for adding a new character race to the Aralia RPG application. This involves two main parts:
1.  **Character Creator Integration**: Making the race selectable and functional in the game.
2.  **Glossary Integration**: Adding the race's lore and details to the in-game glossary.

---

## Part 1: Character Creator Integration

This is the most critical part, ensuring the race works mechanically.

### Step 1: Define Race Game Data

*   **File Location**: `src/data/races/`
*   **Action**: Create a new TypeScript file named `[race_id].ts` (e.g., `hill_dwarf.ts`).
*   **Content**: Inside this file, define and export a `Race` object.

    **Example (`src/data/races/hill_dwarf.ts`):**
    ```typescript
    import { Race } from '../../types';

    export const HILL_DWARF_DATA: Race = {
      id: 'hill_dwarf',
      name: 'Hill Dwarf',
      baseRace: 'dwarf', // REQUIRED for accordion grouping - use parent race id
      // isSelectableAsBase: false, // Optional - set to false if this race cannot be selected without further choices
      description: 'Hill dwarves are known for their wisdom and endurance...',
      abilityBonuses: [], // Leave empty for flexible ASIs handled by Point Buy.
      traits: [
        'Creature Type: Humanoid',
        'Size: Medium (about 4-5 feet tall)',
        'Speed: 25 feet',
        'Darkvision: You have Darkvision with a range of 60 feet.',
        'Dwarven Resilience: You have Resistance to Poison damage...',
        'Dwarven Toughness: Your Hit Point maximum increases by 1...',
        // Add all other racial traits as descriptive strings.
      ],
      visual: {
        id: 'hill_dwarf',
        icon: '⛰️',
        color: '#8B4513',
        maleIllustrationPath: 'assets/images/races/hill_dwarf_male.png',
        femaleIllustrationPath: 'assets/images/races/hill_dwarf_female.png',
      },
    };
    ```

    > **Note on `baseRace`**: This property groups races in the selection UI. All races with the same `baseRace` will appear under an expandable accordion (e.g., "Dwarf (3)"). If a race has no subraces, omit this property or set it to the race's own `id`.

#### Writing the Description

Race descriptions must be **setting-agnostic** since Aralia uses procedurally generated world lore. Follow these guidelines:

1.  **Research Online**: Look up the race on D&D Beyond, wikis, or other sources to understand their core characteristics.
2.  **Remove Setting-Specific References**: Strip out any mentions of specific settings (Faerûn, Krynn, Eberron), named locations (Menzoberranzan, Waterdeep), or named deities (Moradin, Corellon).
3.  **Focus on Generic Traits**: Describe physical appearance, cultural tendencies, and typical behaviors without tying them to a specific world.
4.  **Emphasize Mechanics-Relevant Flavor**: Include details that hint at their mechanical traits (e.g., "known for their resilience" for poison resistance).

**Bad Example** (setting-specific):
> "The gold dwarves of Faerûn in their mighty southern kingdom are hill dwarves..."

**Good Example** (generic):
> "Hill dwarves possess keen senses, deep intuition, and remarkable resilience. More connected to the surface world than their subterranean kin, they often build settlements into hillsides and rolling highlands."

#### Creating the Race Images

Each race requires **two separate character illustrations** saved to `public/assets/images/races/`:
- `[race_id]_male.png` - Male character
- `[race_id]_female.png` - Female character

Use the image generator or source appropriate artwork following these guidelines:

1.  **Separate Images**: Create individual images for male and female characters (not combined).
2.  **Middle-Aged Characters**: Depict characters at a mature but not elderly age.
3.  **Everyday Attire**: Show them in common, practical clothing appropriate for their culture - not armor or adventuring gear.
4.  **Engaged in Activity**: Characters should be actively doing something related to their culture (forging, cooking, reading, crafting), not just standing idle.
5.  **Typical Environment**: Place them in a setting that matches their typical dwelling:
    - Hill Dwarves → Hillside settlements
    - Mountain Dwarves → Underground forges
    - Wood Elves → Forest clearings
    - High Elves → Elegant towers
    - Halflings → Pastoral villages
6.  **Fantasy RPG Style**: Use warm, detailed painterly digital art style suitable for a character selection screen.

**Example Prompts**:
> Male: "A middle-aged male Hill Dwarf blacksmith hammering at an anvil in a hillside dwarven village. Stone-and-turf buildings built into green hills visible in background. Practical work clothes, leather apron. Painterly digital art, fantasy RPG style, warm earthy tones."

> Female: "A middle-aged female Hill Dwarf examining gemstones at a wooden workbench in a cozy hillside workshop. Stone walls, warm lantern light. Practical artisan clothing. Painterly digital art, fantasy RPG style, warm earthy tones."

### Step 2: Register the Race

*   **File Location**: `src/data/races/index.ts`
*   **Action**: Import your new race data and add it to the `ALL_RACES_DATA` object. This object is the **single source of truth** for all race data. The `ACTIVE_RACES` array, which is used to populate the UI, is automatically derived from this object.

    **Example (`src/data/races/index.ts`):**
    ```typescript
    // ... other imports
    import { ORC_DATA } from './orc.ts'; // Import your new race data

    export const ALL_RACES_DATA: Record<string, Race> = Object.freeze({
      // ... existing races
      [ORC_DATA.id]: ORC_DATA, // Add your new race here
    });

    // ACTIVE_RACES is automatically derived from ALL_RACES_DATA.
    // No need to modify this line.
    export const ACTIVE_RACES: readonly Race[] = Object.freeze(Object.values(ALL_RACES_DATA));
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
