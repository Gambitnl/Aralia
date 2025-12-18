# Testing Overhaul Master Plan

## Objective
Ensure that the app has an appropriate testing suite for all components, increasing code reliability and preventing regressions.

## Current Status
- **Infrastructure**: React testing environment (Vitest + React Testing Library) is set up and verified.
- **Existing Tests**:
    - `src/components/__tests__/LoadingSpinner.test.tsx` (Passing)
    - `src/components/__tests__/ConfirmationModal.test.tsx` (Passing)
    - `src/services/villageGenerator.test.ts` (Fixed & Passing)
    - `src/commands/__tests__/*`
    - `src/systems/spells/targeting/__tests__/*`
- **Coverage**: Most UI components in `src/components` lack tests.

## Strategy
We will adopt an incremental approach to add tests, prioritizing core components and complex logic.

### [Phase 1: Core UI Components](./01-CORE-UI.md)
Focus on components that are fundamental to the user experience.
- [x] `MainMenu.tsx` (Completed)
- [ ] `ActionPane.tsx`
- [ ] `CharacterSheetModal.tsx`
- [x] `ConfirmationModal.tsx` (Completed)

<!-- TODO: Clean up duplicate phase files (02-CHARACTER-CREATOR vs 02-COMPLEX-INTERACTIVE,
03-CANVAS-MAP vs 03-GAMEPLAY-SYSTEMS). Merge or renumber to avoid confusion. -->

### [Phase 2: Character Creator](./02-CHARACTER-CREATOR.md)
Focus on the multi-step character creation wizard.
- [ ] Race Selection
- [ ] Class Selection
- [ ] Ability Scores
- [ ] Finalization

### [Phase 3: Gameplay Systems](./03-GAMEPLAY-SYSTEMS.md)
Focus on core gameplay loops.
- [ ] `CombatView.tsx`
- [ ] `InventoryList.tsx`
- [ ] `SpellbookOverlay.tsx`

### [Phase 4: Map & Canvas Systems](./04-MAP-SYSTEMS.md)
Focus on complex map rendering and logic.
- [ ] `SubmapPane.tsx` (Logic & UI)
- [ ] `SubmapRendererPixi.tsx` (Canvas)
- [ ] `TownCanvas.tsx`

### [Phase 5: Utilities and Hooks](./05-UTILITIES.md)
Ensure reusable logic is tested.
- [ ] `src/hooks/*`
- [ ] `src/utils/*`
