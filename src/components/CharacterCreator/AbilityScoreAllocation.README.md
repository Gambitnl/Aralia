
# AbilityScoreAllocation Component

## Purpose

The `AbilityScoreAllocation.tsx` component is a crucial step in the character creation process. It allows players to determine their character's six fundamental ability scores (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma) using a **Point Buy system**.

This system provides a balanced way for players to customize their scores, offering more flexibility than a standard array while preventing overly min-maxed characters. It also features a **Stat Recommender** section based on the selected class to guide player choices.

## System: Point Buy

1.  **Starting Point Pool**: Players begin with a fixed number of points (currently `POINT_BUY_TOTAL_POINTS = 27`).
2.  **Base Scores**: All ability scores initially start at a minimum value (`POINT_BUY_MIN_SCORE = 8`).
3.  **Purchasing Scores**:
    *   Players spend points from their pool to increase scores from the base of 8 up to a maximum (`POINT_BUY_MAX_SCORE = 15`).
    *   The cost to increase a score is not linear; higher scores cost more points per increment. The specific costs are defined in `ABILITY_SCORE_COST` in `src/constants.ts`:
        *   8: 0 points (base)
        *   9: 1 point
        *   10: 2 points (total from 8)
        *   11: 3 points
        *   12: 4 points
        *   13: 5 points
        *   14: 7 points
        *   15: 9 points
4.  **Score Limits**:
    *   Scores cannot be reduced below `POINT_BUY_MIN_SCORE` (8).
    *   Scores cannot be increased above `POINT_BUY_MAX_SCORE` (15) *using the point buy system*. Racial bonuses are applied *after* scores are bought.
5.  **Confirmation**: The player must spend all available points (i.e., `pointsRemaining` must be 0) to proceed to the next step.

## Props

*   **`race: Race`**:
    *   **Type**: `Race` (from `src/types.ts`)
    *   **Purpose**: The character's selected race. This is used to display racial ability score bonuses (if any, as most 2024 PHB style races use flexible ASIs handled by Point Buy) alongside the point-buy scores.
    *   **Required**: Yes

*   **`selectedClass: CharClass | null`**:
    *   **Type**: `CharClass` (from `src/types.ts`) or `null`
    *   **Purpose**: The character's selected class. Used to display the Stat Recommender section by accessing its `statRecommendationFocus` and `statRecommendationDetails` properties.
    *   **Required**: Yes (can be `null`, recommender won't show).

*   **`onAbilityScoresSet: (scores: AbilityScores) => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback invoked when scores are confirmed. Passes the `baseScores` (before racial modifiers) to the parent.
    *   **Required**: Yes

*   **`onBack: () => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback for navigating to the previous creation step.
    *   **Required**: Yes

## State Management

*   **`baseScores: AbilityScores`**: Current scores set by point buy.
*   **`pointsRemaining: number`**: Points left in the pool.

## Core Functionality

1.  **Initialization**: Base scores at 8, points at `POINT_BUY_TOTAL_POINTS`.
2.  **Score Modification**: "+" and "-" buttons adjust scores, updating `pointsRemaining` based on `ABILITY_SCORE_COST`. Disabled if out of bounds or insufficient points.
3.  **Display**: Shows "Points Remaining", and for each ability: current base score, cost, racial bonus (if any), and final score (base + racial).
4.  **Stat Recommender**: If `selectedClass` has recommendation data (`statRecommendationFocus`, `statRecommendationDetails`), this section is displayed with suggested abilities and tips.
5.  **Confirmation**: "Confirm Scores" button enabled when `pointsRemaining === 0`. Calls `onAbilityScoresSet` with `baseScores`.

## Data Dependencies

*   `src/constants.ts`: `ABILITY_SCORE_NAMES`, `POINT_BUY_TOTAL_POINTS`, `POINT_BUY_MIN_SCORE`, `POINT_BUY_MAX_SCORE`, `ABILITY_SCORE_COST`.
*   `selectedClass` prop: Uses `statRecommendationFocus` and `statRecommendationDetails` from `Class` objects defined in `src/data/classes/index.ts`.

## Styling

Tailwind CSS. Clear sections for points, scores, and recommender.

## Accessibility

Buttons are labeled. "Confirm Scores" button provides feedback on why it might be disabled.
