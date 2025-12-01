# Aralia RPG - Feature TODO List

This file tracks planned features, enhancements, and tasks for the Aralia RPG project.

## Core Gameplay Systems

*   **Saving and Loading Games**:
    *   **[DONE]** Implement functionality to save game progress (player state, inventory, world state including `mapData`, `subMapCoordinates`, game log, dynamic item states, `saveVersion`, `saveTimestamp`).
    *   **[DONE]** Implement functionality to load saved games from a default slot, including version checking and resetting transient UI states.
    *   **[DONE]** Add a "Continue Game" option on the main menu to load the most recent save.
    *   **[DONE]** Provide "Save Game" button in `ActionPane`.
    *   **[DONE]** Allow "Main Menu" button to save game before exiting (if not in dev dummy mode).
    *   **[DONE]** Implement multiple save slots. *(PR #15 - Note: Contains critical bugs requiring hotfix - see v1.1 tasks below)*
*   **Character Sheet & Equipment**:
    *   **[DONE]** Display a Character Sheet modal when a party member is clicked.
    *   **[DONE]** Implement a visual Equipment Mannequin UI with slots.
    *   **[DONE]** Implement logic for equipping and unequipping items.
    *   **[DONE]** Update character stats (AC, etc.) based on equipped items.
*   **Combat System**:
    *   **[DONE]** Develop a turn-based tactical combat system on a procedural map.
    *   **[DONE]** Refactor combat system to use a D&D 5e-style action economy (Action, Bonus Action, Reaction, Movement).
    *   **[PARTIALLY DONE]** Implement a full range of abilities and spells. Basic attacks and some spells are supported via `spellAbilityFactory`.
    *   **[DONE]** Implement complex enemy AI for combat decisions. *(PR #12 - Includes AoE targeting, tactical positioning, focus fire)*
    *   **[DONE]** Integrate visual feedback (damage numbers, effect icons) into the battle map. *(PR #12 - BattleMapOverlay component with animations)*
*   **Quest System**:
    *   **[TODO]** Implement a robust quest system with objectives, tracking, and rewards.
    *   **[TODO]** Allow quests to be given by NPCs or discovered in the world.
*   **Character Progression**:
    *   **[PARTIALLY DONE]** Leveling up system. *(PR #11 - XP distribution and auto-leveling implemented, but critical bug: rewards not passing to reducer)*
    *   **[TODO]** Gaining new abilities/spells upon level-up.
    *   **[TODO]** Improving stats or choosing feats.
*   **Feat System**:
    *   **[TODO]** Integrate feats as part of character creation and progression. See dedicated section below.
*   **Economy System**:
    *   **[DONE]** Introduce currency (PP, GP, EP, SP, CP).
    *   **[DONE]** Implement Merchant interface with buying/selling.
    *   **[DONE]** Dynamic merchant inventory generation based on village economy context.
*   **Rest Mechanics**:
    *   **[DONE]** Implement Short Rest and Long Rest mechanics for recovery of HP, spell slots, and feature uses.
*   **Secure Dice Roll Handling**:
    *   **[TODO]** Implement server-side or secure client-side dice rolls that are not vulnerable to client-side manipulation.
*   **Party Members**:
    *   **[DONE]** System supports multiple party members in state and combat.
    *   **[PARTIALLY DONE]** Implement in-game mechanics for NPCs to join or leave the party (Game Guide can generate sheets, but full recruitment flow is pending).
    *   **[TODO]** Basic AI for party members in combat.
*   **Character Age in Creation**:
    *   **[TODO]** Add Age selection to Character Creation.
    *   **[TODO]** Define and display logical age ranges for each race.

### Feat System

*   **Current State**:
    *   The Human "Versatile" trait describes an extra feat, but no mechanical feat selection or application pipeline exists.
*   **Implementation Steps**:
    *   Define structured feat data in `src/data/feats/` (including prerequisites, benefits, and usage limits) and aggregate exports in `src/constants.ts`.
    *   Create a `FeatSelection` UI component for the character creator to surface eligible feats, enforce prerequisites, and capture the player's choice.
    *   Integrate feat effects into character assembly so selected feats adjust derived stats, proficiencies, or abilities across combat and exploration systems.

## World & Exploration

*   **Advanced World Map Features**:
    *   **[TODO]** Implement more sophisticated procedural generation algorithms for biome zones (e.g., Perlin noise, cellular automata).
    *   **[TODO]** Allow procedural generation of actual `Location` data for unkeyed map tiles.
    *   **[TODO]** Add map markers for POIs, discovered locations, quests.
    *   **[TODO]** Implement map panning and zooming.
*   **Points of Interest (POI) System**:
    *   **[TODO]** Define and distribute POIs (shrines, landmarks) across map tiles.
*   **Towns & Cities**:
    *   **[DONE]** Develop procedural village generation (`VillageScene`). *(PR #14 - Expanded with building variety, seeded generation - Contains critical bugs requiring hotfix)*
    *   **[DONE]** Implement interactive buildings (Inns, Shops) within villages. *(PR #14 - Multiple building types with click handlers)*
*   **Living NPCs & Social System**:
    *   **[DONE]** NPC Memory System (Disposition, Known Facts, Goals).
    *   **[DONE]** Gossip System (Information spread between NPCs).
    *   **[DONE]** Suspicion & Plausibility System for social checks.
    *   **[DONE]** Logbook for tracking NPC relationships and history.
    *   **[TODO]** Develop NPC routines and faction affiliations.
*   **In-Game Time**:
    *   **[DONE]** Display current in-game time (Day, HH:MM).
    *   **[TODO]** Implement season-based mechanics.

## AI & Storytelling (Gemini Integration)

*   **DM (Storyteller) Consistency**:
    *   **[ONGOING]** Improve consistency of Gemini-powered storyteller.
*   **Logbook-Fueled Gemini Inference**:
    *   **[DONE]** Utilize NPC memory and active goals to provide context for AI dialogue generation.
*   **Gemini-Generated Custom Actions**:
    *   **[DONE]** Suggest context-aware actions (e.g., "Look Around").
    *   **[DONE]** Implement "Egregious Acts" detection and consequences.
*   **Tile Inspection**:
    *   **[DONE]** Immersive, jargon-free descriptions of submap terrain.
*   **Game Guide Chatbot**:
    *   **[DONE]** Implement an AI assistant for rules and character generation (`GameGuideModal`).

## UI/UX Enhancements

*   **Minimap**:
    *   **[DONE]** Implement a small, always-visible version of the main map. *(PR #14 - Minimap component with click-to-pan, player position indicator)*
*   **Map Tile Tooltips**:
    *   **[DONE]** Hover tooltips for biome, coordinates, and location names.
*   **Quest Indicators**:
    *   **[TODO]** Visual indicators on map for quest objectives.
*   **Inventory Management**:
    *   **[DONE]** Equipping items from inventory.
    *   **[DONE]** Displaying total inventory weight.
    *   **[TODO]** Implement item containers (bags) and comparison UI.
*   **Sound**:
    *   **[DONE]** TTS for NPC dialogue.
    *   **[TODO]** Ambient sounds and music.
*   **Accessibility**:
    *   **[ONGOING]** ARIA implementations, keyboard navigation.
*   **Scene Visuals**:
    *   **[PAUSED]** `ImagePane` component exists, but image generation is currently disabled to manage API quotas; scene panels rely on canvas or textual renderings until quota-friendly image generation is re-enabled.
*   **Tooltips for Keywords**:
    *   **[DONE]** Implemented clickable/hoverable tooltips for game terms.
*   **Submap Display**:
    *   **[DONE]** Detailed local view (`SubmapPane`) with procedural visuals.
*   **Glossary**:
    *   **[DONE]** Comprehensive, searchable glossary for rules, spells, races, and classes.

## Technical & System

*   **Documentation**:
    *   **[DONE]** Maintain up-to-date READMEs. *(PR #16 - Added SVG visual diagrams to 5 component READMEs, updated hook documentation)*
*   **Error Handling**:
    *   **[DONE]** `ErrorBoundary` implementation.
*   **Code Quality**:
    *   **[DONE]** Centralized AI client.
    *   **[DONE]** Refactored state management (`useReducer` slices).
    *   **[DONE]** Modular action handlers.
    *   **[DONE]** Externalized CSS.

---

## v1.1 Critical Bug Fixes & Follow-up Tasks

*Based on Lane Agent deployment (PRs #11-16), the following critical issues were identified and require immediate attention:*

### 🔴 Priority 1: Data Integrity & Core Functionality

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

4.  **[TODO]** **HOTFIX: Village Building Selection Logic** *(PR #14 Critical Bug)*
    *   **Issue**: Nested building selection needs reverse iteration to prevent incorrect placement
    *   **Location**: `src/services/villageGenerator.ts` - building placement loop
    *   **Impact**: HIGH - Building layouts incorrect
    *   **Fix**: Reverse iteration order for building selection

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

### 🟡 Priority 2: Performance & UX Polish

8.  **[DONE]** **Replace Native Dialogs with Themed Modals** *(PR #15 UX Issue)*
    *   **Issue**: Uses `window.confirm()` which breaks game immersion
    *   **Location**: `src/components/SaveSlotSelector.tsx:223-239`
    *   **Impact**: LOW - Breaks immersive theming
    *   **Fix**: Create themed confirmation modal component
    *   **Status**: FIXED - Now uses `ConfirmationModal` component for overwrite confirmations

9.  **[TODO]** **Optimize Save Slot Metadata Operations** *(PR #15 Performance)*
    *   **Issue**: Inefficient read-sort-filter pattern on every metadata operation
    *   **Location**: `src/services/saveLoadService.ts`
    *   **Impact**: LOW - Performance degrades with many saves
    *   **Fix**: Cache metadata, only refresh on write operations

10. **[TODO]** **Combat Hook Performance Optimizations** *(PR #12 Performance)*
    *   **Issue**: Missing `useCallback`/`useMemo` opportunities in battle map hooks
    *   **Location**: `src/hooks/combat/useTurnManager.ts`
    *   **Impact**: LOW - Unnecessary re-renders during combat
    *   **Fix**: Add proper memoization to combat hooks

11. **[TODO]** **Remove Dead Code from Village Generator** *(PR #14 Code Quality)*
    *   **Issue**: Plaza boost logic that never executes
    *   **Location**: `src/services/villageGenerator.ts`
    *   **Impact**: LOW - Code clarity
    *   **Fix**: Remove or fix unreachable code

### 🔵 Priority 3: Incomplete Lane 1 Tasks

*Lane 1 (Core Types & Game Systems) only completed 1 of 7 assigned tasks. The following remain:*

12. **[TODO]** **Feat System Integration** *(Lane 1 Incomplete)*
    *   Create feat data structures in `src/data/feats/`
    *   Add feat slots to `PlayerCharacter` type
    *   Create `FeatSelection.tsx` component for character creation
    *   Integrate feat effects into character stats

13. **[TODO]** **Character Age Selection** *(Lane 1 Incomplete)*
    *   Add `age` field to `PlayerCharacter` type
    *   Define logical age ranges for each race
    *   Add age selection step to CharacterCreator

14. **[TODO]** **Quest System Implementation** *(Lane 1 Incomplete)*
    *   Define Quest, QuestObjective, QuestReward types
    *   Implement quest tracking in `questReducer`
    *   Create QuestLogOverlay component
    *   Add quest completion rewards

15. **[TODO]** **Item Containers & Comparison UI** *(Lane 1 Incomplete)*
    *   Add container properties to Item type
    *   Implement nested inventory logic
    *   Create ItemComparisonTooltip component

16. **[TODO]** **NPC Routines & Factions** *(Lane 1 Incomplete)*
    *   Add faction and dailyRoutine to NPC type
    *   Define faction data structures
    *   Implement routine scheduling system

17. **[TODO]** **Notification System** *(Lane 1 Incomplete)*
    *   Add notifications array to GameState
    *   Create NotificationToast component
    *   Replace all `alert()` calls with notification dispatches

### 🧹 Priority 4: Incomplete Lane 5 Cleanup

18. **[TODO]** **Delete Obsolete Component Files** *(Lane 5 Incomplete)*
    *   Delete `src/components/PlayerPane.tsx`
    *   Delete `src/components/StartScreen.tsx`
    *   Delete `src/components/Spellbook.tsx`
    *   Delete `src/battleMapDemo.tsx`
    *   Delete `src/components/CharacterCreator/Race/FlexibleAsiSelection.tsx`
    *   Delete `src/hooks/OLD_useGameActions.ts`
    *   Delete obsolete racial spellcasting components (4 files)

19. **[TODO]** **Delete Obsolete Documentation Files** *(Lane 5 Incomplete)*
    *   Delete corresponding README files for above components
    *   Update `docs/README_INDEX.md` to remove references

20. **[TODO]** **Verify No Import References Remain** *(Lane 5 Incomplete)*
    *   Global search for imports of deleted files
    *   Remove any remaining import statements
    *   Test application build
