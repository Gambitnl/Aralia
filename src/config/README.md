# Configuration Directory

## Purpose

This directory (`src/config/`) centralizes all static configuration variables for the Aralia RPG application. The goal is to decouple tunable parameters from the core application logic and UI components.

By separating configuration, we can easily adjust game balance, visual settings, and other parameters without modifying complex code. This improves maintainability and allows for more flexible development.

## How to Use

-   Each file in this directory should focus on a specific domain of configuration (e.g., `mapConfig.ts`, `npcBehaviorConfig.ts`).
-   Files should export constants.
-   Application logic (in `src/hooks/`, `src/components/`, etc.) should import these constants rather than defining them locally.
