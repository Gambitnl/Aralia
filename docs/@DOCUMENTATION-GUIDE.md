# Aralia RPG Documentation Guide

This guide outlines the documentation strategy for the Aralia RPG project, ensuring clarity, maintainability, and ease of understanding for all contributors.

## Philosophy

Our documentation aims to be:
- **Accurate:** Reflects the current state of the codebase.
- **Accessible:** Easy to find and understand.
- **Hierarchical:** Provides both high-level overviews and in-depth details.
- **Maintainable:** Structured to be updated alongside code changes.

## Documentation Structure

The project employs a multi-level system of uniquely named README files to provide comprehensive documentation.

1.  **Main Project README (`PROJECT_OVERVIEW.README.md`) (in `docs/`):**
    *   Serves as the primary entry point for understanding the project.
    *   Contains:
        *   Project overview and core features.
        *   Technology stack.
        *   Setup and running instructions.
        *   High-level project structure.
        *   Links to more detailed documentation, including component-specific READMEs, this guide, and the `README_INDEX.md`.
        *   Key development practices (dummy character, code formatting).
        *   Instructions for common tasks like adding a new race.
    *   The root `README.md` file now serves as a simple pointer to this more detailed overview.

2.  **README Index (`README_INDEX.md`) (in `docs/`):**
    *   Located at `docs/README_INDEX.md`.
    *   Serves as a "table of contents" for all README files within the project.
    *   Lists each README by its unique filename and provides a brief description of its content.
    *   Aids in discoverability and navigation of the entire documentation suite. This is the primary tool for finding specific documentation files.

3.  **Component/Module/Data READMEs (e.g., `src/components/PlayerPane.README.md` or `src/data/spells/SPELLS_DATA.README.md`):**
    *   **Naming Convention**: Each README file must have a unique and descriptive name, preferably following the `[SUBJECT].README.md` pattern (e.g., `PLAYER_PANE.README.md`, `GEMINI_SERVICE.README.md`, `ELF_DATA.README.md`). This makes the file's purpose clear from its name, independent of its directory.
    *   **Location**: Placed in the closest logical directory to the code it documents (e.g., a component's README in its component directory, a data module's README alongside its data file).
    *   Provides in-depth information about a specific part of the application.
    *   **Content Guidelines for Specific READMEs:**
        *   **Subject Name:** Clearly state the name of the component, module, service, or data structure.
        *   **Purpose:** Briefly explain what it does and its role in the application.
        *   **Props (for components):**
            *   List each prop.
            *   Specify its type (ideally linking to `types.ts` definitions if complex).
            *   Describe its purpose and how it's used.
            *   Indicate if it's optional or required.
            *   **Validation Reminder**: _Emphasize that when this component is used, all props passed to it must strictly adhere to this defined interface. Thorough validation of passed props is crucial during development and integration._
            *   **Parent Interaction Notes (Optional)**: _If the component has complex interactions that necessitate specific state structures or callback behaviors in its parent component, consider briefly noting these expectations. For example: "The `onItemSelect` prop expects a callback that will manage the selected item's state in the parent component." This clarifies the component's role within a larger system._
        *   **State (for components with significant internal state):**
            *   Describe key state variables.
            *   Explain their purpose and how they influence behavior.
        *   **Core Functionality / Logic:**
            *   Explain the main logic, user interactions, or algorithms.
            *   Detail any complex business rules implemented.
        *   **Data Structure (for data files like `SPELLS_DATA.README.md`):**
            *   Describe the primary exported data structure (e.g., `SPELLS_DATA: Record<string, Spell>`).
            *   Detail the properties of the objects within that structure (e.g., properties of the `Spell` object).
            *   Provide examples of data entries.
            *   Explain how this data is used in the application.
            *   Instructions on how to add new data entries.
        *   **Service Interactions / API Calls (for services or components using them):**
            *   Describe how it interacts with external services (e.g., `geminiService.ts`, `ttsService.ts`).
            *   Mention key functions called or data consumed/produced.
            *   Highlight any important aspects of API interaction (e.g., specific parameters, error handling).
        *   **Data Dependencies:**
            *   List any major data structures or constants it relies on (e.g., from `src/constants.ts` or other `src/data/` modules).
        *   **Styling Notes (Optional):**
            *   Highlight any significant or complex styling approaches if not obvious from Tailwind CSS classes or component structure.
        *   **Example Usage (Optional but Recommended for Reusable Components/Services):**
            *   A brief code snippet showing how the component or service might be typically used.
        *   **Accessibility Notes (If Applicable):**
            *   Mention any specific ARIA attributes used or accessibility considerations taken.
        *   **Future Considerations / TODOs (Optional):**
            *   Note any planned improvements, known issues, or refactoring opportunities.

## Naming Conventions (Code Files)

To maintain consistency and readability across the project, the following naming conventions are established for code files:

### Directory Names
*   Generally `lowercase`.
*   If multiple words, use `kebab-case` (e.g., `character-creator`, `race-specific-components`).
*   Examples: `src/components`, `src/data/races`, `src/components/CharacterCreator/Race`.

### TypeScript Files (`.ts`, `.tsx`)
*   **React Component Files (`.tsx`):** `PascalCase.tsx` (e.g., `PlayerPane.tsx`, `RaceSelection.tsx`).
*   **Non-Component Logic/Service/Type Files (`.ts`):**
    *   General logic/services: `camelCase.ts` or `PascalCase.ts` (e.g., `geminiService.ts`, `ttsService.ts`, `types.ts`, `constants.ts`, `aiClient.ts`, `mapService.ts`).
    *   Data definition files (e.g., within `src/data/`):
        *   For individual race data: `[race_id_lowercase].ts` (e.g., `human.ts`, `aarakocra.ts`).
        *   For other data modules (like biomes, spells, items, skills, classes) that might be a single file or an `index.ts` in a subdirectory: `[module_name_lowercase].ts` or `index.ts` (e.g., `biomes.ts`, `src/data/spells/index.ts`).

### Variables and Functions
*   **General Variables & Functions:** `camelCase` (e.g., `playerCharacter`, `calculateFinalScores`).
*   **Constants:** `UPPER_SNAKE_CASE` (e.g., `POINT_BUY_TOTAL_POINTS`, `STARTING_LOCATION_ID`).
    *   For larger data structures exported as constants (like race or class data), the primary export from a data file often follows `[ENTITY_NAME_UPPERCASE]_DATA` (e.g., `HUMAN_DATA`, `ELF_DATA`, `CLASSES_DATA`, `ALL_RACES_DATA`). Collections like `BIOMES`, `ITEMS`, `SPELLS_DATA` are also uppercase.
*   **React Component Names & Functional Components:** `PascalCase` (e.g., `PlayerPane`, `CharacterCreator`).
*   **Type and Interface Names:** `PascalCase` (e.g., `PlayerCharacter`, `AbilityScores`, `Race`).
*   **Enum Names:** `PascalCase` (e.g., `GamePhase`, `CreationStep`).
*   **Enum Members:** `UPPER_SNAKE_CASE` (e.g., `GamePhase.CHARACTER_CREATION`).

### Specific Conventions for Race and Class Files

*   **Race Data Files (`src/data/races/`):**
    *   **Filename:** `[race_id_lowercase].ts` (e.g., `human.ts`, `dragonborn.ts`, `air_genasi.ts`).
    *   **Primary Exported Constant:** `[RACE_ID_UPPERCASE]_DATA` (e.g., `HUMAN_DATA`, `DRAGONBORN_DATA`).

*   **Race-Specific UI Selection Component Files (`src/components/CharacterCreator/Race/`):**
    *   **Filename & Component Name:** `[RaceNamePascalCase][ChoiceTypePascalCase]Selection.tsx`
    *   **Examples:**
        *   `DragonbornAncestrySelection.tsx`
        *   `ElfLineageSelection.tsx`
        *   `HumanSkillSelection.tsx`
        *   `AirGenasiSpellcastingAbilitySelection.tsx`
        *   `AarakocraSpellcastingAbilitySelection.tsx`
        *   `CentaurNaturalAffinitySkillSelection.tsx`
        *   `ChangelingInstinctsSelection.tsx`

*   **Class-Specific UI Selection Component Files (`src/components/CharacterCreator/Class/`):**
    *   **Filename & Component Name:** `[ClassNamePascalCase][FeatureNamePascalCase]Selection.tsx`
    *   **Examples:**
        *   `FighterFeatureSelection.tsx`
        *   `ClericFeatureSelection.tsx`

## Maintaining Documentation

-   **Alongside Code Changes:** Whenever a component, module, or core feature is significantly modified, its corresponding uniquely named README **must** be updated to reflect these changes. This is crucial for keeping the documentation useful.
-   **New Components/Modules/Data Files:** When adding a new significant part to the application, create a new, uniquely named README file for it following the guidelines above.
-   **README Index Updates**: When creating, significantly modifying, renaming, or removing any README file, the central `README_INDEX.md` (now in `docs/README_INDEX.md`) **must** be updated accordingly to maintain an accurate overview of all project documentation.
-   **Review:** Periodically review documentation for accuracy, completeness, and clarity. As the project evolves, ensure that the documentation evolves with it.
-   **Component READMEs as a "Source of Truth"**: When a component's props interface, core functionality, or expected parent interactions change, its README file should be updated **concurrently or even prior** to integrating these changes elsewhere. This practice helps the README serve as an accurate reference and checklist.
-   **Changelog Strategy**: The project uses a two-tiered changelog system:
    1.  **Main Changelog (`docs/CHANGELOG.md`)**: A high-level overview of changes. Each entry is brief, noting the date, the component affected, its new version, and a link to the detailed changelog.
    2.  **Component Changelogs (`src/components/[ComponentName]/CHANGELOG.md`)**: Detailed, component-specific changelogs. These files provide in-depth descriptions of the changes made to that specific component or feature.

This structured approach helps keep our documentation relevant and useful as the Aralia RPG project grows, making it easier for current and future developers to contribute effectively.