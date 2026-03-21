# Priority: Schema Evolution for Spell System

**Status:** Active rebased gap audit  
**Last Reverified:** 2026-03-11  
**Preservation note:** This file started as a late-2025 blocker memo. It is preserved because it still identifies useful spell-schema concerns, but many of the originally "missing" fields now exist in the current type and validator layers.

---

## What This File Is

This is no longer a pure "everything below is missing" document.

It is now a checked list of schema and runtime concerns that still need explicit re-verification before they can be treated as fully closed across spell migration work.

Primary current references:
- [`docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md`](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)
- [`src/types/spells.ts`](../../../src/types/spells.ts)
- [`src/systems/spells/validation/spellValidator.ts`](../../../src/systems/spells/validation/spellValidator.ts)
- [`src/commands/factory/SpellCommandFactory.ts`](../../../src/commands/factory/SpellCommandFactory.ts)
- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts)

---

## Verified Current State

The current repo already contains schema or typing support for several areas that this memo originally described as absent.

### Present in the type and validator layers

- trigger vocabulary now includes:
  - `on_attack_hit`
  - `on_enter_area`
  - `on_exit_area`
  - `on_end_turn_in_area`
  - `on_target_move`
  - `on_target_attack`
  - `on_target_cast`
  - `on_caster_action`
- repeat-save structures exist in the validator layer
- target filtering exists, including creature-type fields
- structured rider/utility fields exist such as `attackAugments`
- save-penalty support exists
- defensive AC fields exist, including `acBonus`, `baseACFormula`, and `acMinimum`
- summoning-related structures exist, including `SummoningEffect` and `FamiliarContract`

### Present in the runtime layer

- command execution infrastructure exists under [`src/commands`](../../../src/commands)
- `SpellCommandFactory` already branches on reactive triggers and attack-hit riders
- `useAbilitySystem` already uses `SpellCommandFactory` plus `CommandExecutor`

---

## Still-Open Questions Worth Treating As Live

These are the areas that still merit active attention. The distinction now is that they are not automatically "schema missing" problems; some are runtime or integration questions.

### 1. Rider consumption semantics

Still worth checking:
- whether first-hit vs repeat-hit vs per-turn consumption is fully modeled and used consistently at runtime
- whether every migrated rider spell uses the same structured contract

### 2. Runtime repeat-save behavior

Still worth checking:
- whether repeat-save schema is exercised consistently in combat flow
- whether modifiers such as conditional advantage are wired end-to-end, not just typed

### 3. Area entry and boundary handling

Still worth checking:
- whether all area trigger variants are treated as persistent hazards rather than falling through to immediate execution
- whether per-creature frequency limits stay correct in actual combat flow

### 4. Summoning beyond schema presence

Still worth checking:
- whether summon-specific runtime management is complete
- whether command/UI follow-through exists for the richer summon contracts now expressible in types

### 5. Defensive and reaction timing

Still worth checking:
- reaction-timed AC effects
- retroactive "would this hit after Shield?" style resolution
- stacking behavior when multiple defensive surfaces interact

---

## Rebased Priority View

### Highest-value checks

- rider consumption and hit-registration behavior
- repeat-save execution in combat
- persistent area trigger handling
- reaction AC timing and stacking

### Lower-priority or future-heavy work

- full summon-management UI and command economy
- broader advanced creature-filter mechanics that exceed the currently verified use cases

---

## Historical Notes

What remains useful from the older version:
- it correctly identified that spell migration would fail if schema growth and runtime growth drifted apart
- it surfaced the importance of riders, repeat saves, area triggers, summons, and AC logic early

What should no longer be assumed:
- that all seven areas below are still wholly missing
- that every problem listed here is primarily a schema problem
- that the original phased roadmap still reflects the current implementation surface

Use this file as a rebased gap-audit note, not as proof that the named fields are still absent.
