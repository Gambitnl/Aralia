# Task: Implement Remaining Effect Command Types

**Status:** Preserved task spec with current-status note  
**Last Reverified:** 2026-03-11  
**Primary live implementation:** [`src/commands/effects`](../../../src/commands/effects)

---

## Why This File Still Exists

This task spec is preserved because it captures the transition from a partial spell-command layer to broad effect-command coverage.

It is no longer accurate as a live "only 3 of 8 are implemented" brief.
It now serves as:
- a preserved record of the original command-coverage intent
- a pointer to the live effect-command surface
- a note about what is implemented versus what still needs deeper runtime follow-through

---

## Verified Current State

The repo now contains live command files for the effect families this task used to describe as missing:

- [`src/commands/effects/DamageCommand.ts`](../../../src/commands/effects/DamageCommand.ts)
- [`src/commands/effects/HealingCommand.ts`](../../../src/commands/effects/HealingCommand.ts)
- [`src/commands/effects/StatusConditionCommand.ts`](../../../src/commands/effects/StatusConditionCommand.ts)
- [`src/commands/effects/MovementCommand.ts`](../../../src/commands/effects/MovementCommand.ts)
- [`src/commands/effects/SummoningCommand.ts`](../../../src/commands/effects/SummoningCommand.ts)
- [`src/commands/effects/TerrainCommand.ts`](../../../src/commands/effects/TerrainCommand.ts)
- [`src/commands/effects/UtilityCommand.ts`](../../../src/commands/effects/UtilityCommand.ts)
- [`src/commands/effects/DefensiveCommand.ts`](../../../src/commands/effects/DefensiveCommand.ts)

The factory already routes to those commands:
- [`src/commands/factory/SpellCommandFactory.ts`](../../../src/commands/factory/SpellCommandFactory.ts)

This means the older "not implemented" list is no longer true as written.

---

## Important Divergences From The Original Task Brief

### Research path changed

The older version of this file referenced:
- `docs/architecture/@SPELL-SYSTEM-RESEARCH.md`

Use the current architecture surface instead:
- [`docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md`](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)

### Summoning and terrain are no longer placeholders only

The original brief treated `SummoningCommand` and `TerrainCommand` as mostly future placeholders.

What is true now:
- `SummoningCommand` already spawns combat characters into state
- `TerrainCommand` already modifies map tiles and environmental effects when map data is present

That does not mean those systems are feature-complete. It means the repo has gone beyond the old placeholder stage.

### Defensive coverage is still narrower than the type surface

The type layer supports more defensive semantics than the current command fully executes.
Examples worth treating as follow-through questions:
- resistance lifecycle
- immunity lifecycle
- broader reaction-timed defensive behavior

### Teleport and movement work exists, but still has edge-case notes

`MovementCommand` already implements push, pull, teleport, speed changes, and stop behavior.
It also still carries runtime TODOs around pathing and teleport-budget details.

---

## What To Treat As Current Authority

For current effect-command behavior, use:
- [`src/commands/effects`](../../../src/commands/effects)
- [`src/commands/factory/SpellCommandFactory.ts`](../../../src/commands/factory/SpellCommandFactory.ts)
- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts)

This file should be read as preserved task context, not as fresher truth than those live code paths.

---

## What Still Needs Follow-Through

### Highest-value runtime checks

- defensive effect cleanup and full defensive-type coverage
- terrain persistence and hazard behavior when map data is absent
- summon lifecycle and richer summon-management behavior
- effect-family test coverage aligned with the live command set

### Adjacent task dependency that changed shape

This file used to treat `IMPLEMENT-AOE-ALGORITHMS.md` as a pure prerequisite.
That doc is now itself a preserved implementation record because the AoE suite already exists.

---

## What Should No Longer Be Assumed

- that only damage, healing, and status-condition commands exist
- that the command factory still lacks movement, summoning, terrain, utility, or defensive routing
- that summoning and terrain remain purely conceptual placeholders
- that the broken `@SPELL-SYSTEM-RESEARCH.md` link is still a current reference

Use this file as preserved implementation context plus a pointer to the live effect-command layer.
