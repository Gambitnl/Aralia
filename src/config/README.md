# Configuration Directory

## Purpose

This directory (`src/config/`) centralizes all static configuration variables for the Aralia RPG application. The goal is to decouple tunable parameters from the core application logic and UI components.

By separating configuration, we can easily adjust game balance, visual settings, and other parameters without modifying complex code. This improves maintainability and allows for more flexible development.

## How to Use

-   Each file in this directory should focus on a specific domain of configuration (e.g., `mapConfig.ts`, `npcBehaviorConfig.ts`).
-   Files should export constants.
-   Application logic (in `src/hooks/`, `src/components/`, etc.) should import these constants rather than defining them locally.

## Architecture & Design History

This directory centralizes configuration files for the Aralia RPG application. The primary goal of this architectural decision is to decouple configuration data from UI components and core application logic.

### Purpose & Ambition

The separation of configuration from implementation is a critical architectural pillar that enhances the application's flexibility, maintainability, and scalability.

-   **Enhanced Maintainability**: By externalizing values that tune game mechanics (e.g., visual density of biomes, NPC behavior), designers and developers can modify the game's feel without altering complex code. This minimizes the risk of introducing bugs during balancing and iteration.
-   **Improved Collaboration**: It establishes a clean boundary between different roles. A UI developer can work on a component while a game designer tunes its corresponding configuration, reducing friction and merge conflicts.
-   **Simplified Testing**: Logic becomes easier to unit test. Mocks with specific or edge-case configurations can be injected, allowing for more robust and isolated tests.
-   **Foundation for Future Features**: This architecture is the first step toward dynamic game settings. It lays the groundwork for features like user-selectable themes, difficulty settings, and potentially live game balancing where configuration could be fetched from a server.
