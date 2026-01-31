# Combat Component Documentation (Ralph)

## Overview
This folder contains the core logic for the Combat System, handling attack resolution, conditional effects (Riders), and event emission for UI/Logs.

## Files
- **AttackRiderSystem.ts**: Manages "Riders" (conditional effects like Smite/Sneak Attack). Handles registration, validation filters (weapon type, target), and consumption logic (remove on hit vs. mark used per turn).
- **AttackEventEmitter.ts**: Handles the emission of attack-related events (pre/post attack) to allow other systems (UI, Logs) to react or intervene.
- **MovementEventEmitter.ts**: Handles movement events (pre/post movement) during combat, supporting cancellation and distance tracking.
- **SavePenaltySystem.ts**: Manages temporary penalties to saving throws (e.g., from Bane or conditions), similar to the Rider system but for saves.
- **SustainActionSystem.ts**: Logic for actions that must be sustained over multiple turns (e.g., Witch Bolt), managing costs and turn-end cleanup.

## Issues & Opportunities
- **AttackRiderSystem.ts**:
    - `CombatCharacter` is imported but unused (Lint Warning).
    - The `ActiveRider` and `CombatState` types are imported but the file structure implies high coupling with `@/types/combat`.
    - `getMatchingRiders` contains complex nested if-logic for filters; could be refactored into a strategy pattern if filter types grow.
- **General**:
    - The system relies heavily on a "singleton" pattern for Event Emitters (`getInstance`), which might make testing state isolation difficult.
