// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/06/2026, 13:33:35
 * Dependents: components/BattleMap/BattleMapOverlay.tsx, components/BattleMap/vfx/VFXSystem.tsx, hooks/useAbilitySystem.ts, systems/spells/effects/AreaEffectTracker.ts, systems/spells/effects/index.ts
 * Imports: 5 files
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
// TODO(lint-intent): 'EffectCondition' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import type { AreaOfEffect, SpellEffect, TerrainEffect, EffectTrigger, EffectCondition as _EffectCondition, TargetConditionFilter } from '../../../types/spells';
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
    effects: SpellEffect[];
    /** Track entities that have already triggered "first_per_turn" effects this turn */
    triggeredThisTurn: Set<string>;
    /** Track entities that should only ever trigger once (per creature) for this zone */
    triggeredEver: Set<string>;
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

// TODO: `_TriggerContext` and the unused `_round` parameters in `processAreaEntryTriggers`/`processAreaEndTurnTriggers` suggest abandoned or future-planned logic.
// Either fully implement the context passing to support complex triggers (e.g. time-sensitive scaling) or remove these artifacts to reduce noise.

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

    // TODO: The `target` is currently cast to `any` or a partial shape because `CombatCharacter` lacks `creatureType`, `size`, and `alignment`.
    // This makes target filtering fragile. Update the `CombatCharacter` interface in `src/types/combat.ts` to explicitly include these properties.
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

    // TODO: The current Line and Cone checks are direction-agnostic (checking distance only).
    // This is incorrect for directionless spells. Preserve direction data from the casting path so `AoECalculator`
    // can delegate to the canonical `src/utils/combat/aoeCalculations.ts` geometry for Cones and Lines.

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
    // TODO(lint-intent): 'round' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
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

    // TODO: The function relies on double-casting `effect as unknown as ...` which bypasses type safety.
    // Use TypeScript type guards (e.g., `isDamageEffect(effect)`) to safely narrow the `SpellEffect` union before accessing specific properties like `damage.dice`.

    // TODO(2026-01-03 pass 4 Codex-CLI): SpellEffect detail casting until spell data schema is formalized.
    const effectDetails = effect as unknown as {
        damage?: { dice?: string; type?: string };
        healing?: { dice?: string };
        condition?: { type?: string; saveType?: string; saveEffect?: string };
    };

    // TODO: Include source metadata (spellId, casterId, optional saveDC) on ProcessedEffect 
    // to avoid downstream guesswork in handlers. Currently, handlers must re-lookup the 
    // caster to calculate spell DC, which is fragile if the caster has left combat.

    // TODO: `ProcessedEffect` currently lacks `sourceSpellId` and `casterId`. 
    // This forces downstream systems to guess or look up values for Save DC calculations.
    // 1. Extend `ProcessedEffect` to include `context: { spellId: string; casterId: string; saveDC?: number }`.
    // 2. Populate this from the `ActiveSpellZone` or `MovementTriggerDebuff` when converting.
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
                saveEffect: effectDetails.condition?.saveEffect,
                sourceContext
            });
            break;

        case 'HEALING':
            processed.push({
                type: 'heal',
                // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
                // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
                // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
                dice: effectDetails.healing?.dice,
                sourceContext
            });
            break;

        case 'STATUS_CONDITION': {
            // TODO(2026-01-03 pass 4 Codex-CLI): SpellEffect.statusCondition typing is loose; casting for now.
            const statusEffect = effect as unknown as {
                statusCondition?: {
                    name?: string;
                    repeatSave?: RepeatSave;
                    escapeCheck?: EscapeCheck;
                    breakTriggers?: ConditionBreakTrigger[];
                };
                condition?: {
                    type?: string;
                    saveType?: string;
                    saveEffect?: string;
                    repeatSave?: RepeatSave;
                    escapeCheck?: EscapeCheck;
                    breakTriggers?: ConditionBreakTrigger[];
                };
                repeatSave?: RepeatSave;
                escapeCheck?: EscapeCheck;
                breakTriggers?: ConditionBreakTrigger[];
            };
            processed.push({
                type: 'status_condition',
                // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
                // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
                // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
                statusName: statusEffect.statusCondition?.name,
                requiresSave: statusEffect.condition?.type === 'save',
                saveType: statusEffect.condition?.saveType,
                saveEffect: statusEffect.condition?.saveEffect,
                // Status-condition metadata appears in more than one declaration
                // shape while the spell-data migration is still in flight. Preserve
                // all known locations so delayed effects and area triggers keep the
                // ongoing-resolution rules that immediate status commands already use.
                repeatSave: statusEffect.repeatSave ?? statusEffect.statusCondition?.repeatSave ?? statusEffect.condition?.repeatSave,
                escapeCheck: statusEffect.escapeCheck ?? statusEffect.statusCondition?.escapeCheck ?? statusEffect.condition?.escapeCheck,
                breakTriggers: statusEffect.breakTriggers ?? statusEffect.statusCondition?.breakTriggers ?? statusEffect.condition?.breakTriggers,
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
    saveDC?: number
): ActiveSpellZone {
    return {
        id: `zone-${spellId}-${Date.now()}`,
        spellId,
        casterId,
        position,
        areaOfEffect,
        direction,
        saveDC,
        effects: effects.filter(e => {
            // DEBT: Cast trigger to any to probe optional type property without complex typing in this zone factory.
            const t = e.trigger as any;
            return t?.type === 'on_enter_area' ||
                t?.type === 'on_exit_area' ||
                t?.type === 'on_end_turn_in_area' ||
                t?.type === 'on_move_in_area' ||
                t?.type === 'turn_end' ||
                t?.type === 'turn_start';
        }),
        triggeredThisTurn: new Set(),
        triggeredEver: new Set(),
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
    saveDC?: number
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
        saveDC
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
