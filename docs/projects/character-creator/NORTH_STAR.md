# Character Creator North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

The Character Creator feature is already implemented and has a live multi-step flow, but project-level context was originally scaffold-only. This project doc set now captures what is actually live, what is partial, and where handoff risk is highest.

## Current State (Verified in Code)

Primary runtime entry points verified in this pass:

- `src/components/CharacterCreator/CharacterCreator.tsx` (orchestrator)
- `src/components/CharacterCreator/state/characterCreatorState.ts` (reducer/state machine)
- `src/components/CharacterCreator/CreationSidebar.tsx` and `src/components/CharacterCreator/config/sidebarSteps.ts`
- `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`
- `src/components/CharacterCreator/Race/*`, `src/components/CharacterCreator/Class/*`

### Flow Surface (Observed)

The live flow is implemented as a single reducer-driven flow with these `CreationStep` values:
- `Race`
- `AgeSelection`
- `BackgroundSelection`
- `Visuals`
- `Class`
- `AbilityScores`
- `HumanSkillChoice` (conditional)
- `Skills`
- `ClassFeatures`
- `WeaponMastery` (conditional by class slots)
- `FeatSelection` (conditional, with skipped-state)
- `NameAndReview`

The flow is non-destructively navigable, and the reducer intentionally supports in-flow backtracking.

### Persisted/Runtime Behavior

- In-progress creator state is persisted through local storage (`SafeStorage`) under `aralia_character_creation_state` and rehydrated on mount.
- Rehydration normalizes portrait state so request statuses are not resumed in-flight.
- Portrait generation has explicit request/cancel flow with stale-request guards (token + cancel ref).
- Finalization uses `useCharacterAssembly` to validate and build a preview/final `PlayerCharacter`, including abilities, age effects, race/class mechanics, and selected spells/features.

### Step Navigation and Validation Evidence

- `CreationSidebar` renders step rows via `SIDEBAR_STEPS` and `isStepCompleted` summaries.
- Sidebar clicks are allowed to non-current steps via `onNavigateToStep`; it does not strictly gate by completion.
- Step rendering in `CharacterCreator.tsx` uses `StepLockedPlaceholder` to block incomplete steps while still letting users enter them, which avoids render-loop anti-patterns and provides unlock messaging.
- The reducer supports conditional skipping of feat flow (`featStepSkipped`) via `CONFIRM_FEAT_STEP`, `getFeatStepOrReview`, and related branch logic.

### Test Coverage (What exists)

- `src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx`
- `src/components/CharacterCreator/__tests__/CreationSidebar.test.tsx`
- `src/components/CharacterCreator/state/__tests__/characterCreatorReducer.test.ts`
- `src/components/CharacterCreator/hooks/__tests__/useCharacterAssembly.test.tsx`
- `tests/character-creator-flow.spec.ts` (Playwright visual flow + screenshots)

### Partial Areas / Explicitly Uncertain

- Completion gating is not fully sequential: sidebar completion indicators exist, but users can jump to many steps via sidebar.
- Some legacy doc claims and helper expectations remain inconsistent with the live architecture (for example, earlier references to `src/hooks/useCharacterAssembly.ts` as the primary hook path).
- The project has open cleanup signals in test files (annotated TODO-lint debt).

## What Is Already in This Project Folder

- `NORTH_STAR.md` now contains implementation-grounded scope, not just registry placeholder text.
- `TRACKER.md` and `GAPS.md` should be treated as the operational handoff surface for this feature.

## Next Cold-Start Agent Read Order

1. Read this file first.
2. Read `docs/projects/character-creator/TRACKER.md` and `docs/projects/character-creator/GAPS.md`.
3. Confirm source implementation files and reducer/hook files listed above before any claims in new design prose.
4. Check `docs/architecture/domains/character-creator.md` for domain-level context and to avoid duplicate scaffolding.
5. Use registry references in `docs/projects/PROJECT_TRACKER.md` and gap routing in `docs/projects/GLOBAL_GAPS.md` only as needed for scope alignment.

## Open Questions (for next agent)

- Is `featStepSkipped` intended as a final behavior or transitional UX design?
- Should sidebar completion visuals remain loose (free navigation + lock messaging) or move to strict sequential gating?
- Which Character Creator docs should be treated as canonical if old historical notes conflict with current flow files?

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
