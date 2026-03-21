# Analyst: Object Targeting System Gap Analysis

**Status:** Active rebased gap note  
**Last Reverified:** 2026-03-11  
**Primary current references:** [`src/systems/spells/targeting/TargetResolver.ts`](../../../src/systems/spells/targeting/TargetResolver.ts), [`src/types/spells.ts`](../../../src/types/spells.ts), [`src/types/items.ts`](../../../src/types/items.ts)

---

## What This File Is

This is still a live gap note.

Unlike several older spell-overhaul task specs, this one describes a limitation that remains materially real in the current repo:
- the spell targeting surface knows about `"objects"` at the type level
- the live resolver still operates only on `CombatCharacter` targets

So this file remains useful as an active design note rather than only a historical implementation record.

---

## Verified Current State

### The gap is real

- [`src/types/spells.ts`](../../../src/types/spells.ts) includes `"objects"` in `TargetFilter`
- [`src/systems/spells/targeting/TargetResolver.ts`](../../../src/systems/spells/targeting/TargetResolver.ts) still accepts `target: CombatCharacter`
- the resolver's current `matchesTargetFilters` path explicitly returns `false` for `"objects"` when it is evaluating a `CombatCharacter`
- [`src/systems/spells/targeting/TargetValidationUtils.ts`](../../../src/systems/spells/targeting/TargetValidationUtils.ts) currently validates creature-oriented fields only

That means the current targeting stack does not yet provide a first-class path for object/item spell targets.

### Relevant adjacent surfaces do exist

- [`src/types/items.ts`](../../../src/types/items.ts) already defines `Item` and includes `weight`
- broader app surfaces already track location-scoped items outside the spell-targeting stack

### Important limit on current evidence

This pass did not verify a battle-map item-targeting flow that could already be reused for spell selection.
So the absence claim should stay narrow:
- object targeting is not currently supported by the verified spell resolver path

---

## Rebased Design Direction

### Recommendation: specialized object-targeting flow

The lower-risk direction still looks like:
- keep creature targeting in [`TargetResolver.ts`](../../../src/systems/spells/targeting/TargetResolver.ts)
- add a separate object-targeting validator/service for item targets
- let spell/UI selection decide whether a spell is choosing a creature target, an object target, or a point

This remains preferable to a wide `CombatCharacter | Item` union refactor unless a broader combat-target abstraction is intentionally planned.

### Type expansion still appears necessary

The current `TargetConditionFilter` surface does not yet include object-specific constraints like:
- object category/type
- min/max weight
- material constraints
- magical/non-magical constraints

If object-targeting spells become active work, those constraints likely need an explicit contract.

---

## Open Questions That Still Need Real Decisions

### 1. Corpse representation

Still unresolved:
- should a corpse be modeled as an item-like world object
- should it remain a creature-state artifact with a special dead/remains form

This matters for spells such as *Animate Dead*.

### 2. World-state integration

Still unresolved:
- where battle-relevant object targets live during combat
- how item positions are surfaced to spell-targeting UI
- whether the same path should handle dropped loot, map props, and remains

### 3. Command interface shape

Still unresolved:
- whether commands should receive `targetItemId`
- whether spell selection should resolve items before command creation
- whether summoning/transmutation flows need a richer target envelope than the current character-only shape

---

## What To Treat As Current Authority

For current object-targeting limitations, use:
- [`src/systems/spells/targeting/TargetResolver.ts`](../../../src/systems/spells/targeting/TargetResolver.ts)
- [`src/systems/spells/targeting/TargetValidationUtils.ts`](../../../src/systems/spells/targeting/TargetValidationUtils.ts)
- [`src/types/spells.ts`](../../../src/types/spells.ts)
- [`src/types/items.ts`](../../../src/types/items.ts)

This file should be read as a rebased active gap note, not as a claim that the full proposed object-targeting architecture has already been chosen.
