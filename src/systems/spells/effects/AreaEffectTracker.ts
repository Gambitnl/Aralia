/**
 * @file src/systems/spells/effects/AreaEffectTracker.ts
 * 
 * Centralized tracking for active spell zones.
 * Manages entry, exit, and end-of-turn triggers for area effects.
 * Emits combat events for zone interactions.
 */

import { combatEvents } from '../../events/CombatEvents';
import {
    convertSpellEffectToProcessed,
    shouldTriggerForFrequency,
    matchesTargetFilter,
    isPositionInArea,
    ActiveSpellZone,
    TriggerResult
} from './triggerHandler';
import { CombatCharacter, Position } from '../../../types/combat';

export class AreaEffectTracker {
    private zones: ActiveSpellZone[] = [];

    constructor(initialZones: ActiveSpellZone[] = []) {
        this.zones = initialZones;
    }

    /**
     * Update the list of active zones.
     */
    public setZones(zones: ActiveSpellZone[]) {
        this.zones = zones;
    }

    /**
     * Get current active zones.
     */
    public getZones(): ActiveSpellZone[] {
        return this.zones;
    }

    /**
     * Handle character movement events, processing both exit and entry triggers.
     * Use this when a character completes a move step.
     */
    public handleMovement(
        character: CombatCharacter,
        newPosition: Position,
        previousPosition: Position,
        currentRound: number
    ): TriggerResult[] {
        const results: TriggerResult[] = [];

        // Process Exits first
        const exitResults = this.processExit(character, newPosition, previousPosition);
        results.push(...exitResults);

        // Process Entries second
        const entryResults = this.processEntry(character, newPosition, previousPosition, currentRound);
        results.push(...entryResults);

        // Process Movement Within third
        const movementResults = this.processMovementWithin(character, newPosition, previousPosition, currentRound);
        results.push(...movementResults);

        return results;
    }

    /**
     * Process triggers when a character moves within an area.
     * Used by spells like Spike Growth that damage "for every 5 feet traveled within the area".
     * TODO(Analyst): Migrate Spike Growth and similar spells from simple 'TERRAIN' effects to use this 'on_move_in_area' Zone capability.
     */
    public processMovementWithin(
        character: CombatCharacter,
        newPosition: Position,
        previousPosition: Position,
        currentRound: number
    ): TriggerResult[] {
        const results: TriggerResult[] = [];

        for (const zone of this.zones) {
            if (!zone.areaOfEffect) continue;

            const wasInZone = isPositionInArea(previousPosition, zone.position, zone.areaOfEffect);
            const isNowInZone = isPositionInArea(newPosition, zone.position, zone.areaOfEffect);

            // Trigger if moving *within* the zone (start and end are both in)
            if (wasInZone && isNowInZone) {
                const moveEffects = zone.effects.filter(effect =>
                    effect.trigger?.type === 'on_move_in_area'
                );

                for (const effect of moveEffects) {
                    if (!shouldTriggerForFrequency(effect.trigger?.frequency, zone, character.id)) {
                        continue;
                    }

                    if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                        continue;
                    }

                    results.push({
                        triggered: true,
                        effects: convertSpellEffectToProcessed(effect),
                        triggerType: 'on_move_in_area'
                    });
                }
            }
        }

        return results;
    }

    /**
     * Process triggers when a character enters an area.
     * Emits `unit_enter_area` event.
     */
    public processEntry(
        character: CombatCharacter,
        newPosition: Position,
        previousPosition: Position,
        currentRound: number
    ): TriggerResult[] {
        const results: TriggerResult[] = [];

        for (const zone of this.zones) {
            if (!zone.areaOfEffect) continue;

            const wasInZone = isPositionInArea(previousPosition, zone.position, zone.areaOfEffect);
            const isNowInZone = isPositionInArea(newPosition, zone.position, zone.areaOfEffect);

            if (!wasInZone && isNowInZone) {
                // Emit event regardless of whether there are effects
                combatEvents.emit({
                    type: 'unit_enter_area',
                    unitId: character.id,
                    zoneId: zone.id,
                    spellId: zone.spellId,
                    position: newPosition
                });

                const entryEffects = zone.effects.filter(effect =>
                    effect.trigger?.type === 'on_enter_area'
                );

                for (const effect of entryEffects) {
                    if (!shouldTriggerForFrequency(effect.trigger?.frequency, zone, character.id)) {
                        continue;
                    }

                    if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                        continue;
                    }

                    results.push({
                        triggered: true,
                        effects: convertSpellEffectToProcessed(effect),
                        triggerType: 'on_enter_area'
                    });
                }
            }
        }

        return results;
    }

    /**
     * Process triggers when a character exits an area.
     * Emits `unit_exit_area` event.
     */
    public processExit(
        character: CombatCharacter,
        newPosition: Position,
        previousPosition: Position
    ): TriggerResult[] {
        const results: TriggerResult[] = [];

        for (const zone of this.zones) {
            if (!zone.areaOfEffect) continue;

            const wasInZone = isPositionInArea(previousPosition, zone.position, zone.areaOfEffect);
            const isNowInZone = isPositionInArea(newPosition, zone.position, zone.areaOfEffect);

            if (wasInZone && !isNowInZone) {
                // Emit event
                combatEvents.emit({
                    type: 'unit_exit_area',
                    unitId: character.id,
                    zoneId: zone.id,
                    spellId: zone.spellId,
                    position: newPosition
                });

                const exitEffects = zone.effects.filter(effect =>
                    effect.trigger?.type === 'on_exit_area'
                );

                for (const effect of exitEffects) {
                    if (!shouldTriggerForFrequency(effect.trigger?.frequency, zone, character.id)) {
                        continue;
                    }

                    if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                        continue;
                    }

                    results.push({
                        triggered: true,
                        effects: convertSpellEffectToProcessed(effect),
                        triggerType: 'on_exit_area'
                    });
                }
            }
        }

        return results;
    }

    /**
     * Process triggers when a character ends their turn in an area.
     */
    public processEndTurn(
        character: CombatCharacter,
        currentRound: number
    ): TriggerResult[] {
        const results: TriggerResult[] = [];

        for (const zone of this.zones) {
            if (!zone.areaOfEffect) continue;

            const isInZone = isPositionInArea(character.position, zone.position, zone.areaOfEffect);

            if (isInZone) {
                const endTurnEffects = zone.effects.filter(effect =>
                    effect.trigger?.type === 'on_end_turn_in_area' ||
                    // Legacy support for plain 'turn_end' if needed, though strictly that might be global.
                    // Assuming 'turn_end' on a zone effect implies 'in area' context for now.
                    effect.trigger?.type === 'turn_end'
                );

                for (const effect of endTurnEffects) {
                    if (!shouldTriggerForFrequency(effect.trigger?.frequency, zone, character.id)) {
                        continue;
                    }

                    if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                        continue;
                    }

                    results.push({
                        triggered: true,
                        effects: convertSpellEffectToProcessed(effect),
                        triggerType: 'on_end_turn_in_area'
                    });
                }
            }
        }

        return results;
    }

    /**
     * Reset turn-based tracking for all managed zones.
     */
    public resetTurnTracking() {
        for (const zone of this.zones) {
            zone.triggeredThisTurn.clear();
        }
    }
}
