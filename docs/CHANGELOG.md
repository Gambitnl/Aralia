### Added
*   **Feature**: Completed the "Living NPC" System. This major feature set includes NPC memory, gossip, reputation management, discoverable evidence ("Event Residue"), and dynamic triggers. The final piece, "Consequence Linking," was added to the Discovery Journal to make the social simulation's effects visible to the player.
*   **Details**: For a complete list of changes, see the new [Living NPC Changelog](./changelogs/LIVING_NPC_CHANGELOG.md).

## 12:26:26 PM - Thursday, July 17, 2025
### Changed
*   **Architecture**: Completed a major overhaul of the Character Creator. It now uses a centralized state reducer and a dedicated `useCharacterAssembly` hook for improved logic management.
*   **Features**: Added numerous new D&D races, class-specific selection screens, a weapon mastery step, and streamlined the ability score system to rely solely on Point Buy.
*   **UI/UX**: Redesigned the Race Detail Modal for better readability.
*   **Details**: For a complete list of changes, see the new [Character Creator Changelog](./changelogs/CHARACTER_CREATOR_CHANGELOG.md).

## 09:06:03 PM - Tuesday, July 15, 2025
### Added
*   **New Class**: Added the Barbarian class to the game. Includes full data for character creation (Rage, Unarmored Defense, d12 Hit Die, proficiencies) and comprehensive glossary entries for the base class and four subclasses.
*   **New Documentation**: Added a `CLASS_ADDITION_GUIDE.md` to document the process for adding new classes, and a `CLASSES.README.md` to explain the structure of the class data file.

## 05:35:19 PM - Monday, July 14, 2025
### Changed
*   **Architecture**: Refactored the core `appReducer` into a modular, slice-based architecture for improved maintainability. See the new [State Management Changelog](./changelogs/STATE_MANAGEMENT_CHANGELOG.md) for details.

## 12:51:53 AM - Sunday, July 13, 2025
### Added
*   **Glossary Content**: Added a comprehensive, multi-level 'Equipment' section to the Rules Glossary. This includes detailed entries for weapons, armor, tools, adventuring gear, services, crafting, and more. See the [Glossary Changelog](./changelogs/glossary_equipment_changelog.md) for details.

## 07:37:42 PM - Sunday, July 13, 2025
### Changed
*   **Architecture**: Major refactor of the game's action handling system. The monolithic `useGameActions` hook has been decomposed into a lean orchestrator that delegates logic to specialized, single-responsibility handlers in the new `src/hooks/actions/` directory. This significantly improves modularity and maintainability. See the updated `useGameActions.README.md` and new handler READMEs for details.
*   **Architecture**: Refactored the glossary data structure to support nested index files. `GlossaryContext.tsx` can now recursively process indexes, allowing for more organized and scalable rules sections (e.g., `rules_glossary.json` is now an index of other files).
*   **UI**: Added a new `PartyOverlay.tsx` component to display party members in a dedicated modal.
*   **Documentation**: Updated all relevant READMEs and guides to reflect the new architecture.

## 03:22:25 PM - Tuesday, July 8, 2025
### Changed
*   **Feature**: Battle Map Party Sync
*   **Version**: v0.2.4
*   **Details**: See [Battle Map Changelog](./changelogs/BATTLEMAP_CHANGELOG.md) for details.

## 09:41:12 PM - Friday, July 4, 2025
### Changed
*   **Finalized Spellcasting Data Model**: Completed the refactor to enforce a single source of truth for spellcasting data. Removed the deprecated `knownCantrips` and `knownSpells` properties from the core `PlayerCharacter` type in `src/types/index.ts`. The application now exclusively uses the `spellbook: SpellbookData` property on the `PlayerCharacter` object to store spell IDs.
*   **Updated Character Creation**: Refactored `useCharacterAssembly.ts` and character creation logic to correctly populate the new `spellbook` data structure and remove the deprecated properties, resolving previous compilation errors and architectural inconsistencies. All UI components now derive their spell lists from the new data model using the `getCharacterSpells` utility.
*   **Changelog Refactor**: Moved all detailed changelog entries related to the spellbook and spellcasting data model refactor to a dedicated feature changelog at `docs/changelogs/SPELLBOOK_CHANGELOG.md`.

## 2025-06-29 - 11:32:34 UTC
### Changed
*   **Component**: Battle Map Feature
*   **Version**: v.0.0.5
*   **Details**: See [Battle Map Changelog](./changelogs/BATTLEMAP_CHANGELOG.md)

## 2025-06-28 - 19:06:22 UTC
### Added & Changed (UI Polish & Animation)
*   **Integrated Framer Motion**: Added the `framer-motion` library to the project to enhance user experience with fluid animations.
*   **Animated Modals**: The `CharacterSheetModal` and `LoadingSpinner` now use fade-in and scaling animations for a smoother appearance.
*   **Animated Character Creator**: Implemented sliding transitions between each step of the character creation process, providing clearer visual feedback on progression.
*   **Animated UI Elements**:
    *   `ActionPane`: Buttons now have a subtle "pop-in" animation.
    *   `WorldPane`: New messages in the game log now gracefully fade and slide into view.
*   **Updated AI Prompt Guide**: Replaced the content of `docs/@AI-PROMPT-GUIDE.md` with new, more collaborative and application-specific text provided by the user.

## 2025-06-28 - 15:54:10 UTC
### Changed (Glossary Workflow Refactor)
*   **Refactored Glossary Content Workflow**: The process for adding and managing glossary entries has been streamlined. The `public/data/glossary/entries/` directory is now the **single source of truth** for all Markdown content files, eliminating the need for a duplicate directory structure under `src`.
*   **Updated Documentation**: The `GLOSSARY_ENTRY_DESIGN_GUIDE.md`, `CLASS_ADDITION_GUIDE.md`, and `RACE_ADDITION_GUIDE.md` have all been updated to remove instructions for creating files in `src` and to reflect the new, simplified content workflow.
*   **Corrected Build Script**: The `scripts/generateGlossaryIndex.js` script has been updated to correctly point to `public/data/glossary/entries` as its source directory for building the JSON indexes.
*   **Removed Obsolete Files**: Conceptually removed the obsolete and unused `public/data/glossary.flat.json` index file.

## 2025-06-26 - 23:12:04 UTC
### Added & Changed (Summary of Iterative Development Session)

This entry summarizes a significant period of iterative development and refactoring across the Aralia RPG application.

**I. Core Gameplay & Systems:**
    *   **Character Creation Overhaul**:
        *   Implemented a multi-step character creation process (`CharacterCreator.tsx`) using `useReducer` for state management (`src/components/CharacterCreator/state/characterCreatorState.ts`) and a `useCharacterAssembly` hook for logic.
        *   Added new D&D races: Aarakocra, Air Genasi, Bugbear, Centaur, Changeling, Deep Gnome (Svirfneblin), Duergar, Goliath, Halfling, Orc, Tiefling.
        *   Updated existing races (Human, Elf, Gnome, Dragonborn, Aasimar, Dwarf) to reflect 2024 PHB style flexible ASIs and unique traits.
        *   Developed race-specific selection components (e.g., `ElfLineageSelection`, `DragonbornAncestrySelection`, `TieflingLegacySelection`, `AarakocraSpellcastingAbilitySelection`, `DeepGnomeSpellcastingAbilitySelection`, `DuergarMagicSpellcastingAbilitySelection`, etc.).
        *   Implemented a Point Buy system for ability scores (`AbilityScoreAllocation.tsx`) with a class-based Stat Recommender.
        *   Removed the Flexible ASI step to streamline character creation.
        *   Included a `HumanSkillSelection.tsx` step.
        *   Enhanced skill selection to account for racial skill grants (Elf's Keen Senses, Human's Skillful, Bugbear's Sneaky, Centaur's Natural Affinity, Changeling's Instincts).
    *   **Save/Load System (`saveLoadService.ts`)**: Implemented robust game saving and loading to Local Storage, including versioning, map data, dynamic item states, submap coordinates, game time, and inspected tile descriptions.
    *   **Game Time**: Implemented an in-game clock in `App.tsx` that advances automatically per second and by larger fixed amounts for specific player actions. Displayed in `CompassPane.tsx`.
    *   **Error Handling**: Introduced `ErrorBoundary.tsx` to gracefully handle UI errors.
    *   **Utilities**: Created `src/utils/characterUtils.ts` (ability modifiers, AC calculation, equip checks) and `src/utils/locationUtils.ts` (dynamic NPC determination).

**II. UI & UX Enhancements:**
    *   **Main UI Refactor**: `App.tsx` now uses `PartyPane.tsx` (compact character display) instead of the detailed `PlayerPane.tsx`.
    *   **Character Details**: `CharacterSheetModal.tsx` and `EquipmentMannequin.tsx` for viewing detailed character information, including proficiency-based dynamic icons and warnings on the mannequin. `SkillDetailDisplay.tsx` for a dedicated skill breakdown.
    *   **World Pane**: `WorldPane.tsx` now features tooltips for keywords.
    *   **Action Pane**: `ActionPane.tsx` displays Gemini-generated custom actions, save game, dev menu toggle, journal button, and glossary button.
    *   **Compass Pane**: `CompassPane.tsx` handles 8-directional navigation, shows current world/submap coordinates, game time, and map/submap toggles.
    *   **Mapping**:
        *   `MapPane.tsx`: World map with Fog of War, keyboard navigation, and modal-based icon glossary (`GlossaryDisplay.tsx`).
        *   `SubmapPane.tsx`: Detailed local view with procedural visuals (via `useSubmapProceduralData` hook and decomposed `getTileVisuals`), path generation, feature clumping, modal-based icon legend, contextual tooltips, and a tile inspection feature. Inspected tile descriptions are now persistent. The compass is now integrated directly into the `SubmapPane`.
    *   **Tooltips**: Reusable `Tooltip.tsx` component implemented and used throughout. `GlossaryTooltip.tsx` for dynamic glossary excerpts.
    *   **Loading Spinner**: Standardized `LoadingSpinner.tsx` with optional messages.
    *   **Image Pane**: `ImagePane.tsx` for scene visuals (though generation might be temporarily disabled).
    *   **Discovery Journal**: `DiscoveryLogPane.tsx` for browsing game events and lore.
    *   **Glossary System**:
        *   `Glossary.tsx`: Interactive glossary modal with hierarchical navigation, search, and filtering.
        *   `GlossaryContext.tsx`: Loads glossary index from multiple category-specific JSON files (listed in `main.json`).
        *   Added and refactored numerous glossary entries (races, classes, rules), including Drow, Aasimar, Dragonborn, Dwarf, Elf, and Gnome.
        *   Fixed JSON parsing error in `public/data/glossary/index/character_races.json`.
        *   Corrected HTML rendering in Markdown entries by applying the `markdown="1"` attribute where needed.

**IV. AI Integration (Gemini API):**
    *   **Centralized Client**: `aiClient.ts` for shared `GoogleGenAI` instance and API key validation.
    *   **Gemini Service (`geminiService.ts`)**:
        *   Functions now return `GenerateTextResult` (text, prompt, raw response) for improved logging.
        *   Added `generateCustomActions` for dynamic player choices.
        *   Added `generateTileInspectionDetails` for submap exploration, with prompts refined for immersion and to avoid game jargon.
    *   **TTS Service (`ttsService.ts`)**: For Text-to-Speech (TTS) functionality.
    *   **Developer Tools**:
        *   `DevMenu.tsx`: Modal for developer shortcuts (save, load, navigation, log viewer access).
        *   `GeminiLogViewer.tsx`: Modal to display a history of Gemini API prompts and responses.
        *   Integrated Gemini interaction logging into `appState.ts` and `useGameActions.ts`.

**IV. Architecture & Code Quality:**
    *   **State Management**: `App.tsx` refactored to use `useReducer` with centralized state logic in `src/state/appState.ts`.
    *   **Custom Hooks**: Extracted complex logic into `useGameActions.ts` (with action handlers decomposed into `src/hooks/actions/` subdirectory), `useGameInitialization.ts`, `useAudio.ts`, and `useSubmapProceduralData.ts`.
    *   **Data Decoupling**: Moved static game data (locations, NPCs, items, spells, classes, biomes, TTS options, dummy character) from `src/data/` into organized subdirectories under `src/data/`.
    *   **Documentation**: Extensive creation and updates to README files for components, services, data modules, and hooks. Updated `@PROJECT-OVERVIEW.README.md` and `@README-INDEX.md`.

**V. Bug Fixes:**
    *   Fixed an issue where the starting submap's path would dynamically re-align to the player's current position rather than being static.
    *   Corrected a logical error in `character_races.json` that had an obsolete reference to `deep_gnome_lineage` in the `gnome` entry.
    *   Addressed missing `darkvisionRange` and `equippedItems` properties during character assembly.
    *   Resolved JSON parsing errors.

## 2025-06-20 - 06:59:21 UTC
### Added & Changed (Summary of Iterative Development Session)

This entry summarizes a significant period of iterative development and refactoring across the Aralia RPG application.

**I. Core Gameplay & Systems:**
    *   **Character Creation Overhaul**:
        *   Implemented a multi-step character creation process (`CharacterCreator.tsx`) using `useReducer` for state management (`src/components/CharacterCreator/state/characterCreatorState.ts`) and a `useCharacterAssembly` hook for logic.
        *   Added new D&D races: Aarakocra, Air Genasi, Bugbear, Centaur, Changeling, Deep Gnome (Svirfneblin), Duergar, Goliath, Halfling, Orc, Tiefling.
        *   Updated existing races (Human, Elf, Gnome, Dragonborn, Aasimar, Dwarf) to reflect 2024 PHB style flexible ASIs and unique traits.
        *   Developed race-specific selection components (e.g., `ElfLineageSelection`, `DragonbornAncestrySelection`, `TieflingLegacySelection`, `AarakocraSpellcastingAbilitySelection`, `DeepGnomeSpellcastingAbilitySelection`, `DuergarMagicSpellcastingAbilitySelection`, etc.).
        *   Implemented a Point Buy system for ability scores (`AbilityScoreAllocation.tsx`) with a class-based Stat Recommender.
        *   Added a `FlexibleAsiSelection.tsx` step for races with flexible ASIs.
        *   Included a `HumanSkillSelection.tsx` step.
        *   Enhanced skill selection to account for racial skill grants (Elf's Keen Senses, Human's Skillful, Bugbear's Sneaky, Centaur's Natural Affinity, Changeling's Instincts).
    *   **Save/Load System (`saveLoadService.ts`)**: Implemented robust game saving and loading to Local Storage, including versioning, map data, dynamic item states, submap coordinates, game time, and inspected tile descriptions.
    *   **Game Time**: Implemented an in-game clock in `App.tsx` that advances automatically per second and by larger fixed amounts for specific player actions. Displayed in `CompassPane.tsx`.
    *   **Error Handling**: Introduced `ErrorBoundary.tsx` to gracefully handle UI errors.
    *   **Utilities**: Created `src/utils/characterUtils.ts` (ability modifiers) and `src/utils/locationUtils.ts` (dynamic NPC determination).

**II. UI & UX Enhancements:**
    *   **Main UI Refactor**: `App.tsx` now uses `PartyPane.tsx` (compact character display) instead of the detailed `PlayerPane.tsx`.
    *   **Character Details**: `CharacterSheetModal.tsx` and `EquipmentMannequin.tsx` for viewing detailed character information.
    *   **World Pane**: `WorldPane.tsx` now features tooltips for keywords.
    *   **Action Pane**: `ActionPane.tsx` displays Gemini-generated custom actions, save game, and dev menu toggle.
    *   **Compass Pane**: `CompassPane.tsx` handles 8-directional navigation, shows current world/submap coordinates, game time, and map/submap toggles.
    *   **Mapping**:
        *   `MapPane.tsx`: World map with Fog of War, keyboard navigation, and modal-based icon glossary (`GlossaryDisplay.tsx`).
        *   `SubmapPane.tsx`: Detailed local view with procedural visuals (via `useSubmapProceduralData.ts` hook and decomposed `getTileVisuals`), path generation, feature clumping, modal-based icon legend, contextual tooltips, and a tile inspection feature. Inspected tile descriptions are now persistent.
    *   **Tooltips**: Reusable `Tooltip.tsx` component implemented and used throughout.
    *   **Loading Spinner**: Standardized `LoadingSpinner.tsx`.
    *   **Image Pane**: `ImagePane.tsx` for scene visuals (though generation might be temporarily disabled).

**III. AI Integration (Gemini API):**
    *   **Centralized Client**: `aiClient.ts` for shared `GoogleGenAI` instance and API key validation.
    *   **Gemini Service (`geminiService.ts`)**:
        *   Functions now return `GenerateTextResult` (text, prompt, raw response) for improved logging.
        *   Added `generateCustomActions` for dynamic player choices.
        *   Added `generateTileInspectionDetails` for submap exploration, with prompts refined for immersion and to avoid game jargon.
    *   **TTS Service (`ttsService.ts`)**: For Text-to-Speech (TTS) functionality.
    *   **Developer Tools**:
        *   `DevMenu.tsx`: Modal for developer shortcuts (save, load, navigation, log viewer access).
        *   `GeminiLogViewer.tsx`: Modal to display a history of Gemini API prompts and responses.
        *   Integrated Gemini interaction logging into `appState.ts` and `useGameActions.ts`.

**IV. Architecture & Code Quality:**
    *   **State Management**: `App.tsx` refactored to use `useReducer` with centralized state logic in `src/state/appState.ts`.
    *   **Custom Hooks**: Extracted complex logic into `useGameActions.ts`, `useGameInitialization.ts`, `useAudio.ts`, and `useSubmapProceduralData.ts`.
    *   **Data Decoupling**: Moved static game data (locations, NPCs, items, spells, classes, biomes, TTS options, dummy character) from `constants.ts` into organized subdirectories under `src/data/`.
    *   **Documentation**: Extensive creation and updates to README files for components, services, data modules, and hooks. Updated `@PROJECT-OVERVIEW.README.md` and `@README-INDEX.md`.

**V. Bug Fixes:**
    *   Fixed an issue where the starting submap's path would dynamically re-align to the player's current position rather than being static.