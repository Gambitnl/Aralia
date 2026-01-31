# Dice Roller Component Analysis

## 1. Overview
The application utilizes a hybrid dice rolling system consisting of:
1.  **Visual 3D Rolling**: Powered by `@3d-dice/dice-box`.
2.  **Silent Logic Rolling**: Powered by internal utility functions.

The system is split across two primary user interfaces:
-   **Manual Rolling**: `DiceRollerModal.tsx` (User manually selects dice).
-   **System Rolling**: `DiceOverlay.tsx` (Game programmatically triggers rolls, e.g., skill checks).

## 2. Component Architecture

### 2.1 UI Layer
-   **`src/components/dice/DiceRollerModal.tsx`**:
    -   **Purpose**: Provides an interactive modal for the user to build a dice pool and roll.
    -   **Dependencies**: Uses `useDiceBox.ts` hook.
    -   **Canvas**: Manages its own canvas element `#dice-roller-canvas`.
    -   **Issues**: Contains inline `<style>` blocks that should be moved to CSS/Tailwind.

-   **`src/components/dice/DiceOverlay.tsx`**:
    -   **Purpose**: A global overlay for displaying 3D rolls triggered by game logic.
    -   **Dependencies**: Uses `DiceContext.tsx` which consumes `DiceService.ts`.
    -   **Canvas**: Manages a separate canvas element `#dice-overlay-canvas`.

### 2.2 State & Service Layer
-   **`src/contexts/DiceContext.tsx`**:
    -   **Purpose**: React Context provider that exposes `roll` (silent) and `visualRoll` (3D) functions to the app.
    -   **Implementation**: Wraps `DiceService`.

-   **`src/services/DiceService.ts`**:
    -   **Purpose**: Singleton service for managing the `DiceBox` instance for the **Overlay**.
    -   **Logic**: Handles dynamic import of `@3d-dice/dice-box` and initialization.
    -   **Risk**: Its initialization logic is less robust than `useDiceBox.ts` (see below).

-   **`src/hooks/useDiceBox.ts`**:
    -   **Purpose**: Specialized hook for the **Modal**.
    -   **Logic**: Contains robust initialization logic, including fixes for React Strict Mode (double-mount) and stale canvas cleanup.

### 2.3 Logic Layer (The "Silent" Rollers)
There are **three** distinct places where dice rolling logic exists:

1.  **`src/utils/combat/combatUtils.ts` (Primary)**
    -   **Function**: `rollDice(diceString)` and `rollDamage(...)`.
    -   **Usage**: Used by `DiceService.ts` for silent rolls.
    -   **Capabilities**: Supports complex formulas (e.g., `1d8 + 1d6 + 2`), critical hits, and min-rolls.
    -   **Status**: The "God Object" for combat mechanics.

2.  **`src/systems/spells/mechanics/DiceRoller.ts` (Secondary/Legacy)**
    -   **Function**: `DiceRoller.roll(formula)`.
    -   **Usage**: Used by `SavingThrowResolver.ts` and its tests.
    -   **Capabilities**: Simple regex parsing. May be less robust than `combatUtils`.
    -   **Status**: Potentially redundant.

3.  **`@3d-dice/dice-box` (Visual)**
    -   **Usage**: Used for 3D physics-based results.

## 3. Findings & Recommendations

### 3.1 Code Duplication in Initialization
`useDiceBox.ts` and `DiceService.ts` duplicate the logic for:
-   Importing `@3d-dice/dice-box`.
-   Setting up asset paths (Vite `BASE_URL`).
-   Initializing the canvas.

**Risk**: `useDiceBox.ts` contains critical fixes for React Strict Mode (removing stale canvases) that are **missing** from `DiceService.ts`. This suggests the `DiceOverlay` might be prone to "invisible dice" bugs in development or rapid re-mounting scenarios.

**Recommendation**: Extract the core `DiceBox` management logic into a shared utility or factory that both the Service and the Hook can use, ensuring both benefit from the robustness fixes.

### 3.2 Redundant Logic Classes
`src/systems/spells/mechanics/DiceRoller.ts` largely duplicates `src/utils/combat/combatUtils.ts`.

**Recommendation**: Refactor `SavingThrowResolver.ts` to use `combatUtils.ts` (or a dedicated `DiceUtils` extracted from it) and delete `DiceRoller.ts` to reduce maintenance burden and ensure consistent RNG behavior across the app.

### 3.3 UI Refactoring
`DiceRollerModal.tsx` has a TODO to refactor inline styles.

```tsx
<style>
    {`
        .dice-box-canvas,
        #dice-roller-canvas canvas {
            pointer-events: none !important;
        }
    `}
</style>
```

**Recommendation**: Move these styles to a CSS module or global CSS file.
