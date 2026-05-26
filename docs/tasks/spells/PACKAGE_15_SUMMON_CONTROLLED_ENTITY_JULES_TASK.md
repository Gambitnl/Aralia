# Package 15 Jules Task: Summons And Controlled Entities

Status: draft package packet for the next Jules-preferred mechanics slice.

This packet promotes the next tracker-defined bucket after Package 14:
`summon_or_controlled_entity`. Package 14 closed the `vision_light_sound` slice
through PR #1110, and the execution plan lists `summon_or_controlled_entity` as
the next mechanics bucket.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, visible dashboard/Jules
handoff, PR review, verification, compact decision reporting, and tracker
updates. Jules should own the implementation-heavy spell data, smallest
reusable runtime bridge, focused tests, and bucket-row classification for the
bounded slice below.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package15-summon-controlled-entity`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package15-summon-controlled-entity-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package15-summon-controlled-entity`

## Goal

Make a coherent early-game subset of summoned, animated, or manually
controlled spell-created entities mechanically visible and testable instead of
leaving those rules in prose only.

Package 15 should be larger than a one-spell patch, but it must not pretend the
entire summon/control engine can be finished in one PR. The current bucket has
44 open findings overall. A scoped early-game extraction has 21 actionable-open
rows across these cantrip/level 1-3 spells:

- Cantrip: `druidcraft`, `mage-hand`.
- Level 1: `find-familiar`, `unseen-servant`.
- Level 2: `find-steed`, `spiritual-weapon`, `summon-beast`.
- Level 3: `animate-dead`, `conjure-animals`, `glyph-of-warding`,
  `phantom-steed`, `speak-with-dead`, `speak-with-plants`,
  `summon-lesser-demons`, and `tiny-servant`.

Jules should classify all of those early-game open rows first, then implement
the largest coherent safe subset. Likely safe candidates are the rows that can
reuse existing `SUMMONING`, summon-template, `controlledEntity`, validation, and
focused `SummoningCommand` test patterns without inventing broad AI, initiative,
hostile-control, trap/glyph, or file-backed entity systems.

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/summon_or_controlled_entity.md`
- `docs/tasks/spells/summoned-entities/SPELL_SUMMONED_ENTITIES_TRACKER.md`
- relevant spell JSON files under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/types/spellControlledEntity.ts`
- `src/systems/spells/validation/controlledEntitySchemas.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/commands/effects/SummoningCommand.ts`
- `src/commands/__tests__/SummoningCommand.test.ts`
- `src/data/summonTemplates.ts`
- nearest spell-validation and combat tests that already exercise summon or
  controlled-entity data

Current evidence to preserve:

- `src/types/spells.ts` already defines `SummoningEffect`,
  `SummonedEntityStatBlock`, `SUMMONING`, and `controlledEntity`.
- `src/types/spellControlledEntity.ts` and
  `controlledEntitySchemas.ts` currently model the narrow Mage Hand-style
  `spectral_hand` helper.
- `SummoningCommand` currently reads older flat fields such as `summonType`,
  `creatureId`, `count`, and `objectDescription`.
- The validator-shaped spell JSON stores summon detail under nested
  `effect.summon`, so runtime proof may need a narrow adapter or command
  resolution bridge before bulk JSON migration.
- Existing level 0-3 JSON already includes `SUMMONING` examples for
  `find-familiar`, `unseen-servant`, `find-steed`, `tensers-floating-disk`, and
  `conjure-animals`; do not rewrite them blindly.
- `mage-hand` may already have a `controlledEntity` path in current source/data;
  verify before changing it or closing its bucket row.

## Allowed Write Scope

Jules may edit:

- selected summon/control spell JSON under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- matching structured spell docs under `docs/spells/` if they exist and need
  alignment with runtime data
- `docs/tasks/spells/mechanics-discovery/buckets/summon_or_controlled_entity.md`
  only to mark rows resolved after proof exists or to document residual rows
- `docs/tasks/spells/summoned-entities/SPELL_SUMMONED_ENTITIES_TRACKER.md`
  only when the category split or runtime-state count changes
- manual review overrides only when a row is proven resolved or deliberately
  narrowed
- `src/types/spells.ts`, `src/types/spellControlledEntity.ts`,
  `src/systems/spells/validation/controlledEntitySchemas.ts`, or
  `src/systems/spells/validation/spellValidator.ts` only for the smallest typed
  extension needed to represent reusable summon/control facts
- `src/commands/effects/SummoningCommand.ts`,
  `src/commands/factory/SpellCommandFactory.ts`, `src/data/summonTemplates.ts`,
  or nearby combat helpers only when they are the narrow runtime bridge for
  selected rows
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
- combat HUD/rider-icon UI; record active spell-rider icon visibility as a
  later combat-visibility follow-up if noticed
- broad AI arbitration policy
- broad file-backed entity folder trees
- broad hostile-summon AI, independent initiative, demon-control breakout,
  long-term reassert-control, trap/glyph authoring, speaking-with-dead/plants
  social arbitration, or general object-animation engines
- generated gate reports when the only change is a timestamp
- unrelated type/lint cleanup

## Required Work

1. Reconfirm the current `summon_or_controlled_entity` bucket rows and selected
   spell JSON files before editing.
2. Classify every cantrip/level 1-3 open row named in this packet as one of:
   `implement_now`, `already_represented_after_proof`,
   `defer_broader_system`, or `not_really_summon_control`.
3. Implement the largest coherent safe subset covered by existing
   `SUMMONING`, summon-template, `controlledEntity`, validation, command, and
   focused-test patterns.
4. Prefer proving already-structured summon/control rows and adding narrow
   adapters over inventing a second entity-authoring system.
5. Add or update focused tests proving the selected rows carry the intended
   summon/control facts through the data/runtime path.
6. Mark only proven rows closed in `summon_or_controlled_entity.md`; leave
   broader or unproven rows open with a concise residual reason.
7. Do not close demon-control, Animate Dead reassert-control, Glyph of Warding
   stored-summon, Speak with Dead/Plants social-command, or Spiritual Weapon
   persistent-position rows unless the implementation truly covers them without
   a broad new system.
8. Run validation, Atlas audit, focused tests, and TypeScript/build checks when
   runtime code changes.
9. Update this packet or the living tracker with the implementation result,
   tests run, behavior proven, and residual limitations.

## Verification Commands

Run from the repository root:

```powershell
npm run validate:spells
node scripts\auditAtlasBuckets.mjs
```

Add the focused tests created or changed by this package. Candidate targets may
include `SummoningCommand`, `SpellCommandFactory`, spell validation, summon
template tests, or controlled-entity schema tests depending on the
implementation.

If exported TypeScript signatures change, run the Aralia dependency-header sync
command required by `AGENTS.md` for each changed exported/shared file. If that
documented sync command is unavailable, record the exact failure and continue
with the package verification rather than widening into tooling repair.

## Acceptance Criteria

- Jules classifies all named early-game summon/control rows before selecting
  the implementation subset.
- The implemented subset contains more than one isolated spell row unless
  current evidence proves that a broader batch would cross a major system
  boundary.
- Selected summon/control rules are represented by explicit data or a runtime
  bridge instead of prose only.
- Existing `SUMMONING` and `controlledEntity` examples remain valid.
- Focused tests prove the selected rows expose the intended facts through the
  chosen runtime/data path.
- Spell validation passes.
- Atlas audit remains green.
- The final PR contains durable Package 15 files only. No helper scripts,
  `.orig` files, generated caches, workflow edits, or raw Symphony/Jules
  runtime artifacts should remain in the diff.

## Decision And Wait-State Reporting

Do not create a full decision entry for every observation or wait. Full
decisions are for real forks: plan approval/rejection, repair requests,
branch-hygiene repair, replacement handoff, scope expansion, and merge/closeout.

Repeated unchanged waits should be compact wait-state rows that name observed
state, what is being waited for, and the next recheck condition. Routine
implementation choices, files changed, and verification results belong in the
completion note or PR summary, not in the assumed-approval decision ledger.
