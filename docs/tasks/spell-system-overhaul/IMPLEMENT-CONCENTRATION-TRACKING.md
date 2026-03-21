# Task: Implement Concentration Tracking System

**Status:** Preserved task spec with current-status note  
**Last Reverified:** 2026-03-11  
**Primary live implementation:** [`src/commands/effects/ConcentrationCommands.ts`](../../../src/commands/effects/ConcentrationCommands.ts)

---

## Why This File Still Exists

This task spec is preserved because the concentration system it proposed now exists across the combat type layer, command layer, and damage flow.

It is no longer accurate as a "not started" task.

---

## Verified Current State

The repo already contains concentration tracking surfaces in several places:

### Types and mechanics

- [`src/types/combat.ts`](../../../src/types/combat.ts) includes `ConcentrationState`
- [`src/types/combat.ts`](../../../src/types/combat.ts) includes `CombatCharacter.concentratingOn`
- [`src/systems/spells/mechanics/ConcentrationTracker.ts`](../../../src/systems/spells/mechanics/ConcentrationTracker.ts) exists
- [`src/systems/spells/mechanics/__tests__/ConcentrationTracker.test.ts`](../../../src/systems/spells/mechanics/__tests__/ConcentrationTracker.test.ts) exists

### Command flow

- [`src/commands/effects/ConcentrationCommands.ts`](../../../src/commands/effects/ConcentrationCommands.ts) includes `StartConcentrationCommand` and `BreakConcentrationCommand`
- [`src/commands/factory/SpellCommandFactory.ts`](../../../src/commands/factory/SpellCommandFactory.ts) inserts concentration start/break commands
- [`src/commands/effects/DamageCommand.ts`](../../../src/commands/effects/DamageCommand.ts) checks concentration after damage and logs success/failure
- [`src/utils/character/concentrationUtils.ts`](../../../src/utils/character/concentrationUtils.ts) is the live concentration utility surface
- [`src/utils/concentrationUtils.ts`](../../../src/utils/concentrationUtils.ts) is now a deprecated bridge

### UI-adjacent surfaces

- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts) exports `dropConcentration`
- [`src/components/BattleMap/CharacterToken.tsx`](../../../src/components/BattleMap/CharacterToken.tsx) shows a concentration indicator
- [`src/components/BattleMap/ActionEconomyBar.tsx`](../../../src/components/BattleMap/ActionEconomyBar.tsx) already handles concentration sustain UI when `sustainCost` exists

This means the older "no system prevents multiple concentration spells / no concentration save mechanism exists / no command to drop concentration" framing is no longer true as written.

---

## Important Divergences From The Original Task Brief

### Utility path changed

The older version of this file proposed:
- `src/utils/concentrationUtils.ts`

What is true now:
- the live implementation sits under [`src/utils/character/concentrationUtils.ts`](../../../src/utils/character/concentrationUtils.ts)
- [`src/utils/concentrationUtils.ts`](../../../src/utils/concentrationUtils.ts) now exists as a deprecated bridge

### More cleanup logic exists than the older task assumed

`BreakConcentrationCommand` now does more than just clear a flag.
It already attempts to remove:
- linked riders
- linked status effects
- linked light sources
- linked summons

That is more advanced than the original minimal proposal.

### End-to-end UI proof is still narrower than the older task implies

What is verified:
- concentration indicators exist
- sustain UI exists
- `dropConcentration` exists in the hook

What was not reverified during this pass:
- a live BattleMap button or menu action that definitely calls `dropConcentration`

So the UI layer is not "missing entirely," but some end-to-end proof-of-life questions remain.

---

## What To Treat As Current Authority

For current concentration behavior, use:
- [`src/types/combat.ts`](../../../src/types/combat.ts)
- [`src/commands/effects/ConcentrationCommands.ts`](../../../src/commands/effects/ConcentrationCommands.ts)
- [`src/commands/effects/DamageCommand.ts`](../../../src/commands/effects/DamageCommand.ts)
- [`src/utils/character/concentrationUtils.ts`](../../../src/utils/character/concentrationUtils.ts)
- [`src/hooks/useAbilitySystem.ts`](../../../src/hooks/useAbilitySystem.ts)

This file should be read as preserved task context, not as fresher truth than the live combat and command layers.

---

## What Still Needs Follow-Through

### Live questions still worth checking

- whether every concentration-tied effect family is cleaned up consistently when concentration breaks
- whether the voluntary drop flow is fully exposed in the live BattleMap UI
- whether sustain-cost behavior is exercised and verified across actual concentration spells
- whether all duration and cleanup interactions match the intended combat turn lifecycle

### What is already no longer true

- "ConcentrationState is missing"
- "casting a new concentration spell does not break the old one"
- "damage does not trigger concentration checks"
- "there is no concentration UI signal at all"

---

## Reference Update

The older research path in this file was broken:
- `docs/architecture/@SPELL-SYSTEM-RESEARCH.md`

Use the current architecture surface instead:
- [`docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md`](../../architecture/SPELL_SYSTEM_ARCHITECTURE.md)

Use this file as preserved implementation context plus a pointer to the live concentration stack.
