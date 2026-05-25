# Package 12 Jules Prompt: Conditional Endings

You are working on Aralia Spell Phase 1, Package 12.

Read first:

- `docs/tasks/spells/PACKAGE_12_CONDITIONAL_ENDING_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/conditional_ending.md`
- relevant selected spell JSON under `public/data/spells/level-1/`,
  `public/data/spells/level-2/`, and `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/commands/factory/SpellCommandFactory.ts`

Goal: make a bounded representative subset of early-game `conditional_ending`
rows mechanically visible and testable instead of leaving those rules in prose
only.

Expected behavior:

- Select at least one level 1-3 row where a spell effect ends, transfers, is
  suppressed, or expires because a concrete condition occurs before normal
  duration.
- Prefer a transfer-on-defeat or temporary-suppression row such as `hex`,
  `hunters-mark`, or `knock`.
- Include an escape/attention-break row such as `detect-thoughts` only if it can
  stay inside conditional-ending data/runtime proof without broad AI or social
  arbitration work.
- Reuse existing `conditionalEndings` structures where possible before adding
  new types.
- Add the smallest reusable data/runtime bridge needed for the selected rows.
- Add focused tests proving the selected spells expose the intended
  conditional-ending facts through the runtime/data path.
- Do not mark unimplemented rows closed. Record residual rows clearly.

Candidate rows include:

- Level 1: `hex`, `hunters-mark`.
- Level 2: `animal-messenger`, `detect-thoughts`, `knock`.
- Level 3: select only if inspection shows the row stays bounded to
  conditional-ending behavior.

Keep the package bounded. Do not edit Symphony files, `.jules` or `.symphony`
runtime state, GitHub workflows, premade roster semantics, character creator UI,
spellbook UI, levels 4-9, broad AI arbitration policy, broad summon/control,
terrain, light/vision, social manipulation, trap/glyph systems, combat
rider-icon UI, or generated report timestamps.

Workflow note: once this Jules session starts, later local tracker edits or
merged GitHub task-doc PRs will not automatically reach your isolated clone.
If the foreman needs to adjust the task after launch, expect that update through
an explicit Jules message, bounded PR feedback, PR-branch repair/rebase, or a
replacement handoff.

Expected output:

1. Focused spell data/runtime changes for the selected representative rows.
2. Focused tests proving conditional-ending behavior through the data/runtime
   path.
3. `npm run validate:spells`.
4. `node scripts\auditAtlasBuckets.mjs`.
5. Any required dependency-header sync if exported/shared TypeScript signatures
   changed.
6. A completion note naming changed files, tests run, rows proven closed, and
   residual rows left for later.
