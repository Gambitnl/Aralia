# Phase 1: Core UI Components
This file was re-verified on 2026-03-14.
It now serves as a preserved gap list for core UI coverage, not a claim that this phase is still largely untouched.

Current reality:
- `MainMenu`, `CharacterSheetModal`, `ConfirmationModal`, `ActionPane`, and several related UI surfaces already have tests in the repo.
- Remaining work is narrower than this original phase framing suggests and should be re-scoped from the live test tree when resumed.


## Objective
Add tests for components that are fundamental to the user experience and navigation.

## Task List

### `MainMenu.tsx`
- [x] **Render Test**: Verify all menu options (New Game, Load Game, etc.) are displayed.
- [x] **Interaction Test**: Verify clicking buttons triggers the correct callback or navigation event.
- [x] **State Test**: Verify "Continue" button only appears if a save exists (if applicable/mockable).

### `ActionPane.tsx`
- [ ] **Render Test**: Verify action buttons are rendered based on current game state.
- [ ] **Interaction Test**: Verify clicking actions triggers game logic.
- [ ] **Conditional Rendering**: Ensure disabled actions look disabled and are not clickable.

### `CharacterSheetModal.tsx`
- [ ] **Render Test**: Verify stats, equipment, and inventory sections are visible.
- [ ] **Data Display**: Verify character data passed via props is correctly displayed.
- [ ] **Interaction**: Test tab switching (if tabs exist) or closing the modal.

### `ConfirmationModal.tsx`
- [x] **Render Test**: Verify title, message, and buttons.
- [x] **Interaction**: Verify Confirm/Cancel callbacks.
- [x] **Accessibility**: Verify Escape/Enter key handling.
