# Implementation Plan: Character Creator UI/UX Standardization

This plan outlines the overhaul of the Character Creator into a standardized, component-driven wizard with a logical flow, persistent state, and header-based navigation.

**CRITICAL MANDATE: CONTENT PRESERVATION**
All tasks are strictly additive or transformative. **DO NOT** remove any existing content (race options, class details, lore text, specific mechanics) without explicit confirmation.

## Phase 1: Component Audit & Design System Extraction (COMPLETE)
- [x] Task: Audit existing steps and inventory elements.
- [x] Task: Define Global UI Components (Button, Table, SelectionListItem, Typography).
- [x] Task: Implement Component Showcase in Dev Hub. [checkpoint: b31dcda]

## Phase 2: Navigation Refactor & Header Migration
Goal: Standardize the spatial strategy for actions and promote layout components.

- [x] Task: **Promote Layout Components**:
    - [x] Move `SplitPaneLayout.tsx` to `src/components/ui/`.
    - [x] Update `Component Showcase` to include a `SplitPaneLayout` demo.
- [x] Task: **Refactor `CreationStepLayout` (Header Nav)**:
    - [x] Remove the bottom footer from `CreationStepLayout.tsx`.
    - [x] Add `onNext` and `onBack` props that render `Button` components in the Header.
- [ ] Task: **Apply Header Nav to All Steps**:
    - [ ] Update `RaceSelection`, `ClassSelection`, `AgeSelection`, `BackgroundSelection`, `VisualsSelection`, `SkillSelection`, and `NameAndReview` to use the new header-based navigation.
- [ ] Task: **Sidebar & Logic Polish**:
    - [ ] Implement/Verify Sidebar Numbering (1-10).
    - [ ] Verify "Back to Main Menu" behavior from Step 1 (Race).
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Header Migration' (Protocol in workflow.md)

## Phase 3: Persistent State & UX Enhancements (PARTIAL)
Goal: Add the summary sidebar, auto-save, and utility triggers.

- [x] Task: Implement Save & Resume (Local Storage). [checkpoint: 1aa05f6]
- [ ] Task: **Implement Header Utility Actions**:
    - [ ] Add "Reset Step" (Danger variant) to the header of complex steps.
    - [ ] Add "Randomize" placeholder where applicable.
- [ ] Task: **Final Flow Review**:
    - [ ] Ensure all 10 steps transition smoothly without the "Loop Back" bug.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: UX Polish' (Protocol in workflow.md)

## Phase 4: Final Verification & Archive
- [ ] Task: Verify Keyboard Navigation across all header-based actions.
- [ ] Task: Final Content Audit (Confirm zero loss).
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Sign-off' (Protocol in workflow.md)
