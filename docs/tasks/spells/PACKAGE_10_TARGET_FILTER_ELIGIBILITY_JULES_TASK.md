# Package 10 Jules Task: Target Filters And Eligibility

Status: historical Package 10 packet; PR #1059 merged on 2026-05-25.

This packet promotes tracker gap `G95` into a bounded implementation task. It
exists because Package 8 closed the first attack/save modifier slice, Package 9
added higher-level caster fixtures for level 2 and level 3 spell testing, and
`G93` repaired the documented Jules post-launch update-boundary gap.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, visible dashboard/Jules
handoff, PR review, verification, decision reporting, and tracker updates.
Jules should own the implementation-heavy spell data, reusable target
eligibility bridge, and focused tests for the bounded slice below.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package10-target-filter-eligibility`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package10-target-filter-eligibility-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package10-target-filter-eligibility`

## Goal

Make a representative cantrip/level 1-3 subset of target filters and placement
eligibility mechanically visible and testable instead of leaving those rules in
prose only.

This package should focus on the `target_filter_or_eligibility` bucket for the
early-game spell band. It does not need to close every open row in that bucket
in one PR if the reusable model gets too broad. Prefer a small, honest runtime
bridge plus representative proof over a wide but shallow data sweep.

Representative families to cover:

- Object eligibility: nonmagical, unattended, not worn/carried, loose object, or
  access-preventing object filters.
- Placement eligibility: unoccupied, visible, ground, arrival, or fallback
  destination rules for created/summoned/teleported effects.
- Special target identity: reaction-triggered damaging creature, humanoid-only
  target, corpse/remains target, and similar filters where the current target
  category is too generic.

Candidate early-game rows from the current bucket evidence:

- Level 1: `burning-hands`, `find-familiar`, `hellish-rebuke`,
  `tensers-floating-disk`, `unseen-servant`.
- Level 2: `darkness`, `enlarge-reduce`, `find-steed`,
  `flaming-sphere`, `gentle-repose`, `hold-person`, `knock`, `levitate`,
  `magic-weapon`, `misty-step`, `pyrotechnics`, `shatter`, `summon-beast`.
- Level 3: `animate-dead`, `blink`, `conjure-animals`, `daylight`,
  `dispel-magic`, `elemental-weapon`, `fireball`, `flame-arrows`,
  `intellect-fortress`, `meld-into-stone`, `nondetection`,
  `phantom-steed`, `revivify`, `sending`, `spirit-guardians`,
  `summon-lesser-demons`, `thunder-step`.

Jules should pick a bounded representative subset from those rows, implement the
shared model needed to prove it, and record any residual rows left for later.

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/target_filter_or_eligibility.md`
- relevant spell JSON files under `public/data/spells/level-1/`,
  `public/data/spells/level-2/`, and `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/utils/character/spellAbilityFactory.ts`
- `src/systems/spells/validation/targetingSchemas.ts`
- `src/systems/spells/targeting/TargetValidationUtils.ts`
- nearest existing targeting, ability, combat, and spell-validation tests

Current evidence to preserve:

- The project plan sequences mechanics buckets after `choice_or_mode` and
  `attack_or_save_modifier`; `target_filter_or_eligibility` is the next planned
  mechanics bucket.
- The bucket report lists 75 open target-filter findings across 74 spells, with
  36 level 1-3 findings in the scoped early-game band.
- Several level 1-3 rows already have partial broad target categories. Package
  10 should add the missing eligibility facts rather than replacing useful
  existing targeting data.
- Some rows overlap with other mechanics buckets, such as environmental
  ignition or summon/control behavior. Keep Package 10 focused on target and
  placement eligibility, and leave broader object-state, summon, or terrain
  behavior as explicit residual work when needed.

## Allowed Write Scope

Jules may edit:

- target-filter spell JSON under `public/data/spells/level-1/`,
  `public/data/spells/level-2/`, and `public/data/spells/level-3/` for the
  selected representative rows only
- matching structured spell docs under `docs/spells/` if they exist and need
  alignment with runtime data
- `docs/tasks/spells/mechanics-discovery/buckets/target_filter_or_eligibility.md`
  only to mark rows resolved after proof exists or to document residual rows
- manual review overrides only when a row is proven resolved or deliberately
  narrowed
- `src/types/spells.ts` only for the smallest typed extension needed to
  represent reusable target/placement eligibility
- spell factory, ability factory, target resolution, or combat helpers only
  where they are the narrow runtime bridge for the selected rows
- `src/systems/spells/validation/targetingSchemas.ts` and
  `src/systems/spells/targeting/TargetValidationUtils.ts` only if the selected
  rows need those existing targeting surfaces to consume or expose the new
  eligibility facts
- focused tests under the nearest existing `__tests__` directories
- package-specific completion notes in this file or the living tracker

Jules should not edit:

- Symphony dashboard/runtime/source files
- `.symphony`, `.jules`, dashboard caches, generated manifests, draft IDs,
  click receipts, or local orchestration logs
- GitHub workflow files
- levels 4-9 spell data
- premade roster semantics
- character creator or spellbook UI
- broad AI arbitration policy
- broad summon/control, terrain, object-state, or light/vision systems unless a
  tiny eligibility field is unavoidable for this package
- generated gate reports when the only change is a timestamp
- unrelated type/lint cleanup

## Required Work

0. Treat the first Package 10 Jules session `3916044383011290995` as
   stale/no-PR output. Do not continue from that session's unfinished plan; use
   current `origin/master` and this clarified packet instead.
1. Reconfirm the current target-filter bucket rows and selected spell JSON files
   before editing.
2. Choose a bounded representative subset from the level 1-3 candidate rows.
   Include at least one object-eligibility row, one placement-eligibility row,
   and one special target-identity row unless current code evidence proves that
   one family is already covered.
3. Add the smallest reusable data shape for target or placement eligibility.
   Preserve existing broad target categories where they remain useful.
4. Make the runtime bridge consume or expose that data enough for focused tests
   and future UI/combat targeting to use it honestly.
   - If the nearest bridge is `targetingSchemas.ts` or
     `TargetValidationUtils.ts`, keep the edit limited to eligibility facts for
     the selected rows and explain why that file was necessary in the final
     report.
5. Update the selected spell JSON files with explicit eligibility data.
6. Add focused tests proving that the selected rows carry the intended
   eligibility facts through the data/runtime path.
7. Do not mark unimplemented rows closed. If the package only proves a subset,
   document the remaining rows in the completion note and tracker.
8. Run validation and focused tests.
9. Update this packet or the living tracker with the implementation result,
   tests run, behavior proven, and residual limitations.

## Verification Commands

Run from the repository root:

```powershell
npm run validate:spells
node scripts\auditAtlasBuckets.mjs
```

Add the focused tests created or changed by this package. Use the actual nearest
test paths present in the implementation branch.

If exported TypeScript signatures change, run the Aralia dependency-header sync
command required by `AGENTS.md` for each changed exported/shared file.

## Acceptance Criteria

- At least one object-eligibility, one placement-eligibility, and one special
  target-identity row from levels 1-3 are represented by explicit data or a
  runtime bridge instead of prose only.
- Existing useful broad targeting data is preserved.
- Focused tests prove the selected rows expose the new eligibility data through
  the intended runtime/data path.
- Spell validation passes.
- Atlas audit remains green.
- The bucket tracker or completion note honestly distinguishes closed rows from
  residual rows.
- No Symphony runtime/source/local-state artifacts are committed.

## Decision Report

Decision point: choose the next package after Package 9 and the `G93` workflow
repair merged.

Decision made by Codex foreman: promote `target_filter_or_eligibility` into
Package 10 and delegate it to Jules first.

Why: the execution plan already sequences target filters after the completed
choice/mode and attack/save modifier mechanics slices. The bucket has enough
level 1-3 findings to matter for early-game combat and spell testing, but it is
still narrow enough for a representative Jules implementation slice.

Artifact boundary:

- Aralia GitHub: this task packet, the matching Jules prompt, living tracker
  updates, implementation PR, focused tests, and concise completion notes.
- External Symphony / local ignored state: dashboard run state, draft IDs,
  handoff receipts, generated manifests, click logs, and raw Jules process
  output.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_10_TARGET_FILTER_ELIGIBILITY_JULES_TASK.md","sha256WithoutMarker":"06c2ae26fa278b9694e2b20f94f3050d3b8639df99adf37f8eb37ea49514adcd","markedAtUtc":"2026-06-25T22:29:38.370Z"} -->
