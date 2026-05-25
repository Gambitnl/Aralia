# Package 10 Jules Prompt: Target Filters And Eligibility

You are working on Aralia Spell Phase 1, Package 10.

Read first:

- `docs/tasks/spells/PACKAGE_10_TARGET_FILTER_ELIGIBILITY_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/target_filter_or_eligibility.md`
- relevant selected spell JSON under `public/data/spells/level-1/`,
  `public/data/spells/level-2/`, and `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/utils/character/spellAbilityFactory.ts`
- `src/systems/spells/validation/targetingSchemas.ts`
- `src/systems/spells/targeting/TargetValidationUtils.ts`

Goal: make a bounded representative subset of early-game
`target_filter_or_eligibility` rows mechanically visible and testable instead of
leaving those rules in prose only.

Expected behavior:

- Select at least one object-eligibility row, one placement-eligibility row, and
  one special target-identity row from cantrips/levels 1-3, unless current code
  evidence proves one of those families is already represented.
- Add the smallest reusable data/runtime bridge needed for those rows.
- You may use `src/systems/spells/validation/targetingSchemas.ts` and
  `src/systems/spells/targeting/TargetValidationUtils.ts` when they are the
  existing narrow bridge needed to expose the selected eligibility facts.
- Preserve existing broad target categories where they are still useful.
- Add focused tests proving the selected spells expose the intended eligibility
  facts through the runtime/data path.
- Do not mark unimplemented rows closed. Record residual rows clearly.

Candidate rows include:

- Object eligibility: `burning-hands`, `darkness`, `enlarge-reduce`,
  `flaming-sphere`, `knock`, `levitate`, `pyrotechnics`, `shatter`,
  `fireball`, `daylight`, `dispel-magic`, `elemental-weapon`,
  `flame-arrows`.
- Placement eligibility: `find-familiar`, `tensers-floating-disk`,
  `unseen-servant`, `find-steed`, `misty-step`, `summon-beast`,
  `animate-dead`, `conjure-animals`, `phantom-steed`,
  `summon-lesser-demons`, `thunder-step`.
- Special target identity: `hellish-rebuke`, `gentle-repose`, `hold-person`,
  `revivify`, `sending`, `spirit-guardians`.

Keep the package bounded. Do not edit Symphony files, `.jules` or `.symphony`
runtime state, GitHub workflows, premade roster semantics, character creator UI,
spellbook UI, levels 4-9, broad AI arbitration policy, broad terrain/object
state systems, or generated report timestamps.

Replacement note: Jules session `3916044383011290995` completed without a PR
after the first plan gate. Start from current `origin/master`; do not continue
from that stale session's unfinished plan.

Expected output:

1. Focused spell data/runtime changes for the selected representative rows.
2. Focused tests proving target/placement eligibility behavior.
3. `npm run validate:spells`.
4. `node scripts\auditAtlasBuckets.mjs`.
5. Any required dependency-header sync if exported/shared TypeScript signatures
   changed.
6. A completion note naming changed files, tests run, rows proven closed, and
   residual rows left for later.
