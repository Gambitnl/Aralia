---
name: character-creator-steps
description: Edit the Character Creator step flow in Aralia. Use when adding, removing, reordering, or conditioning steps; updating reducer transitions; changing sidebar step visibility/completion; or adjusting tests and docs tied to the character creation wizard.
---
# Character Creator Steps

Use this skill to modify the multi-step character creation flow. Focus on the reducer-driven step map, render switch, and sidebar config so navigation, backtracking, and visibility stay consistent.

## Entry Points
- `src/components/CharacterCreator/state/characterCreatorState.ts` for `CreationStep`, reducer transitions, `stepDefinitions`, `GO_BACK` resets, and step gating helpers.
- `src/components/CharacterCreator/CharacterCreator.tsx` for `renderStep()` and step-level handlers.
- `src/components/CharacterCreator/config/sidebarSteps.ts` for sidebar labels, grouping, visibility, and completion summaries.
- `src/components/CharacterCreator/CreationSidebar.tsx` if sidebar layout or grouping behavior changes.
- `src/components/CharacterCreator/CharacterCreator.README.md` and `src/components/CharacterCreator/state/characterCreatorState.README.md` for state/flow notes.
- `tests/character-creator-flow.spec.ts` and `src/components/CharacterCreator/state/__tests__/characterCreatorReducer.test.ts` for flow coverage.

## Workflow
1. **Map the change**: Identify whether the update is add, remove, reorder, or conditional. Note the current step order and dependencies (race, class, ability scores, feats).
2. **Update the state model**:
   - Add/remove the `CreationStep` enum entry.
   - Add any new `CharacterCreationState` fields and action types.
   - Update `determineNextStepAfterRace`, `getNextStep`, and any gating helpers (`canOfferFeatAtLevelOne`, `getFeatStepOrReview`, `getPreviousStepBeforeFeat`) if the path changes.
3. **Wire reducer transitions**:
   - Add new `case` handlers in `characterCreatorReducer`.
   - Update `stepDefinitions` for back navigation.
   - Update `getFieldsToResetOnGoBack` to clear the data captured by the step.
4. **Render the step UI**:
   - Add a `renderStep()` branch in `CharacterCreator.tsx`.
   - Ensure navigation (`SET_STEP`, `GO_BACK`, `NAVIGATE_TO_STEP`) keeps the user in valid state.
5. **Keep the sidebar honest**:
   - Add/update entries in `SIDEBAR_STEPS` with label, group, visibility, and selection summary.
   - Update `isStepCompleted` for the new step.
6. **Validate flow**:
   - Update Playwright flow if the screen order changes.
   - Add/adjust reducer tests for step transitions and backtracking.
   - Confirm docs still match current behavior.

## Change Patterns
### Add a new step
- Add enum + reducer action + state field.
- Insert into forward path (e.g., after `AbilityScores` or before `ClassFeatures`) and update the `stepDefinitions` previous step mapping.
- Add sidebar config and completion logic.
- Add test coverage for forward and back navigation.

### Remove a step
- Remove enum, reducer case, and related state fields.
- Remove from `stepDefinitions`, `SIDEBAR_STEPS`, and completion logic.
- Collapse adjacent steps to keep the flow continuous.
- Prune tests that depended on the removed step.

### Reorder steps
- Update `stepDefinitions` for back navigation and forward flow helpers.
- Audit all `SET_STEP` transitions that assume the old order.
- Update sidebar grouping order if needed.

### Conditional steps
- Gate visibility in `SIDEBAR_STEPS.isVisible`.
- Gate the transition in reducer logic (often in `SELECT_*` or `SET_ABILITY_SCORES`).
- Ensure `GO_BACK` resets the conditional data if the step is skipped or revisited.

## Guardrails
- Prefer inline race variant selection in `RaceDetailPane` unless a step must block forward progress (see existing centaur/changeling patterns).
- Keep `NAVIGATE_TO_STEP` conservative: it must not allow jumping past incomplete data.
- If the step affects stats, sync with `useCharacterAssembly` so preview and final assembly match.
