// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 10/07/2026, 14:02:30
 * Dependents: commands/effects/commandAreaMovementEffects.ts, commands/factory/AbilityCommandFactory.ts, components/BattleMap/BattleMapOverlay.tsx, components/BattleMap/vfx/VFXSystem.tsx, components/Combat/MaplessTerrainSummary.tsx, hooks/combat/useVisibility.ts, hooks/useAbilitySystem.ts, systems/spells/effects/AreaEffectTracker.ts, systems/spells/effects/index.ts, utils/combat/resistanceUtils.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/systems/spells/effects/triggerHandler.ts
 * 
 * Handles execution of spell effect triggers based on game events.
 * Supports the new trigger types: on_enter_area, on_exit_area, on_end_turn_in_area, on_target_move
 */
import type { AreaOfEffect, SpellEffect, TerrainEffect, EffectTrigger, TargetConditionFilter, TargetFilter } from '../../../types/spells';
import type { CombatCharacter, Position } from '../../../types/combat';
import type { RepeatSave, EscapeCheck, ConditionBreakTrigger } from '../../../types/spells';
import type { AoEParams } from '../../../utils/combat/aoeCalculations';
import { AoECalculator } from '../targeting/AoECalculator';

/**
 * Represents an active spell zone on the battlefield (e.g., Create Bonfire)
 */
export interface ActiveSpellZone {
    id: string;
    spellId: string;
    casterId: string;
    position: Position;
    areaOfEffect?: { shape: string; size: number };
    /** Direction/orientation for directional zones such as Cone and Line. */
    direction?: Position;
    /** Spell save DC captured at cast time so delayed zone saves do not drift with later caster stat changes. */
    saveDC?: number;
    /** Source targeting is preserved so defensive auras can distinguish universal zones from ally-only ones. */
    targetingValidTargets?: TargetFilter[];
    effects: SpellEffect[];
    /** Track entities that have already triggered "first_per_turn" effects this turn */
    triggeredThisTurn: Set<string>;
    /** Track entities that should only ever trigger once (per creature) for this zone */
    triggeredEver: Set<string>;
    /** Remaining wall length for wall-shaped spells that shrink over time. */
    remainingWallLength?: number;
    /** Original wall length so UI/log consumers can compare current and starting size. */
    originalWallLength?: number;
    /** Whether this zone should disappear when its remaining wall length reaches zero. */
    endsWhenLengthZero?: boolean;
    expiresAtRound?: number;
}

/**
 * Stores spell effects that should fire on a future target turn rather than at
 * cast time. This is intentionally separate from repeat-save metadata: repeat
 * saves end statuses, while scheduled spell effects apply delayed payloads such
 * as damage or healing.
 */
export interface ScheduledSpellEffect {
    id: string;
    spellId: string;
    casterId: string;
    targetId: string;
    timing: 'turn_start' | 'turn_end';
    effects: SpellEffect[];
    createdAtRound: number;
    expiresAtRound?: number;
    /** Spell save DC captured at cast time for delayed target-bound payloads. */
    saveDC?: number;
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
    /** Spell save DC captured when the movement-triggered debuff was created. */
    saveDC?: number;
}

export interface MovementTriggerContext {
    previousPosition?: Position;
    movementType?: 'willing' | 'forced' | 'teleport';
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

export interface ProcessedEffectSourceContext {
    spellId: string;
    casterId: string;
    saveDC?: number;
}

export interface ProcessedEffect {
    type: 'damage' | 'heal' | 'status_condition';
    value?: number;
    dice?: string;
    damageType?: string;
    statusName?: string;
    /** Original status duration so delayed/area trigger consumers do not invent timing. */
    duration?: SpellEffect['duration'];
    requiresSave?: boolean;
    saveType?: string;
    saveEffect?: string;
    repeatSave?: RepeatSave;
    escapeCheck?: EscapeCheck;
    breakTriggers?: ConditionBreakTrigger[];
    /**
     * Carries the original spell/caster identity through delayed trigger
     * processing. Area and movement triggers can fire long after the cast, so
     * downstream handlers should not guess save DCs from the target.
     */
    sourceContext?: ProcessedEffectSourceContext;
}

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

    if (normalizedShape && (normalizedShape !== 'Cone' && normalizedShape !== 'Line' || direction)) {
        return AoECalculator.containsTile(position, zonePosition, {
            ...areaOfEffect,
            shape: normalizedShape
        }, direction);
    }

    // TODO #977: The current Line and Cone checks are direction-agnostic (checking distance only).
    // This is incorrect for directionless spells. Preserve direction data from the casting path so `AoECalculator`
    // can delegate to the canonical `src/utils/combat/aoeCalculations.ts` geometry for Cones and Lines.

    // TODO #978(SPELL-OVERHAUL): Replace simplified line/cone checks with direction-aware AoE math (see docs/tasks/spell-system-overhaul/TODO #979.md; if this block is moved/refactored/modularized, update the TODO #980 entry path).
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
                effect.trigger?.type === 'on_enter_area'
            );

            for (const effect of entryEffects) {
                // DEBT: Cast trigger to any to probe optional frequency property without complex typing in this handler.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (!shouldTriggerForFrequency((effect.trigger as any)?.frequency, zone, character.id)) {
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
            const moveEffects = zone.effects.filter(effect =>
                effect.trigger?.type === 'on_move_in_area'
            );

            for (let i = 0; i < distanceInTiles; i++) {
                for (const effect of moveEffects) {
                    // DEBT: Cast trigger to any to probe optional frequency property without complex typing in this handler.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (!shouldTriggerForFrequency((effect.trigger as any)?.frequency, zone, character.id)) {
                        continue;
                    }

                    if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                        continue;
                    }

                    results.push({
                        triggered: true,
                        effects: convertSpellEffectToProcessed(effect, { spellId: zone.spellId, casterId: zone.casterId, saveDC: zone.saveDC }),
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
            const requiredMovementType = (effect.trigger as { movementType?: string }).movementType;
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
                if (!shouldTriggerForFrequency((effect.trigger as any)?.frequency, zone, character.id)) {
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

        const endTurnEffects = zone.effects.filter(effect =>
            effect.trigger?.type === 'on_end_turn_in_area' ||
            effect.trigger?.type === 'turn_end'
        );

        for (const effect of endTurnEffects) {
            // DEBT: Cast trigger to any to probe optional frequency property without complex typing in this handler.
            if (!shouldTriggerForFrequency((effect.trigger as any)?.frequency, zone, character.id)) {
                continue;
            }

            if (!matchesTargetFilter(effect.condition?.targetFilter, character)) {
                continue;
            }

            results.push({
                triggered: true,
                effects: convertSpellEffectToProcessed(effect, { spellId: zone.spellId, casterId: zone.casterId, saveDC: zone.saveDC }),
                triggerType: 'on_end_turn_in_area'
            });
        }
    }

    return results;
}

/**
 * Convert a SpellEffect to a ProcessedEffect for the combat system
 */
export function convertSpellEffectToProcessed(
    effect: SpellEffect,
    sourceContext?: ProcessedEffectSourceContext
): ProcessedEffect[] {
    const processed: ProcessedEffect[] = [];

    switch (effect.type) {
        case 'DAMAGE':
            processed.push({
                type: 'damage',
                dice: effect.damage?.dice,
                damageType: effect.damage?.type,
                requiresSave: effect.condition?.type === 'save',
                saveType: effect.condition?.saveType,
                saveEffect: effect.condition?.saveEffect,
                sourceContext
            });
            break;

        case 'HEALING':
            processed.push({
                type: 'heal',
                dice: effect.healing?.dice,
                sourceContext
            });
            break;

        case 'STATUS_CONDITION': {
            processed.push({
                type: 'status_condition',
                statusName: effect.statusCondition?.name,
                duration: effect.statusCondition?.duration,
                requiresSave: effect.condition?.type === 'save',
                saveType: effect.condition?.saveType,
                saveEffect: effect.condition?.saveEffect,
                // Status-condition metadata appears in more than one declaration
                // shape while the spell-data migration is still in flight. Preserve
                // all known locations so delayed effects and area triggers keep the
                // ongoing-resolution rules that immediate status commands already use.
                repeatSave: effect.statusCondition?.repeatSave,
                escapeCheck: effect.statusCondition?.escapeCheck,
                breakTriggers: effect.statusCondition?.breakTriggers,
                sourceContext
            });
            break;
        }
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
    durationRounds?: number,
    direction?: Position,
    saveDC?: number,
    targetingValidTargets?: TargetFilter[]
): ActiveSpellZone {
    return {
        id: `zone-${spellId}-${Date.now()}`,
        spellId,
        casterId,
        position,
        areaOfEffect,
        direction,
        saveDC,
        targetingValidTargets,
        // Area zones now preserve defensive resistance/immunity payloads in
        // addition to trigger-driven effects so the damage pipeline can read
        // the live zone state instead of flattening those spells into logs.
        effects: effects.filter(e => {
            // DEBT: Cast trigger to any to probe optional type property without complex typing in this zone factory.
            const t = e.trigger as any;
            const hasAreaRecurringMechanic = Array.isArray(e.recurringMechanics) &&
                e.recurringMechanics.some(mechanic =>
                    mechanic.timing === 'turn_start' ||
                    mechanic.timing === 'turn_end' ||
                    mechanic.timing === 'on_move_in_area' ||
                    mechanic.timing === 'on_entity_proximity'
                );
            return t?.type === 'on_enter_area' ||
                t?.type === 'on_exit_area' ||
                t?.type === 'on_end_turn_in_area' ||
                t?.type === 'on_move_in_area' ||
                t?.type === 'turn_end' ||
                t?.type === 'turn_start' ||
                hasAreaRecurringMechanic ||
                (e.type === 'DEFENSIVE' && (e.defenseType === 'resistance' || e.defenseType === 'immunity'));
        }),
        triggeredThisTurn: new Set(),
        triggeredEver: new Set(),
        // Wall-shaped zones such as Wall of Light need a durable length value
        // because later granted actions can shrink the wall after the original
        // cast. Non-wall zones leave this undefined and keep their old behavior.
        remainingWallLength: areaOfEffect.shape.toLowerCase() === 'wall' ? areaOfEffect.size : undefined,
        originalWallLength: areaOfEffect.shape.toLowerCase() === 'wall' ? areaOfEffect.size : undefined,
        expiresAtRound: durationRounds ? currentRound + durationRounds : undefined
    };
}

/**
 * Create an ActiveSpellZone from the shared AoE targeting parameters used by
 * previews and immediate spell targeting. This keeps the future casting bridge
 * from re-deriving origin/direction in a different format when it registers a
 * persistent zone.
 */
export function createSpellZoneFromAoEParams(
    spellId: string,
    casterId: string,
    aoeParams: AoEParams,
    areaOfEffect: { shape: string; size: number },
    effects: SpellEffect[],
    currentRound: number,
    durationRounds?: number,
    saveDC?: number,
    targetingValidTargets?: TargetFilter[]
): ActiveSpellZone {
    return createSpellZone(
        spellId,
        casterId,
        aoeParams.origin,
        areaOfEffect,
        effects,
        currentRound,
        durationRounds,
        directionFromAoEParams(aoeParams),
        saveDC,
        targetingValidTargets
    );
}

/**
 * Create an ActiveSpellZone specifically for mapless terrain persistence.
 *
 * TerrainCommand can mutate real map tiles when `mapData` exists. In mapless
 * combat there are no tiles to mutate, so this helper stores the terrain spell's
 * affected area as durable spell-zone state instead of reducing the spell to a
 * one-line combat log. It deliberately preserves TERRAIN effects instead of
 * using createSpellZone's trigger-only filter.
 */
export function createTerrainSpellZoneFromAoEParams(
    spellId: string,
    casterId: string,
    aoeParams: AoEParams,
    areaOfEffect: { shape: string; size: number },
    effects: TerrainEffect[],
    currentRound: number,
    durationRounds?: number
): ActiveSpellZone {
    return {
        id: `terrain-zone-${spellId}-${Date.now()}`,
        spellId,
        casterId,
        position: aoeParams.origin,
        areaOfEffect,
        direction: directionFromAoEParams(aoeParams),
        effects,
        triggeredThisTurn: new Set(),
        triggeredEver: new Set(),
        expiresAtRound: durationRounds ? currentRound + durationRounds : undefined
    };
}

export function createScheduledSpellEffect(
    spellId: string,
    casterId: string,
    targetId: string,
    timing: 'turn_start' | 'turn_end',
    effects: SpellEffect[],
    currentRound: number,
    durationRounds?: number,
    saveDC?: number
): ScheduledSpellEffect {
    return {
        id: `scheduled-${spellId}-${targetId}-${timing}-${Date.now()}`,
        spellId,
        casterId,
        targetId,
        timing,
        effects: effects.filter(effect => effect.trigger?.type === timing),
        createdAtRound: currentRound,
        expiresAtRound: durationRounds ? currentRound + durationRounds : undefined,
        saveDC
    };
}

function directionFromAoEParams(params: AoEParams): Position | undefined {
    if (params.targetPoint && (params.targetPoint.x !== params.origin.x || params.targetPoint.y !== params.origin.y)) {
        return {
            x: params.targetPoint.x - params.origin.x,
            y: params.targetPoint.y - params.origin.y
        };
    }

    if (params.direction === undefined) {
        return undefined;
    }

    const angleRad = (params.direction - 90) * (Math.PI / 180);
    return {
        x: Math.cos(angleRad),
        y: Math.sin(angleRad)
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
    durationRounds: number = 1,
    saveDC?: number
): MovementTriggerDebuff {
    return {
        id: `debuff-${spellId}-${targetId}-${Date.now()}`,
        spellId,
        casterId,
        targetId,
        effects: effects.filter(e => e.trigger?.type === 'on_target_move'),
        expiresAtRound: currentRound + durationRounds,
        hasTriggered: false,
        saveDC
    };
}
