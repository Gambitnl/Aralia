# Phase 2: Character Creator

## Objective
Add comprehensive tests for the multi-step Character Creator wizard.

## Task List

### Step 1: Race Selection
- [ ] **Render Test**: Verify all available races are displayed.
- [ ] **Selection**: Verify clicking a race updates the state.
- [ ] **Details**: Verify race details (traits, description) are shown upon selection.

### Step 2: Class Selection
- [ ] **Render Test**: Verify all available classes are displayed.
- [ ] **Selection**: Verify clicking a class updates the state.
- [ ] **Details**: Verify class details (hit die, primary ability) are shown.

### Step 3: Ability Scores
- [ ] **Render Test**: Verify all 6 ability scores are listed.
- [ ] **Point Buy Logic**: Verify interacting with +/- buttons updates the score and remaining points correctly.
- [ ] **Limits**: Verify scores cannot go below 8 or above 15 (standard point buy rules).
- [ ] **Racial Bonuses**: Verify racial bonuses are applied correctly to the final score.

### Step 4: Skills & Feats (if applicable)
- [ ] **Render Test**: Verify skill list is populated based on class/background.
- [ ] **Selection Limit**: Verify user cannot select more skills than allowed.

### Step 5: Name & Review
- [ ] **Input**: Verify name input field works.
- [ ] **Review**: Verify all previously selected choices are displayed correctly.
- [ ] **Finalization**: Verify "Create Character" button calls the completion handler with the full character object.

### Integration
- [ ] **Navigation**: Verify "Next" and "Back" buttons navigate between steps correctly.
- [ ] **State Persistence**: Verify data is preserved when navigating back and forth.
