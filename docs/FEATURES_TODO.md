# Aralia RPG - Feature TODO List

This file tracks **active** planned features, enhancements, and tasks for the Aralia RPG project.

---

## 📋 Workflow: Managing Completed TODOs

### When to Archive a TODO

TODOs are moved from this file to [archive/@FEATURES-COMPLETED.md](./archive/@FEATURES-COMPLETED.md) when:

1. **Standalone Task Complete**: A single, independent task is marked `[DONE]` and has no dependencies
2. **Project Fully Complete**: ALL sub-tasks within a larger project group are marked `[DONE]`

### When to Keep a TODO Here

TODOs remain in this file when:

1. **Partially Complete Projects**: Some sub-tasks are `[DONE]` but others remain `[TODO]` or `[PARTIALLY DONE]`
   - Example: Combat System has 4 items done but 1 still in progress
   - Keep all sub-items together until the entire project is complete
2. **Active Work**: Any task currently being worked on or planned for near-term implementation
3. **Dependencies**: Tasks that are complete but blocked waiting for dependent work

### Status Markers

*   `[TODO]` - Not yet started
*   `[PARTIALLY DONE]` - In progress, significant work remaining
*   `[ONGOING]` - Continuous improvement task with no clear end state
*   `[PAUSED]` - Temporarily suspended (include reason)
*   `[DONE]` - Completed (will be archived per rules above)

---

## Core Gameplay Systems

*   **Combat System**:
    *   **[PARTIALLY DONE]** Implement a full range of abilities and spells. Basic attacks and some spells are supported via `spellAbilityFactory`.
*   **Quest System**:
    *   **[TODO]** Implement a robust quest system with objectives, tracking, and rewards.
    *   **[TODO]** Allow quests to be given by NPCs or discovered in the world.
*   **Character Progression**:
    *   **[PARTIALLY DONE]** Leveling up system. *(PR #11 - XP distribution and auto-leveling implemented, but critical bug: rewards not passing to reducer)*
    *   **[TODO]** Gaining new abilities/spells upon level-up.
    *   **[TODO]** Improving stats or choosing feats.
*   **Feat System**:
    *   **[TODO]** Integrate feats as part of character creation and progression. See dedicated section below.
*   **Secure Dice Roll Handling**:
    *   **[TODO]** Implement server-side or secure client-side dice rolls that are not vulnerable to client-side manipulation.
*   **Party Members**:
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

*   **Town Description System**:
    *   **[PLANNED]** Implement dynamic town descriptions that generate rich details on-demand when players approach settlements. *(Complete project documentation created in `docs/projects/town-description-system/`)*
        *   **Basic Metadata**: Generate town names and core properties during world creation
        *   **Lazy Loading**: Rich descriptions generate when players get near towns (configurable range)
        *   **Cultural Adaptation**: Descriptions adapt based on race, biome, culture, and player background
        *   **Performance Optimized**: Only nearby towns have detailed descriptions loaded
    *   **Next Steps**: Create `TownMetadata` interface, implement `TownNameGenerator`, add proximity detection system

*   **Advanced World Map Features**:
    *   **[TODO]** Implement more sophisticated procedural generation algorithms for biome zones (e.g., Perlin noise, cellular automata).
    *   **[TODO]** Allow procedural generation of actual `Location` data for unkeyed map tiles.
    *   **[TODO]** Add map markers for POIs, discovered locations, quests.
    *   **[TODO]** Implement map panning and zooming.
*   **Points of Interest (POI) System**:
    *   **[TODO]** Define and distribute POIs (shrines, landmarks) across map tiles.
*   **Living NPCs & Social System**:
    *   **[TODO]** Develop NPC routines and faction affiliations.
*   **In-Game Time**:
    *   **[TODO]** Implement season-based mechanics.

## AI & Storytelling (Gemini Integration)

*   **DM (Storyteller) Consistency**:
    *   **[ONGOING]** Improve consistency of Gemini-powered storyteller.

## UI/UX Enhancements

*   **Quest Indicators**:
    *   **[TODO]** Visual indicators on map for quest objectives.
*   **Inventory Management**:
    *   **[TODO]** Implement item containers (bags) and comparison UI.
*   **Sound**:
    *   **[TODO]** Ambient sounds and music.
*   **Accessibility**:
    *   **[ONGOING]** ARIA implementations, keyboard navigation.
*   **Scene Visuals**:
    *   **[PAUSED]** `ImagePane` component exists, but image generation is currently disabled to manage API quotas; scene panels rely on canvas or textual renderings until quota-friendly image generation is re-enabled.

---

## v1.1 Critical Bug Fixes & Follow-up Tasks

*Based on Lane Agent deployment (PRs #11-16), the following critical issues require attention:*

### 🔴 Priority 1: Data Integrity & Core Functionality

5.  **[TODO]** **Canvas Rendering Initialization Error** *(Deployment Test 2025-11-26)*
    *   **Issue**: `TypeError: Cannot read properties of undefined (reading 'canvas')` - PIXI/canvas fails to initialize
    *   **Location**: Canvas/PIXI initialization code, game initialization hooks
    *   **Impact**: CRITICAL - Blocking core game rendering functionality
    *   **Investigation**:
        - Check canvas/PIXI initialization order
        - Verify rendering dependencies load correctly
        - Ensure canvas element exists in DOM before access
    *   **Related**: See [03-CANVAS-MAP.md](tasks/testing-overhaul/03-CANVAS-MAP.md) for testing coverage

6.  **[DONE]** **HOTFIX: Village Building Selection Logic** *(Completed)*
    *   **Issue**: Nested building selection needs reverse iteration to prevent incorrect placement
    *   **Location**: `src/services/villageGenerator.ts` - building placement loop
    *   **Impact**: HIGH - Building layouts incorrect
    *   **Fix**: Building placement system now uses proper priority system with `setTileWithPriority()` that prevents overwriting civic structures

### 🟡 Priority 2: Performance & UX Polish

8.  **[TODO]** **Combat Log Anomalies After Initiative Reordering**
    *   **Issue**: Turn-start guards trigger unexpectedly after initiative reordering
    *   **Location**: Combat hooks / turn management system
    *   **Impact**: MEDIUM - Unexpected behavior during combat
    *   **Fix**: Capture and replay combat log anomalies to diagnose; review turn-start guard logic

9.  **[TODO]** **Optimize Save Slot Metadata Operations** *(PR #15 Performance)*
    *   **Issue**: Inefficient read-sort-filter pattern on every metadata operation
    *   **Location**: `src/services/saveLoadService.ts`
    *   **Impact**: LOW - Performance degrades with many saves
    *   **Fix**: Cache metadata, only refresh on write operations

10. **[TODO]** **AI AoE Sampling Performance Hotspots**
    *   **Issue**: AI AoE sampling may have performance hotspots; reachability and AoE tile sets recalculated each evaluation
    *   **Location**: AI combat evaluation / AoE targeting system
    *   **Impact**: LOW - Potential performance degradation during AI turns
    *   **Fix**: Profile AI AoE sampling; consider caching reachability and AoE tile sets per ability per turn

11. **[DONE]** **Combat Hook Performance Optimizations** *(Completed)*
    *   **Issue**: Missing `useCallback`/`useMemo` opportunities in battle map hooks
    *   **Location**: `src/hooks/combat/useTurnManager.ts`
    *   **Impact**: LOW - Unnecessary re-renders during combat
    *   **Fix**: Added 15+ `useCallback` calls and multiple `useMemo` calls with proper dependency arrays

12. **[DONE]** **Remove Dead Code from Village Generator** *(Completed)*
    *   **Issue**: Plaza boost logic that never executes
    *   **Location**: `src/services/villageGenerator.ts`
    *   **Impact**: LOW - Code clarity
    *   **Fix**: No unreachable plaza boost logic found - all plaza code is actively used in building generation

### 🔵 Priority 3: Incomplete Lane 1 Tasks

*Lane 1 (Core Types & Game Systems) only completed 1 of 7 assigned tasks. The following remain:*

13. **[TODO]** **Feat System Integration** *(Lane 1 Incomplete)*
    *   Create feat data structures in `src/data/feats/`
    *   Add feat slots to `PlayerCharacter` type
    *   Create `FeatSelection.tsx` component for character creation
    *   Integrate feat effects into character stats

14. **[TODO]** **Character Age Selection** *(Lane 1 Incomplete)*
    *   Add `age` field to `PlayerCharacter` type
    *   Define logical age ranges for each race
    *   Add age selection step to CharacterCreator

15. **[TODO]** **Quest System Implementation** *(Lane 1 Incomplete)*
    *   Define Quest, QuestObjective, QuestReward types
    *   Implement quest tracking in `questReducer`
    *   Create QuestLogOverlay component
    *   Add quest completion rewards

16. **[TODO]** **Item Containers & Comparison UI** *(Lane 1 Incomplete)*
    *   Add container properties to Item type
    *   Implement nested inventory logic
    *   Create ItemComparisonTooltip component

17. **[TODO]** **NPC Routines & Factions** *(Lane 1 Incomplete)*
    *   Add faction and dailyRoutine to NPC type
    *   Define faction data structures
    *   Implement routine scheduling system

18. **[TODO]** **Notification System** *(Lane 1 Incomplete)*
    *   Add notifications array to GameState
    *   Create NotificationToast component
    *   Replace all `alert()` calls with notification dispatches

### 🧹 Priority 4: Incomplete Lane 5 Cleanup

19. **[DONE]** **Delete Obsolete Component Files** *(Completed)*
    *   Delete `src/components/PlayerPane.tsx` ✅
    *   Delete `src/components/StartScreen.tsx` ✅
    *   Delete `src/components/Spellbook.tsx` ✅
    *   Delete `src/battleMapDemo.tsx` ✅
    *   Delete `src/components/CharacterCreator/Race/FlexibleAsiSelection.tsx` ✅
    *   Delete `src/hooks/OLD_useGameActions.ts` ✅
    *   Delete obsolete racial spellcasting components (4 files) ✅

20. **[TODO]** **Delete Obsolete Documentation Files** *(Lane 5 Incomplete)*
    *   Delete corresponding README files for above components
    *   Update `docs/@README-INDEX.md` to remove references

21. **[TODO]** **Verify No Import References Remain** *(Lane 5 Incomplete)*
    *   Global search for imports of deleted files
    *   Remove any remaining import statements
    *   Test application build

---

## 📚 See Also

*   **[Completed Features Archive](./archive/@FEATURES-COMPLETED.md)** - All finished features and tasks
*   **[QOL_TODO.md](./QOL_TODO.md)** - Quality of Life improvements and technical debt
*   **[SPELL_INTEGRATION_STATUS.md](./SPELL_INTEGRATION_STATUS.md)** - Spell system migration tracking
*   **[CHANGELOG.md](./CHANGELOG.md)** - Project history and release notes
