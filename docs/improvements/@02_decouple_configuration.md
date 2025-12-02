- [x] Plan Completed

# Plan: Decouple Configuration from UI and Logic (Expanded Scope)

## 1. Purpose & Ambition

The original goal of this improvement was to extract hardcoded configuration values from components and logic files into a centralized `src/config/` directory. This remains the core task, but its ambition is far greater than simple code cleanup.

This refactor is an **architectural pillar** that transforms the application from a monolith of interwoven logic and data into a more flexible, scalable, and professional system. By strictly separating configuration (the "what" and "how much") from implementation (the "how"), we achieve several critical long-term goals:

*   **Enhanced Maintainability**: Game designers and developers can tune the game's feel—visual density of biomes, NPC gossip frequency, character creation rules—by editing simple, dedicated configuration files, without ever touching complex React components or hooks. This drastically reduces the risk of introducing bugs during game balancing.
*   **Improved Collaboration**: It creates a clean boundary between different roles. A UI developer can work on `SubmapPane.tsx` while a game designer experiments with values in `submapVisualsConfig.ts`, minimizing merge conflicts and cognitive overhead.
*   **Simplified Testing**: Core logic becomes easier to test. We can import the real configuration for integration tests or provide a mock configuration to test specific edge cases (e.g., a biome with zero scatter features) without altering the component's code.
*   **Foundation for Future Features**: This is the most ambitious aspect. A well-defined configuration layer is the first step toward dynamic game settings. In the future, this architecture could enable:
    *   **User-Selectable Themes**: Loading different visual configs based on user preference.
    *   **Difficulty Settings**: Loading different `npcBehaviorConfig.ts` files for "Easy," "Normal," or "Hard" modes.
    *   **Live Game Balancing**: In a future-state application, these configuration files could be fetched from a server, allowing for game updates without requiring a full client-side deployment.

This plan is about future-proofing the application and establishing professional development patterns.

---

## 2. Expanded Implementation Plan

### Phase 1: Establish the Configuration Directory

-   [x] **Create Directory**: Create the `src/config/` directory.
-   [x] **Create README**: Create `src/config/README.md` to document the purpose of this directory and explain how to add new configuration files.

### Phase 2: Relocate Submap Visual Configuration

-   [x] **Identify Target**: The `biomeVisualsConfig` and `defaultBiomeVisuals` objects, along with the `BiomeVisuals` and related interfaces, currently inside `src/components/SubmapPane.tsx`.
-   [x] **Create New File**: `src/config/submapVisualsConfig.ts`.
-   [x] **Action**:
    1.  Move the `BiomeVisuals`, `SeededFeatureConfig`, and `MicroFeatureVisual` interface definitions from `SubmapPane.tsx` to `src/types.ts` so they can be shared globally.
    2.  Cut the entire `biomeVisualsConfig` and `defaultBiomeVisuals` object definitions from `SubmapPane.tsx`.
    3.  Paste them into `src/config/submapVisualsConfig.ts` and export them.
    4.  In `SubmapPane.tsx`, remove the old definitions and add `import { biomeVisualsConfig, defaultBiomeVisuals } from '../config/submapVisualsConfig';`.

### Phase 3: Relocate NPC Behavior Constants

-   [x] **Identify Targets**: All gameplay-tuning constants in `src/hooks/actions/handleWorldEvents.ts`, including `MAX_GOSSIP_EXCHANGES_PER_LOCATION`, `MAX_TOTAL_GOSSIP_EXCHANGES`, `MAX_FACTS_PER_NPC`, `DRIFT_THRESHOLD_DAYS`.
-   [x] **Create New File**: `src/config/npcBehaviorConfig.ts`.
-   [x] **Action**:
    1.  Move the constant definitions to the new config file and export them.
    2.  In `handleWorldEvents.ts`, import the constants: `import * as NpcConfig from '../../config/npcBehaviorConfig';`.
    3.  Update the logic to reference the imported constants (e.g., change `MAX_FACTS_PER_NPC` to `NpcConfig.MAX_FACTS_PER_NPC`).

### Phase 4: Consolidate and Relocate Game & Map Constants

-   [x] **Identify Targets**: Core game constants currently in `src/constants.ts` and `src/App.tsx`.
-   [x] **Create New File**: `src/config/mapConfig.ts`.
    -   **Action**: Move `MAP_GRID_SIZE`, `SUBMAP_DIMENSIONS`, `BATTLE_MAP_DIMENSIONS`, `TILE_SIZE_PX`, and `DIRECTION_VECTORS` into this file. Update all import paths.
-   [x] **Create New File**: `src/config/characterCreationConfig.ts`.
    -   **Action**: Move `POINT_BUY_TOTAL_POINTS`, `POINT_BUY_MIN_SCORE`, `POINT_BUY_MAX_SCORE`, and `ABILITY_SCORE_COST` from `src/constants.ts` into this file. Update `AbilityScoreAllocation.tsx` to import from this new, focused config file.
-   [x] **Refactor `constants.ts`**: This file should now primarily be an aggregator and re-exporter of *data* (from `src/data/`), not a dumping ground for configuration variables.

### Phase 5: Verification and Documentation

-   [x] **Full Application Test**: After refactoring, thoroughly test all affected areas: submap generation, NPC interactions (especially resting), map navigation, and character creation.
-   [x] **Update Documentation**:
    -   Update `src/components/SubmapPane.README.md` to reflect that its visual configuration is now external.
    -   Update `docs/guides/NPC_GOSSIP_SYSTEM_GUIDE.md` to reference the new `npcBehaviorConfig.ts` file for tuning.
    -   Update `src/constants.README.md` to clarify its role as a data aggregator.
    -   Add `[configName].README.md` files for the new, significant config modules (`submapVisualsConfig.README.md`, etc.).
    -   Update `docs/README_INDEX.md` to include all new documentation files.