
# Aralia RPG - Quality of Life Improvements & TODO List

This file lists Quality of Life improvements and TODO items identified
from code reviews and feature planning. Each item is rated by urgency/impact and includes a detailed approach.

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

3.  **[Medium Urgency - UI/UX] `ActionPane` Layout Scalability (Review Rec #5)**:
    *   **Description**: As more system actions are added (`Journal`, `Glossary`, `Save`, etc.) and with the potential for Gemini-suggested actions, the `ActionPane.tsx` could become crowded. A more scalable layout should be considered.
    *   **Approach**:
        1.  Monitor the `ActionPane` layout as new features are added.
        2.  If crowding becomes an issue, implement a "System" or "Menu" dropdown button using an accessible primitive (e.g., from Headless UI if integrated).
        3.  Group less-frequent or non-combat-critical actions (like "Save Game", "Main Menu", "Dev Menu") into this dropdown to clean up the primary interface.
        4.  Ensure any new layout remains intuitive and responsive.
    *   **Status**: PENDING

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
1.  **[Low Urgency - Code Quality] Enhance Type Specificity (Long-Term) (Review Rec #2)**:
    *   **Description**: Some types, like `Item.effect` and `Location.exits`, use simple strings. As the game grows, these could become more robust, structured types to improve type safety and reduce parsing errors.
    *   **Approach**:
        *   **For `Item.effect`**: Define a type like `type ItemEffect = { type: 'heal' | 'buff'; value: number; stat?: AbilityScoreName; } | { type: 'unlock'; keyId: string; }`. Update `items.ts` and the `use_item` action handler to use this structure.
        *   **For `Location.exits`**: If custom exit types beyond compass directions become common, consider a type like `type Exit = { direction: string; targetId: string; travelTime?: number; };` and update the `Location` interface.
    *   **Status**: PENDING

2.  **[Low Urgency - Performance] Monitor `SubmapPane.tsx` Rendering (Review Rec #3)**:
    *   **Description**: The `SubmapPane` renders a large grid, and the `getTileVisuals` function performs several calculations per tile. This could become a performance bottleneck on some devices.
    *   **Approach**:
        1.  Use React DevTools Profiler to measure `SubmapPane` render times.
        2.  If performance is slow, refactor `SubmapPane` to memoize the individual tile components using `React.memo`. This will prevent tiles from re-rendering unless their specific props change.
        3.  Consider further optimizations within the `useSubmapProceduralData` hook if the data generation itself is slow.
    *   **Status**: PENDING

3.  **[Low Urgency - UX] Character Creator Back Navigation Review (Review Rec #4)**:
    *   **Description**: The "Back" button in the character creator currently resets all subsequent choices. For a user making a minor correction, this can be frustrating.
    *   **Approach**:
        1.  Analyze the `characterCreatorReducer`'s `GO_BACK` logic.
        2.  Identify specific steps where a less destructive "back" action would be beneficial (e.g., going from `Skills` back to `AbilityScores` should not reset the chosen class).
        3.  Refactor the `getFieldsToResetOnGoBack` helper function to be more granular, only resetting the state for the step being exited, rather than all subsequent steps. This is a complex change that requires careful dependency mapping.
    *   **Status**: PENDING

4.  **[Low Urgency - Performance] Monitor Submap Hover Effects (Review Rec #6)**:
    *   **Description**: The CSS `transform: scale(1.5)` on submap tile hover is visually appealing but can be performance-intensive on large grids, as it may trigger repaints on adjacent elements.
    *   **Approach**:
        1.  Use browser developer tools (Performance tab) to check for paint/layout shifts during hover events on the submap.
        2.  If performance degradation is noticeable, consider replacing the `transform` with a less intensive property like `filter: brightness(1.2)` or a `box-shadow` transition, which are often better optimized by browsers.
    *   **Status**: PENDING

5.  **[Low Urgency - State Management] Reducer Complexity (Future) (Review Rec #7)**:
    *   **Description**: As more features are added, the main `appReducer` could become very large. Planning for this complexity is good practice.
    *   **Approach**:
        1.  When `appReducer` exceeds a certain line count or logical complexity (e.g., 300+ lines), consider splitting it.
        2.  Create "slice" reducers for distinct parts of the state (e.g., `mapReducer`, `inventoryReducer`, `uiReducer`).
        3.  Create a root reducer that combines these slice reducers to manage the overall `GameState` object.
    *   **Status**: PENDING (Future consideration)

6.  **[DONE] [Low Urgency - Documentation] Scrub `@README-INDEX.md` (Review Rec #9)**:
    *   **Description**: With ongoing refactoring, links in the documentation index can become outdated.
    *   **Approach**:
        1.  Periodically (e.g., after every major feature merge), review every link in `docs/@README-INDEX.md`.
        2.  Verify that each link points to the correct file and that the file's description is still accurate.
        3.  Update or remove any broken or incorrect entries.
    *   **Status**: DONE *(PR #16 - Added placeholder back for race selection READMEs after PR #13 cleanup)*

7.  **[DONE] [Low Urgency - Documentation] Ensure Hook READMEs are Current (Review Rec #10)**:
    *   **Description**: The custom hooks are the core of the application's logic. Their documentation must be kept accurate.
    *   **Approach**:
        1.  After any significant change to a custom hook in `src/hooks/`, immediately update its corresponding README file.
        2.  Ensure the "Props" (or dependencies), "Return Value," and "Core Functionality" sections accurately reflect the new logic.
    *   **Status**: DONE *(PR #16 - Updated 3 hook READMEs: useGameActions, useGameInitialization, useSubmapProceduralData)*

8.  **[Low Urgency - UI Polish] UI Button Consistency (Existing #12, still valid)**:
    *   **Description**: While generally consistent, minor variations in button padding, font size, or hover/focus states may exist across the app, particularly in multi-step processes like character creation.
    *   **Approach**:
        1.  Perform a visual audit of all buttons in the application.
        2.  Create a set of base Tailwind CSS class strings for common button types (e.g., `primary`, `secondary`, `danger`).
        3.  Apply these base classes consistently to ensure a uniform look and feel.
    *   **Status**: PENDING

9.  **[Low Urgency - UI Polish] Refine Tooltip.tsx Positioning (Existing #13, still valid)**:
    *   **Description**: The `Tooltip.tsx` component's positioning logic is robust for most cases but might have edge cases where it appears slightly off-screen or awkwardly placed when the trigger element is at the very edge of the viewport.
    *   **Approach**:
        1.  Intentionally test the tooltip by placing trigger elements at the extreme corners and edges of the screen.
        2.  If issues are found, refine the `calculateAndSetPosition` function in `Tooltip.tsx`. This might involve adding more margin from the viewport edge or more sophisticated logic to choose between top/bottom/left/right placement.
    *   **Status**: PENDING (Currently considered stable)

10. **[Low Urgency - Future Consideration] Performance Review of App.tsx Callbacks (Existing #15, still valid)**:
    *   **Description**: `App.tsx` and its hooks use `useCallback` to memoize functions. Incorrect or overly broad dependency arrays can lead to unnecessary re-renders of child components.
    *   **Approach**:
        1.  Use the React DevTools Profiler to identify components that are re-rendering unexpectedly.
        2.  Trace the props causing the re-render. If it's a memoized callback, review its dependency array in `useGameActions.ts`, `useGameInitialization.ts`, etc.
        3.  Ensure the dependency array is minimal and only includes values that should actually trigger the callback's re-creation. This is a low-priority task unless performance issues are observed.
    *   **Status**: PENDING (Future consideration)
