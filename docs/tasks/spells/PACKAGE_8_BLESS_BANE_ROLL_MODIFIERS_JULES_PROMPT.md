# Package 8 Jules Prompt: Bless/Bane Roll Modifiers

You are working on Aralia Spell Phase 1, Package 8.

Read first:

- `docs/tasks/spells/PACKAGE_8_BLESS_BANE_ROLL_MODIFIERS_JULES_TASK.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/mechanics-discovery/manual-review-overrides/level-1-00.json`
- `public/data/spells/level-1/bless.json`
- `public/data/spells/level-1/bane.json`
- `src/commands/effects/AttackRollModifierCommand.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/systems/combat/SavePenaltySystem.ts`
- `src/utils/character/savingThrowUtils.ts`

Goal: make Bless and Bane mechanically apply their `1d4` attack-roll and
saving-throw modifiers in the combat simulator.

Expected behavior:

- Bless applies `+1d4` to affected targets' attack rolls and saving throws
  while the spell is active.
- Bane applies `-1d4` to failed-save targets' attack rolls and saving throws
  while the spell is active.
- Bane's initial Charisma save still gates whether the debuff lands.
- The existing `Blessed` and `Bane` labels may remain for UI readability, but
  combat math must use explicit runtime data rather than status-name semantics.

Use existing structures where they fit. `AttackRollModifierEffect` already has
bonus/penalty dice fields, and `rollSavingThrow` already accepts positive and
negative dice modifiers. Add only the smallest shared runtime bridge needed for
Bless/Bane to work honestly.

Do not edit Symphony files, `.jules` or `.symphony` runtime state, GitHub
workflows, premade roster semantics, character creator UI, spellbook UI, levels
4-9, or broad AI arbitration policy. Do not commit generated gate-report churn
if it is only timestamps.

Expected output:

1. Focused spell data/runtime changes for Bless and Bane.
2. Focused tests proving attack-roll and saving-throw modifier behavior.
3. `npm run validate:spells`.
4. `node scripts\auditAtlasBuckets.mjs`.
5. Any required dependency-header sync if exported/shared TypeScript signatures
   changed.
6. A completion note naming changed files, tests run, behavior proven, and any
   residual limitation.

