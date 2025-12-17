# QOL TODO Archive (Completed)

Completed QOL items moved from `docs/QOL_TODO.md` for archival tracking.

## High Urgency / High Impact
1.  **[DONE] Update `docs/FEATURES_TODO.md` (Review Rec #14)**:
    *   **Description**: After a comprehensive review, the `docs/FEATURES_TODO.md` file needs to be updated to accurately reflect the current project status and future goals.
    *   **Approach**:
        1.  Systematically review each item in `FEATURES_TODO.md`.
        2.  Mark items that have been fully implemented as `[DONE]`.
        3.  Re-evaluate the priority of remaining items.
        4.  Add any major new features that have been identified (e.g., advanced combat mechanics, a full quest system).
        5.  Ensure the "Scene Visuals" feature status is clarified as per its specific TODO item.
    *   **Status**: DONE

## Medium Urgency / Medium Impact
1.  **[DONE] [Medium Urgency - Architecture] Clarify Data Aggregation (Review Rec #1)**:
    *   **Description**: There is a slight ambiguity in how data is aggregated, with `src/data/races/index.ts` and `src/constants.ts` both acting as aggregators. This should be streamlined for a clearer single source of truth.
    *   **Approach**:
        1.  Establish `src/constants.ts` as the definitive, single aggregator for all game data.
        2.  Modify `src/constants.ts` to directly import data from each specific module in `src/data/` (e.g., `import { BIOMES } from './data/biomes';`, `import { ITEMS } from './data/items';`).
        3.  Refactor `src/data/races/index.ts` to *only* export race-specific data (`ALL_RACES_DATA`, `DRAGONBORN_ANCESTRIES_DATA`, etc.). It should no longer export data from other modules like `BIOMES`.
        4.  Update `src/constants.ts` to import `ALL_RACES_DATA` and other race constants from `src/data/races/index.ts` and then re-export them.
        5.  Perform a global search to ensure all components and services now import their required data constants from `src/constants.ts` only.
    *   **Status**: DONE

2.  **[DONE] [Medium Urgency - Data] Centralize Biome Color Definitions (Review Rec #8)**:
    *   **Description**: The `MapPane.tsx` component currently contains a hardcoded `colorMap` to translate Tailwind CSS class names (like `bg-green-700`) into RGBA values for direct styling. This is brittle. The RGBA color should be part of the `Biome` data itself.
    *   **Approach**:
        1.  Update the `Biome` interface in `src/types.ts` to include a new optional property, e.g., `rgbaColor: string;`.
        2.  Modify `src/data/biomes.ts` to add the `rgbaColor` property to each biome definition, copying the values from the `colorMap` in `MapPane.tsx`.
        3.  Refactor `MapPane.tsx` to remove the local `colorMap`.
        4.  Update the `getTileStyle` function in `MapPane.tsx` to directly use `biome.rgbaColor` for the `backgroundColor` style.
    *   **Status**: DONE

3.  **[DONE] [Medium Urgency - UI/UX] `ActionPane` Layout Scalability (Review Rec #5)**:
    *   **Description**: As more system actions are added (`Journal`, `Glossary`, `Save`, etc.) and with the potential for Gemini-suggested actions, the `ActionPane.tsx` could become crowded. A more scalable layout should be considered.
    *   **Approach**:
        1.  Monitor the `ActionPane` layout as new features are added.
        2.  If crowding becomes an issue, implement a "System" or "Menu" dropdown button using an accessible primitive (e.g., from Headless UI if integrated).
        3.  Group less-frequent or non-combat-critical actions (like "Save Game", "Main Menu", "Dev Menu") into this dropdown to clean up the primary interface.
        4.  Ensure any new layout remains intuitive and responsive.
    *   **Status**: DONE (System menu grouping implemented in `src/components/ActionPane.tsx`)

4.  **[DONE] [Medium Urgency - Documentation] Add Visuals to UI Component READMEs (Review Rec #11)**:
    *   **Description**: Text-only documentation for complex UI components can be hard to visualize. Adding images would significantly improve comprehension.
    *   **Approach**:
        1.  Take screenshots of key UI components in action (e.g., the `MapPane` overlay, a populated `SubmapPane`, a step in the `CharacterCreator`).
        2.  Create diagrams if necessary to explain component relationships or state flow.
        3.  Upload these images to a stable image hosting service (like `ibb.co`, as used for race images) or place them in a `docs/images` directory.
        4.  Embed these images using Markdown syntax in the relevant `[Component].README.md` files.
    *   **Status**: DONE *(PR #16 - Created 5 professional SVG diagrams in docs/images/, embedded in component READMEs)*

5.  **[DONE] [Medium Urgency - Project Adherence] Clarify "Scene Visuals" Status (Review Rec #12)**:
    *   **Description**: The `ImagePane.tsx` component and `generateImageForScene` service exist, but the feature is not currently active in the main UI. Project documentation should reflect this reality.
    *   **Approach**:
        1.  Review `docs/@PROJECT-OVERVIEW.README.md` and `docs/FEATURES_TODO.md`.
        2.  Update the "Core Features" section to clarify that scene visualization is a potential feature but is currently disabled or in a non-active state.
        3.  Add a note explaining the reason if known (e.g., "Disabled to manage API quotas during development").
    *   **Status**: DONE *(PR #16 - Updated FEATURES_TODO.md line 105 with clarification about canvas/textual rendering)*

6.  **[DONE] [Medium Urgency - Project Adherence] Detail Feat System Implementation (Review Rec #13)**:
    *   **Description**: The feat system is mentioned via the Human's "Versatile" trait but isn't a fully implemented system. The project documentation should be clearer on its current state.
    *   **Approach**:
        1.  In `docs/FEATURES_TODO.md`, create a dedicated sub-section for the "Feat System".
        2.  Document the current state: "A descriptive `Versatile` trait exists for Humans, but no mechanical feat selection or application is implemented yet."
        3.  Outline the necessary steps for a full implementation: (a) Define feat data structures in `src/data/feats/`. (b) Create a `FeatSelection.tsx` component for character creation. (c) Integrate feat effects into character stats and game mechanics.
    *   **Status**: DONE *(Feat System section exists in FEATURES_TODO.md lines 50-58 with current state and implementation steps)*

7.  **[DONE] [Medium Urgency - UI Polish] Review User-Facing Error Messages (Existing #11, completed)**:
    *   **Description**: The application currently uses native `alert()` for some user-facing errors (e.g., save game failure). This is jarring and not thematically consistent.
    *   **Approach**:
        1.  Identify all instances of `alert()` in the codebase (e.g., `saveLoadService.ts`).
        2.  Implement a more integrated notification system. This could be a new component that displays a styled "toast" message at the top or bottom of the screen.
        3.  The notification state could be managed within `appState.ts`.
        4.  Replace `alert()` calls with dispatches to this new notification system.
    *   **Status**: COMPLETED - All `alert()` calls in `saveLoadService.ts` have been replaced with notification system calls using `notify?.({ message: result.message, type: 'success' })` pattern.

## Low Urgency / Polish & Minor Refactors
1.  **[DONE] [Low Urgency - Documentation] Scrub `@README-INDEX.md` (Review Rec #9)**:
    *   **Description**: With ongoing refactoring, links in the documentation index can become outdated.
    *   **Approach**:
        1.  Periodically (e.g., after every major feature merge), review every link in `docs/@README-INDEX.md`.
        2.  Verify that each link points to the correct file and that the file's description is still accurate.
        3.  Update or remove any broken or incorrect entries.
    *   **Status**: DONE *(PR #16 - Added placeholder back for race selection READMEs after PR #13 cleanup)*

2.  **[DONE] [Low Urgency - Documentation] Ensure Hook READMEs are Current (Review Rec #10)**:
    *   **Description**: The custom hooks are the core of the application's logic. Their documentation must be kept accurate.
    *   **Approach**:
        1.  After any significant change to a custom hook in `src/hooks/`, immediately update its corresponding README file.
        2.  Ensure the "Props" (or dependencies), "Return Value," and "Core Functionality" sections accurately reflect the new logic.
    *   **Status**: DONE *(PR #16 - Updated 3 hook READMEs: useGameActions, useGameInitialization, useSubmapProceduralData)*
