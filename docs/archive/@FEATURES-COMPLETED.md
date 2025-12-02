# Aralia RPG - Completed Features Archive

**Archive Date**: December 2, 2025

This file contains features and tasks that have been completed and archived from [FEATURES_TODO.md](../../FEATURES_TODO.md). Items are moved here when:
1. They are completely finished as a standalone task, OR
2. They are part of a larger project where ALL sub-tasks are now complete

For partially complete projects, items remain in FEATURES_TODO.md until the entire project is finished.

---

## Core Gameplay Systems

### Saving and Loading Games ✅ COMPLETE

*   **[DONE]** Implement functionality to save game progress (player state, inventory, world state including `mapData`, `subMapCoordinates`, game log, dynamic item states, `saveVersion`, `saveTimestamp`).
*   **[DONE]** Implement functionality to load saved games from a default slot, including version checking and resetting transient UI states.
*   **[DONE]** Add a "Continue Game" option on the main menu to load the most recent save.
*   **[DONE]** Provide "Save Game" button in `ActionPane`.
*   **[DONE]** Allow "Main Menu" button to save game before exiting (if not in dev dummy mode).
*   **[DONE]** Implement multiple save slots. *(PR #15 - Note: Contains critical bugs requiring hotfix - see v1.1 tasks below)*

### Character Sheet & Equipment ✅ COMPLETE

*   **[DONE]** Display a Character Sheet modal when a party member is clicked.
*   **[DONE]** Implement a visual Equipment Mannequin UI with slots.
*   **[DONE]** Implement logic for equipping and unequipping items.
*   **[DONE]** Update character stats (AC, etc.) based on equipped items.

### Economy System ✅ COMPLETE

*   **[DONE]** Introduce currency (PP, GP, EP, SP, CP).
*   **[DONE]** Implement Merchant interface with buying/selling.
*   **[DONE]** Dynamic merchant inventory generation based on village economy context.

### Rest Mechanics ✅ COMPLETE

*   **[DONE]** Implement Short Rest and Long Rest mechanics for recovery of HP, spell slots, and feature uses.

---

## World & Exploration

### Towns & Cities ✅ COMPLETE

*   **[DONE]** Develop procedural village generation (`VillageScene`). *(PR #14 - Expanded with building variety, seeded generation - Contains critical bugs requiring hotfix)*
*   **[DONE]** Implement interactive buildings (Inns, Shops) within villages. *(PR #14 - Multiple building types with click handlers)*

### Living NPCs & Social System ✅ MOSTLY COMPLETE

*   **[DONE]** NPC Memory System (Disposition, Known Facts, Goals).
*   **[DONE]** Gossip System (Information spread between NPCs).
*   **[DONE]** Suspicion & Plausibility System for social checks.
*   **[DONE]** Logbook for tracking NPC relationships and history.
*   **[DONE]** Implement in-game time display (Day, HH:MM).

---

## AI & Storytelling (Gemini Integration)

### Logbook-Fueled Gemini Inference ✅ COMPLETE

*   **[DONE]** Utilize NPC memory and active goals to provide context for AI dialogue generation.

### Gemini-Generated Custom Actions ✅ COMPLETE

*   **[DONE]** Suggest context-aware actions (e.g., "Look Around").
*   **[DONE]** Implement "Egregious Acts" detection and consequences.

### Tile Inspection ✅ COMPLETE

*   **[DONE]** Immersive, jargon-free descriptions of submap terrain.

### Game Guide Chatbot ✅ COMPLETE

*   **[DONE]** Implement an AI assistant for rules and character generation (`GameGuideModal`).

---

## UI/UX Enhancements

### Minimap ✅ COMPLETE

*   **[DONE]** Implement a small, always-visible version of the main map. *(PR #14 - Minimap component with click-to-pan, player position indicator)*

### Map Tile Tooltips ✅ COMPLETE

*   **[DONE]** Hover tooltips for biome, coordinates, and location names.

### Inventory Management - Equipping ✅ COMPLETE

*   **[DONE]** Equipping items from inventory.
*   **[DONE]** Displaying total inventory weight.

### Sound - TTS ✅ COMPLETE

*   **[DONE]** TTS for NPC dialogue.

### Tooltips for Keywords ✅ COMPLETE

*   **[DONE]** Implemented clickable/hoverable tooltips for game terms.

### Submap Display ✅ COMPLETE

*   **[DONE]** Detailed local view (`SubmapPane`) with procedural visuals.

### Glossary ✅ COMPLETE

*   **[DONE]** Comprehensive, searchable glossary for rules, spells, races, and classes.

---

## Technical & System ✅ COMPLETE

### Documentation ✅ COMPLETE

*   **[DONE]** Maintain up-to-date READMEs. *(PR #16 - Added SVG visual diagrams to 5 component READMEs, updated hook documentation)*

### Error Handling ✅ COMPLETE

*   **[DONE]** `ErrorBoundary` implementation.

### Code Quality ✅ COMPLETE

*   **[DONE]** Centralized AI client.
*   **[DONE]** Refactored state management (`useReducer` slices).
*   **[DONE]** Modular action handlers.
*   **[DONE]** Externalized CSS.

---

## v1.1 Critical Bug Fixes (Completed) ✅

### 🟢 Priority 1: Data Integrity & Core Functionality (Completed)

1.  **[DONE]** **HOTFIX: Battle XP Rewards Not Applied** *(PR #11 Critical Bug)*
    *   **Issue**: The `END_BATTLE` action does not pass reward object to reducer, preventing XP system from functioning.
    *   **Location**: `src/state/appState.ts:398-441`
    *   **Impact**: HIGH - Players cannot gain XP or level up
    *   **Fix**: Rewards are now properly processed in END_BATTLE reducer, distributing XP, applying level ups, and awarding gold/items
    *   **Status**: FIXED - Reducer correctly handles rewards.xp, distributes to party, and triggers level up logic

2.  **[DONE]** **HOTFIX: Save Slot Overwrite Vulnerability** *(PR #15 Critical Bug)*
    *   **Issue**: Flawed overwrite detection logic could allow unintended save data loss
    *   **Location**: `src/components/SaveSlotSelector.tsx:65-83`
    *   **Impact**: CRITICAL - Potential player save data loss
    *   **Fix**: Correct overwrite detection before writing to localStorage
    *   **Status**: FIXED - Proper ID and name collision detection with explicit user confirmation via themed modal before overwrite

3.  **[DONE]** **HOTFIX: Village Generation No-op Tile Assignments** *(PR #14 Critical Bug)*
    *   **Issue**: Tile assignments that don't persist, causing incomplete village generation
    *   **Location**: `src/services/villageGenerator.ts:98-112`
    *   **Impact**: HIGH - Villages may not render correctly
    *   **Fix**: Ensure tile assignments modify the layout array correctly
    *   **Status**: FIXED - `setTileWithPriority` now assigns directly to `tiles[y][x]` instead of modifying row variable

5.  **[DONE]** **HOTFIX: Village Type Safety Violations** *(PR #14 Critical Bug)*
    *   **Issue**: Multiple uses of `as any` to bypass TypeScript, indicating state management issues
    *   **Location**: `src/components/VillageScene.tsx`, `src/services/villageGenerator.ts`
    *   **Impact**: MEDIUM - Potential runtime errors
    *   **Fix**: Add proper type definitions to `src/types.ts`, remove all `as any` casts
    *   **Status**: FIXED - No `as any` casts remain in either file

6.  **[DONE]** **HOTFIX: Incorrect Playtime Calculation** *(PR #15 Critical Bug)*
    *   **Issue**: Save slot playtime using in-game time instead of actual session duration
    *   **Location**: `src/services/saveLoadService.ts:422-433`
    *   **Impact**: MEDIUM - Misleading UI, incorrect statistics
    *   **Fix**: Track actual session duration using `Date.now()` deltas
    *   **Status**: FIXED - `calculatePlaytimeSeconds()` now uses real-world elapsed time via `Date.now() - sessionStartedAtMs`

7.  **[DONE]** **HOTFIX: AoE Healing Can Target Enemies** *(PR #12 Medium Bug)*
    *   **Issue**: AoE healing spells can heal enemy combatants
    *   **Location**: `src/utils/combat/combatAI.ts:438-442`
    *   **Impact**: MEDIUM - Combat balance broken
    *   **Fix**: Filter AoE heal targets by team affiliation
    *   **Status**: FIXED - AI now penalizes healing enemies with `WEIGHTS.FRIENDLY_FIRE_PENALTY * 1.5` when evaluating AoE heal spells

### 🟢 Priority 2: UX Polish (Completed)

8.  **[DONE]** **Replace Native Dialogs with Themed Modals** *(PR #15 UX Issue)*
    *   **Issue**: Uses `window.confirm()` which breaks game immersion
    *   **Location**: `src/components/SaveSlotSelector.tsx:223-239`
    *   **Impact**: LOW - Breaks immersive theming
    *   **Fix**: Create themed confirmation modal component
    *   **Status**: FIXED - Now uses `ConfirmationModal` component for overwrite confirmations

---

## Combat System Components (Completed)

*Note: These are split out from the larger Combat System project, which still has ongoing work*

*   **[DONE]** Develop a turn-based tactical combat system on a procedural map.
*   **[DONE]** Refactor combat system to use a D&D 5e-style action economy (Action, Bonus Action, Reaction, Movement).
*   **[DONE]** Implement complex enemy AI for combat decisions. *(PR #12 - Includes AoE targeting, tactical positioning, focus fire)*
*   **[DONE]** Integrate visual feedback (damage numbers, effect icons) into the battle map. *(PR #12 - BattleMapOverlay component with animations)*

---

## Party Members - Core Support (Completed)

*Note: This is split out from the larger Party Members project, which still has ongoing recruitment/AI work*

*   **[DONE]** System supports multiple party members in state and combat.
