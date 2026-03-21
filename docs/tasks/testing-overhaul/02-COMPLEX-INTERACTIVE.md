# Phase 2: Complex Interactive Components
This file was re-verified on 2026-03-14.
It is preserved as an older alternate phase slice, not the authoritative current testing roadmap.

What drifted:
- the numbering overlaps with `02-CHARACTER-CREATOR.md`
- several listed targets now already have meaningful tests
- this file should be treated as historical backlog decomposition rather than the current phase contract


## Objective
Add tests for components with significant internal state, forms, or complex user interactions.

## Task List

### `CharacterCreator`
- [ ] **Flow Test**: Verify navigation between steps (Race -> Class -> Ability Scores).
- [ ] **State Management**: Verify that choices in one step persist to the next.
- [ ] **Validation**: Verify that users cannot proceed without making required choices.
- [ ] **Sub-components**: Test `RaceSelection`, `ClassSelection`, etc., in isolation if possible.

### `CombatView.tsx`
- [ ] **Render Test**: Verify combatants, turn order, and action menu are displayed.
- [ ] **Turn Logic**: Verify that the current turn indicator updates correctly.
- [ ] **Action Feedback**: Verify that selecting an attack/spell updates the UI (e.g., targeting mode).

### `InventoryList.tsx`
- [ ] **Render Test**: Verify list of items is displayed.
- [ ] **Interaction**: Test equipping/unequipping items.
- [ ] **Filtering/Sorting**: Test any sort or filter functionality.

### `SpellbookOverlay.tsx`
- [ ] **Render Test**: Verify known spells are listed.
- [ ] **Filtering**: Test filtering by level or school.
- [ ] **Selection**: Verify clicking a spell shows details or prepares it.
