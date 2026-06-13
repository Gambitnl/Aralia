# Combat-Resume Architecture Analysis

## 1. Combat Runtime State Scope
The combat runtime is extensive and currently lives in the local scope of React hook components (primarily `CombatView.tsx` and its children) rather than the globally serializable `GameState`. To serialize it, the following would need tracking:

- **Entities & Characters (`src/components/Combat/CombatView.tsx`)**: The `characters` array of type `CombatCharacter[]`. This is deeply nested data encompassing HP, temporary HP, condition immunities, `statusEffects`, `deathSaves`, spell slots, active concentration trackers, `actionEconomy` (movement, actions, bonus actions), and `position`.
- **Turn State (`src/hooks/combat/useTurnOrder.ts`)**: The internal `turnState` including `currentTurn`, the `turnOrder` (initiative string array), `currentCharacterId`, `phase` (planning vs. action), and `actionsThisTurn`.
- **Environment & Meta-State**: The `mapData` (`BattleMapData` holding grid sizes and impassable terrain), `pocketedSummons`, `activeLightSources` (`useTurnManager.ts`), `seed`, and `autoCharacters` flags.
- **Visuals & Messaging**: The rich combat logs tied to `useCombatMessaging`, `damageNumbers`, and unresolved `animations` currently tracked inside `useCombatVisuals`.

## 2. Option A: Full Combat Serialization (Risks & Effort)
- **Architectural Misalignment (High Effort)**: `saveLoadService` operates against the global `GameState`. Currently, combat state is intentionally ephemeral and decoupled, living in the `CombatView` hook tree. Full serialization requires either "lifting" massive amounts of highly volatile state into the global context or plumbing the `GameState` down to sync on every hook dispatch. 
- **Brittle Schema Migrations (High Risk)**: `CombatCharacter` and ability schemas change constantly as new spells are added. Serializing mid-combat state means future game updates will break saves mid-turn unless complex, error-prone schema migration scripts are added to `saveLoadService.ts`.
- **Rehydrating Runtime Hook State (High Risk)**: React state involving timeouts (e.g., AI thinking delays in `useTurnManager`), pending animation queue promises, and unresolved reaction callbacks cannot be safely serialized or deterministically rehydrated from JSON. 

## 3. Option B: Pre-Combat Checkpoint + "No Combat Saves" Rule
Implementing a strict checkpointing system requires changes at specific points:

- **Autosave Eligibility (`src/hooks/useAutoSave.ts`, ~line 9)**: 
  The `isGameplayPhase` helper must be modified to exclude `GamePhase.COMBAT` and `GamePhase.BATTLE_MAP_DEMO`. This prevents the background timer and beforeunload triggers from firing while mid-fight.
- **Pre-Combat Checkpoint Write (`src/state/appState.ts` or `src/App.tsx`)**: 
  Immediately prior to dispatching `{ type: 'SET_GAME_PHASE', payload: GamePhase.COMBAT }` (e.g., around `src/state/appState.ts` line 770 or wherever combat initiates), an explicit call to `SaveLoadService.saveGame(state, SaveLoadService.AUTO_SAVE_SLOT_KEY, ...)` must be fired to snapshot the exploration state.
- **Load-time Messaging (`src/services/saveLoadService.ts`, ~line 354)**: 
  The code already forces `loadedState.phase = GamePhase.PLAYING;` to fix legacy saves. Here, we can add conditional messaging: if the raw `loadedState.phase` was `COMBAT` before being overwritten, we display a toast: `notify?.({ message: 'Resumed from pre-combat checkpoint.', type: 'info' })`.
- **Manual Save Block (`src/components/layout/MainMenu.tsx`)**: 
  The `Save Game` button should be disabled when `gameState.phase === GamePhase.COMBAT`, ideally with a tooltip explaining that saving is restricted during encounters.

## 4. Recommendation and Implementation Steps
**Recommendation:** **Option B** is highly recommended for a solo-dev RPG. It vastly simplifies state management, avoids brittle schema migrations during game patching, and maintains a clean boundary between the global exploration state and the local, ephemeral "physics engine" of combat.

**Minimal Implementation Steps:**

1. **`src/hooks/useAutoSave.ts`**: Edit `isGameplayPhase` (lines 9-13) to only return true for `PLAYING` and `VILLAGE_VIEW`. Delete `phase === GamePhase.COMBAT` and `phase === GamePhase.BATTLE_MAP_DEMO`.
2. **`src/state/appState.ts` (or relevant encounter dispatcher)**: Locate the transition to `GamePhase.COMBAT`. Before executing it, add a synchronous dispatch to trigger an autosave to the `AUTO_SAVE_SLOT_KEY`. 
3. **`src/components/layout/MainMenu.tsx`**: Add a check evaluating the current `GamePhase`. If `GamePhase.COMBAT`, pass `disabled={true}` to the manual Save Game button.
4. **`src/services/saveLoadService.ts`**: Around line 354, read the raw phase before overwriting it. Add:
   ```typescript
   if (loadedState.phase === GamePhase.COMBAT || loadedState.phase === GamePhase.BATTLE_MAP_DEMO) {
       notify?.({ message: 'Resumed from pre-combat checkpoint.', type: 'info' });
   }
   loadedState.phase = GamePhase.PLAYING; 
   ```
