# Package 3 Jules Prompt: Spellbook And Character Creator Visibility

You are implementing Spell Phase 1 Package 3 in Aralia.

Goal: make early-game spell selection and spellbook inspection clear and
trustworthy for players. Focus on cantrips and level 1 spell selection in the
character creator, plus the character sheet spellbook display for cantrips,
prepared spells, known/unprepared spells, always-prepared spells, and spell
slots.

Read first:

- `docs/tasks/spells/PACKAGE_3_SPELLBOOK_CREATOR_VISIBILITY_JULES_TASK.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md`
- `docs/tasks/spells/PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md`

Expected implementation areas:

- `src/components/CharacterCreator/Class/*FeatureSelection.tsx`
- `src/components/CharacterCreator/CharacterCreator.tsx`
- `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`
- `src/components/CharacterCreator/state/characterCreatorState.ts`
- `src/components/CharacterSheet/CharacterSheetModal.tsx`
- `src/components/CharacterSheet/Spellbook/*.tsx`
- focused tests under the nearest existing `__tests__` directory

Do:

- keep spell selection class-legal and level-legal
- preserve selection limits and make counts/states clear
- make spell choice cards useful without raw schema labels
- make prepared/unprepared/cantrip/always-prepared states visible in the
  spellbook
- make sure selected spells survive character assembly
- add or update focused tests for the creator and spellbook paths
- run spell validation and spell-gate generation and report whether generated
  files changed

Do not:

- implement combat simulator spell casting in this package
- change broad spell schema/runtime architecture
- set broad AI arbitration policy
- change premade roster semantics except for tiny test fixtures if absolutely
  necessary
- edit Symphony orchestration files
- claim level 2-3 combat coverage from this UI package

Verification commands:

```powershell
npm run validate:spells
npm run generate:spell-gates
npx vitest run src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx src/components/CharacterSheet/__tests__/CharacterSheetModal.test.tsx --reporter=verbose
```

If you add a more focused test file, run it too and report the exact command.

Completion report should include:

- changed files
- behavior summary
- how known/prepared spellbook semantics work after your change
- verification commands and results
- screenshots or test proof for the creator and spellbook flows
- any adjacent gaps found for Package 4, Package 5, or later mechanics buckets

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_3_SPELLBOOK_CREATOR_VISIBILITY_JULES_PROMPT.md","sha256WithoutMarker":"f1c7929f22327b3e0d009c65563421f7856c91e1d7d5b1590393953106a94712","markedAtUtc":"2026-06-25T22:29:38.526Z"} -->
