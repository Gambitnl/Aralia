# Task: Implement Complete AoE Algorithm Suite

**Status:** Preserved task spec with current-status note  
**Last Reverified:** 2026-03-11  
**Primary live implementation:** [`src/systems/spells/targeting/AoECalculator.ts`](../../../src/systems/spells/targeting/AoECalculator.ts)

---

## Why This File Still Exists

This task spec is preserved because the AoE suite it proposed now exists and still explains why cone, cube, line, sphere, and cylinder handling mattered during the spell-system overhaul.

It is no longer accurate as a "not started" task.

---

## Verified Current State

The repo already contains an AoE calculation surface plus shape-specific implementations:

- [`src/systems/spells/targeting/AoECalculator.ts`](../../../src/systems/spells/targeting/AoECalculator.ts)
- [`src/systems/spells/targeting/gridAlgorithms/sphere.ts`](../../../src/systems/spells/targeting/gridAlgorithms/sphere.ts)
- [`src/systems/spells/targeting/gridAlgorithms/cone.ts`](../../../src/systems/spells/targeting/gridAlgorithms/cone.ts)
- [`src/systems/spells/targeting/gridAlgorithms/cube.ts`](../../../src/systems/spells/targeting/gridAlgorithms/cube.ts)
- [`src/systems/spells/targeting/gridAlgorithms/line.ts`](../../../src/systems/spells/targeting/gridAlgorithms/line.ts)
- [`src/systems/spells/targeting/gridAlgorithms/cylinder.ts`](../../../src/systems/spells/targeting/gridAlgorithms/cylinder.ts)

The current hook flow already delegates AoE preview work instead of relying on inline sphere-only math:
- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts)
- [`src/utils/aoeCalculations.ts`](../../../src/utils/aoeCalculations.ts)
- [`src/utils/targetingUtils.ts`](../../../src/utils/targetingUtils.ts)

Current test surfaces exist at:
- [`src/systems/spells/targeting/__tests__/AoECalculator.test.ts`](../../../src/systems/spells/targeting/__tests__/AoECalculator.test.ts)
- [`src/systems/spells/targeting/__tests__/sphere.test.ts`](../../../src/systems/spells/targeting/__tests__/sphere.test.ts)

---

## Important Divergences From The Original Task Brief

### Implementation location changed

The older version of this file proposed a new utility at:
- `src/utils/aoeCalculations.ts`

What is true now:
- the live implementation sits under [`src/systems/spells/targeting`](../../../src/systems/spells/targeting)
- [`src/utils/aoeCalculations.ts`](../../../src/utils/aoeCalculations.ts) is now a deprecated bridge layer, not the authoritative home of the AoE logic

### The hook has already been refactored

The older version treated `useAbilitySystem.ts` as the place where sphere-only logic still lived.
That is no longer true.
The hook already imports AoE helpers and resolves preview parameters through shared utilities.

### The current cone implementation is not the same as the older proposed math

The older brief proposed a 53-degree angle model.
The current code documents and implements a different cone interpretation in the live grid-algorithm layer.

That means this file is no longer a perfect description of the algorithm the repo actually uses.
Any future rule-fidelity work should compare the live implementation against the desired D&D template behavior rather than assuming the older proposal was what landed.

### Test paths changed

The older version proposed tests under:
- `src/utils/__tests__/aoeCalculations.test.ts`

Use the current targeting-test surface instead:
- [`src/systems/spells/targeting/__tests__`](../../../src/systems/spells/targeting/__tests__)

---

## What To Treat As Current Authority

For current AoE behavior, use:
- [`src/systems/spells/targeting/AoECalculator.ts`](../../../src/systems/spells/targeting/AoECalculator.ts)
- [`src/systems/spells/targeting/gridAlgorithms`](../../../src/systems/spells/targeting/gridAlgorithms)
- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts)

This file should be read as preserved implementation context, not as fresher truth than the current targeting code.

---

## What Still Needs Follow-Through

### Live correctness questions worth checking

- exact rule fidelity of the cone implementation
- line-width semantics versus the current spell data surface
- edge-case behavior near map bounds
- whether the deprecated utility bridges should eventually be removed once imports are fully normalized

### What is already not true anymore

- "only sphere exists"
- "the hook still owns the only AoE logic"
- "the suite has not started"

---

## Reference Update

The older research path in this file was broken:
- `docs/architecture/@SPELL-SYSTEM-RESEARCH.md`

Use the current architecture surface instead:
- [`docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md`](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)

Use this file as preserved implementation context plus a pointer to the live AoE stack.
