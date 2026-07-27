/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 23/07/2026, 21:41:09
 * Dependents: commands/effects/commandAreaMovementEffects.ts, commands/factory/AbilityCommandFactory.ts, components/BattleMap/BattleMapOverlay.tsx, components/BattleMap/vfx/VFXSystem.tsx, components/Combat/MaplessTerrainSummary.tsx, hooks/combat/useVisibility.ts, hooks/useAbilitySystem.ts, systems/spells/effects/AreaEffectTracker.ts, systems/spells/effects/index.ts, utils/combat/resistanceUtils.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/systems/spells/effects/triggerHandler.ts
 *
 * Handles execution of spell effect triggers based on game events.
 * Supports the new trigger types: on_enter_area, on_exit_area, on_end_turn_in_area, on_target_move
 */
import type { SpellEffect, TerrainEffect, EffectTrigger, TargetConditionFilter, TargetFilter } from '../../../types/spells';
import type { CombatCharacter, Position } from '../../../types/combat';
import type { RepeatSave, EscapeCheck, ConditionBreakTrigger } from '../../../types/spells';
import type { AoEParams } from '../../../utils/combat/aoeCalculations';
import type { RecurringMechanic } from '../../../types/spellEffectTypes';
/**
 * Represents an active spell zone on the battlefield (e.g., Create Bonfire)
 */
export interface ActiveSpellZone {
    id: string;
    spellId: string;
    casterId: string;
    position: Position;
    areaOfEffect?: {
        shape: string;
        size: number;
    };
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
 * Recenter a Conjure Animals threat zone when its spectral pack moves.
 *
 * The zone is keyed by the same spell/caster pair as the summon actor. Keeping
 * this ownership rule in the zone module prevents movement callers from
 * inventing a second area representation or silently moving unrelated zones.
 */
export declare function recenterConjureAnimalsZonesForPackMove(zones: ActiveSpellZone[], pack: CombatCharacter): ActiveSpellZone[];
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
    /** Source-backed recurring payload selected for this scheduled timing. */
    recurringMechanic?: RecurringMechanic;
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
    triggerType?: 'on_enter_area' | 'on_exit_area' | 'on_start_turn_in_area' | 'on_end_turn_in_area' | 'on_move_in_area' | 'on_entity_proximity' | 'on_target_move';
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
    duration?: any;
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
export declare function matchesTargetFilter(filter: TargetConditionFilter | undefined, target: CombatCharacter): boolean;
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
export declare function shouldTriggerForFrequency(frequency: TriggerFrequency, zone: ActiveSpellZone, characterId: string): boolean;
/**
 * Check if a position is within an area of effect
 */
export declare function isPositionInArea(position: Position, zonePosition: Position, areaOfEffect: {
    shape: string;
    size: number;
}, direction?: Position): boolean;
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
export declare function processAreaEntryTriggers(zones: ActiveSpellZone[], character: CombatCharacter, newPosition: Position, previousPosition: Position, _round: number): TriggerResult[];
/**
 * Process on_move_in_area triggers while a character moves inside a zone.
 *
 * Spike Growth-style effects care about distance traveled through the zone, so
 * this helper emits one trigger result per tile moved while both the old and new
 * positions are inside the same area. AreaEffectTracker delegates here so
 * movement-within effects share filtering, frequency gates, and source context
 * with entry, exit, and end-turn area triggers.
 */
export declare function processAreaMoveWithinTriggers(zones: ActiveSpellZone[], character: CombatCharacter, newPosition: Position, previousPosition: Position, movementPath?: Position[]): TriggerResult[];
/**
 * Process on_target_move triggers when a character with a movement debuff moves
 *
 * @param debuffs - Active movement-triggered debuffs
 * @param character - The character that moved
 * @param round - Current combat round
 * @returns Array of trigger results for effects that should fire
 */
export declare function processMovementTriggers(debuffs: MovementTriggerDebuff[], character: CombatCharacter, round: number, movementContext?: MovementTriggerContext): TriggerResult[];
/**
 * Process on_exit_area triggers when a character leaves a zone.
 */
export declare function processAreaExitTriggers(zones: ActiveSpellZone[], character: CombatCharacter, newPosition: Position, previousPosition: Position): TriggerResult[];
/**
 * Process on_end_turn_in_area triggers when a character ends their turn inside a zone.
 */
export declare function processAreaEndTurnTriggers(zones: ActiveSpellZone[], character: CombatCharacter, _round: number): TriggerResult[];
/** Process source-backed or direct turn-start effects for an occupant. */
export declare function processAreaStartTurnTriggers(zones: ActiveSpellZone[], character: CombatCharacter, _round: number): TriggerResult[];
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
export declare function processAreaProximityTriggers(zones: ActiveSpellZone[], character: CombatCharacter, currentPosition: Position, previousPosition?: Position, isEndTurn?: boolean): TriggerResult[];
/**
 * Convert a SpellEffect to a ProcessedEffect for the combat system
 */
export declare function convertSpellEffectToProcessed(effect: SpellEffect, sourceContext?: ProcessedEffectSourceContext, recurringMechanic?: RecurringMechanic): ProcessedEffect[];
/**
 * Reset turn-based tracking for all zones (call at start of each round)
 */
export declare function resetZoneTurnTracking(zones: ActiveSpellZone[]): void;
/**
 * Create an ActiveSpellZone from a spell cast
 */
export declare function createSpellZone(spellId: string, casterId: string, position: Position, areaOfEffect: {
    shape: string;
    size: number;
}, effects: SpellEffect[], currentRound: number, durationRounds?: number, direction?: Position, saveDC?: number, targetingValidTargets?: TargetFilter[]): ActiveSpellZone;
/**
 * Create an ActiveSpellZone from the shared AoE targeting parameters used by
 * previews and immediate spell targeting. This keeps the future casting bridge
 * from re-deriving origin/direction in a different format when it registers a
 * persistent zone.
 */
export declare function createSpellZoneFromAoEParams(spellId: string, casterId: string, aoeParams: AoEParams, areaOfEffect: {
    shape: string;
    size: number;
}, effects: SpellEffect[], currentRound: number, durationRounds?: number, saveDC?: number, targetingValidTargets?: TargetFilter[]): ActiveSpellZone;
/**
 * Create an ActiveSpellZone specifically for mapless terrain persistence.
 *
 * TerrainCommand can mutate real map tiles when `mapData` exists. In mapless
 * combat there are no tiles to mutate, so this helper stores the terrain spell's
 * affected area as durable spell-zone state instead of reducing the spell to a
 * one-line combat log. It deliberately preserves TERRAIN effects instead of
 * using createSpellZone's trigger-only filter.
 */
export declare function createTerrainSpellZoneFromAoEParams(spellId: string, casterId: string, aoeParams: AoEParams, areaOfEffect: {
    shape: string;
    size: number;
}, effects: TerrainEffect[], currentRound: number, durationRounds?: number): ActiveSpellZone;
export declare function createScheduledSpellEffect(spellId: string, casterId: string, targetId: string, timing: 'turn_start' | 'turn_end', effects: SpellEffect[], currentRound: number, durationRounds?: number, saveDC?: number, recurringMechanic?: RecurringMechanic): ScheduledSpellEffect;
/**
 * Create a MovementTriggerDebuff from a spell hit
 */
export declare function createMovementDebuff(spellId: string, casterId: string, targetId: string, effects: SpellEffect[], currentRound: number, durationRounds?: number, saveDC?: number): MovementTriggerDebuff;
export {};
