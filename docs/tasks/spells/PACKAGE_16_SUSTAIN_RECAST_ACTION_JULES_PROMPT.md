# Package 16 Jules Prompt: Sustain, Move, Or Recast Actions

You are working on Aralia Spell Phase 1, Package 16.

Read first:

- `docs/tasks/spells/PACKAGE_16_SUSTAIN_RECAST_ACTION_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/sustain_or_recast_action.md`
- relevant selected spell JSON under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- `src/types/spells.ts`
- nearest existing runtime, validation, command, ability-factory, and focused
  test files for granted actions, sustain costs, caster actions, active
  effects, or spell-created follow-up actions

Goal: make the largest coherent safe subset of early-game
`sustain_or_recast_action` rows mechanically visible and testable instead of
leaving those rules in prose only.

Expected behavior:

- First classify the named cantrip/level 1-3 open rows from the task packet as
  `implement_now`, `already_represented_after_proof`,
  `defer_broader_system`, or `belongs_to_other_bucket`.
- Prefer a higher-value batch that uses existing `sustainCost`, `trigger`,
  `actionType`, `grantedActions`, utility-option, active-effect, validation,
  command, and focused-test patterns.
- Good candidates may include `dancing-lights`, `mold-earth`, `shape-water`,
  `expeditious-retreat`, `flaming-sphere`, `gust-of-wind`,
  `spiritual-weapon`, `call-lightning`, and `melfs-minute-meteors` if current
  source proves they can be represented without a broad new subsystem.
- Classify or defer likely broader rows such as `find-familiar`,
  `unseen-servant`, `animate-dead`, `tiny-servant`, `phantasmal-force`,
  `flame-blade`, `clairvoyance`, and `hex` unless current source already has a
  narrow safe path.
- Reuse existing runtime/data patterns where they fit.
- Add focused tests proving the selected spells expose the intended
  sustain/recast facts through the data/runtime path.
- Mark only proven rows closed in `sustain_or_recast_action.md`; record
  residual rows clearly.

Keep the package bounded. Do not edit Symphony files, `.jules` or `.symphony`
runtime state, GitHub workflows, premade roster semantics, character creator UI,
spellbook UI, combat rider-icon UI, levels 4-9, broad summon/control engines,
broad AI arbitration policy, broad illusion/social arbitration, broad
persistent-object or sensor systems, or generated report timestamps.

Workflow note: once this Jules session starts, later local tracker edits or
merged GitHub task-doc PRs will not automatically reach your isolated clone. If
the foreman needs to adjust the task after launch, expect that update through
an explicit Jules message, bounded PR feedback, PR-branch repair/rebase, or a
replacement handoff.

Decision-log note: do not create a full decision entry for every observation,
wait, or routine implementation choice. Full decisions are for real forks:
plan approval/rejection, repair requests, branch-hygiene repair, replacement
handoff, scope expansion, and merge/closeout. Repeated unchanged waits should
be compact wait-state rows that name observed state, what is being waited for,
and the next recheck condition. File lists and verification results belong in
the completion report.

Expected output:

1. Early-game sustain/recast row classification.
2. Focused spell data/runtime changes for the selected representative batch.
3. Focused tests proving sustain/recast behavior through the data/runtime path.
4. `npm run validate:spells`.
5. `node scripts\auditAtlasBuckets.mjs`.
6. TypeScript/build checks if runtime code changed.
7. Any required dependency-header sync if exported/shared TypeScript signatures
   changed, or the exact reason that documented sync could not run.
8. A completion note naming changed files, tests run, rows proven closed, and
   residual rows left for later.
