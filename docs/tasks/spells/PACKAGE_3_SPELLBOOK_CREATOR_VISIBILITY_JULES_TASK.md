# Package 3 Jules Task: Spellbook And Character Creator Visibility

Status: package draft prepared for Symphony dashboard intake.

This is the next Spell Phase 1 implementation slice after Package 2 merged the
premade level-1 party gear and caster legality work. Package 3 is intentionally
player-facing: it should make early-game spell choices understandable in the
character creator and make the character sheet spellbook readable enough that a
player can trust what is known, prepared, always prepared, or merely available.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns scoping, dashboard handoff, review,
verification, decision reporting, and Atlas/gate receipts. Jules should own the
implementation-heavy UI, assembly, and focused test work once the Symphony task
is created.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package3-spellbook-creator-visibility`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package3-spellbook-creator-visibility-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package3-spellbook-creator-visibility`

## Goal

Make cantrips and level 1 spell choices pleasant, legible, and rules-aware in
the character creator and character sheet spellbook, while preserving the Phase
1 plan for level 2-3 spell support in later combat and fixture packages.

## Source Context

Use these existing artifacts instead of inventing a parallel plan:

- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/PACKAGE_2_ATLAS_GATE_CHECKPOINT_RECEIPT.md`
- `docs/tasks/spells/PACKAGE_2_FOREMAN_REVIEW_RECEIPT.md`
- `src/components/CharacterCreator/Class/*FeatureSelection.tsx`
- `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`
- `src/components/CharacterCreator/state/characterCreatorState.ts`
- `src/components/CharacterSheet/CharacterSheetModal.tsx`
- `src/components/CharacterSheet/Spellbook/SpellbookTab.tsx`
- `src/components/CharacterSheet/Spellbook/SpellbookOverlay.tsx`
- `src/components/CharacterSheet/Spellbook/SpellDetailPane.tsx`

## Ownership

Jules may edit:

- `src/components/CharacterCreator/Class/*FeatureSelection.tsx`
- `src/components/CharacterCreator/CharacterCreator.tsx`
- `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`
- `src/components/CharacterCreator/state/characterCreatorState.ts`
- `src/components/CharacterCreator/__tests__/*.test.tsx`
- `src/components/CharacterCreator/Class/__tests__/*.test.tsx`
- `src/components/CharacterSheet/CharacterSheetModal.tsx`
- `src/components/CharacterSheet/Spellbook/*.tsx`
- `src/components/CharacterSheet/__tests__/*.test.tsx`
- the nearest existing focused test file if a better local convention exists

Jules should not edit:

- combat simulator casting behavior or spell command runtime
- broad spell JSON schema or shared runtime architecture
- AI arbitration policy
- premade character roster semantics, except tiny fixture adjustments strictly
  needed for a UI test
- Symphony orchestration files
- higher-level spell mechanics buckets

## Current Observations

- Several class feature selectors already show cantrip and level 1 spell
  choices, but the cards mostly expose spell name and damage dice only.
- The selectors repeat similar card/count logic across Bard, Cleric, Druid,
  Sorcerer, Warlock, Wizard, Paladin, and Ranger surfaces.
- `useCharacterAssembly.ts` currently places selected level 1 spells in
  `preparedSpells`, while `knownSpells` can include the whole class spell list.
  If that is intentional for discovery, the UI must make prepared vs available
  distinction clear. If it is not intentional, repair the assembly model within
  this slice and explain the behavior change.
- `CharacterSheetModal.tsx` already exposes a Spellbook tab when spellbook data
  exists.
- `SpellbookTab.tsx` already distinguishes cantrips, prepared, unprepared, and
  always-prepared states, but this needs focused UI/test proof and cleanup of
  player-facing rough edges such as compact labels or mojibake.
- `SpellbookOverlay.tsx` has similar spellbook behavior and should not drift
  from the tab if it remains a live surface.

## Required Work

1. Improve character creator spell choice cards for caster classes so players
   can compare cantrips and level 1 spells without opening raw data. Include
   useful player-facing facts such as level, school, casting time, range,
   concentration/ritual tags, damage/healing summaries where available, and
   readable prepared/known language.
2. Keep class and level filtering strict. Cantrip lists must only show level 0
   spells and level 1 lists must only show level 1 spells from the relevant
   class spell list.
3. Preserve and clarify selection limits. Counts must stay visible, disabled
   states must make sense, and completed selections must survive character
   assembly.
4. Review `useCharacterAssembly.ts` for known/prepared spellbook semantics. Do
   not silently give created casters every spell as prepared. If the current
   model intentionally keeps full class access in `knownSpells`, make the UI
   label that as available/unprepared rather than selected/prepared.
5. Improve the character sheet spellbook display enough that cantrips,
   prepared spells, unprepared/known spells, always-prepared spells, and slots
   are visually distinguishable without raw schema or debug labels.
6. Keep the UI consistent with existing Aralia styling. Avoid a landing-page or
   marketing redesign; this is an in-app utility surface.
7. Add focused tests or screenshots/manual proof for the core flows:
   character creator spell selection, assembly persistence, Spellbook tab
   visibility, and spellbook prepared/unprepared state rendering.
8. Run and record spell-gate validation even if no spell JSON changes. If the
   gate report only changes timestamps, record that and do not commit timestamp
   churn.

## Verification Commands

Jules should run the narrowest relevant checks first:

```powershell
npm run validate:spells
npm run generate:spell-gates
npx vitest run src/components/CharacterCreator/__tests__/CharacterCreator.test.tsx src/components/CharacterSheet/__tests__/CharacterSheetModal.test.tsx --reporter=verbose
```

If Jules adds a more focused test file, include it in the vitest command and
record the exact command in the completion note.

## Acceptance Criteria

- Character creator spell selection remains class-legal and level-legal.
- Spell cards expose enough player-facing detail for meaningful choices without
  raw JSON/debug field names.
- Selected cantrips and level 1 spells survive character assembly.
- Prepared, unprepared/known, always-prepared, cantrip, and slot states are
  visible in the character sheet spellbook.
- No caster is represented as having every spell prepared.
- Focused tests or rendered proof cover the creator and spellbook flows.
- Atlas/gate receipt for Package 3 records validation output and whether any
  generated report changed.
- Any level 2-3 fixture, combat simulator, or AI arbitration issue discovered
  here is recorded as a follow-up gap instead of folded into this UI slice.
