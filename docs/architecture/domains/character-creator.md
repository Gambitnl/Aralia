# Character Creator

## Purpose

The Character Creator domain covers Aralia's step-by-step player-character creation flow, including race and class selection, age and background choices, visuals, ability scores, skills, class features, weapon masteries, feats, and final review.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/components/CharacterCreator/CharacterCreator.tsx
- src/components/CharacterCreator/state/characterCreatorState.ts
- src/components/CharacterCreator/hooks/useCharacterAssembly.ts
- src/components/CharacterCreator/config/sidebarSteps.ts
- src/components/CharacterCreator/CreationSidebar.tsx
- src/components/CharacterCreator/Race/
- src/components/CharacterCreator/Class/

## Current Domain Shape

The live character-creator flow is broader than the older race-class-review summary implied.
The verified step surface in CharacterCreator.tsx now includes:
- Race
- AgeSelection
- BackgroundSelection
- Visuals
- Class
- AbilityScores
- HumanSkillChoice when needed
- Skills
- ClassFeatures
- WeaponMastery when needed
- FeatSelection when needed
- NameAndReview

The state and assembly split is also more specific now:
- CharacterCreator.tsx owns the step orchestration and reducer-driven UI flow.
- characterCreatorState.ts owns creator state and step transitions.
- src/components/CharacterCreator/hooks/useCharacterAssembly.ts owns the main assembly logic.
- src/hooks/useCharacterAssembly.ts still exists, but it is no longer the best primary architecture entry point.

## Historical Drift Corrected

The older version of this file drifted in a few concrete ways:
- it pointed to src/hooks/useCharacterAssembly.ts as the main assembly hook, but the live creator imports ./hooks/useCharacterAssembly from inside the CharacterCreator subtree
- it treated the creator as a simpler wizard than the current gated step flow actually is
- it listed generic utility-test surfaces under src/utils/__tests__, but those files are not present at the claimed paths in the current repo

That older explanation should not be treated as the current implementation guide.

## Boundaries And Constraints

- The creator should stay isolated from live game state until character submission.
- The flow depends on race, class, feat, and spell data, but it should remain the orchestration layer rather than the owner of those upstream datasets.
- The reducer-driven step flow and step gating are part of the current architecture and should be documented as such rather than collapsed into a simple linear wizard.
- The creator now persists in-progress state locally, so docs should not imply a purely ephemeral modal flow anymore.

## What Is Materially Implemented

This pass verified that the character-creator domain already has:
- a live WindowFrame-based creator surface loaded from App.tsx
- reducer-driven state and step orchestration
- dedicated race and class subtree components
- age, background, visuals, skills, class-feature, weapon-mastery, feat, and review steps
- creator-local config, utility, and hook lanes
- persisted in-progress creator state
- portrait-generation handling inside the creator flow

## Verified Test Surface

Verified tests in this pass:
- src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx
- src/components/CharacterCreator/__tests__/CreationSidebar.test.tsx
- src/components/CharacterCreator/AbilityScoreAllocation.test.tsx
- src/components/CharacterCreator/SkillSelection.test.tsx
- src/components/CharacterCreator/state/__tests__/characterCreatorReducer.test.ts
- src/components/CharacterCreator/utils/__tests__/skillSelectionUtils.test.ts
- src/components/CharacterCreator/Class/__tests__/FeatureSelectionCheckboxes.test.tsx

The older claims about src/utils/__tests__/characterUtils.test.ts, characterValidation.test.ts, and statUtils.test.ts were not accurate in the current repo.

## Open Follow-Through Questions

- Which creator docs should explain the current step-gating rules more explicitly?
- How should the repo document the relationship between the live creator subtree and the older bridge-style helper files that still exist outside it?
- Which portrait-generation and preview-character details belong in creator docs versus broader character-system references?
