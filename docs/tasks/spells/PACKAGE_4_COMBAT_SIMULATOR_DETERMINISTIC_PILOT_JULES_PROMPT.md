# Package 4 Jules Prompt: Combat Simulator Deterministic Spell Pilot

Status: prompt-ready, not dispatched.

Do not paste this into Jules until the visible Symphony dashboard draft is
created and the handoff path reaches the Jules launch boundary. The raw
dashboard payload is orchestration state, not a durable Aralia task artifact.

## Prompt To Send

```text
You are Jules working on Aralia Spell Phase 1, Package 4: combat simulator deterministic spell pilot.

Goal:
Prove a small representative deterministic spell path end to end inside the
combat simulator. Use cantrips and level 1 spells first, then leave clear notes
for level 2-3 follow-up coverage. This is a pilot, not a broad rewrite of every
spell.

Branch:
Use `jules/spells-package4-combat-deterministic-pilot`.

Primary context:
- docs/tasks/spells/EARLY_GAME_SPELL_EXECUTION_PLAN.md
- docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md
- docs/tasks/spells/SPELL_PHASE_1_BASELINE_REPORT.md
- docs/tasks/spells/PACKAGE_4_COMBAT_SIMULATOR_DETERMINISTIC_PILOT_JULES_TASK.md
- src/hooks/useAbilitySystem.ts
- src/components/BattleMap/BattleMapDemo.tsx
- src/components/Combat/CombatView.tsx
- src/components/BattleMap/AbilityPalette.tsx
- src/components/BattleMap/CombatLog.tsx
- src/utils/character/spellAbilityFactory.ts
- src/commands/factory/SpellCommandFactory.ts
- src/commands/effects/DamageCommand.ts
- src/commands/effects/HealingCommand.ts
- src/commands/effects/StatusConditionCommand.ts
- src/commands/__tests__/SpellCommandFactory.test.ts
- src/commands/factory/__tests__/AbilityEffectMapper.test.ts
- public/premade-characters/*.json

Allowed write scope:
- src/hooks/useAbilitySystem.ts
- src/utils/character/spellAbilityFactory.ts
- src/utils/combat/combatUtils.ts
- src/commands/factory/SpellCommandFactory.ts
- src/commands/factory/AbilityCommandFactory.ts
- src/commands/effects/*.ts only for the selected pilot effects
- src/components/BattleMap/AbilityPalette.tsx
- src/components/BattleMap/CombatLog.tsx
- src/components/BattleMap/BattleMapDemo.tsx
- src/components/Combat/CombatView.tsx
- nearest focused tests under src/commands/**/__tests__/, src/hooks/**/__tests__/,
  src/utils/**/__tests__/, or src/components/BattleMap/**/__tests__/
- optional focused fixture/test helpers that do not change default roster semantics

Do not edit in this slice:
- broad spell schema/template architecture unless a tiny selected-pilot fix is required
- AI arbitration policy or AI-routed spell behavior
- character creator UI
- character sheet spellbook UI, except a tiny castability bridge if one already exists
- broad premade roster semantics
- Symphony orchestration files
- level 4-9 spell behavior

Pilot spells:
- fire-bolt or nearest equivalent direct damage cantrip
- magic-missile or nearest equivalent level-1 damage spell
- cure-wounds or nearest equivalent healing spell
- bless or nearest equivalent simple buff/status spell

Required work:
1. Confirm premade/test combat casters expose prepared spells as selectable combat abilities.
2. Prove spell selection, legal targeting, and execution through useAbilitySystem.
3. Prove cantrips do not consume spell slots.
4. Prove level-1 spells consume the correct slot and action resource.
5. Prove damage changes target HP and writes a readable combat log entry.
6. Prove healing changes ally HP and writes a readable combat log entry.
7. Prove the chosen buff/status pilot applies an observable status/buff, or record the exact missing runtime seam as a follow-up gap.
8. Add focused automated tests for the command/runtime path.
9. If a rendered simulator proof is feasible, describe the exact path and result.
10. Run the spell gate commands and report whether public/data/spell_gate_report.json changed meaningfully.

Verification to run:
- npm run validate:spells
- npm run generate:spell-gates
- npx vitest run src/commands/__tests__/SpellCommandFactory.test.ts src/commands/factory/__tests__/AbilityEffectMapper.test.ts --reporter=verbose

If you add a more focused combat pilot test file, run it too and report the exact command.

Completion report:
- List changed files.
- For each pilot spell, report caster, target type, runtime path, cost/resource result, HP/status result, and combat log proof.
- Include exact verification commands and results.
- Call out level 2-3 fixture needs, broader mechanics buckets, or AI arbitration boundaries as follow-up gaps rather than folding them into this pilot.
```

## Foreman Dispatch Checklist

Before sending:

1. Confirm this prompt and the task file are committed or otherwise visible to
   Jules through the repository branch used for the handoff.
2. Create the Symphony dashboard draft through the visible dashboard form and
   record the returned draft id in the tracker.
3. Create/link the Linear issue through the dashboard when the handoff path
   reaches that boundary.
4. Stage the Jules manifest and launch the Jules session through the dashboard.
5. Send exactly one Package 4 implementation slice; do not start Package 5 or a
   mechanics bucket in parallel.

After Jules returns:

1. Inspect scope and changed files.
2. Run the Package 4 verification commands locally.
3. Run rendered simulator proof if the PR changes player-visible combat flow.
4. Refresh spell gates and Atlas/gate receipt.
5. Record PR/review/deployment/local-sync evidence in the Symphony trail.
