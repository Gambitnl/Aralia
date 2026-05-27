# Package 17 Jules Prompt: Reaction And Opportunity Restrictions

You are working on Aralia Spell Phase 1, Package 17.

Read first:

- `docs/tasks/spells/PACKAGE_17_REACTION_OPPORTUNITY_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/reaction_or_opportunity_restriction.md`
- relevant selected spell JSON under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/systems/spells/schema/spell.schema.json`
- `src/systems/spells/schema/parts/20-effect-payloads.json`
- `src/hooks/combat/useActionExecutor.ts`
- `src/systems/combat/reactions/OpportunityAttackSystem.ts`
- nearest focused tests for spell validation, command factories, forced
  movement, opportunity attacks, and action economy

Goal: make the largest coherent safe subset of early-game
`reaction_or_opportunity_restriction` rows mechanically visible and testable
instead of leaving those rules in prose only.

Expected behavior:

- First classify the named cantrip/level 1-3 open rows from the task packet as
  `implement_now`, `already_represented_after_proof`,
  `defer_broader_system`, or `belongs_to_other_bucket`.
- Prefer a higher-value batch that uses existing `castingTime`,
  `reactionCondition`, `combatCost`, `forcedMovement`, status-condition,
  opportunity-attack, validation, command, and focused-test patterns.
- Good candidates may include `shocking-grasp`, `arms-of-hadar`, `slow`,
  `confusion`, `dissonant-whispers`, `enemies-abound`, and `counterspell` if
  current source proves they can be represented without a broad new subsystem.
- Classify or defer likely broader rows such as `find-familiar`,
  `summon-beast`, `shining-smite`, and `blinding-smite` unless current source
  already has a narrow safe path.
- Reuse existing runtime/data patterns where they fit.
- Add focused tests proving the selected spells expose the intended
  reaction/opportunity facts through the data/runtime path.
- Mark only proven rows closed in `reaction_or_opportunity_restriction.md`;
  record residual rows clearly.

Keep the package bounded. Do not edit Symphony files, `.jules` or `.symphony`
runtime state, GitHub workflows, premade roster semantics, character creator UI,
spellbook UI, combat rider-icon UI, levels 4-9, broad optional-reaction prompt
UI, broad summon/control engines, broad AI arbitration policy, broad
illusion/social arbitration, or generated report timestamps.

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

1. Early-game reaction/opportunity row classification.
2. Focused spell data/runtime changes for the selected representative batch.
3. Focused tests proving reaction/opportunity behavior through the data/runtime
   path.
4. `npm run validate:spells`.
5. `node scripts\auditAtlasBuckets.mjs`.
6. TypeScript/build checks if runtime code changed.
7. Any required dependency-header sync if exported/shared TypeScript signatures
   changed, or the exact reason that documented sync could not run.
8. A completion note naming changed files, tests run, rows proven closed, and
   residual rows left for later.
