# Puzzle & Lock System

The puzzle system provides the framework for locks, traps, and puzzles in Aralia.

## Integration TODOs

### Action Handlers
To make the system fully functional, we need to implement `ActionHandler` logic for the following actions in `useGameActions.ts`:

- [ ] **PICK_LOCK**:
    - Triggered when interacting with a `Lockable` (Exit/ItemContainer) that is `locked`.
    - Should call `attemptLockpick`.
    - On success: Update `GameState.locks[lockId]` to `isLocked: false`.
    - On failure: Potentially trigger trap if margin is low enough.
    - Requires UI to select tool (Thieves' Tools).

- [ ] **DISARM_TRAP**:
    - Triggered when a trap is detected (`TrapDetected` state).
    - Should call `disarmTrap`.
    - On success: Update `GameState.locks[lockId]` to `isTrapDisarmed: true`.

- [ ] **BREAK_LOCK**:
    - Brute force option calling `attemptBreak`.

### UI Integration
- [ ] **Interaction Menu**: Update `ActionPane` or context menus to show "Pick Lock" / "Disarm Trap" buttons when a target has a `lockId`.
- [ ] **Visual Feedback**: Show lock status on `ItemContainer` slots or Map Exits.

### Data Entry
- [ ] **Dungeon Generation**: Update dungeon generators to populate `lockId` and `trapId` on generated doors and chests.
