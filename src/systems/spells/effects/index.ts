/**
 * @file src/systems/spells/effects/index.ts
 * 
 * Exports for spell effect processing system.
 */

export {
    // Types
    type ActiveSpellZone,
    type MovementTriggerDebuff,
    type TriggerResult,
    type ProcessedEffect,

    // Functions
    matchesTargetFilter,
    isPositionInArea,
    processAreaEntryTriggers,
    processAreaExitTriggers,
    processAreaEndTurnTriggers,
    processMovementTriggers,
    resetZoneTurnTracking,
    createSpellZone,
    createMovementDebuff
} from './triggerHandler';
