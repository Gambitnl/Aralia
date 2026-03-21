# Combat

## Purpose

The Combat domain handles tactical encounter execution: turn flow, action resolution, spell and ability use, movement, targeting, damage, conditions, and combat-facing UI state.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/components/Combat/
- src/hooks/useAbilitySystem.ts
- src/hooks/combat/
- src/systems/combat/
- src/systems/events/CombatEvents.ts
- src/utils/combatUtils.ts
- src/types/combat.ts

## Current Domain Shape

The combat domain currently spans several layers:
- combat UI surfaces under src/components/Combat/
- orchestration hooks under src/hooks/combat/ and src/hooks/useAbilitySystem.ts
- combat subsystems under src/systems/combat/
- supporting event and rules utilities under src/systems/events/ and src/utils/

Verified subsystem names referenced in this pass include:
- AttackEventEmitter
- AttackRiderSystem
- MovementEventEmitter
- SavePenaltySystem
- SustainActionSystem

## Boundaries And Constraints

- Combat state should be updated through the established action and command flow rather than ad hoc component mutation.
- Combat depends heavily on spell, character, and map data, but it should remain the execution layer rather than the owner of those upstream domains.
- Multiple utility paths now exist for movement, line of sight, targeting, saving throws, and area-of-effect math, so path-level ownership claims need to be made carefully instead of assuming one canonical helper file for every rule.

## Historical Drift Corrected

The older version of this file was broadly right about the domain, but it drifted toward a too-neat ownership map:
- several helper names now exist in more than one utility lane
- some file listings were too specific for a system that has continued to branch
- the document read closer to an exhaustive ownership index than a stable domain map

## What Is Materially Implemented

This pass verified that the combat domain already has:
- dedicated combat UI surfaces
- dedicated combat hooks
- a systems/combat subsystem lane
- event infrastructure
- action-economy, line-of-sight, targeting, area-of-effect, and saving-throw utility surfaces
- spell-aware combat orchestration through useAbilitySystem

## Open Follow-Through Questions

- Which combat utility duplicates should be documented as intentional layering versus technical debt?
- Which combat docs should point to battle-map integration explicitly instead of implying combat owns all map rendering concerns?
- Which combat rule surfaces need tighter current-state documentation for reactions, bonus actions, and sustained actions?
