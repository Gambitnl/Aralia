/**
 * @file src/systems/spells/effects/triggerHandler.ts
 * 
 * Handles execution of spell effect triggers based on game events.
 * Supports the new trigger types: on_enter_area, on_target_move
 */

import type { SpellEffect, EffectTrigger, EffectCondition, TargetConditionFilter } from '../../../types/spells';
import type { CombatCharacter, Position } from '../../../types/combat';

/**
 * Represents an active spell zone on the battlefield (e.g., Create Bonfire)
 */
export interface ActiveSpellZone {
    id: string;
    spellId: string;
    casterId: string;
    position: Position;
    areaOfEffect?: { shape: string; size: number };
    effects: SpellEffect[];
    /** Track entities that have already triggered "first_per_turn" effects this turn */
    triggeredThisTurn: Set<string>;
    expiresAtRound?: number;
}

/**
 * Represents a movement-triggered debuff on a target (e.g., Booming Blade)
 */
export interface MovementTriggerDebuff {
    id: string;
    spellId: string;
    casterId: string;
    targetId: string;
    effects: SpellEffect[];
    expiresAtRound: number;
    hasTriggered: boolean;
}

/**
 * Context for evaluating trigger conditions
 */
interface TriggerContext {
    round: number;
    movingCharacter?: CombatCharacter;
    enteredPosition?: Position;
    previousPosition?: Position;
}

/**
 * Result of processing a trigger
 */
export interface TriggerResult {
    triggered: boolean;
    effects: ProcessedEffect[];
}

export interface ProcessedEffect {
    type: 'damage' | 'heal' | 'status_condition';
    value?: number;
    dice?: string;
    damageType?: string;
    statusName?: string;
    requiresSave?: boolean;
    saveType?: string;
    saveEffect?: string;
}

/**
 * Check if an effect's targetFilter matches the target creature
 */
export function matchesTargetFilter(
    filter: TargetConditionFilter | undefined,
    target: CombatCharacter
): boolean {
    if (!filter) return true; // No filter means effect applies to all

    // Check creature type
    if (filter.creatureType && filter.creatureType.length > 0) {
        const targetType = (target as any).creatureType || 'Humanoid';
        if (!filter.creatureType.includes(targetType)) {
            return false;
        }
    }

    // Check size (if target has size property)
    if (filter.size && filter.size.length > 0) {
        const targetSize = (target as any).size || 'Medium';
        if (!filter.size.includes(targetSize)) {
            return false;
        }
    }

    // Check alignment (if target has alignment property)
    if (filter.alignment && filter.alignment.length > 0) {
        const targetAlignment = (target as any).alignment;
        if (targetAlignment && !filter.alignment.includes(targetAlignment)) {
            return false;
        }
    }

    return true;
}

/**
 * Check if a position is within an area of effect
 */
export function isPositionInArea(
    position: Position,
    zonePosition: Position,
    areaOfEffect: { shape: string; size: number }
): boolean {
    const dx = Math.abs(position.x - zonePosition.x);
    const dy = Math.abs(position.y - zonePosition.y);
    const sizeInTiles = Math.ceil(areaOfEffect.size / 5); // Convert feet to tiles

    switch (areaOfEffect.shape.toLowerCase()) {
        case 'cube':
        case 'square':
            return dx < sizeInTiles && dy < sizeInTiles;
        case 'sphere':
        case 'circle':
            return Math.sqrt(dx * dx + dy * dy) <= sizeInTiles;
        case 'line':
            // Simplified line check - would need direction for full implementation
            return dx <= sizeInTiles && dy === 0;
        case 'cone':
            // Simplified cone check - would need direction for full implementation
            return dx <= sizeInTiles && Math.abs(dy) <= dx;
        default:
            // Default to cube-like behavior
            return dx < sizeInTiles && dy < sizeInTiles;
    }
}

/**
 * Process on_enter_area triggers when a character moves
 * 
 * @param zones - Active spell zones on the battlefield
 * @param character - The character that moved
 * @param newPosition - The position they moved to
 * @param previousPosition - Their previous position
 * @param round - Current combat round
 * @returns Array of trigger results for effects that should fire
 */
export function processAreaEntryTriggers(
    zones: ActiveSpellZone[],
    character: CombatCharacter,
    newPosition: Position,
    previousPosition: Position,
    round: number
): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const zone of zones) {
        if (!zone.areaOfEffect) continue;

        const wasInZone = isPositionInArea(previousPosition, zone.position, zone.areaOfEffect);
        const isNowInZone = isPositionInArea(newPosition, zone.position, zone.areaOfEffect);

        // Only trigger on actual entry (wasn't in zone before, is now)
        if (!wasInZone && isNowInZone) {
            const entryEffects = zone.effects.filter(effect =>
                effect.trigger?.type === 'on_enter_area'
            );

            for (const effect of entryEffects) {
                const frequency = effect.trigger?.frequency || 'every_time';

                // Check frequency constraints
                if (frequency === 'first_per_turn') {
                    const triggerKey = `${character.id}-${zone.id}`;
                    if (zone.triggeredThisTurn.has(triggerKey)) {
                        continue; // Already triggered this turn
                    }
                    zone.triggeredThisTurn.add(triggerKey);
                } else if (frequency === 'once') {
                    const triggerKey = `${character.id}-${zone.id}-once`;
                    if (zone.triggeredThisTurn.has(triggerKey)) {
                        continue; // Already triggered ever
                    }
                    zone.triggeredThisTurn.add(triggerKey);
                }

                // Check target filter
                if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                    continue;
                }

                results.push({
                    triggered: true,
                    effects: convertSpellEffectToProcessed(effect)
                });
            }
        }
    }

    return results;
}

/**
 * Process on_target_move triggers when a character with a movement debuff moves
 * 
 * @param debuffs - Active movement-triggered debuffs
 * @param character - The character that moved
 * @param round - Current combat round
 * @returns Array of trigger results for effects that should fire
 */
export function processMovementTriggers(
    debuffs: MovementTriggerDebuff[],
    character: CombatCharacter,
    round: number
): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const debuff of debuffs) {
        // Only process debuffs on this character that haven't triggered and haven't expired
        if (debuff.targetId !== character.id) continue;
        if (debuff.hasTriggered) continue;
        if (debuff.expiresAtRound < round) continue;

        const moveTriggerEffects = debuff.effects.filter(effect =>
            effect.trigger?.type === 'on_target_move'
        );

        for (const effect of moveTriggerEffects) {
            // Check target filter (though movement debuffs are usually on a specific target)
            if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                continue;
            }

            results.push({
                triggered: true,
                effects: convertSpellEffectToProcessed(effect)
            });

            // Mark as triggered (most movement triggers are one-shot)
            debuff.hasTriggered = true;
        }
    }

    return results;
}

/**
 * Convert a SpellEffect to a ProcessedEffect for the combat system
 */
function convertSpellEffectToProcessed(effect: SpellEffect): ProcessedEffect[] {
    const processed: ProcessedEffect[] = [];

    switch (effect.type) {
        case 'DAMAGE':
            processed.push({
                type: 'damage',
                dice: (effect as any).damage?.dice,
                damageType: (effect as any).damage?.type,
                requiresSave: effect.condition?.type === 'save',
                saveType: effect.condition?.saveType,
                saveEffect: effect.condition?.saveEffect
            });
            break;

        case 'HEALING':
            processed.push({
                type: 'heal',
                dice: (effect as any).healing?.dice
            });
            break;

        case 'STATUS_CONDITION':
            processed.push({
                type: 'status_condition',
                statusName: (effect as any).statusCondition?.name,
                requiresSave: effect.condition?.type === 'save',
                saveType: effect.condition?.saveType,
                saveEffect: effect.condition?.saveEffect
            });
            break;
    }

    return processed;
}

/**
 * Reset turn-based tracking for all zones (call at start of each round)
 */
export function resetZoneTurnTracking(zones: ActiveSpellZone[]): void {
    for (const zone of zones) {
        zone.triggeredThisTurn.clear();
    }
}

/**
 * Create an ActiveSpellZone from a spell cast
 */
export function createSpellZone(
    spellId: string,
    casterId: string,
    position: Position,
    areaOfEffect: { shape: string; size: number },
    effects: SpellEffect[],
    currentRound: number,
    durationRounds?: number
): ActiveSpellZone {
    return {
        id: `zone-${spellId}-${Date.now()}`,
        spellId,
        casterId,
        position,
        areaOfEffect,
        effects: effects.filter(e =>
            e.trigger?.type === 'on_enter_area' ||
            e.trigger?.type === 'turn_end' ||
            e.trigger?.type === 'turn_start'
        ),
        triggeredThisTurn: new Set(),
        expiresAtRound: durationRounds ? currentRound + durationRounds : undefined
    };
}

/**
 * Create a MovementTriggerDebuff from a spell hit
 */
export function createMovementDebuff(
    spellId: string,
    casterId: string,
    targetId: string,
    effects: SpellEffect[],
    currentRound: number,
    durationRounds: number = 1
): MovementTriggerDebuff {
    return {
        id: `debuff-${spellId}-${targetId}-${Date.now()}`,
        spellId,
        casterId,
        targetId,
        effects: effects.filter(e => e.trigger?.type === 'on_target_move'),
        expiresAtRound: currentRound + durationRounds,
        hasTriggered: false
    };
}
