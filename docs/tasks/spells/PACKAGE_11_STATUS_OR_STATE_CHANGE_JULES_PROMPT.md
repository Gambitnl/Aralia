# Package 11 Jules Prompt: Status And State Changes

You are working on Aralia Spell Phase 1, Package 11.

Read first:

- `docs/tasks/spells/PACKAGE_11_STATUS_OR_STATE_CHANGE_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/mechanics-discovery/ACTIONABLE_SCHEMA_BUCKETS.md`
- `docs/tasks/spells/mechanics-discovery/buckets/status_or_state_change.md`
- relevant selected spell JSON under `public/data/spells/level-1/`,
  `public/data/spells/level-2/`, and `public/data/spells/level-3/`
- `src/types/spells.ts`
- `src/types/spellStatusMetadata.ts`
- `src/commands/effects/StatusConditionCommand.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/utils/character/spellAbilityFactory.ts`

Goal: make a bounded representative subset of early-game
`status_or_state_change` rows mechanically visible and testable instead of
leaving those rules in prose only.

Expected behavior:

- Select at least one direct status-application row and one option-specific
  status payload row from cantrips/levels 1-3.
- Include one condition-removal or staged-status row if current code evidence
  shows it can be represented without broadening the package.
- Reuse existing `statusCondition`, `repeatSave`, `breakTriggers`,
  `conditionRemoval`, and `controlOptions` structures where possible before
  adding new types.
- Add the smallest reusable data/runtime bridge needed for those rows.
- Add focused tests proving the selected spells expose the intended status/state
  facts through the runtime/data path.
- Do not mark unimplemented rows closed. Record residual rows clearly.

Candidate rows include:

- Direct status application: `ray-of-sickness`, `sleep`, `snare`,
  `tashas-hideous-laughter`, `blindness-deafness`, `pyrotechnics`, `web`.
- Option-specific status payload: `command` Grovel applying Prone.
- Condition removal or staged status: `lesser-restoration`,
  `protection-from-poison`, `sleep`.

Keep the package bounded. Do not edit Symphony files, `.jules` or `.symphony`
runtime state, GitHub workflows, premade roster semantics, character creator UI,
spellbook UI, levels 4-9, broad AI arbitration policy, broad summon/control,
terrain, light/vision, conditional-ending systems, combat rider-icon UI, or
generated report timestamps.

Workflow note: once this Jules session starts, later local tracker edits or
merged GitHub task-doc PRs will not automatically reach your isolated clone.
If the foreman needs to adjust the task after launch, expect that update through
an explicit Jules message, bounded PR feedback, PR-branch repair/rebase, or a
replacement handoff.

Expected output:

1. Focused spell data/runtime changes for the selected representative rows.
2. Focused tests proving status/state behavior through the data/runtime path.
3. `npm run validate:spells`.
4. `node scripts\auditAtlasBuckets.mjs`.
5. Any required dependency-header sync if exported/shared TypeScript signatures
   changed.
6. A completion note naming changed files, tests run, rows proven closed, and
   residual rows left for later.
