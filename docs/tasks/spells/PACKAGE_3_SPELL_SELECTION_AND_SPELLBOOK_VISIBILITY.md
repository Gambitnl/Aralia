# Package 3: Spell Selection And Spellbook Visibility

Status: done Phase 1 spell-selection slice; the local proof shipped in GitHub
and the packet now serves as a durable closeout record for future contributors.

This packet covers the user-facing spell surfaces that sit between raw spell
data and combat resolution. It exists so early-game spells are visible,
selectable, and assembled into the right spellbook shape before the combat
simulator ever sees them.

Symphony draft ids, workflow logs, click receipts, local run state, and other
orchestration internals stay external or ignored unless a short excerpt is
needed here for future Aralia contributors.

## Current Live State

- `src/components/CharacterCreator/Class/__tests__/WizardFeatureSelection.test.tsx`
  proves cantrip and level 1 choices were visible, selectable, capped at the
  expected counts, and submitted as the selected spell IDs.
- `src/components/CharacterCreator/hooks/__tests__/useCharacterAssembly.test.tsx`
  proves the assembled preview character kept only the spells the player
  actually selected in `knownSpells`.
- `src/components/CharacterSheet/Spellbook/__tests__/SpellbookTab.test.tsx`
  proves the sheet spellbook showed cantrips and level 1-3 tabs, exposed
  prepared vs known state, and let the user switch between spells.

## Why This Slice Exists

Phase 1 is not complete if the player can only see spell data in the abstract.
The creator and sheet need to agree on what the player has chosen, what is
prepared, and what is merely known. This slice keeps that contract visible.

The spellbook view should therefore have proven:

- cantrips were listed and selectable where the creator expects them
- level 1 choices were recorded without pulling the entire class list into the
  assembled character
- levels 1-3 stayed visible in the character sheet spellbook
- prepared and known state remained distinct in the sheet

## Prompt Draft

```text
You were working on Aralia Spell Phase 1, Package 3: spell selection and
spellbook visibility.

Goal:
Make early-game spell selection and display behavior match the actual selected
spellbook. Cantrips and level 1 spell choices were selectable in the creator,
the assembled character only kept the selected spells as known, and the
character sheet spellbook clearly showed cantrips plus level 1-3 spell
visibility with prepared vs known state preserved.

Primary context:
- docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md
- docs/tasks/spells/SPELL_PHASE_1_ARTIFACT_LIFECYCLE_POLICY.md
- src/components/CharacterCreator/Class/WizardFeatureSelection.tsx
- src/components/CharacterCreator/hooks/useCharacterAssembly.ts
- src/components/CharacterSheet/Spellbook/SpellbookTab.tsx

Allowed write scope:
- src/components/CharacterCreator/Class/WizardFeatureSelection.tsx
- src/components/CharacterCreator/Class/ClericFeatureSelection.tsx
- src/components/CharacterCreator/hooks/useCharacterAssembly.ts
- src/components/CharacterSheet/Spellbook/SpellbookTab.tsx
- nearest focused tests for the above surfaces

Do not edit in this slice:
- combat simulator resolution logic
- Symphony runtime or receipt artifacts
- broad spell-data migration work

Required work:
1. Keep creator spell choices visible and selectable for the supported class
   selectors.
2. Keep the assembled preview character honest: selected spells should remain
   selected, not the full class list.
3. Keep the character sheet spellbook readable across cantrips and levels 1-3.
4. Preserve the difference between prepared spells and merely known spells.
5. Add or maintain focused tests proving those behaviors.

Acceptance criteria:
- The creator spell selector can submit the selected cantrips and level 1
  spells.
- The assembled preview character does not promote the full class spell list
  into `knownSpells`.
- The sheet spellbook shows cantrips plus level 1-3 tabs and makes prepared vs
  known state visible.
- The proof remained local, deterministic, and tied to the real component
  surfaces rather than synthetic fixtures alone.

Verification to run:
- npx vitest run --exclude '.worktrees/**' 'src/components/CharacterCreator/Class/__tests__/WizardFeatureSelection.test.tsx' 'src/components/CharacterSheet/Spellbook/__tests__/SpellbookTab.test.tsx' 'src/components/CharacterCreator/hooks/__tests__/useCharacterAssembly.test.tsx' --reporter=verbose
- npx tsc --noEmit (or a targeted filter for the touched files if the repo
  still carries unrelated type debt)
- git diff --check

## Closeout

- PR #954 merged the Package 3 implementation.
- The packet stays here as a durable record of scope and proof for future
  Aralia contributors.
```

## Handoff Notes

- If Jules is asked to continue this slice, keep the scope on selection and
  display behavior rather than moving into combat resolution.
- If a later pass discovers a broader spell-data issue, record it separately so
  the selection/sheet proof does not quietly widen into a corpus rewrite.
