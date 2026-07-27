/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 23/07/2026, 20:43:33
 * Dependents: hooks/combat/engine/useCombatEngine.ts, hooks/combat/useActionExecutor.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/spells/effects/index.ts
 *
 * Exports for spell effect processing system.
 */
export { type ActiveSpellZone, type ScheduledSpellEffect, type MovementTriggerDebuff, type TriggerResult, type ProcessedEffect, matchesTargetFilter, isPositionInArea, processAreaEntryTriggers, processAreaExitTriggers, processAreaEndTurnTriggers, processMovementTriggers, convertSpellEffectToProcessed, resetZoneTurnTracking, recenterConjureAnimalsZonesForPackMove, createSpellZone, createScheduledSpellEffect, createMovementDebuff } from './triggerHandler';
