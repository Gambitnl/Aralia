
# State Management - Changelog

This file documents all notable changes specifically related to the application's core state management architecture.

## v1.0.1 (Current)
### Added
*   **Map Configuration Module**: Created a new module at `src/config/mapConfig.ts` to centralize map-related constants (`MAP_GRID_SIZE`, `SUBMAP_DIMENSIONS`, `DIRECTION_VECTORS`, etc.). This improves modularity by decoupling these settings from the main `constants.ts` file. Updated all dependent components (`App.tsx`, `CompassPane.tsx`, `SubmapPane.tsx`) to import from the new module.

## v1.0.0 (05:35:19 PM - Monday, July 14, 2025)
### Added & Changed (Major State Refactor)
*   **Architecture**: Major architectural refactor of the application's state management to improve modularity, scalability, and maintainability.
*   **Decomposed Reducer**: The monolithic `appReducer` in `src/state/appState.ts` has been decomposed. It now acts as a **root reducer** that orchestrates smaller, domain-specific "slice" reducers.
*   **New Slice Reducers**: The following new slice reducers were created in the `src/state/reducers/` directory:
    *   **`uiReducer.ts`**: Manages all UI-related state (modal visibility, loading states, errors).
    *   **`characterReducer.ts`**: Manages state related to the player party, inventory, equipment, and resources.
    *   **`worldReducer.ts`**: Manages the state of the game world, including location, map data, time, and NPC interaction context.
    *   **`logReducer.ts`**: Manages all game logs (main log, Gemini dev log, discovery journal).
    *   **`encounterReducer.ts`**: Manages the state for the encounter generation feature.
*   **Centralized Action Types**: Created `src/state/actionTypes.ts` to define and export the main `AppAction` type. This resolves circular dependencies that arose between the root reducer and the new slice reducers.
*   **Updated Hooks**: The `useGameActions` and `useGameInitialization` hooks were updated to import `AppAction` from the new `actionTypes.ts` file.
*   **Documentation**: Created new README files for `appState.ts`, `actionTypes.ts`, and each of the new slice reducer modules to document their specific roles and responsibilities.
