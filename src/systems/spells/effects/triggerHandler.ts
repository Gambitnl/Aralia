/**
 * @file src/systems/spells/effects/triggerHandler.ts
 * 
 * Handles execution of spell effect triggers based on game events.
 * Supports the new trigger types: on_enter_area, on_exit_area, on_end_turn_in_area, on_target_move
 */
// TODO(lint-intent): 'EffectCondition' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import type { SpellEffect, EffectTrigger, EffectCondition as _EffectCondition, TargetConditionFilter } from '../../../types/spells';
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
    /** Track entities that should only ever trigger once (per creature) for this zone */
    triggeredEver: Set<string>;
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
// TODO(lint-intent): 'TriggerContext' is declared but unused, suggesting an unfinished state/behavior hook in this block.
// TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
// TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
interface _TriggerContext {
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
    sourceId?: string;
    triggerType?: 'on_enter_area' | 'on_exit_area' | 'on_end_turn_in_area' | 'on_move_in_area' | 'on_target_move';
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
    // TODO(2026-01-03 pass 4 Codex-CLI): target details cast until CombatCharacter exposes creatureType/size/alignment.
    const targetDetails = target as Partial<CombatCharacter> & { creatureType?: string; size?: string; alignment?: string };

    // Check creature type
    if (filter.creatureType && filter.creatureType.length > 0) {
        // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
        // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
        // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
        const targetType = targetDetails.creatureType || 'Humanoid';
        if (!filter.creatureType.includes(targetType)) {
            return false;
        }
    }

    // Check size (if target has size property)
    if (filter.size && filter.size.length > 0) {
        // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
        // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
        // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
        const targetSize = targetDetails.size || 'Medium';
        if (!filter.size.includes(targetSize)) {
            return false;
        }
    }

    // Check alignment (if target has alignment property)
    if (filter.alignment && filter.alignment.length > 0) {
        // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
        // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
        // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
        const targetAlignment = targetDetails.alignment;
        if (targetAlignment && !filter.alignment.includes(targetAlignment)) {   
            return false;
        }
    }

    return true;
}

type TriggerFrequency = EffectTrigger['frequency'] | undefined;

/**
 * Frequency helper so entry/exit/end-turn triggers share the same guard rails.
 * We keep per-turn and per-encounter tracking separate to avoid clearing "once"
 * triggers when the round advances.
 * 
 * - `every_time`: Triggers every time the event occurs (default).
 * - `first_per_turn`: Triggers once per creature per turn.
 * - `once`: Triggers only ONCE for the entire zone, regardless of who triggers it.
 * - `once_per_creature`: Triggers once per unique creature interacting with the zone.
 */
export function shouldTriggerForFrequency(
    frequency: TriggerFrequency,
    zone: ActiveSpellZone,
    characterId: string
): boolean {
    const mode = frequency || 'every_time';

    if (mode === 'first_per_turn') {
        // Key includes characterId: each creature can trigger once per turn
        const perTurnKey = `${characterId}-${zone.id}`;
        if (zone.triggeredThisTurn.has(perTurnKey)) return false;
        zone.triggeredThisTurn.add(perTurnKey);
        return true;
    }

    if (mode === 'once') {
        // Key uses ONLY zone.id: triggers once for entire spell zone, period
        const onceGlobalKey = `${zone.id}-once`;
        if (zone.triggeredEver.has(onceGlobalKey)) return false;
        zone.triggeredEver.add(onceGlobalKey);
        return true;
    }

    if (mode === 'once_per_creature') {
        // Key includes characterId: each creature can trigger once for the zone's lifetime
        const oncePerCreatureKey = `${characterId}-${zone.id}-once`;
        if (zone.triggeredEver.has(oncePerCreatureKey)) return false;
        zone.triggeredEver.add(oncePerCreatureKey);
        return true;
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
    // TODO(SPELL-OVERHAUL): Replace simplified line/cone checks with direction-aware AoE math (see docs/tasks/spell-system-overhaul/TODO.md; if this block is moved/refactored/modularized, update the TODO entry path).
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
    // TODO(lint-intent): 'round' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    _round: number
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
                if (!shouldTriggerForFrequency((effect.trigger as any)?.frequency, zone, character.id)) {
                    continue;
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
                effects: convertSpellEffectToProcessed(effect),
                sourceId: debuff.id
            });

            // Mark as triggered (most movement triggers are one-shot)
            debuff.hasTriggered = true;
        }
    }

    return results;
}

/**
 * Process on_exit_area triggers when a character leaves a zone.
 */
export function processAreaExitTriggers(
    zones: ActiveSpellZone[],
    character: CombatCharacter,
    newPosition: Position,
    previousPosition: Position
): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const zone of zones) {
        if (!zone.areaOfEffect) continue;

        const wasInZone = isPositionInArea(previousPosition, zone.position, zone.areaOfEffect);
        const isNowInZone = isPositionInArea(newPosition, zone.position, zone.areaOfEffect);

        // Only trigger on actual exit (was in zone, now out)
        if (wasInZone && !isNowInZone) {
            const exitEffects = zone.effects.filter(effect =>
                effect.trigger?.type === 'on_exit_area'
            );

            for (const effect of exitEffects) {
                if (!shouldTriggerForFrequency((effect.trigger as any)?.frequency, zone, character.id)) {
                    continue;
                }

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
 * Process on_end_turn_in_area triggers when a character ends their turn inside a zone.
 */
export function processAreaEndTurnTriggers(
    zones: ActiveSpellZone[],
    character: CombatCharacter,
    _round: number
): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const zone of zones) {
        if (!zone.areaOfEffect) continue;

        const isInZone = isPositionInArea(character.position, zone.position, zone.areaOfEffect);
        if (!isInZone) continue;

        const endTurnEffects = zone.effects.filter(effect =>
            effect.trigger?.type === 'on_end_turn_in_area' ||
            effect.trigger?.type === 'turn_end'
        );

        for (const effect of endTurnEffects) {
            if (!shouldTriggerForFrequency((effect.trigger as any)?.frequency, zone, character.id)) {
                continue;
            }

            if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                continue;
            }

            results.push({
                triggered: true,
                effects: convertSpellEffectToProcessed(effect)
            });
        }
    }

    return results;
}

/**
 * Convert a SpellEffect to a ProcessedEffect for the combat system
 */
export function convertSpellEffectToProcessed(effect: SpellEffect): ProcessedEffect[] {
    const processed: ProcessedEffect[] = [];
    // TODO(2026-01-03 pass 4 Codex-CLI): SpellEffect detail casting until spell data schema is formalized.
    const effectDetails = effect as unknown as {
        damage?: { dice?: string; type?: string };
        healing?: { dice?: string };
        condition?: { type?: string; saveType?: string; saveEffect?: string };
    };

    // TODO: Include source metadata (spellId, casterId, optional saveDC) on ProcessedEffect 
    // to avoid downstream guesswork in handlers. Currently, handlers must re-lookup the 
    // caster to calculate spell DC, which is fragile if the caster has left combat.
    switch (effect.type) {
        case 'DAMAGE':
            processed.push({
                type: 'damage',
                // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
                // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
                // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
                dice: effectDetails.damage?.dice,
                // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
                // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
                // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
                damageType: effectDetails.damage?.type,
                requiresSave: effectDetails.condition?.type === 'save',
                saveType: effectDetails.condition?.saveType,
                saveEffect: effectDetails.condition?.saveEffect
            });
            break;

        case 'HEALING':
            processed.push({
                type: 'heal',
                // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
                // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
                // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
                dice: effectDetails.healing?.dice
            });
            break;

        case 'STATUS_CONDITION':
            // TODO(2026-01-03 pass 4 Codex-CLI): SpellEffect.statusCondition typing is loose; casting for now.
            const statusEffect = effect as unknown as {
                statusCondition?: { name?: string };
                condition?: { type?: string; saveType?: string; saveEffect?: string };
            };
            processed.push({
                type: 'status_condition',
                // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
                // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
                // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
                statusName: statusEffect.statusCondition?.name,
                requiresSave: statusEffect.condition?.type === 'save',
                saveType: statusEffect.condition?.saveType,
                saveEffect: statusEffect.condition?.saveEffect
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
            (e.trigger as any)?.type === 'on_enter_area' ||
            (e.trigger as any)?.type === 'on_exit_area' ||
            (e.trigger as any)?.type === 'on_end_turn_in_area' ||
            (e.trigger as any)?.type === 'on_move_in_area' ||
            (e.trigger as any)?.type === 'turn_end' ||
            (e.trigger as any)?.type === 'turn_start'
        ),
        triggeredThisTurn: new Set(),
        triggeredEver: new Set(),
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
