# Feat Selection Implementation Guide

Last Updated: 2026-03-11
Purpose: Reframe the feat-selection guide around the current repo, where the core feat-choice UI and assembly lane already exist.

## Current Status

This is no longer purely a future implementation plan.

Verified anchors in this pass:
- src/components/CharacterCreator/FeatSelection.tsx
- src/components/CharacterCreator/state/characterCreatorState.ts
- src/components/CharacterCreator/hooks/useCharacterAssembly.ts
- src/data/feats/featsData.ts
- src/utils/combatUtils.ts

Important current-state correction:
- the repo does not contain src/hooks/useCombatSystem.ts, so older references to that hook are stale

## What Already Exists

The current feat lane already includes:
- ability-score choice handling in FeatSelection.tsx
- damage-type choice handling in FeatSelection.tsx
- selectable-skill handling in FeatSelection.tsx
- spell-source and spell-choice handling in FeatSelection.tsx
- feat choice state in characterCreatorState.ts
- feat application during assembly through useCharacterAssembly.ts and applyAllFeats
- feat data hooks in src/data/feats/featsData.ts

## What This Guide Is For Now

Use this guide when extending or correcting feat behavior.

Good reasons to use it:
- a new feat introduces a new choice shape
- an existing feat choice is stored incorrectly
- the UI supports the choice but assembly does not
- a combat or runtime effect exists in data but is only partially consumed

## Extension Order

1. Start with src/data/feats/featsData.ts and verify the feat benefit shape you actually need.
2. Check whether FeatSelection.tsx already supports that choice pattern.
3. If state persistence is missing, extend characterCreatorState.ts rather than inventing a side state store.
4. If the assembled character does not reflect the feat choice, update useCharacterAssembly.ts and the underlying feat-application utilities.
5. Only then look at combat or runtime consumers such as combatUtils.ts or the relevant downstream mechanic.

## Practical Checklist

- [ ] Confirm the feat data shape in src/data/feats/featsData.ts
- [ ] Verify whether FeatSelection.tsx already supports the needed choice UI
- [ ] Extend characterCreatorState.ts only if the current feat-choice structure is insufficient
- [ ] Verify feat choices survive into useCharacterAssembly.ts
- [ ] Verify applyAllFeats or the downstream feat application actually uses the choice
- [ ] For combat-sensitive feats, verify the runtime consumer instead of assuming the UI change finishes the feature

## Common Drift To Avoid

Do not assume:
- that feat selection is still mostly unimplemented
- that every missing feat behavior starts in the UI
- that a nonexistent useCombatSystem hook is the combat integration surface
- that a feat is fully working just because the picker renders the right controls
