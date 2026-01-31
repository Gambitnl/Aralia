# Core Hooks Documentation (Ralph)

## Overview
This folder contains the React Hooks that power the application lifecycle and game loop. These "Manager" hooks act as controllers, bridging the Redux state with the UI components and the deeper System logic.

## Files
- **useGameInitialization.ts**: Handles the "New Game" flow. It generates the world map (Seed), creates the initial party (using `generateCompanion` for rich backstories), and populates starting items.
- **useGameActions.ts**: The central dispatch hub. It receives generic `Action` objects (e.g., `{ type: 'move', ... }`) and routes them to specific handlers. It manages global UI states like "Loading" or "Error".
- **useAbilitySystem.ts**: The Combat Action controller. It manages the complex flow of Selecting a Spell -> Picking Targets -> Validating Range -> Executing the Command. It uses `useRef` heavily to maintain stable function identities despite frequent React renders during combat animations.

## Issues & Opportunities
- **useGameActions.ts**: The `isUiToggle` list is a hardcoded array of string literals. Every time a new UI modal is added, this list must be updated manually or the global loading spinner will trigger unnecessarily.
- **useGameInitialization.ts**: `handleSkipCharacterCreator` hardcodes the "Classic Party" (Fighter/Cleric/Rogue). This is great for dev speed but limits testing of other classes/races without using the full UI creator.
