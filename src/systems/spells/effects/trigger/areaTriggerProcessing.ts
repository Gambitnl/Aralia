/**
 * @file src/systems/spells/effects/trigger/areaTriggerProcessing.ts
 *
 * Area and movement trigger predicates and processors: which occupants of a
 * spell zone fire which effects on entry, exit, movement, turn start/end, and
 * proximity.
 *
 * WHY THIS EXISTS: split out of triggerHandler.ts (MOD-3.3). AreaEffectTracker
 * still owns event emission; this module still owns pure effect filtering, which
 * is the same decision point the runtime path and the helper tests shared before
 * the split. Behavior is unchanged from the original file.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:28:33
 * Dependents: systems/spells/effects/triggerHandler.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { AreaOfEffect, EffectTrigger, SpellEffect, TargetConditionFilter } from '../../../../types/spells';
import type { CombatCharacter, Position } from '../../../../types/combat';
import { AoECalculator } from '../../targeting/AoECalculator';
import { getRecurringMechanics } from '../../../../hooks/spellEffectUtils';
import type { RecurringMechanic } from '../../../../types/spellEffectTypes';
import type {
    ActiveSpellZone,
    MovementTriggerContext,
    MovementTriggerDebuff,
    TriggerResult
} from './types';
import { convertSpellEffectToProcessed } from './effectConversion';

/**
 * Check if an effect's targetFilter matches the target creature
 */
export function matchesTargetFilter(
    filter: TargetConditionFilter | undefined,
    target: CombatCharacter
): boolean {
    if (!filter) return true; // No filter means effect applies to all

    const targetTypes = [
        ...(target.creatureTypes ?? []),
        ...(target.stats?.creatureTypes ?? [])
    ].filter((type): type is string => Boolean(type));

    // Check creature type
    if (filter.creatureType && filter.creatureType.length > 0) {
        const targetType = targetTypes[0] || 'Humanoid';
        if (!filter.creatureType.includes(targetType)) {
            return false;
        }
    }

    // Check size (if target has size property)
    if (filter.size && filter.size.length > 0) {
        const targetSize = target.stats?.size || 'Medium';
        if (!filter.size.includes(targetSize)) {
            return false;
        }
    }

    // Check alignment (if target has alignment property)
    if (filter.alignment && filter.alignment.length > 0) {
        const targetAlignment = target.alignment || target.stats?.alignment;
        if (targetAlignment && !filter.alignment.includes(targetAlignment)) {
            return false;
        }
    }

    return true;
}

type TriggerFrequency = EffectTrigger['frequency'] | undefined;

/**
 * The four frequency gates this module can actually execute.
 *
 * EffectTrigger.frequency is already limited to these. RecurringMechanic.frequency
 * is a source-backed string that may carry a label no gate implements, such as the
 * 'once_per_turn' default the proximity adapter passes. Narrowing here keeps the
 * authored label visible at the call site while the runtime keeps treating an
 * unimplemented label as 'every_time' - which is exactly what the removed
 * `as any` and `as TriggerFrequency` casts did. No label is promoted into a
 * stricter gate.
 */
const EXECUTABLE_TRIGGER_FREQUENCIES: readonly NonNullable<TriggerFrequency>[] = [
    'every_time',
    'first_per_turn',
    'once',
    'once_per_creature'
];

export function normalizeTriggerFrequency(frequency: string | undefined): TriggerFrequency {
    const executable = EXECUTABLE_TRIGGER_FREQUENCIES.find(candidate => candidate === frequency);
    return executable ?? 'every_time';
}

/**
 * Read an effect trigger's frequency gate where that gate is declared.
 *
 * Almost every effect declares `trigger: EffectTrigger`, which carries `frequency`.
 * ReactiveEffect overrides `trigger` with its own four reaction events and declares
 * no frequency, so the SpellEffect union has no shared `frequency` property. A
 * reaction trigger is never one of the area events gated here, so its gate is simply
 * absent - which is what the removed `as any` casts produced at runtime. The record
 * itself can also be missing in authored data, which is why every trigger read in
 * this module is optional.
 */
function triggerFrequencyOf(trigger: SpellEffect['trigger'] | undefined): TriggerFrequency {
    return trigger && 'frequency' in trigger ? trigger.frequency : undefined;
}

// Composite source labels are expanded only at the event boundary. Keeping the
// authored label in spell JSON preserves source fidelity while these sets let
// the existing area tracker execute each real event exactly once.
const AREA_ENTRY_TRIGGER_TYPES = new Set([
    'on_enter_area',
    'area_entry_or_turn_start',
    'area_entry_or_turn_end',
    'emanation_entry_or_turn_end'
]);
const AREA_START_TURN_TRIGGER_TYPES = new Set([
    'turn_start',
    'area_entry_or_turn_start'
]);
const AREA_END_TURN_TRIGGER_TYPES = new Set([
    'on_end_turn_in_area',
    'turn_end',
    'area_entry_or_turn_end',
    'emanation_entry_or_turn_end'
]);

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
    areaOfEffect: { shape: string; size: number },
    direction?: Position
): boolean {
    const normalizedShape = normalizeAreaShape(areaOfEffect.shape);

    // RULING 2026-09-13 (Q2, agora-79fa.3, GG-201): a cone or a line zone always
    // carries a direction. `resolveZoneDirection` in `zoneLifecycle.ts` gives the
    // zone the cast direction, or the caster facing, or it throws. The old
    // permissive distance-only fallback is deleted: it counted tiles behind and
    // beside the caster, which is wrong. A directionless cone or line zone can
    // only come from a caller that builds an `ActiveSpellZone` by hand, thus it
    // is a defect and this function fails loudly instead of widening the area.
    if ((normalizedShape === 'Cone' || normalizedShape === 'Line') && !direction) {
        throw new Error(
            `Cone or line zone needs a direction: shape "${areaOfEffect.shape}" at ${zonePosition.x},${zonePosition.y}`
        );
    }

    if (normalizedShape) {
        return AoECalculator.containsTile(position, zonePosition, {
            ...areaOfEffect,
            shape: normalizedShape
        }, direction);
    }

    // Shapes that the shared AoE geometry does not model, such as "wall" and
    // "emanation", keep the historical cube-like containment test. These shapes
    // are not directional, thus the ruling above does not apply to them.
    const dx = Math.abs(position.x - zonePosition.x);
    const dy = Math.abs(position.y - zonePosition.y);
    const sizeInTiles = Math.ceil(areaOfEffect.size / 5); // Convert feet to tiles

    return dx < sizeInTiles && dy < sizeInTiles;
}

function normalizeAreaShape(shape: string): AreaOfEffect['shape'] | null {
    switch (shape.toLowerCase()) {
        case 'cube':
            return 'Cube';
        case 'square':
            return 'Square';
        case 'sphere':
        case 'circle':
            return 'Sphere';
        case 'cylinder':
            return 'Cylinder';
        case 'cone':
            return 'Cone';
        case 'line':
            return 'Line';
        default:
            return null;
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
// These helper exports remain as compatibility functions for callers and tests,
// while AreaEffectTracker delegates entry/exit/end-turn effect selection here.
// Keep tracker-owned event emission in AreaEffectTracker and pure effect
// filtering here so the runtime path and helper tests share one decision point.
export function processAreaEntryTriggers(
    zones: ActiveSpellZone[],
    character: CombatCharacter,
    newPosition: Position,
    previousPosition: Position,
    _round: number
): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const zone of zones) {
        if (!zone.areaOfEffect) continue;

        const wasInZone = isPositionInArea(previousPosition, zone.position, zone.areaOfEffect, zone.direction);
        const isNowInZone = isPositionInArea(newPosition, zone.position, zone.areaOfEffect, zone.direction);

        // Only trigger on actual entry (wasn't in zone before, is now)
        if (!wasInZone && isNowInZone) {
            const entryEffects = zone.effects.filter(effect =>
                AREA_ENTRY_TRIGGER_TYPES.has(effect.trigger?.type ?? '')
            );

            for (const effect of entryEffects) {
                if (!shouldTriggerForFrequency(triggerFrequencyOf(effect.trigger), zone, character.id)) {
                    continue;
                }

                // Check target filter
                if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                    continue;
                }

                results.push({
                    triggered: true,
                    effects: convertSpellEffectToProcessed(effect, { spellId: zone.spellId, casterId: zone.casterId, saveDC: zone.saveDC }),
                    triggerType: 'on_enter_area'
                });
            }
        }
    }

    return results;
}

/**
 * Process on_move_in_area triggers while a character moves inside a zone.
 *
 * Spike Growth-style effects care about distance traveled through the zone, so
 * this helper emits one trigger result per tile moved while both the old and new
 * positions are inside the same area. AreaEffectTracker delegates here so
 * movement-within effects share filtering, frequency gates, and source context
 * with entry, exit, and end-turn area triggers.
 */
export function processAreaMoveWithinTriggers(
    zones: ActiveSpellZone[],
    character: CombatCharacter,
    newPosition: Position,
    previousPosition: Position,
    movementPath?: Position[]
): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const zone of zones) {
        if (!zone.areaOfEffect) continue;

        const distanceInTiles = countMovementTilesInsideZone(zone, newPosition, previousPosition, movementPath);

        if (distanceInTiles > 0) {
            const moveEffects = zone.effects.flatMap(effect => {
                const direct = effect.trigger?.type === 'on_move_in_area'
                    ? [{ effect, mechanic: undefined as RecurringMechanic | undefined }]
                    : [];
                const recurring = getRecurringMechanics(effect)
                    .filter(mechanic => mechanic.timing === 'on_move_in_area')
                    .map(mechanic => ({ effect, mechanic }));
                return [...direct, ...recurring];
            });

            for (let i = 0; i < distanceInTiles; i++) {
                for (const { effect, mechanic } of moveEffects) {
                    if (!shouldTriggerForFrequency(normalizeTriggerFrequency(mechanic?.frequency ?? triggerFrequencyOf(effect.trigger)), zone, character.id)) {
                        continue;
                    }

                    if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                        continue;
                    }

                    results.push({
                        triggered: true,
                        effects: convertSpellEffectToProcessed(effect, { spellId: zone.spellId, casterId: zone.casterId, saveDC: zone.saveDC }, mechanic),
                        triggerType: 'on_move_in_area'
                    });
                }
            }
        }
    }

    return results;
}

function countMovementTilesInsideZone(
    zone: ActiveSpellZone,
    newPosition: Position,
    previousPosition: Position,
    movementPath?: Position[]
): number {
    if (movementPath && movementPath.length >= 2) {
        let traveledInsideTiles = 0;

        // A supplied path is authoritative. Count every explicit step that
        // touches the zone, including the first step into it and the last step
        // out of it. Spike Growth-style spells punish moving into or through
        // the area, so requiring both endpoints to already be inside silently
        // misses the entry step.
        for (let i = 1; i < movementPath.length; i++) {
            const from = movementPath[i - 1];
            const to = movementPath[i];
            // Paths can contain sparse waypoints rather than one entry per tile.
            // Walk the segment in grid-sized steps so an eight-tile jump that
            // merely ends inside the zone does not charge all eight tiles.
            traveledInsideTiles += countUnitStepsTouchingZone(zone, from, to);
        }

        return traveledInsideTiles;
    }

    const wasInZone = isPositionInArea(previousPosition, zone.position, zone.areaOfEffect!, zone.direction);
    const isNowInZone = isPositionInArea(newPosition, zone.position, zone.areaOfEffect!, zone.direction);

    if (!wasInZone && !isNowInZone) {
        return 0;
    }

    return getChebyshevTileDistance(previousPosition, newPosition);
}

/**
 * Count discrete grid steps whose start or end touches the active zone.
 *
 * Including the boundary-crossing steps preserves Spike Growth-style entry and
 * exit damage, while interpolating sparse waypoints prevents out-of-zone travel
 * from being billed as though it happened entirely on hazardous ground.
 */
function countUnitStepsTouchingZone(zone: ActiveSpellZone, from: Position, to: Position): number {
    const distance = getChebyshevTileDistance(from, to);
    if (distance === 0 || !zone.areaOfEffect) return 0;

    let touchingSteps = 0;
    let previous = from;

    for (let step = 1; step <= distance; step++) {
        // Round each evenly spaced sample onto the combat grid. Chebyshev
        // distance guarantees at most one tile of movement on either axis per
        // sample, matching Aralia's diagonal movement model.
        const current = {
            x: Math.round(from.x + ((to.x - from.x) * step) / distance),
            y: Math.round(from.y + ((to.y - from.y) * step) / distance)
        };
        const startsInside = isPositionInArea(previous, zone.position, zone.areaOfEffect, zone.direction);
        const endsInside = isPositionInArea(current, zone.position, zone.areaOfEffect, zone.direction);
        if (startsInside || endsInside) touchingSteps += 1;
        previous = current;
    }

    return touchingSteps;
}

function getChebyshevTileDistance(from: Position, to: Position): number {
    // Aralia's grid uses one tile as five feet. Chebyshev distance matches the
    // existing diagonal movement model, so a diagonal move across three tiles
    // pays for three five-foot steps, not six.
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);

    return Math.max(dx, dy);
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
    round: number,
    movementContext: MovementTriggerContext = {}
): TriggerResult[] {
    const results: TriggerResult[] = [];
    const movementType = movementContext.movementType ?? 'willing';
    const movedAtLeastFiveFeet = movementContext.previousPosition
        ? getChebyshevTileDistance(movementContext.previousPosition, character.position) >= 1
        : true;

    for (const debuff of debuffs) {
        // Only process debuffs on this character that haven't triggered and haven't expired
        if (debuff.targetId !== character.id) continue;
        if (debuff.hasTriggered) continue;
        if (debuff.expiresAtRound < round) continue;

        const moveTriggerEffects = debuff.effects.filter(effect =>
            effect.trigger?.type === 'on_target_move'
        );

        for (const effect of moveTriggerEffects) {
            const requiredMovementType = effect.trigger?.movementType;
            if (requiredMovementType === 'willing' && movementType !== 'willing') {
                continue;
            }
            if (requiredMovementType === 'forced' && movementType !== 'forced') {
                continue;
            }
            if (!movedAtLeastFiveFeet) {
                continue;
            }

            // Check target filter (though movement debuffs are usually on a specific target)
            if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                continue;
            }

            results.push({
                triggered: true,
                effects: convertSpellEffectToProcessed(effect, { spellId: debuff.spellId, casterId: debuff.casterId, saveDC: debuff.saveDC }),
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

        const wasInZone = isPositionInArea(previousPosition, zone.position, zone.areaOfEffect, zone.direction);
        const isNowInZone = isPositionInArea(newPosition, zone.position, zone.areaOfEffect, zone.direction);

        // Only trigger on actual exit (was in zone, now out)
        if (wasInZone && !isNowInZone) {
            const exitEffects = zone.effects.filter(effect =>
                effect.trigger?.type === 'on_exit_area'
            );

            for (const effect of exitEffects) {
                if (!shouldTriggerForFrequency(triggerFrequencyOf(effect.trigger), zone, character.id)) {
                    continue;
                }

                if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                    continue;
                }

                results.push({
                    triggered: true,
                    effects: convertSpellEffectToProcessed(effect, { spellId: zone.spellId, casterId: zone.casterId, saveDC: zone.saveDC }),
                    triggerType: 'on_exit_area'
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

        const isInZone = isPositionInArea(character.position, zone.position, zone.areaOfEffect, zone.direction);
        if (!isInZone) continue;

        const endTurnEffects = zone.effects.flatMap(effect => {
            const direct = AREA_END_TURN_TRIGGER_TYPES.has(effect.trigger?.type ?? '')
                ? [{ effect, mechanic: undefined as RecurringMechanic | undefined }]
                : [];
            const recurring = getRecurringMechanics(effect)
                .filter(mechanic => mechanic.timing === 'turn_end')
                .map(mechanic => ({ effect, mechanic }));
            return [...direct, ...recurring];
        });

        for (const { effect, mechanic } of endTurnEffects) {
            if (!shouldTriggerForFrequency(normalizeTriggerFrequency(mechanic?.frequency ?? triggerFrequencyOf(effect.trigger)), zone, character.id)) {
                continue;
            }

            if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                continue;
            }

            results.push({
                triggered: true,
                effects: convertSpellEffectToProcessed(effect, { spellId: zone.spellId, casterId: zone.casterId, saveDC: zone.saveDC }, mechanic),
                triggerType: 'on_end_turn_in_area'
            });
        }
    }

    return results;
}

/** Process source-backed or direct turn-start effects for an occupant. */
export function processAreaStartTurnTriggers(
    zones: ActiveSpellZone[],
    character: CombatCharacter,
    _round: number
): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const zone of zones) {
        if (!zone.areaOfEffect) continue;

        const isInZone = isPositionInArea(character.position, zone.position, zone.areaOfEffect, zone.direction);
        if (!isInZone) continue;

        const startTurnEffects = zone.effects.flatMap(effect => {
            const direct = AREA_START_TURN_TRIGGER_TYPES.has(effect.trigger?.type ?? '')
                ? [{ effect, mechanic: undefined as RecurringMechanic | undefined }]
                : [];
            const recurring = getRecurringMechanics(effect)
                .filter(mechanic => mechanic.timing === 'turn_start')
                .map(mechanic => ({ effect, mechanic }));
            return [...direct, ...recurring];
        });

        for (const { effect, mechanic } of startTurnEffects) {
            if (!shouldTriggerForFrequency(normalizeTriggerFrequency(mechanic?.frequency ?? triggerFrequencyOf(effect.trigger)), zone, character.id)) {
                continue;
            }

            if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                continue;
            }

            results.push({
                triggered: true,
                effects: convertSpellEffectToProcessed(
                    effect,
                    { spellId: zone.spellId, casterId: zone.casterId, saveDC: zone.saveDC },
                    mechanic
                ),
                triggerType: 'on_start_turn_in_area'
            });
        }
    }

    return results;
}

/**
 * Process source-backed proximity mechanics for a persistent zone.
 *
 * Conjure Animals describes its threat radius as a recurring mechanic rather
 * than a legacy area trigger. Movement enters and end-of-turn occupancy both
 * use this adapter, so the source save/damage packet reaches the same delayed
 * effect pipeline without inventing a second zone representation.
 *
 * A moving summoned zone is intentionally not inferred here: callers must
 * update the zone position when the summoned actor moves before asking this
 * helper to evaluate the next event.
 */
export function processAreaProximityTriggers(
    zones: ActiveSpellZone[],
    character: CombatCharacter,
    currentPosition: Position,
    previousPosition?: Position,
    isEndTurn = false
): TriggerResult[] {
    const results: TriggerResult[] = [];

    for (const zone of zones) {
        if (!zone.areaOfEffect) continue;

        const isInZone = isPositionInArea(currentPosition, zone.position, zone.areaOfEffect, zone.direction);
        if (!isInZone) continue;

        const wasInZone = previousPosition
            ? isPositionInArea(previousPosition, zone.position, zone.areaOfEffect, zone.direction)
            : false;
        if (!isEndTurn && wasInZone) continue;

        const proximityEffects = zone.effects.flatMap(effect =>
            getRecurringMechanics(effect)
                .filter(mechanic => mechanic.timing === 'on_entity_proximity')
                .map(mechanic => ({ effect, mechanic }))
        );

        for (const { effect, mechanic } of proximityEffects) {
            if (!shouldTriggerForFrequency(normalizeTriggerFrequency(mechanic.frequency ?? 'once_per_turn'), zone, character.id)) {
                continue;
            }

            if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                continue;
            }

            results.push({
                triggered: true,
                effects: convertSpellEffectToProcessed(
                    effect,
                    { spellId: zone.spellId, casterId: zone.casterId, saveDC: zone.saveDC },
                    mechanic
                ),
                triggerType: 'on_entity_proximity'
            });
        }
    }

    return results;
}
