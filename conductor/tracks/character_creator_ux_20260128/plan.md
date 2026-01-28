# Implementation Plan: Character Creator UI/UX Standardization

This plan outlines the refactoring of the Character Creator into a standardized, component-driven wizard with a logical flow and persistent state.

**CRITICAL MANDATE: CONTENT PRESERVATION**
All tasks in this plan are strictly additive or transformative. **DO NOT** remove any existing content (race options, class details, lore text, specific mechanics) without explicit, written confirmation from the user. If a refactor seems to require removing content, pause and ask for guidance.

## Phase 1: Component Audit & Design System Extraction
Goal: Identify current inconsistencies and extract reusable UI components.

- [x] Task: Audit existing Character Creator steps to inventory all unique UI elements AND content (text, options).
- [x] Task: Define/Update Global UI Components:
    - [x] Create/Update `Button` component with standard variants (Primary, Secondary, Destructive).
    - [x] Create/Update `Table` component for skill/feature listings.
    - [x] Create/Update `SelectableCard` component for Race/Class choices.
    - [x] Standardize Typography components (Title, Body, Label).
- [x] Task: Verify Component responsiveness within a simulated modal frame.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Component Audit & Design System Extraction' (Protocol in workflow.md) [checkpoint: b31dcda]

## Phase 2: Logical Flow & Navigation Refactor
Goal: Fix the wizard's progression, navigation, and broken steps while preserving all existing logic.

- [x] Task: Implement Global Stepper:
    - [x] Create a visual progress indicator.
    - [x] Implement non-destructive step switching logic.
- [x] Task: Standardize Navigation Controls:
    - [x] Move "Back" and "Next" to fixed positions.
    - [x] Implement step-level validation to enable/disable "Next".
- [x] Task: Fix Core Logic & Broken Steps:
    - [x] Resolve "Step 7" (Skills) transition issues (Ensure NO skill options are lost).
    - [x] Fix the "Loop Back" bug (prevent reset at end).
    - [x] Ensure Step 8 (Class Features) updates dynamically based on Class selection (Verify all class features are preserved).
- [x] Task: Conductor - User Manual Verification 'Phase 2: Logical Flow & Navigation Refactor' (Protocol in workflow.md) [checkpoint: ea94de6]

## Phase 3: Persistent State & UX Enhancements
Goal: Add the summary sidebar, auto-save, and polish.

- [x] Task: Implement Persistent Summary Sidebar:
    - [x] Design sidebar layout.
    - [x] Wire up real-time updates from the character creation state.
- [x] Task: Implement Save & Resume:
    - [x] Add LocalStorage persistence for current creation state.
    - [x] Implement state restoration on page load/refresh.
- [x] Task: Implement Contextual Help & Smart Defaults:
    - [x] Add tooltips/details for complex choices (Preserve all existing tooltip text).
    - [x] Apply "Recommended" defaults to friction points.
- [x] Task: Implement Final Review Step:
    - [x] Create a comprehensive summary page before final confirmation.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Persistent State & UX Enhancements' (Protocol in workflow.md) [checkpoint: 1aa05f6]

## Phase 4: Verification & Cleanup
Goal: Ensure stability, accessibility, and ZERO content loss.

- [ ] Task: Verify Keyboard Navigation across all steps.
- [ ] Task: **Content Audit:** Verify that every race, class, skill, and feature present at the start of the track is still accessible.
- [ ] Task: Conduct a final "Mop-up" of any lingering UI inconsistencies.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Verification & Cleanup' (Protocol in workflow.md)
