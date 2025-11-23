# Constants Module (`src/constants.ts`)

## Purpose

The `src/constants.ts` file is a critical hub for the Aralia RPG application. Its primary purpose has been refined to **aggregate and re-export all static game *data*** and define only the most foundational, unchanging constants. This creates a single, consistent source for components and services to import game data, improving maintainability and clarity.

Most tunable parameters and configuration variables have been moved to dedicated modules in the `src/config/` directory.

## Core Functionality

1.  **Data Aggregation**:
    *   This module imports data from various specialized modules located in the `src/data/` directory. This includes:
        *   `ALL_RACES_DATA` from `src/data/races/index.ts`
        *   `CLASSES_DATA` from `src/data/classes/index.ts`
        *   `ITEMS` and `WEAPONS_DATA` from `src/data/items/index.ts`
        *   `LOCATIONS` and `NPCS` from `src/data/world/`
        *   And more...
    *   It then re-exports these collections, often with more convenient aliases (e.g., `DRAGONBORN_ANCESTRIES_DATA as DRAGONBORN_ANCESTRIES`).

2.  **Constant Definitions**:
    *   It defines and exports a minimal set of global constants, such as `ABILITY_SCORE_NAMES`.
    *   Most other constants, especially those related to game balance or layout (like Point Buy costs or map dimensions), have been moved to `src/config/`.

3.  **Dummy Character Initialization**:
    *   Orchestrates the initialization of the development dummy character by first importing all necessary data (races, classes, skills) and then calling the initialization functions from `src/data/dev/dummyCharacter.ts`.

## Usage

All components, services, and hooks should import game **data** from this file. Configuration variables should be imported from their specific files in `src/config/`.

**Correct Usage:**
```typescript
import { RACES_DATA, ITEMS } from '../constants'; // Importing DATA
import { MAP_GRID_SIZE } from '../config/mapConfig'; // Importing CONFIG
```
