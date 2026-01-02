```# Comprehensive Review of Worklogs

## TODOs from Worklogs

### Architect
```## 2025-02-17 - PartyPane Refactor Strategy (TODO) **Learning:** The `PartyPane` component has grown to include embedded logic for individual character buttons and missing-choice validation. To improve maintainability and testability, this should be refactored into a directory structure. **Action:**
1. Create `src/components/PartyPane/` directory.
2. Extract the button logic into `PartyCharacterButton.tsx`.
3. Move the main list logic to `PartyPane.tsx` and export via `index.ts`.
4. Integrate `validateCharacterChoices` (from `src/utils/characterValidation.ts`) into the button component to show warnings for missing selections.
5. Ensure `MissingChoice` type is exported from `src/types`.
6. Update tests to reflect the new structure.
(Note: This refactor was prototyped but reverted to ensure a clean slate.)
```

### Bolt
```## 2024-05-23 - TODO: Aggressive Decoupling of Constants (Aborted)
**Context:** `src/constants.ts` is a major performance bottleneck because it aggregates all game data. A plan was formed to refactor this but was deemed too high-risk/sweeping for the current session.

**The Plan:**
1.  **Stop Re-exporting Heavy Data:** Remove exports like `ITEMS`, `NPCS`, `LOCATIONS` from `src/constants.ts`.
2.  **Direct Imports:** Update all ~90 files currently importing from `constants.ts` to import directly from their source files (e.g., `import { ITEMS } from './data/items'`).
3.  **Lazy Dev Data:** Refactor `src/data/dev/dummyCharacter.ts` to export a getter (`getDummyParty()`) rather than a static array, preventing immediate calculation of the dummy party (and thus immediate loading of all dependencies) at app startup.
4.  **Update Consumers:** Update `appState.ts` and `useGameInitialization.ts` to use the lazy getter.

**Benefit:** Significant reduction in initial bundle parse time and circular dependency risks.
**Status:** Deferred. Future "Bolt" or "Architect" agents should execute this in smaller chunks.
```

### Captain
```# Naval System Implementation Plan (TODO)

## 1. Type Definitions & State Structure
- [ ] **Update `src/types/naval.ts`**:
    - Add `NavalState` interface:
      ```typescript
      export interface NavalState {
        playerShips: Ship[];
        activeShipId: string | null;
        currentVoyage: VoyageState | null;
        knownPorts: string[];
      }
      ```
- [ ] **Update `src/types/index.ts`**: Ensure `naval` and `navalCombat` types are exported.
- [ ] **Update `src/types/state.ts`**: Add `naval: NavalState` to `GameState` interface.

## 2. Redux Integration
- [ ] **Create `src/state/reducers/navalReducer.ts`**:
    - **Actions**:
        - `NAVAL_INITIALIZE_FLEET`: Create starter ship.
        - `NAVAL_START_VOYAGE`: Init `currentVoyage` using `VoyageManager`.
        - `NAVAL_ADVANCE_VOYAGE`: Call `VoyageManager.advanceDay` and update state.
        - `NAVAL_RECRUIT_CREW`: Add crew member, deduct gold.
        - `NAVAL_REPAIR_SHIP`: Restore Hull Points, deduct gold.
        - `NAVAL_SET_ACTIVE_SHIP`: Switch command.
    - **Logic**: Use `VoyageManager` from `src/systems/naval/voyage/VoyageManager.ts`.
- [ ] **Update `src/state/actionTypes.ts`**: Register `NavalAction` types.
- [ ] **Update `src/state/appState.ts`**:
    - Import `navalReducer` and `INITIAL_NAVAL_STATE`.
    - Add `naval` to `initialGameState`.
    - Add `navalReducer` to `rootReducer`.
- [ ] **Update `src/state/reducers/uiReducer.ts`**:
    - Add `isNavalDashboardVisible` to `GameState` (UI slice).
    - Add `TOGGLE_NAVAL_DASHBOARD` action handler.

## 3. UI Components (`src/components/Naval/`)
- [ ] **`CaptainDashboard.tsx`**:
    - Main container modal.
    - Shows Active Ship details (HP, Speed, Supplies).
    - Actions: "Chart Course", "Advance Day", "Recruit".
- [ ] **`VoyageProgress.tsx`**:
    - Visualizes `VoyageState`.
    - Progress bar for `distanceTraveled` vs `totalDistance`.
    - Display Current Weather and Daily Log entries.
- [ ] **`CrewManifest.tsx`**:
    - List crew members, roles, and morale.
    - Buttons to recruit new roles (Sailor, Cook, Surgeon).

## 4. Integration Points
- [ ] **`src/components/DevMenu.tsx`**: Add button to toggle `isNavalDashboardVisible` for testing.
- [ ] **`src/components/layout/GameModals.tsx`**:
    - Lazy load `CaptainDashboard`.
    - Render it conditionally based on `gameState.isNavalDashboardVisible`.

## 5. Verification
- [ ] **Unit Tests**: Test `navalReducer` for state mutations (voyage progress, gold deduction).
- [ ] **Visual Check**: Verify Dashboard renders correctly and updates on "Advance Day".
```

### Depthcrawler
```## 2024-05-20 - TODO: The Blinding of the Deep (Visibility System Plan)
**Status:** Deferred / Architected
**Context:** The Underdark is defined by darkness. Currently, the BattleMap renders everything. To truly simulate the alien depths, we need a rigorous visibility system that makes Light a resource and Darkness a threat.

### 1. Architecture: The `VisibilitySystem`
**Goal:** A centralized service to calculate what a specific character can see.
**Inputs:**
- `BattleMapData` (Tiles, Walls)
- `activeLightSources` (Torches, Spells, Bioluminescence)
- `CombatCharacter` (Position, Senses: Darkvision/Blindsight)
**Logic:**
- **Step 1: Light Grid.** Calculate the light level ('bright', 'dim', 'darkness') for every tile on the map based on all active light sources.
- **Step 2: Line of Sight.** Use Bresenham's algorithm (existing in `lineOfSight.ts`) to determine physical visibility.
- **Step 3: Vision Overlay.** Combine LoS with Light Grid.
    - If Tile is blocked by Wall -> Invisible.
    - If Tile is Darkness AND Character has no Darkvision -> Invisible.
    - If Tile is Darkness AND Character has Darkvision -> Visible (as Dim Light, Monochrome).
    - If Tile is Invisible -> Hide enemies/tokens on that tile.

### 2. Integration: The Veil (Fog of War)
**Goal:** Visually represent the unknown.
**Components:**
- `BattleMapTile`: Add `visibilityState` prop ('visible', 'fog', 'hidden').
    - `visible`: Render normally.
    - `fog`: Render terrain (memory), hide tokens.
    - `hidden`: Render black void.
- `BattleMap`: Calculate `visibleTiles` set for the *current player character* (or active turn character) and pass this down.

### 3. Mechanics: Terror in the Dark
**Goal:** You cannot kill what you cannot see.
**Changes to `useAbilitySystem`:**
- **Targeting Validation:** `isValidTarget` must check `VisibilitySystem.canSee(caster, target)`.
- **UI Feedback:** "Target is in darkness" or "Target unseen" error message.
- **Disadvantage:** Attacks against unseen targets (if guessed correctly) or targets in Dim Light (if relevant features apply) should carry Disadvantage.

### 4. Why This Matters
Without this, the Underdark is just a grey forest. With this, a torch flickering out (duration mechanics) becomes a lethal emergency.
```

### Ecologist
```### TODO: Integrate TimeOfDay into WeatherSystem
**Goal:** Make weather react to Day/Night cycles (Temperature drops at night, Visibility decreases).
**Design:**
1.  **Update `updateWeather` signature:**
    ```typescript
    updateWeather(currentWeather: WeatherState, biomeId: string, timeOfDay: TimeOfDay): WeatherState
    ```
2.  **Temperature Mechanics:**
    - **Night:** Shift temperature index down by 1 (e.g., Hot -> Temperate).
    - **Day (Desert):** Shift temperature index up by 1.
    - **Caveat:** Be careful of "drift" where repeated updates compound the shift (e.g., Night 1: Hot->Temperate, Night 2: Temperate->Cold). Consider recalculating from a "Base Climate" or resetting stability.
3.  **Visibility Mechanics:**
    - **Night:** Force `visibility: 'heavily_obscured'` (Darkness).
    - **Dusk/Dawn:** Force `visibility: 'lightly_obscured'` if weather is clear.
    - **Priority:** Storms/Blizzards (Heavily Obscured) override Dusk/Dawn.
**Status:** Design validated via unit tests, but implementation reverted to prioritize other tasks.
```

### Economist
```## 2024-05-24 - Regional Pricing Architecture (TODO) **Learning:** The current pricing model relies solely on global scarcity/surplus, missing local nuance. A robust regional economy requires linking physical locations to economic zones. **Action:** Plan to implement the following architecture:

### 1. Data Structure Updates
- **Location Interface (`src/types/world.ts`):** Add optional `regionId: string` field.
- **Location Data (`src/data/world/locations.ts`):** Map existing locations to regional keys defined in `REGIONAL_ECONOMIES` (e.g., `region_capital`, `region_coast`).

### 2. Pricing Logic Refactor (`src/utils/economyUtils.ts`)
Update `calculatePrice` to accept an optional `regionId`.
Algorithm:
```typescript
const region = REGIONAL_ECONOMIES[regionId];
if (region) {
  // Supply: Local Exports are cheap (-20%)
  if (region.exports.includes(itemCategory)) {
     multiplier -= 0.2;
  }
  // Demand: Local Imports are expensive (+20%)
  if (region.imports.includes(itemCategory)) {
     multiplier += 0.2;
  }
}
```

### 3. Integration Points
- **MerchantModal:** Must pass `currentLocation.regionId` to `calculatePrice`.
- **Loot Generation:** Adjust value of loot based on where it is found (optional future scope).

### 4. Verification Strategy
- Test that 'Fish' costs less in `Coastal Cities` than `Iron Peaks`.
- Test that 'Iron' costs less in `Iron Peaks` than `Coastal Cities`.
```

### Gardener
```**Learning:** `npm run lint` is currently broken. The project has ESLint v9 installed but uses a legacy `.eslintrc.cjs` configuration. ESLint v9 defaults to "Flat Config" (`eslint.config.js`) and drops support for the old format unless strictly configured, but even `ESLINT_USE_FLAT_CONFIG=false` failed due to missing plugin dependencies (`@typescript-eslint/eslint-plugin`).
**Impact:** We cannot automatically detect unused variables, unused imports, or other "code rot" indicators. This leaves the Gardener blind to the most common maintenance tasks.
**Action (TODO):**
1.  **Migrate to Flat Config:** Create `eslint.config.js` and move rules from `.eslintrc.cjs` into it.
2.  **Fix Dependencies:** Ensure all ESLint plugins (react, typescript-eslint, imports) are compatible with v9 and Flat Config.
3.  **Enable Dead Code Rules:** explicit rules for `no-unused-vars` and `unused-imports` to automate gardening.
4.  **Verify:** Run `npm run lint` to ensure it passes or correctly flags issues.
```

### Linker
```**Learning:** geminiService generates narrative text (e.g., generateActionOutcome) that may invent entities (places, people) without validating against the GameState. A specific TODO was found requesting an EntityResolverService.
**Action:** Created EntityResolverService to parse text for entities and validate them against known Factions and Locations, providing a framework for future Stub creation.
```

### Mythkeeper
```## 2024-05-24 - Missing Races & Future Implementation Plan **Learning:** A review of `src/data/races/` revealed significant gaps in official race coverage compared to *Mordenkainen's Monsters of the Multiverse* and *Volo's Guide to Monsters*. Specifically, **Tabaxi**, **Triton**, **Kenku**, and **Tortle** are missing. **Action:** Created this TODO entry to document the implementation plan for **Tabaxi** that was prepared but deferred.

### TODO: Implement Tabaxi Race
**Source:** *Mordenkainen's Monsters of the Multiverse* (p. 26) / *Volo's Guide to Monsters* (p. 113)

**Proposed File Structure:**
- Create `src/data/races/tabaxi.ts`

**Data Structure Draft:**
```typescript
import { Race } from '../../types';

export const TABAXI_DATA: Race = {
  id: 'tabaxi',
  name: 'Tabaxi',
  description: 'Hailing from a strange and distant land, wandering tabaxi are catlike humanoids driven by curiosity to collect interesting artifacts, gather tales and stories, and lay eyes on all the world's wonders.',
  abilityBonuses: [], // Follow 2024 PHB style (Background-based ASIs)
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
    'Cat's Claws: You can use your claws to make unarmed strikes (1d6 + Strength slashing damage). You also have a climbing speed equal to your walking speed.',
    'Cat's Talent: You have proficiency in the Perception and Stealth skills.',
    'Feline Agility: Your reflexes and agility allow you to move with a burst of speed. When you move on your turn in combat, you can double your speed until the end of the turn. Once you use this trait, you can't use it again until you move 0 feet on one of your turns.',
  ],
  imageUrl: 'https://i.ibb.co/Placeholder/Tabaxi.png', // Needs asset
};
```

**Integration Steps:**
1.  Create the file above.
2.  Update `src/data/races/index.ts` to export `TABAXI_DATA`.
3.  Verify integration with Character Creator UI (ensure traits display correctly).
4.  (Future) Implement mechanical hooks for `Feline Agility` (requires a status effect or movement tracker reset trigger).
```

### Oracle
```## TODO: Refactor ActiveEffect to remove `any` and circular deps
**Context:**
`PlayerCharacter` in `src/types/character.ts` currently uses `activeEffects?: any[]`. This should be typed as `ActiveEffect[]`.
However, `ActiveEffect` is defined in `src/types/combat.ts`, which imports `Class` from `src/types/character.ts`. Importing `ActiveEffect` into `character.ts` creates a circular dependency (`character` -> `combat` -> `character`).

**Proposed Plan:**
1.  **Move `ActiveEffect`**: Move the `ActiveEffect` interface from `src/types/combat.ts` to `src/types/effects.ts`.
    *   `src/types/effects.ts` is a leaf node for effect types and avoids circular deps.
    *   Update `ActiveEffect` to use strict `TargetConditionFilter` instead of `any` for `attackerFilter`.
2.  **Update `character.ts`**: Import `ActiveEffect` from `src/types/effects.ts` and replace `any[]` with `ActiveEffect[]`.
3.  **Update `combat.ts`**: Remove the local definition and import `ActiveEffect` from `src/types/effects.ts`.
4.  **Update Consumers**: Update imports in files that reference `ActiveEffect` (currently importing from `combat.ts`):
    *   `src/commands/effects/DefensiveCommand.ts`
    *   `src/utils/statUtils.ts` and its test `src/utils/__tests__/statUtils.test.ts`
    *   `src/systems/spells/__tests__/DefenderFilter.test.ts`
    *   `src/systems/spells/effects/__tests__/ACCalculation.test.ts`

**Why Aborted:**
Prioritized documentation of the plan over execution at this time to allow for a clean task reset.
```

### Recorder
```**Learning:** Implemented a structured `NPCMemory` system with `Interaction` (ID, significance, witnesses) and `Fact` (confidence, source).
**Action:** Added `src/utils/memoryUtils.ts` with `addInteraction`, `decayMemories`, and `getRelevantMemories`.
**Action:** Left TODO in `src/types/companions.ts` to migrate legacy approval systems to this new structure.

## TODO: Item Provenance System (Design)
**Goal:** Implement a system to track the history and "life" of items, adhering to the philosophy "If they don't remember, it didn't happen."

**1. Data Types (`src/types/provenance.ts`)**
- `ProvenanceEventType`: Enum of events (CRAFTED, FOUND, STOLEN, SOLD, USED_IN_COMBAT, ENCHANTED, DAMAGED, REPAIRED, GIFTED).
- `ProvenanceEvent`:
  - `date`: GameDate (number).
  - `type`: ProvenanceEventType.
  - `description`: string.
  - `actorId?`: string (Entity ID).
  - `locationId?`: string.
- `ItemProvenance`:
  - `creator`: string.
  - `createdDate`: GameDate.
  - `originalName?`: string.
  - `previousOwners`: string[].
  - `history`: ProvenanceEvent[].

**2. Integration (`src/types/items.ts`)**
- Update `Item` interface to include optional `provenance?: ItemProvenance`.

**3. Utility Logic (`src/utils/provenanceUtils.ts`)**
- `createProvenance(creator, date)`: Initialize new history.
- `addProvenanceEvent(item, type, desc, date, actorId)`: Immutable update adding an event.
- `generateLegendaryHistory(item, date)`: Procedural generation for "found" rare items to give them backstory (e.g., forged 100 years ago, lost in battle).

**4. Service Integration**
- **Loot Generation (`src/services/lootService.ts`)**: When generating Rare/Legendary items, call `generateLegendaryHistory` so they aren't "born yesterday."
- **Crafting**: When players craft items, initialize provenance with `createProvenance`.
- **Combat/Events**: When significant events occur (killing a boss with a weapon), append a `USED_IN_COMBAT` event to the weapon.

**5. Testing**
- Unit tests in `src/utils/__tests__/provenanceUtils.test.ts` to verify immutable updates and history generation.
```

### Ritualist
```### TODO: Implement Ritual Backlash Execution System
**Context:** The `RitualState` supports a `backlash` array, but there is no engine logic to execute these effects when a ritual is interrupted.
**Plan:**
1.  **Create `src/systems/rituals/RitualBacklashSystem.ts`**:
    *   **Interface `BacklashResult`**:
        ```typescript
        interface BacklashResult {
          messages: string[];
          damageEvents: Array<{ targetId: string; amount: number; type?: string }>;
          statusEvents: Array<{ targetId: string; condition: string; duration?: number }>;
          summonEvents: Array<{ creatureId: string; count: number }>;
        }
        ```
    *   **Function `executeBacklash(backlashList: RitualBacklash[], casterId: string, participantIds: string[]): BacklashResult`**:
        *   Iterate through `backlashList`.
        *   Roll damage using `combatUtils.rollDice`.
        *   Target `casterId` and all `participantIds`.
        *   Return the structured `BacklashResult`.

2.  **Integration Point**:
    *   In `RitualManager.checkInterruption`, if interruption occurs and `saveToResist` fails (or isn't present), retrieve relevant backlash using `getBacklashOnFailure`.
    *   Call `executeBacklash` with the retrieved effects.
    *   **Architecture Decision Needed:** Should `RitualManager` return the `BacklashResult` to the reducer, or should the reducer call `executeBacklash`?
        *   *Recommendation:* Keep `RitualManager` pure. The Reducer (or Saga/Thunk) should call `RitualManager.getBacklashOnFailure`, then call `executeBacklash`, then dispatch the resulting damage/summon events to the engine.

3.  **Future UI Work**:
    *   Display "Ritual Backlash!" warning.
    *   Show specific VFX for backlash (e.g., necrotic explosion).
```

### Taxonomist
```**Learning:** Converting `DamageType` from a string union to an Enum provides better type safety and extensibility (like associating descriptions/traits) without breaking existing string-based usage if the Enum values are strings. However, explicit type assertions are sometimes needed when interacting with legacy string-typed interfaces.
**Action:** When migrating other unions like `ConditionName` or `ItemType`, prioritize creating the Enum first, update the type definition to use the Enum, and provide a migration path (TODOs) for consumers to switch to strict Enum usage.
```

### Timekeeper
```### TODO: Dynamic Weather & Meaningful Time Architecture

**Goal:** Make the passage of time mechanically impactful by allowing weather to shift and influence player actions.

**1. Activate Weather in `worldReducer`**
- **Current State:** `ADVANCE_TIME` only increments the clock and processes basic world events. Weather is static or manually set.
- **Proposed Change:**
    - Import `updateWeather` from `src/systems/environment/WeatherSystem.ts`.
    - In the `ADVANCE_TIME` case, calculate the new weather state based on the current biome and elapsed time.
    - Update `state.environment` with the result.
    - Triggers logs if weather conditions change significantly (e.g., "A storm begins to brew.").

**2. Update `timeUtils` for Weather Awareness**
- **Current State:** `getTimeModifiers` only looks at Season and Time of Day.
- **Proposed Change:**
    - Update signature: `getTimeModifiers(date: Date, weather?: WeatherState)`.
    - Incorporate weather mechanics:
        - **Precipitation:** Rain/Storms increase travel cost.
        - **Temperature:** Extreme heat/cold could impose exhaustion risks (future).
        - **Visibility:** Fog/Blizzards reduce vision range.
    - Generate richer descriptions: "The storm howls, making travel difficult." instead of just "It is night."

**3. System Integration**
- **Movement:** Ensure `handleMovement.ts` passes the current `state.environment` to `getTimeModifiers` so travel times reflect the weather.
- **Context:** Update `generateGeneralActionContext` to include weather descriptions in the narrative prompt for AI.

**4. Verification Plan**
- **Unit Tests:**
    - Test `worldReducer` correctly transitions weather over long durations.
    - Test `getTimeModifiers` returns higher costs during storms.
- **Manual Check:**
    - Wait for hours in-game and observe weather changes in the UI/Logs.
```

### Worldsmith
```**Future TODO Plan:**
1.  **Define Action Type:** Ensure `TOGGLE_NEWS` is added to `src/types/actions.ts` (AppAction) and `src/types/index.ts` (Action union).
2.  **State Initialization:** Add `isNewsVisible: false` to `initialGameState` in `src/state/appState.ts`.
3.  **Reducer Logic:** Implement `TOGGLE_NEWS` in `uiReducer.ts`, ensuring it closes `isQuestLogVisible`, `isLogbookVisible`, etc.
4.  **UI Component:** Re-implement `src/components/NewsPane/NewsPane.tsx` using the `WorldRumor` type.
5.  **Modal Manager:** Add the rendering logic to `src/components/layout/GameModals.tsx`.
6.  **Action Handler:** Register the handler in `src/hooks/actions/actionHandlers.ts` AND update the `isUiToggle` whitelist in `src/hooks/useGameActions.ts`.
7.  **Verification:** Verify specifically that `onAction({ type: 'TOGGLE_NEWS' })` successfully triggers the reducer.
```
