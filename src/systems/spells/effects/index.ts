// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 31/05/2026, 23:02:40
 * Dependents: hooks/combat/engine/useCombatEngine.ts, hooks/combat/useActionExecutor.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/systems/spells/effects/index.ts
 * 
 * Exports for spell effect processing system.
 */

export {
    // Types
    type ActiveSpellZone,
    type ScheduledSpellEffect,
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
    convertSpellEffectToProcessed,
    resetZoneTurnTracking,
    createSpellZone,
    createScheduledSpellEffect,
    createMovementDebuff
} from './triggerHandler';
