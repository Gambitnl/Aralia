# Character Creator

Verified: 2026-09-06 - creator entry points and the isolated Character Atelier preview; historical test claims below were not rerun.

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
- src/components/CharacterCreator/hooks/useCharacterAssembly.ts still exists, but it is no longer the best primary architecture entry point.

## Historical Drift Corrected

The older version of this file drifted in a few concrete ways:
- it pointed to src/components/CharacterCreator/hooks/useCharacterAssembly.ts as the main assembly hook, but the live creator imports ./hooks/useCharacterAssembly from inside the CharacterCreator subtree
- it treated the creator as a simpler wizard than the current gated step flow actually is
- it listed generic utility-test surfaces under src/utils/__tests__, but those files are not present at the claimed paths in the current repo

That older explanation should not be treated as the current implementation guide.

## Boundaries And Constraints

- The creator should stay isolated from live game state until character submission.
- The flow depends on race, class, feat, and spell data, but it should remain the orchestration layer rather than the owner of those upstream datasets.
- The reducer-driven step flow and permissive navigation with locked placeholders are part of the current architecture and should be documented as such rather than collapsed into a simple linear wizard.
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

The older claims about src/utils/character/__tests__/characterUtils.test.ts, characterValidation.test.ts, and statUtils.test.ts were not accurate in the current repo.

## Open Follow-Through Questions

### Character Atelier reference recreation

`misc/character-atelier.html` mounts `src/devtools/characterAtelier/main.tsx` as an isolated reference-inspired creator. Run `npx vite --config scripts/character-atelier/vite.config.ts`, then open `/Aralia/misc/character-atelier.html` on port 4178. This lightweight server avoids launching unrelated operator services.

The preview includes eight creation panels, twelve class choices using `CLASSES_DATA`, background and cantrip selection, bounded 27-point ability allocation, appearance colors and body width, orbit/portrait camera controls, and a JSON character-sheet export. Choices belong to this preview and do not submit a production character or change game saves. Preview ancestry traits and subclass text are illustrative, not a replacement for Aralia's canonical character rules.

Fourteen independently exported, skinned Blender models live under `public/assets/character-atelier/`: high elf, wood elf, human, half-elf, drow, dwarf, halfling, gnome, tiefling, half-orc, githyanki, dragonborn, aasimar, and goliath. `src/devtools/characterAtelier/races.json` shares model recipes, default colors, heights and portrait framing with the picker; `render_portraits.py` renders its thumbnails from the exported models. Short-race mesh and rest-bone deformation preserves garment fit and animation. Subrace selection stays within the selected ancestry. They use CC0 MakeHuman anatomy, fitted eyes/hair/shoes, and script-authored garments. `scripts/character-atelier/build_characters.py` retains editable MakeHuman sources in ignored scratch and bakes the current shape into GLB exports. The export must preserve shape-key values and opaque skin materials; otherwise the neutral face or inner mouth surfaces appear in the web renderer. The builder reimports its GLB before rendering its final proof image.

The clearing is generated reference-inspired artwork. Asset provenance and rebuilding instructions live in `scripts/character-atelier/README.md`. Remaining model likeness, roster, wardrobe, and production-integration work is tracked in `docs/projects/character-atelier/GAPS.md`. This is an approximate recreation and does not contain the original game's models.

- Which creator docs should explain the resolved permissive navigation with locked placeholders more explicitly?
- How should the repo document the relationship between the live creator subtree and the older bridge-style helper files that still exist outside it?
- Which portrait-generation and preview-character details belong in creator docs versus broader character-system references?
