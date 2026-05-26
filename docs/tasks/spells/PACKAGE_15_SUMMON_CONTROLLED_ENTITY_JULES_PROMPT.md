# Package 15 Jules Prompt: Summons And Controlled Entities

You are working on Aralia Spell Phase 1, Package 15.

Read first:

- `docs/tasks/spells/PACKAGE_15_SUMMON_CONTROLLED_ENTITY_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/summon_or_controlled_entity.md`
- `docs/tasks/spells/summoned-entities/SPELL_SUMMONED_ENTITIES_TRACKER.md`
- relevant selected spell JSON under `public/data/spells/level-0/`,
  `public/data/spells/level-1/`, `public/data/spells/level-2/`, and
  `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/types/spellControlledEntity.ts`
- `src/systems/spells/validation/controlledEntitySchemas.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/commands/effects/SummoningCommand.ts`
- `src/commands/__tests__/SummoningCommand.test.ts`
- `src/data/summonTemplates.ts`

Goal: make the largest coherent safe subset of early-game
`summon_or_controlled_entity` rows mechanically visible and testable instead of
leaving those rules in prose only.

Expected behavior:

- First classify the named cantrip/level 1-3 open rows from the task packet as
  `implement_now`, `already_represented_after_proof`,
  `defer_broader_system`, or `not_really_summon_control`.
- Prefer a higher-value batch that uses existing `SUMMONING`, summon-template,
  `controlledEntity`, validation, command, and focused test patterns.
- Good candidates may include proof/cleanup for already-structured
  `find-familiar`, `unseen-servant`, `find-steed`, `conjure-animals`, and
  `mage-hand`, plus `summon-beast` or `tiny-servant` only if current runtime
  shape supports a narrow safe migration.
- Reuse existing `SummoningCommand`, summon templates, validation schemas, and
  controlled-entity metadata where they fit.
- Add focused tests proving the selected spells expose the intended
  summon/control facts through the runtime/data path.
- Mark only proven rows closed in `summon_or_controlled_entity.md`; record
  residual rows clearly.

Keep the package bounded. Do not edit Symphony files, `.jules` or `.symphony`
runtime state, GitHub workflows, premade roster semantics, character creator UI,
spellbook UI, combat rider-icon UI, levels 4-9, broad AI arbitration policy,
broad file-backed entity folder trees, hostile-summon AI, independent
initiative systems, demon-control breakout, long-term reassert-control,
trap/glyph authoring, social arbitration for speaking spells, general
object-animation engines, or generated report timestamps.

Workflow note: once this Jules session starts, later local tracker edits or
merged GitHub task-doc PRs will not automatically reach your isolated clone. If
the foreman needs to adjust the task after launch, expect that update through an
explicit Jules message, bounded PR feedback, PR-branch repair/rebase, or a
replacement handoff.

Decision-log note: do not create a full decision entry for every observation,
wait, or routine implementation choice. Full decisions are for real forks:
plan approval/rejection, repair requests, branch-hygiene repair, replacement
handoff, scope expansion, and merge/closeout. Repeated unchanged waits should
be compact wait-state rows that name observed state, what is being waited for,
and the next recheck condition. File lists and verification results belong in
the completion report.

Expected output:

1. Early-game summon/control row classification.
2. Focused spell data/runtime changes for the selected representative batch.
3. Focused tests proving summon/control behavior through the data/runtime path.
4. `npm run validate:spells`.
5. `node scripts\auditAtlasBuckets.mjs`.
6. TypeScript/build checks if runtime code changed.
7. Any required dependency-header sync if exported/shared TypeScript signatures
   changed, or the exact reason that documented sync could not run.
8. A completion note naming changed files, tests run, rows proven closed, and
   residual rows left for later.
