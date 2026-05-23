# Package 4 Jules Task: Combat Simulator Deterministic Spell Pilot

Status: historical launch packet; proof is recorded, PR #979 merged, and the
remaining visible follow-ups are the bless/status gap and the Atlas source gap.

This is the durable scope and acceptance record for the launched Package 4 handoff. The live orchestration state stays in the dashboard and Jules system instead of being treated as repo state.

This is the next Spell Phase 1 implementation slice after Package 3 merged the
character creator and spellbook visibility work. Package 4 should prove that a
small, representative set of early-game deterministic spells can be cast inside
the combat simulator from real premade or focused test characters.

## Worker

Default worker: Jules.

Codex role: foreman. Codex owns scoping, dashboard handoff, review,
verification, decision reporting, and Atlas/gate receipts. Jules should own the
implementation-heavy runtime, fixture, and focused test work for this launched
handoff.

## Branch And Worktree

Recommended implementation branch:

- `jules/spells-package4-combat-deterministic-pilot`

Optional Codex review/repair branch, only if a bounded local follow-up is safer
than returning the PR to Jules:

- `codex/spells-package4-combat-deterministic-pilot-review`

Recommended local review worktree:

- `F:\Repos\Aralia\.worktrees\spells-package4-combat-deterministic-pilot`

## Goal

Prove one deterministic combat spell path end to end for cantrips and level 1
spells, then leave a clear bridge for level 2-3 deterministic testing. This
slice should cover representative spell behavior, not every spell.

## Source Context

Use these existing artifacts instead of inventing a parallel plan:

- `docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md`
- `docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md`
- `docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md`
- `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`
- `docs/tasks/spells/PACKAGE_3_ATLAS_GATE_CHECKPOINT_RECEIPT.md`
- `src/hooks/useAbilitySystem.ts`
- `src/components/BattleMap/BattleMapDemo.tsx`
- `src/components/Combat/CombatView.tsx`
- `src/components/BattleMap/AbilityPalette.tsx`
- `src/components/BattleMap/CombatLog.tsx`
- `src/utils/character/spellAbilityFactory.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/commands/effects/HealingCommand.ts`
- `src/commands/effects/StatusConditionCommand.ts`
- `src/commands/__tests__/SpellCommandFactory.test.ts`
- `src/commands/factory/__tests__/AbilityEffectMapper.test.ts`

## Ownership

Jules may edit:

- `src/hooks/useAbilitySystem.ts`
- `src/utils/character/spellAbilityFactory.ts`
- `src/utils/combat/combatUtils.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/factory/AbilityCommandFactory.ts`
- `src/commands/effects/*.ts` only for the pilot effects below
- `src/components/BattleMap/AbilityPalette.tsx`
- `src/components/BattleMap/CombatLog.tsx`
- `src/components/BattleMap/BattleMapDemo.tsx`
- `src/components/Combat/CombatView.tsx`
- nearest focused tests under `src/commands/**/__tests__/`,
  `src/hooks/**/__tests__/`, `src/utils/**/__tests__/`, or
  `src/components/BattleMap/**/__tests__/`
- optional focused test fixtures under an existing test/fixture convention

Jules should not edit:

- broad spell JSON schema or template architecture unless a tiny fix is required
  for the selected pilot spells and is explicitly called out
- AI arbitration policy or AI-routed spell behavior
- character creator spell choice UI
- character sheet spellbook UI beyond a tiny castability bridge if one already
  exists
- broad premade roster semantics
- Symphony orchestration files
- level 4-9 spell behavior

## Pilot Spell Set

Use existing level-1 premades where practical:

- Direct damage cantrip: `fire-bolt`
  - available on `ivel_sparkvein`, `maelis_quill`, and `pip_coppercoil`
  - proves cantrip castability, target selection, damage command creation, action
    cost, and combat log output.
- Simple level-1 damage: `magic-missile`
  - available on `ivel_sparkvein` and `maelis_quill`
  - proves slot spending and deterministic damage from a prepared level-1 spell.
- Simple healing: `cure-wounds`
  - available on `pip_coppercoil`, `merrit_greenbough`, `oren_pathmark`, and
    `tavian_oathsteel`
  - proves ally targeting, healing command creation, slot spending, and combat
    log output.
- Simple buff/status pilot: `bless`
  - available on `sera_dawnmantle` and `tavian_oathsteel`
  - proves the current status/buff path or records the smallest runtime gap if
    the live engine cannot represent it yet.

If one of these is impossible because of a current fixture/runtime blocker, do
not replace the whole package with a broad rewrite. Pick the nearest equivalent
level 0-1 deterministic spell and record the blocker in the completion report.

## Required Work

1. Confirm combat characters built from premades expose prepared spell abilities
   in `AbilityPalette` or the equivalent simulator control surface.
2. Prove a player-controlled caster can select a spell, target legally, and
   execute the spell through `useAbilitySystem`.
3. Prove cantrips do not consume spell slots.
4. Prove level-1 spells consume the correct spell slot and action resource.
5. Prove damage changes target HP and writes a readable combat log entry.
6. Prove healing changes ally HP and writes a readable combat log entry.
7. Prove the chosen buff/status pilot either applies an observable status/buff
   or produces a precise follow-up gap that names the missing runtime seam.
8. Add focused automated tests for the command/runtime path. Prefer stable unit
   or hook-level tests over brittle full-canvas assertions.
9. If visual proof is feasible, add a rendered Playwright/manual proof note for
   the simulator showing the selected spell action and combat log result.
10. Regenerate the spell gate report and record whether it changed. Do not
    commit timestamp-only churn unless the report has meaningful state changes.

## Verification Commands

Jules should run the narrowest relevant checks first:

```powershell
npm run validate:spells
npm run generate:spell-gates
npx vitest run src/commands/__tests__/SpellCommandFactory.test.ts src/commands/factory/__tests__/AbilityEffectMapper.test.ts --reporter=verbose
```

If Jules adds a more focused combat pilot test file, include it in the vitest
command and report the exact command in the completion note.

## Acceptance Criteria

- At least one premade/test caster can cast `fire-bolt` or an equivalent damage
  cantrip through the simulator runtime.
- At least one premade/test caster can cast `magic-missile` or an equivalent
  level-1 damage spell through the simulator runtime.
- At least one premade/test caster can cast `cure-wounds` or an equivalent
  healing spell through the simulator runtime.
- The chosen buff/status pilot is either working with proof or recorded as a
  precise mechanics gap.
- Action cost, spell slot cost, target HP/healing, and combat log output are
  covered by tests or rendered proof.
- The package does not broaden into AI arbitration or all level 2-3 mechanics.
- Atlas/gate receipt records validation output and generated report status.
- Any level 2-3 fixture or broader mechanics bucket need is recorded as a
  follow-up gap instead of folded into this pilot.

## Completion Note

The Package 4 proof is now recorded in
`PACKAGE_4_COMBAT_PROOF_RECEIPT.md`, PR #979 merged on 2026-05-22, and the
spell-gate refresh was rerun locally with timestamp-only churn in
`public/data/spell_gate_report.json`. The combat simulator pilot still
preserves two explicit follow-ups instead of broadening:

- `bless` has no combat-simulator spell/status bridge yet, so it remains a
  follow-up gap instead of a scope expansion.
- Atlas/source discovery is still blocked by G48 and remains a separate repair
  path.
