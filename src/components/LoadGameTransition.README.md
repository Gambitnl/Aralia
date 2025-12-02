## Architecture & Design History

- [x] Plan Completed

# Plan: Enhance Game Loading Transition

## 1. Purpose

The goal of this improvement is to create a smoother and more polished user experience when a player loads a saved game. Currently, upon successful loading, the player is immediately dropped into the main game UI, which can feel abrupt.

This plan will introduce a brief, full-screen "Welcome Back" or "Loading Complete" transition screen that appears after the game state is loaded but before the main UI is rendered.

## 2. Key Rules

-   All plans will be written in a checklist format.
-   All phases of the plan will be detailed, including envisioned file/folder structures and general code direction.
-   When code is envisioned, it will be heavily accompanied by comments explaining its function and dependencies.

---

## 3. Implementation Plan

### Phase 1: Create the Transition Screen Component

-   [x] **Create New File**: `src/components/LoadGameTransition.tsx`
-   **File and Folder Structure**: A new, simple component for the transition screen.
-   **Envisioned Code Content**:
    ```tsx
    // src/components/LoadGameTransition.tsx
    /**
     * @file LoadGameTransition.tsx
     * A component that displays a brief "Welcome Back" message after loading a game.
     *
     * DEPENDS ON:
     * - framer-motion (for animations)
     * - ../types (for PlayerCharacter)
     *
     * USED BY:
     * - ../App.tsx
     */
    import React from 'react';
    import { motion } from 'framer-motion';
    import { PlayerCharacter } from '../types';

    interface LoadGameTransitionProps {
      character: PlayerCharacter; // The character from the loaded save
    }

    const LoadGameTransition: React.FC<LoadGameTransitionProps> = ({ character }) => {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }} // Fade out
          transition={{ duration: 0.3 }}
          className="fixed inset-0 bg-gray-900 flex items-center justify-center z-[100]"
          aria-live="polite"
          aria-label={`Welcome back, ${character.name}`}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { delay: 0.2, duration: 0.5 } }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-cinzel text-amber-400 mb-4">
              Welcome Back, {character.name}
            </h1>
            <p className="text-lg text-gray-300">Your adventure continues...</p>
          </motion.div>
        </motion.div>
      );
    };

    export default LoadGameTransition;
    ```

### Phase 2: Integrate the Transition into the Game State and `App.tsx`

-   [x] **Update Game State**:
    -   **File**: `src/types.ts`
    -   **Action**: Add a new phase to the `GamePhase` enum:
        ```typescript
        export enum GamePhase {
          // ... existing phases
          LOAD_TRANSITION, // New phase for the welcome back screen
        }
        ```
    -   **File**: `src/state/appState.ts`
    -   **Action**: Update the `LOAD_GAME_SUCCESS` action in the `appReducer` to transition to the new phase instead of directly to `PLAYING`.
        ```typescript
        // in appReducer
        case 'LOAD_GAME_SUCCESS': {
          // ... existing logic to set up loaded state ...
          return {
            ...loadedState,
            phase: GamePhase.LOAD_TRANSITION, // <--- CHANGE HERE
            // ... reset other UI flags ...
          };
        }
        ```
-   [x] **Modify App Component**: `src/App.tsx`
    -   **Code Direction**:
        1.  **Import**: Import the new `LoadGameTransition` component.
        2.  **Add `useEffect` for Transition**: Create a new `useEffect` hook that listens for changes to `gameState.phase`.
            ```typescript
            // In App.tsx
            useEffect(() => {
              // This effect handles the timed transition from the welcome screen to the main game.
              if (gameState.phase === GamePhase.LOAD_TRANSITION) {
                // Set a timer for 2 seconds (2000 milliseconds)
                const timer = setTimeout(() => {
                  // After the timer, dispatch the action to enter the PLAYING phase
                  dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.PLAYING });
                }, 2000); // 2-second duration for the welcome screen

                // Cleanup function to clear the timer if the component unmounts
                // or if the phase changes before the timer completes.
                return () => clearTimeout(timer);
              }
            }, [gameState.phase, dispatch]);
            ```
        3.  **Update Rendering Logic**: Add a new `else if` block in the main rendering logic to display the `LoadGameTransition` component when `gameState.phase === GamePhase.LOAD_TRANSITION`.
            ```tsx
            // In App.tsx's main render logic
            // ...
            } else if (gameState.phase === GamePhase.LOAD_TRANSITION && gameState.party.length > 0) {
              mainContent = (
                <LoadGameTransition character={gameState.party[0]} />
              );
            } else if (gameState.phase === GamePhase.PLAYING && gameState.party.length > 0) {
            // ... rest of the playing UI ...
            ```

### Phase 3: Verification

-   [x] **Test Load Game Flow**:
    -   Start the game and save it.
    -   Return to the main menu.
    -   Click "Load Game" or "Continue".
    -   Verify that the `LoadingSpinner` appears first.
    -   Verify that after the spinner, the new `LoadGameTransition` screen appears for approximately 2 seconds, displaying the correct character name.
    -   Verify that after the transition screen, the main game UI renders correctly.
    -   Verify that this transition does *not* appear when starting a new game.