/**
 * @file src/systems/spells/effects/trigger/zoneLifecycle.ts
 *
 * Creation, per-round reset, and repositioning of the durable trigger-domain
 * records: spell zones, terrain zones, scheduled effects, and movement debuffs.
 *
 * WHY THIS EXISTS: split out of triggerHandler.ts (MOD-3.3). These factories
 * never read the trigger predicates, so keeping them apart from
 * areaTriggerProcessing leaves the module graph acyclic. Behavior is unchanged
 * from the original file, including createSpellZone's trigger-only effect filter
 * and createTerrainSpellZoneFromAoEParams' deliberate bypass of it.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 14:28:33
 * Dependents: systems/spells/effects/triggerHandler.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { SpellEffect, TerrainEffect, TargetFilter } from '../../../../types/spells';
import type { CombatCharacter, Direction, Position } from '../../../../types/combat';
import type { AoEParams } from '../../../../utils/combat/aoeCalculations';
import { getRecurringMechanics } from '../../../../hooks/spellEffectUtils';
import type { RecurringMechanic } from '../../../../types/spellEffectTypes';
import type { ActiveSpellZone, MovementTriggerDebuff, ScheduledSpellEffect } from './types';
import { facingToVector } from '../../../../utils/spatial/geometry';

/**
 * Recenter a Conjure Animals threat zone when its spectral pack moves.
 *
 * The zone is keyed by the same spell/caster pair as the summon actor. Keeping
 * this ownership rule in the zone module prevents movement callers from
 * inventing a second area representation or silently moving unrelated zones.
 */
export function recenterConjureAnimalsZonesForPackMove(
    zones: ActiveSpellZone[],
    pack: CombatCharacter
): ActiveSpellZone[] {
    const metadata = pack.summonMetadata;
    if (!pack.isSummon || metadata?.spellId !== 'conjure-animals' || !metadata.casterId) {
        return zones;
    }

    let changed = false;
    const nextZones = zones.map(zone => {
        if (zone.spellId !== 'conjure-animals' || zone.casterId !== metadata.casterId) {
            return zone;
        }

        if (zone.position.x === pack.position.x && zone.position.y === pack.position.y) {
            return zone;
        }

        changed = true;
        return { ...zone, position: pack.position };
    });

    return changed ? nextZones : zones;
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
    targetingValidTargets?: TargetFilter[],
    casterFacing?: Direction
): ActiveSpellZone {
    const resolvedDirection = resolveZoneDirection(
        areaOfEffect.shape,
        direction,
        casterFacing,
        spellId,
        casterId
    );

    return {
        id: `zone-${spellId}-${Date.now()}`,
        spellId,
        casterId,
        position,
        areaOfEffect,
        direction: resolvedDirection,
        saveDC,
        targetingValidTargets,
        // Area zones now preserve defensive resistance/immunity payloads in
        // addition to trigger-driven effects so the damage pipeline can read
        // the live zone state instead of flattening those spells into logs.
        effects: effects.filter(e => {
            const triggerType = e.trigger?.type;
            const hasAreaRecurringMechanic = getRecurringMechanics(e).some(mechanic =>
                    mechanic.timing === 'turn_start' ||
                    mechanic.timing === 'turn_end' ||
                    mechanic.timing === 'on_move_in_area' ||
                    mechanic.timing === 'on_entity_proximity'
                );
            return triggerType === 'on_enter_area' ||
                triggerType === 'on_exit_area' ||
                triggerType === 'on_end_turn_in_area' ||
                triggerType === 'on_move_in_area' ||
                triggerType === 'turn_end' ||
                triggerType === 'turn_start' ||
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
    targetingValidTargets?: TargetFilter[],
    casterFacing?: Direction
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
        targetingValidTargets,
        casterFacing
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
    durationRounds?: number,
    casterFacing?: Direction
): ActiveSpellZone {
    return {
        id: `terrain-zone-${spellId}-${Date.now()}`,
        spellId,
        casterId,
        position: aoeParams.origin,
        areaOfEffect,
        direction: resolveZoneDirection(
            areaOfEffect.shape,
            directionFromAoEParams(aoeParams),
            casterFacing,
            spellId,
            casterId
        ),
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
    saveDC?: number,
    recurringMechanic?: RecurringMechanic
): ScheduledSpellEffect {
    return {
        id: `scheduled-${spellId}-${targetId}-${timing}-${Date.now()}`,
        spellId,
        casterId,
        targetId,
        timing,
        effects: recurringMechanic
            ? effects
            : effects.filter(effect => effect.trigger?.type === timing),
        createdAtRound: currentRound,
        expiresAtRound: durationRounds ? currentRound + durationRounds : undefined,
        saveDC,
        recurringMechanic
    };
}

/**
 * Give a cone, a line, or a cube zone the one direction it must have.
 *
 * Ruling 2026-09-22 (Q4, face anchor): a cube zone is directional too. The cube
 * extends away from the caster, and the zone keeps only this vector, thus a
 * cube zone with no direction cannot be made. "square" maps to the same cube
 * geometry in AoECalculator, thus it follows the same rule.
 *
 * Ruling 2026-09-13 (Q2): a directional zone points along the cast direction
 * when the cast supplies a target point. If the cast has no target point, the
 * zone points along the caster facing. If neither source exists, the zone is
 * invalid and this function throws. There is no permissive alternative: a cone
 * or a line zone with no direction cannot be made.
 *
 * Shapes that are not directional keep the direction they were given, which is
 * usually undefined.
 */
export function resolveZoneDirection(
    shape: string,
    explicitDirection: Position | undefined,
    casterFacing: Direction | undefined,
    spellId: string,
    casterId: string
): Position | undefined {
    const normalizedShape = shape.toLowerCase();
    if (!['cone', 'line', 'cube', 'square'].includes(normalizedShape)) {
        return explicitDirection;
    }

    if (explicitDirection) {
        console.info(
            `[spell-zone] ${normalizedShape} zone "${spellId}" by ${casterId} takes its direction from the cast target point.`
        );
        return explicitDirection;
    }

    if (casterFacing) {
        console.info(
            `[spell-zone] ${normalizedShape} zone "${spellId}" by ${casterId} takes its direction from the caster facing (${casterFacing}).`
        );
        return facingToVector(casterFacing);
    }

    const shapeLabel = normalizedShape === 'cone' || normalizedShape === 'line' ? 'Cone or line' : 'Cube';
    throw new Error(`${shapeLabel} zone needs a direction: ${spellId} by ${casterId}`);
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
