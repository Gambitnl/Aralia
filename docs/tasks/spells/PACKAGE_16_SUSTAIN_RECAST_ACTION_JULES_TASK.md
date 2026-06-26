# Package 16 Jules Task: Sustain, Move, Or Recast Actions

Status: historical Package 16 packet; PR #1135 merged on 2026-05-27.

This packet promotes the next tracker-defined bucket after Package 15:
`sustain_or_recast_action`. Package 15 closed the summon/control slice through
PR #1122, and the execution plan lists `sustain_or_recast_action` before the
reaction/opportunity-restriction bucket.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns package selection, visible dashboard/Jules
handoff, PR review, verification, compact decision reporting, and tracker
updates. Jules should own the implementation-heavy spell data, smallest
reusable runtime bridge, focused tests, and bucket-row classification for the
bounded slice below.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package16-sustain-recast-action`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package16-sustain-recast-action-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package16-sustain-recast-action`

## Jules Value

This package clears the stricter implementation-value floor. The current
`sustain_or_recast_action` bucket has 34 open findings across 32 distinct
spells, including 20 cantrip/level 1-3 findings. The next candidate,
`reaction_or_opportunity_restriction`, has 18 open findings total and 12
cantrip/level 1-3 findings.

The sustain/recast rows also form a coherent repeated pattern: spell-created
effects often grant a later action, bonus action, Magic action, active-effect
cap, dismiss action, repeat attack, repeat damage, movement command, or recast
maintenance rule. That makes this a better Jules package than another tiny
one-off correction.

## Goal

Make a coherent early-game subset of sustain, move, repeat, dismiss, and recast
spell actions mechanically visible and testable instead of leaving those rules
in prose only.

Package 16 should classify every cantrip/level 1-3 open row first, then
implement the largest safe subset that fits existing `sustainCost`, `trigger`,
`actionType`, `grantedActions`, utility-option, active-effect, validation,
command, and focused-test patterns. Do not invent a broad persistent-effect,
summon-control, illusion-arbitration, or action-economy engine just to close
rows.

The early-game open rows currently named by the bucket are:

- Cantrips: `dancing-lights`, `mold-earth`, `shape-water`.
- Level 1: `expeditious-retreat`, `find-familiar`, `hex`,
  `unseen-servant`.
- Level 2: `flame-blade`, `flaming-sphere`, `gust-of-wind`,
  `phantasmal-force`, `spiritual-weapon`.
- Level 3: `animate-dead`, `call-lightning`, `clairvoyance`,
  `melfs-minute-meteors` (two findings), and `tiny-servant`.

Likely safe implementation candidates are the rows that can be represented as
explicit spell-granted follow-up actions or active-effect limits without
building a new subsystem:

- `dancing-lights`: Bonus Action move lights.
- `mold-earth` and `shape-water`: two active non-instantaneous effects and
  action dismissal.
- `expeditious-retreat`: immediate Dash plus later Bonus Action Dash.
- `flaming-sphere`: Bonus Action move/ram sphere.
- `gust-of-wind`: Bonus Action change line direction.
- `spiritual-weapon`: Bonus Action move force and repeat attack.
- `call-lightning`: later Magic action repeat strike.
- `melfs-minute-meteors`: initial and later Bonus Action meteor expenditure.

Rows likely needing classification or deferral unless current source already
has a narrow safe path:

- `find-familiar`, `unseen-servant`, `animate-dead`, and `tiny-servant` may
  overlap Package 15 summon/control lifecycle and command semantics.
- `phantasmal-force` may belong with illusion/social/AI arbitration or a
  future repeat-illusion-damage bridge.
- `flame-blade` may need persistent conjured-weapon lifecycle handling.
- `clairvoyance` may belong with sensor/sense switching instead of generic
  sustain/recast actions.
- `hex` transfer after a target drops to 0 hit points may overlap the
  conditional-ending package or a later conditional-retarget action rule.

## Source Context

Read these before editing:

- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/sustain_or_recast_action.md`
- relevant spell JSON files under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- nearest command, ability-factory, validation, and combat tests that already
  exercise granted actions, sustain costs, caster actions, active effects, or
  spell-created follow-up actions

Current evidence to preserve:

- Many open rows already have partial runtime hints such as `sustainCost`,
  `trigger`, and `actionType`. Prove or strengthen these paths instead of
  duplicating them.
- Higher-level closed rows in the same bucket show acceptable interim patterns:
  granted actions, utility options, on-caster-action effects, movement effects,
  and active-effect metadata.
- Package 15 already handled some summon/control facts. Do not reopen that
  package just because some command rows also mention bonus actions.

## Allowed Write Scope

Jules may edit:

- selected sustain/recast spell JSON under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- matching structured spell docs under `docs/spells/` if they exist and need
  alignment with runtime data
- `docs/tasks/spells/mechanics-discovery/buckets/sustain_or_recast_action.md`
  only to mark rows resolved after proof exists or to document residual rows
- manual review overrides only when a row is proven resolved or deliberately
  narrowed
- `src/types/spells.ts` only for the smallest typed extension needed to
  represent reusable sustain/recast facts
- `src/commands/factory/SpellCommandFactory.ts`, ability factories, validation
  helpers, or nearby combat helpers only when they are the narrow runtime bridge
  for selected rows
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
- combat HUD/rider-icon UI
- broad summon/control engines already outside Package 15 closeout
- broad AI arbitration policy
- broad illusion/social arbitration
- broad persistent-object or sensor systems
- generated gate reports when the only change is a timestamp
- unrelated type/lint cleanup

## Required Work

1. Reconfirm the current `sustain_or_recast_action` bucket rows and selected
   spell JSON files before editing.
2. Classify every cantrip/level 1-3 open row named in this packet as one of:
   `implement_now`, `already_represented_after_proof`,
   `defer_broader_system`, or `belongs_to_other_bucket`.
3. Implement the largest coherent safe subset covered by existing
   `sustainCost`, `trigger`, `actionType`, `grantedActions`, utility-option,
   active-effect, validation, command, and focused-test patterns.
4. Prefer proving already-structured sustain/recast facts and adding narrow
   adapters over inventing a second action-economy system.
5. Add or update focused tests proving the selected rows carry the intended
   follow-up-action facts through the data/runtime path.
6. Mark only proven rows closed in `sustain_or_recast_action.md`; leave broader
   or unproven rows open with a concise residual reason.
7. Do not close summon lifecycle, illusion damage, sensor switching,
   conditional retargeting, or persistent conjured-weapon rows unless the
   implementation truly covers them without a broad new system.
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
include `SpellCommandFactory`, spell validation, ability-factory tests, command
tests for follow-up actions, or combat utility tests depending on the
implementation.

If exported TypeScript signatures change, run the Aralia dependency-header sync
command required by `AGENTS.md` for each changed exported/shared file. If that
documented sync command is unavailable, record the exact failure and continue
with the package verification rather than widening into tooling repair.

## Acceptance Criteria

- Jules classifies all named early-game sustain/recast rows before selecting
  the implementation subset.
- The implemented subset contains more than one isolated spell row unless
  current evidence proves that a broader batch would cross a major system
  boundary.
- Selected sustain/recast rules are represented by explicit data or a runtime
  bridge instead of prose only.
- Existing spell validation and already-closed bucket rows remain valid.
- Focused tests prove the selected rows expose the intended facts through the
  chosen runtime/data path.
- Spell validation passes.
- Atlas audit remains green.
- The final PR contains durable Package 16 files only. No helper scripts,
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

## Package 16 Completion Note
- Classified `dancing-lights`, `mold-earth`, `shape-water`, `expeditious-retreat`, `flaming-sphere`, `gust-of-wind`, `spiritual-weapon`, `call-lightning`, and `melfs-minute-meteors` as `implement_now` and added explicit `grantedActions` payloads inside their `UTILITY` effects.
- Classified `find-familiar`, `unseen-servant`, `animate-dead`, `tiny-servant`, `phantasmal-force`, `flame-blade`, `clairvoyance`, and `hex` as deferred to `sustain_or_recast_action.md` (e.g. illusion, summon lifecycle, persistent-weapon boundaries).
- Created a focused test `SpellCommandFactoryGrantedAction.test.ts` to prove `grantedActions` survives command instantiation without breaking existing combat structure.
- Validated all spell JSONs and verified Atlas audits remain green. No arbitrary environment configurations were altered.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/PACKAGE_16_SUSTAIN_RECAST_ACTION_JULES_TASK.md","sha256WithoutMarker":"eb1a0cb2e948dc307590b873263935756bef9eeab2d99d6f5884d76839684b03","markedAtUtc":"2026-06-25T22:29:38.379Z"} -->
