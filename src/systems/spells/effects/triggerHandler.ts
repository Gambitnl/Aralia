/**
 * @file src/systems/spells/effects/triggerHandler.ts
 *
 * Re-export barrel for the spell trigger modules under ./trigger/.
 *
 * WHY THIS FILE IS A BARREL: MOD-3.3 split the original 1166-line handler into
 * trigger/types.ts (record shapes), trigger/areaTriggerProcessing.ts (area and
 * movement predicates and processors), trigger/effectConversion.ts (effect type
 * guards and SpellEffect -> ProcessedEffect conversion), and
 * trigger/zoneLifecycle.ts (zone/schedule/debuff factories and per-round reset).
 * This path stays the public entry point so none of the existing importers had
 * to move. New code may import the specific module directly; nothing is
 * deprecated here.
 *
 * Handles execution of spell effect triggers based on game events.
 * Supports the trigger types: on_enter_area, on_exit_area, on_end_turn_in_area,
 * on_start_turn_in_area, on_move_in_area, on_entity_proximity, on_target_move.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 09/09/2026, 14:28:33
 * Dependents: commands/effects/commandAreaMovementEffects.ts, commands/factory/AbilityCommandFactory.ts, components/BattleMap/BattleMapOverlay.tsx, components/BattleMap/vfx/VFXSystem.tsx, components/BattleMap/vfx/combatFeedback.tsx, components/BattleMap/vfx/spellEffects.tsx, components/Combat/MaplessTerrainSummary.tsx, hooks/ability/useAbilityExecution.ts, hooks/ability/useConcentration.ts, hooks/combat/useVisibility.ts, hooks/useAbilitySystem.ts, systems/spells/effects/AreaEffectTracker.ts, systems/spells/effects/index.ts, utils/combat/resistanceUtils.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type {
    ActiveSpellZone,
    MovementTriggerContext,
    MovementTriggerDebuff,
    ProcessedEffect,
    ProcessedEffectSourceContext,
    ScheduledSpellEffect,
    TriggerResult
} from './trigger/types';

export {
    isPositionInArea,
    matchesTargetFilter,
    processAreaEndTurnTriggers,
    processAreaEntryTriggers,
    processAreaExitTriggers,
    processAreaMoveWithinTriggers,
    processAreaProximityTriggers,
    processAreaStartTurnTriggers,
    processMovementTriggers,
    shouldTriggerForFrequency
} from './trigger/areaTriggerProcessing';

export { convertSpellEffectToProcessed } from './trigger/effectConversion';

export {
    createMovementDebuff,
    createScheduledSpellEffect,
    createSpellZone,
    createSpellZoneFromAoEParams,
    createTerrainSpellZoneFromAoEParams,
    recenterConjureAnimalsZonesForPackMove,
    resetZoneTurnTracking,
    resolveZoneDirection
} from './trigger/zoneLifecycle';
