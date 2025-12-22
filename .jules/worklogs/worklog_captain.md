# Captain's Log

## 2024-05-22 - Plotting the Course
**Learning:** The shipyard is stocked (backend logic exists in `NavalCombatSystem` and `VoyageManager`), but the harbor is empty (no UI/State integration). The crew needs a way to see the horizon.
**Action:** Planned a `CaptainDashboard` and `NavalState` integration. Aborted implementation to document the plan first.

# Naval System Implementation Plan (TODO)

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
