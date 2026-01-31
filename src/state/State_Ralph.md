# State Component Documentation (Ralph)

## Overview
This folder contains the Redux-like State Management logic. It defines the "Single Source of Truth" for the entire application, including the party stats, world map, current time, and global flags. It uses a modular reducer pattern where a Root Reducer (`appReducer`) delegates to specialized slice reducers.

## Key Files
- **appState.ts**: The Root orchestrator. Defines the total `GameState` interface and the main `appReducer`.
- **initialState.ts**: (Redundant?) Defines the starting state for a new game. **Note: Duplicates logic from appState.ts.**
- **reducers/characterReducer.ts**: Manages the party, inventory, and progression (Level Up, XP, Equipment). Includes complex stat-recalculation logic inside actions like `EQUIP_ITEM`.
- **reducers/worldReducer.ts**: Manages time, map data, and global events. Cascades `ADVANCE_TIME` actions into Ritual and Underdark mechanics.

## Issues & Opportunities
- **Redundancy**: `appState.ts` and `initialState.ts` both define `initialGameState`. They have drifted apart (one has `npcMemory` with interactions, the other doesn't). This is a high-risk technical debt item.
- **Action Complexity**: Several reducers (e.g. `characterReducer`) perform complex calculations (AC, HP) *inside* the reducer. This is generally anti-pattern in Redux; calculations should happen in utilities or selectors to keep reducers pure and predictable.
- **Loose Typing**: Many actions use `action.payload as any` or partial types, leading to defensive code like `if (!itemId || !characterId) return {}`.
