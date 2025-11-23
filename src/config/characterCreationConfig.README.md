# Character Creation Configuration (`src/config/characterCreationConfig.ts`)

## Purpose

The `characterCreationConfig.ts` module centralizes all static configuration variables specifically related to the character creation process, most notably the Point Buy system for ability scores.

By isolating these tuning parameters, we make it easy to adjust the balance of character creation without touching the logic in the `AbilityScoreAllocation.tsx` component.

## Exports

*   **`POINT_BUY_TOTAL_POINTS: number`**:
    *   The total number of points a player has to spend on their ability scores. Default is `27`.

*   **`POINT_BUY_MIN_SCORE: number`**:
    *   The base score from which all abilities start before points are spent. Default is `8`.

*   **`POINT_BUY_MAX_SCORE: number`**:
    *   The maximum score a player can purchase for a single ability before racial modifiers. Default is `15`.

*   **`ABILITY_SCORE_COST: Record<number, number>`**:
    *   An object that maps an ability score value to its total point cost from the base score (8). This is the core of the Point Buy calculation logic.
