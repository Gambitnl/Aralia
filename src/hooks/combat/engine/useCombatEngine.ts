// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 09:22:18
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file hooks/combat/engine/useCombatEngine.ts
 * Core combat simulation engine.
 * Handles the "physics" of combat: damage, saving throws, area effects, and triggers.
 * Decoupled from turn scheduling (useTurnOrder) and UI (CombatView).
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
    CombatCharacter,
    CombatLogEntry,
    CombatState,
    BattleMapData,
    ReactiveTrigger,
    Position
} from '../../../types/combat';
import { MovementEffect } from '../../../types/spells';
import {
    ActiveSpellZone,
    ScheduledSpellEffect,
    MovementTriggerDebuff,
    convertSpellEffectToProcessed,
    resetZoneTurnTracking
} from '../../../systems/spells/effects';
import { AreaEffectTracker } from '../../../systems/spells/effects/AreaEffectTracker';
import { MovementCommand } from '../../../commands/effects/MovementCommand';
import { generateId, rollDice, calculateDamage, rollD20, getDistance } from '../../../utils/combat';
import { calculateSpellDC, rollSavingThrow } from '../../../utils/character';
import { SavePenaltySystem } from '../../../systems/combat/SavePenaltySystem';
import { getAbilityModifierValue } from '../../../utils/character';
import { hasLineOfSight } from '../../../utils/spatial/lineOfSight';
import { findPath } from '../../../utils/spatial/pathfinding';
import { applyDamageAndCheckDowned, applyHealingAndRestore } from '../../../utils/combat/deathSaveUtils';
import { applyRuntimeStatusCondition } from '../../../utils/combat/statusConditionUtils';
import { resolveOnDamageSpellEffect } from '../../../systems/spells/effects/onDamageSpellEffects';
import { removeRepeatSaveLinkedEffects } from '../../../utils/combat/repeatSaveUtils';

// Repeat-save metadata now lives on StatusEffect, but not every repeat-save
// shape is a saving throw. Some spell data asks for ability checks such as
// `strength_check`; those need a separate check resolver instead of being
// forced through the saving-throw roller.
type RepeatSaveRollAbility = Parameters<typeof rollSavingThrow>[1];
type RepeatSaveMetadata = NonNullable<CombatCharacter['statusEffects'][number]['repeatSave']>;
type RepeatSaveRuntimeStatus = CombatCharacter['statusEffects'][number];
type RepeatSaveCheckAbility = 'strength_check' | 'wisdom_check';
type RepeatSaveRuntimeTiming = 'turn_end' | 'turn_start' | 'on_damage' | 'on_action' | 'after_forced_movement';
type CharacterStatKey = keyof CombatCharacter['stats'];

const REPEAT_SAVE_ROLL_ABILITIES = new Set<string>([
    'Strength',
    'Dexterity',
    'Constitution',
    'Intelligence',
    'Wisdom',
    'Charisma'
]);

const isRepeatSaveRollAbility = (saveType: unknown): saveType is RepeatSaveRollAbility => (
    typeof saveType === 'string' && REPEAT_SAVE_ROLL_ABILITIES.has(saveType)
);

const REPEAT_SAVE_CHECK_ABILITIES: Record<RepeatSaveCheckAbility, { statKey: CharacterStatKey; label: string }> = {
    strength_check: { statKey: 'strength', label: 'Strength' },
    wisdom_check: { statKey: 'wisdom', label: 'Wisdom' }
};

const isRepeatSaveCheckAbility = (saveType: unknown): saveType is RepeatSaveCheckAbility => (
    typeof saveType === 'string' && saveType in REPEAT_SAVE_CHECK_ABILITIES
);

const hasNoLineOfSightPrerequisite = (repeat: RepeatSaveMetadata): boolean => (
    repeat.prerequisites?.includes('no_line_of_sight_to_caster') === true
);

// Some spells, such as Tasha's Hideous Laughter, use one normal repeat-save
// timing and then add a second timing for special events like damage. Keep the
// match logic in one named helper so the engine does not accidentally treat
// additional timings as schema-only metadata again.
const repeatSaveMatchesTiming = (
    repeat: RepeatSaveMetadata,
    timing: RepeatSaveRuntimeTiming
): boolean => (
    repeat.timing === timing || repeat.additionalTimings?.includes(timing) === true
);

const getRepeatSaveDc = (repeat: RepeatSaveMetadata): number => {
    const repeatWithRuntimeDc = repeat as RepeatSaveMetadata & { dc?: unknown };
    return typeof repeatWithRuntimeDc.dc === 'number' ? repeatWithRuntimeDc.dc : 10;
};

// Flesh to Stone and Contagion do not end on a single repeat-save result. They
// count successes and failures until a configured threshold is reached. The
// count lives on the status effect because that is the durable runtime object
// already carried between turns.
const recordRepeatSaveProgress = (
    effect: RepeatSaveRuntimeStatus,
    success: boolean
): RepeatSaveRuntimeStatus => {
    const progress = effect.repeatSaveProgress ?? { successes: 0, failures: 0 };
    const consecutiveRequired = effect.repeatSave?.progression?.consecutiveRequired === true;

    return {
        ...effect,
        repeatSaveProgress: {
            successes: success
                ? progress.successes + 1
                : consecutiveRequired ? 0 : progress.successes,
            failures: success
                ? consecutiveRequired ? 0 : progress.failures
                : progress.failures + 1
        }
    };
};

const replaceRepeatSaveStatus = (
    character: CombatCharacter,
    updatedEffect: RepeatSaveRuntimeStatus
): CombatCharacter => ({
    ...character,
    statusEffects: character.statusEffects.map(effect =>
        effect.id === updatedEffect.id ? updatedEffect : effect
    )
});

const repeatSaveProgressionReached = (
    effect: RepeatSaveRuntimeStatus,
    success: boolean
): boolean => {
    const progression = effect.repeatSave?.progression;
    if (!progression || !effect.repeatSaveProgress) return false;

    if (success && progression.successThreshold) {
        return effect.repeatSaveProgress.successes >= progression.successThreshold;
    }

    if (!success && progression.failureThreshold) {
        return effect.repeatSaveProgress.failures >= progression.failureThreshold;
    }

    return false;
};

const progressionSuccessEndsEffect = (repeat: RepeatSaveMetadata): boolean => {
    const outcome = repeat.progression?.successOutcome;
    return !outcome || ['spell_ends', 'ends_spell', 'ends_condition', 'not_restrained'].includes(outcome);
};

const applyRepeatSaveFailureOutcome = (
    character: CombatCharacter,
    effect: RepeatSaveRuntimeStatus
): { character: CombatCharacter; handled: boolean; message?: string } => {
    const outcome = effect.repeatSave?.progression?.failureOutcome;

    // Flesh to Stone has a second structured effect for Petrified, but the
    // repeat-save engine owns the threshold moment. Apply both condition mirrors
    // here so combat rules, cleanup, and map-facing status surfaces agree.
    if (outcome === 'apply_petrified_condition') {
        const duration = effect.duration;
        const source = effect.source || String(effect.name);
        const sourceCasterId = effect.sourceCasterId;
        const petrifiedStatus: RepeatSaveRuntimeStatus = {
            id: generateId(),
            name: 'Petrified',
            type: 'debuff',
            description: `${character.name} is turned to stone after failing repeated saves.`,
            duration,
            source,
            sourceCasterId,
            effect: { type: 'condition' },
            visualEffect: 'petrified'
        };
        const petrifiedCondition = {
            name: 'Petrified',
            duration: { type: 'rounds' as const, value: duration },
            appliedTurn: 0,
            source,
            sourceCasterId
        };

        return {
            character: {
                ...character,
                statusEffects: [
                    ...character.statusEffects.filter(status => status.id !== effect.id && status.name !== 'Petrified'),
                    petrifiedStatus
                ],
                conditions: [
                    ...(character.conditions ?? []).filter(condition => condition.name !== effect.name && condition.name !== 'Petrified'),
                    petrifiedCondition
                ]
            },
            handled: true,
            message: `${character.name} is petrified after failing repeated saves against ${effect.name}.`
        };
    }

    // Contagion's current spell data already stores the seven-day Poisoned
    // duration on the status payload. Once the failure threshold is reached,
    // keep that condition and remove the repeat-save machine so future turns do
    // not keep rolling against an outcome that has already locked in.
    if (outcome === 'poisoned_duration_lasts_7_days') {
        const lockedEffect: RepeatSaveRuntimeStatus = {
            ...effect,
            duration: Math.max(effect.duration, 100800),
            repeatSave: undefined,
            repeatSaveProgress: undefined
        };

        return {
            character: replaceRepeatSaveStatus(character, lockedEffect),
            handled: true,
            message: `${character.name}'s ${effect.name} progression locks in for 7 days.`
        };
    }

    return { character, handled: false };
};

const rollRepeatSaveCheck = (
    character: CombatCharacter,
    saveType: RepeatSaveCheckAbility,
    dc: number,
    options: { advantage: boolean; disadvantage: boolean }
) => {
    const ability = REPEAT_SAVE_CHECK_ABILITIES[saveType];
    const score = character.stats[ability.statKey];
    const modifier = typeof score === 'number' ? getAbilityModifierValue(score) : 0;
    const roll = rollD20({ advantage: options.advantage, disadvantage: options.disadvantage });
    const total = roll + modifier;

    return {
        ability: ability.label,
        roll,
        total,
        success: total >= dc
    };
};

interface UseCombatEngineProps {
    characters: CombatCharacter[];
    mapData: BattleMapData | null;
    onCharacterUpdate: (character: CombatCharacter) => void;
    onLogEntry: (entry: CombatLogEntry) => void;
    onMapUpdate?: (mapData: BattleMapData) => void;
    addDamageNumber: (value: number, position: Position, type: 'damage' | 'heal' | 'miss') => void;
    /**
     * Optional replay seam for target-bound scheduled payloads. Ordinary combat
     * keeps rollDice randomness; deterministic scenario/replay callers can pin
     * legal totals without replacing timing, damage, HP, or cleanup behavior.
     */
    scheduledEffectDiceRoller?: ScheduledEffectDiceRoller;
    /**
     * Optional deterministic d20 source for scheduled recurring saves. The
     * shared saving-throw utility still owns modifiers, proficiency, and DC.
     */
    scheduledEffectSaveRng?: ScheduledEffectSaveRng;
}

export interface ScheduledEffectDiceRollContext {
    scheduledEffect: ScheduledSpellEffect;
    timing: 'turn_start' | 'turn_end';
    payload: 'damage' | 'heal';
}

export type ScheduledEffectDiceRoller = (
    dice: string,
    context: ScheduledEffectDiceRollContext,
) => number;

export interface ScheduledEffectSaveRollContext {
    scheduledEffect: ScheduledSpellEffect;
    timing: 'turn_start' | 'turn_end';
    target: CombatCharacter;
    saveDC: number;
}

export type ScheduledEffectSaveRng = (
    context: ScheduledEffectSaveRollContext,
) => number;

export const useCombatEngine = ({
    characters,
    mapData,
    onCharacterUpdate,
    onLogEntry,
    onMapUpdate,
    addDamageNumber,
    scheduledEffectDiceRoller,
    scheduledEffectSaveRng,
}: UseCombatEngineProps) => {

    // --- Engine State ---
    const [spellZones, setSpellZones] = useState<ActiveSpellZone[]>([]);
    const [scheduledSpellEffects, setScheduledSpellEffects] = useState<ScheduledSpellEffect[]>([]);
    const [movementDebuffs, setMovementDebuffs] = useState<MovementTriggerDebuff[]>([]);
    const [reactiveTriggers, setReactiveTriggers] = useState<ReactiveTrigger[]>([]);
    // A phase claim is written synchronously before a scheduled record fires.
    // This protects against two stale End Turn callbacks resolving the same
    // record before React has committed the queue update.
    const scheduledPhaseClaimsRef = useRef(new Set<string>());

    // A target that leaves combat cannot receive later turn phases. Remove only
    // target-orphaned schedules; source loss deliberately preserves delayed
    // spells such as Searing Smite and Acid Arrow, which do not require a live
    // or concentrating caster after they have been applied.
    useEffect(() => {
        const liveCharacterIds = new Set(characters.map(character => character.id));
        setScheduledSpellEffects(previousEffects => {
            const survivingEffects = previousEffects.filter(effect => liveCharacterIds.has(effect.targetId));
            if (survivingEffects.length === previousEffects.length) {
                return previousEffects;
            }

            const survivingIds = new Set(survivingEffects.map(effect => effect.id));
            scheduledPhaseClaimsRef.current = new Set(
                [...scheduledPhaseClaimsRef.current].filter(claim => (
                    [...survivingIds].some(effectId => claim.startsWith(`${effectId}:`))
                )),
            );
            return survivingEffects;
        });
    }, [characters]);

    // --- Core Mechanics ---

    const processRepeatSaves = useCallback((
        character: CombatCharacter,
        timing: RepeatSaveRuntimeTiming,
        actionEffectId?: string
    ): CombatCharacter => {
        let updatedCharacter = { ...character };
        const savedEffectIds: string[] = [];
        const savePenaltySystem = new SavePenaltySystem();

        updatedCharacter.statusEffects.forEach(effect => {
            const repeat = effect.repeatSave;
            if (!repeat) return;
            if (timing === 'on_action' && effect.id !== actionEffectId) return;
            if (!repeatSaveMatchesTiming(repeat, timing)) return;

            const dc = getRepeatSaveDc(repeat);
            let hasAdvantage = false;
            let hasDisadvantage = false;

            if (repeat.modifiers?.advantageOnDamage && character.damagedThisTurn) {
                hasAdvantage = true;
            }
            if (repeat.modifiers?.sizeAdvantage && character.stats.size && repeat.modifiers.sizeAdvantage.includes(character.stats.size)) {
                hasAdvantage = true;
            }
            if (repeat.modifiers?.sizeDisadvantage && character.stats.size && repeat.modifiers.sizeDisadvantage.includes(character.stats.size)) {
                hasDisadvantage = true;
            }
            if (repeat.modifiers?.disadvantage) {
                hasDisadvantage = true;
            }
            if (hasNoLineOfSightPrerequisite(repeat)) {
                const caster = characters.find(candidate => candidate.id === effect.sourceCasterId);
                const casterTile = caster ? mapData?.tiles.get(`${caster.position.x}-${caster.position.y}`) : undefined;
                const targetTile = mapData?.tiles.get(`${character.position.x}-${character.position.y}`);

                if (!caster || !mapData || !casterTile || !targetTile) {
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'status',
                        message: `${character.name}'s repeat save against ${effect.name} requires line-of-sight context that is not available yet.`,
                        characterId: character.id,
                        data: {
                            repeatPrerequisites: repeat.prerequisites,
                            effectId: effect.id,
                            sourceCasterId: effect.sourceCasterId
                        }
                    });
                    return;
                }

                if (hasLineOfSight(casterTile, targetTile, mapData)) {
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'status',
                        message: `${character.name} can still see ${caster.name}, so ${effect.name} does not grant a repeat save yet.`,
                        characterId: character.id,
                        data: { repeatPrerequisites: repeat.prerequisites, effectId: effect.id, sourceCasterId: effect.sourceCasterId }
                    });
                    return;
                }

                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${character.name} no longer has line of sight to ${caster.name}; ${effect.name} grants a repeat save.`,
                    characterId: character.id,
                    data: { repeatPrerequisites: repeat.prerequisites, effectId: effect.id, sourceCasterId: effect.sourceCasterId }
                });
            }

            if (isRepeatSaveCheckAbility(repeat.saveType)) {
                const checkResult = rollRepeatSaveCheck(updatedCharacter, repeat.saveType, dc, {
                    advantage: hasAdvantage,
                    disadvantage: hasDisadvantage
                });

                if (checkResult.success) {
                    let resolvedEffect = effect;
                    if (repeat.progression) {
                        resolvedEffect = recordRepeatSaveProgress(effect, true);
                        updatedCharacter = replaceRepeatSaveStatus(updatedCharacter, resolvedEffect);
                    }
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'status',
                        message: `${character.name} succeeds on ${checkResult.ability} check against ${effect.name}! (${checkResult.total} vs DC ${dc})`,
                        characterId: character.id
                    });
                    if (repeat.progression && repeatSaveProgressionReached(resolvedEffect, true)) {
                        onLogEntry({
                            id: generateId(),
                            timestamp: Date.now(),
                            type: 'status',
                            message: `${character.name} reaches ${effect.name}'s repeat-save success threshold.`,
                            characterId: character.id,
                            data: { effectId: effect.id, repeatSaveProgress: resolvedEffect.repeatSaveProgress }
                        });
                        if (progressionSuccessEndsEffect(repeat)) {
                            savedEffectIds.push(effect.id);
                        }
                    } else if (!repeat.progression && repeat.successEnds) {
                        savedEffectIds.push(effect.id);
                    }
                } else {
                    let resolvedEffect = effect;
                    if (repeat.progression) {
                        resolvedEffect = recordRepeatSaveProgress(effect, false);
                        updatedCharacter = replaceRepeatSaveStatus(updatedCharacter, resolvedEffect);
                    }
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'status',
                        message: `${character.name} fails ${checkResult.ability} check against ${effect.name}. (${checkResult.total} vs DC ${dc})`,
                        characterId: character.id
                    });
                    if (repeat.progression && repeatSaveProgressionReached(resolvedEffect, false)) {
                        const outcome = applyRepeatSaveFailureOutcome(updatedCharacter, resolvedEffect);
                        updatedCharacter = outcome.character;
                        onLogEntry({
                            id: generateId(),
                            timestamp: Date.now(),
                            type: 'status',
                            message: outcome.message || `${character.name} is fully overcome by ${effect.name}.`,
                            characterId: character.id,
                            data: {
                                effectId: effect.id,
                                repeatSaveProgress: resolvedEffect.repeatSaveProgress,
                                failureOutcome: repeat.progression.failureOutcome,
                                handled: outcome.handled
                            }
                        });
                    }
                }
                return;
            }

            if (!isRepeatSaveRollAbility(repeat.saveType)) {
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${character.name} holds steady against ${effect.name}.`,
                    characterId: character.id,
                    data: { repeatSaveType: repeat.saveType, effectId: effect.id }
                });
                return;
            }

            const saveType = repeat.saveType;
            const saveModifiers = savePenaltySystem.getActivePenalties(updatedCharacter);
            const roll = rollSavingThrow(updatedCharacter, saveType, dc, saveModifiers);

            let finalSuccess = roll.success;
            // ...advantage/disadvantage logic uses saveModifiers...
            if (hasAdvantage) {
                const roll2 = rollSavingThrow(updatedCharacter, saveType, dc, saveModifiers);
                finalSuccess = roll.success || roll2.success;
            } else if (hasDisadvantage) {
                const roll2 = rollSavingThrow(updatedCharacter, saveType, dc, saveModifiers);
                finalSuccess = roll.success && roll2.success;
            }

            // Immediately consume 'next_save' penalties if this roll was made
            if (updatedCharacter.savePenaltyRiders?.some(r => r.applies === 'next_save')) {
                updatedCharacter = {
                    ...updatedCharacter,
                    savePenaltyRiders: updatedCharacter.savePenaltyRiders.filter(r => r.applies !== 'next_save')
                };
            }

            if (roll.modifiersApplied && roll.modifiersApplied.length > 0) {
                const penaltyDetails = roll.modifiersApplied.map(m => `${m.value} from ${m.source}`).join(', ');
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${character.name}'s save is modified: ${penaltyDetails}`,
                    characterId: character.id
                });
            }

            if (finalSuccess) {
                let resolvedEffect = effect;
                if (repeat.progression) {
                    resolvedEffect = recordRepeatSaveProgress(effect, true);
                    updatedCharacter = replaceRepeatSaveStatus(updatedCharacter, resolvedEffect);
                }
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${character.name} succeeds on repeat save against ${effect.name}!`,
                    characterId: character.id
                });
                if (repeat.progression && repeatSaveProgressionReached(resolvedEffect, true)) {
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'status',
                        message: `${character.name} reaches ${effect.name}'s repeat-save success threshold.`,
                        characterId: character.id,
                        data: { effectId: effect.id, repeatSaveProgress: resolvedEffect.repeatSaveProgress }
                    });
                    if (progressionSuccessEndsEffect(repeat)) {
                        savedEffectIds.push(effect.id);
                    }
                } else if (!repeat.progression && repeat.successEnds) {
                    savedEffectIds.push(effect.id);
                }
            } else {
                let resolvedEffect = effect;
                if (repeat.progression) {
                    resolvedEffect = recordRepeatSaveProgress(effect, false);
                    updatedCharacter = replaceRepeatSaveStatus(updatedCharacter, resolvedEffect);
                }
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${character.name} fails repeat save against ${effect.name}.`,
                    characterId: character.id
                });
                if (repeat.progression && repeatSaveProgressionReached(resolvedEffect, false)) {
                    const outcome = applyRepeatSaveFailureOutcome(updatedCharacter, resolvedEffect);
                    updatedCharacter = outcome.character;
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'status',
                        message: outcome.message || `${character.name} is fully overcome by ${effect.name}.`,
                        characterId: character.id,
                        data: {
                            effectId: effect.id,
                            repeatSaveProgress: resolvedEffect.repeatSaveProgress,
                            failureOutcome: repeat.progression.failureOutcome,
                            handled: outcome.handled
                        }
                    });
                }
            }
        });

        if (savedEffectIds.length > 0) {
            // A successful repeat save ends the whole source-linked condition,
            // not only the legacy status label. The shared cleanup also removes
            // matching structured/active records, restores movement penalties,
            // and leaves unrelated spells on the target untouched.
            updatedCharacter = removeRepeatSaveLinkedEffects(
                updatedCharacter,
                savedEffectIds
            ).character;

            const demonControlReleased = savedEffectIds.some(effectId =>
                effectId.startsWith('summon-greater-demon-control-') &&
                updatedCharacter.summonMetadata?.aftermathState?.kind === 'summon_greater_demon_control'
            );
            if (demonControlReleased && updatedCharacter.summonMetadata) {
                updatedCharacter = {
                    ...updatedCharacter,
                    summonMetadata: {
                        ...updatedCharacter.summonMetadata,
                        commandsPerTurn: 0,
                        commandsUsedThisTurn: 0,
                        control: {
                            ...updatedCharacter.summonMetadata.control,
                            allegiance: 'uncontrolled_hostile',
                            obedience: 'pursues_and_attacks_nearest_non_demons'
                        },
                        aftermathState: {
                            ...updatedCharacter.summonMetadata.aftermathState,
                            kind: 'summon_greater_demon_uncontrolled',
                            controlBroken: true
                        }
                    }
                };
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${updatedCharacter.name}'s control ends; the demon turns hostile.`,
                    characterId: updatedCharacter.id,
                    data: { summonControl: 'broken', spellId: updatedCharacter.summonMetadata?.spellId } as any
                });
            }
        }

        return updatedCharacter;
    }, [characters, mapData, onLogEntry]);

    // Remove only the status/condition/active-effect mirrors owned by one
    // scheduled spell and caster. The repeat-save cleanup utility already
    // understands those paired records and restores movement when needed.
    const removeScheduledSourceLinks = useCallback((
        character: CombatCharacter,
        scheduledEffect: ScheduledSpellEffect,
    ): CombatCharacter => {
        const ownedStatusIds = character.statusEffects
            .filter(status => (
                status.sourceSpellId === scheduledEffect.spellId
                && status.sourceCasterId === scheduledEffect.casterId
            ))
            .map(status => status.id);

        return removeRepeatSaveLinkedEffects(character, ownedStatusIds).character;
    }, []);

    const handleDamage = useCallback((
        character: CombatCharacter,
        amount: number,
        source: string,
        damageType?: string,
        currentTurnNumber = 0,
        sourceCharacter?: CombatCharacter,
        damageTrigger?: 'turn_start' | 'turn_end' | 'on_start_turn_in_area' | 'on_end_turn_in_area',
    ): CombatCharacter => {
        let updatedCharacter = { ...character };

        // The same defense calculator serves immediate, environmental, and
        // scheduled packets. A known owner is passed through for source feats;
        // environmental callers remain source-less through the optional field.
        const triggeringDamage = calculateDamage(amount, sourceCharacter ?? null, character, damageType, {
            spellZones,
            characters
        });
        const onDamageResolution = resolveOnDamageSpellEffect(
            character,
            damageType,
            currentTurnNumber,
            triggeringDamage
        );
        const extraDamage = onDamageResolution.damageDice
            ? rollDice(onDamageResolution.damageDice)
            : 0;

        // Fold any matching rider into the same typed damage packet. This lets
        // Elemental Bane suppress resistance and lets vulnerability or immunity
        // affect both the triggering and extra damage consistently.
        updatedCharacter = onDamageResolution.character;
        const finalAmount = extraDamage > 0
            ? calculateDamage(amount + extraDamage, sourceCharacter ?? null, updatedCharacter, damageType, {
                spellZones,
                characters
            })
            : triggeringDamage;

        const updatedTarget = applyDamageAndCheckDowned(updatedCharacter, finalAmount);
        updatedCharacter = {
            ...updatedCharacter,
            currentHP: updatedTarget.currentHP,
            tempHP: updatedTarget.tempHP,
            temporaryHitPointSource: updatedTarget.temporaryHitPointSource,
            deathSaves: updatedTarget.deathSaves,
            statusEffects: updatedTarget.statusEffects,
            conditions: updatedTarget.conditions,
            damagedThisTurn: updatedTarget.damagedThisTurn
        };

        addDamageNumber(finalAmount, updatedCharacter.position, 'damage');

        // Check for death
        const isDeath = updatedCharacter.currentHP === 0 && character.currentHP > 0;

        onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'damage',
            message: `${character.name} takes ${finalAmount} ${damageType || ''} damage from ${source}${isDeath ? ' and is defeated!' : ''}`,
            characterId: character.id,
            data: {
                damage: amount,
                damageType,
                source,
                damageDealt: finalAmount,
                trigger: damageTrigger,
                // Delayed and area-phase callers pass the owning spell id as
                // `source`. Preserve that provenance even when no on-damage
                // rider fired during this packet.
                spellId: onDamageResolution.sourceSpellId
                    ?? (damageTrigger ? source : undefined),
                isDeath,
                targetTags: character.creatureTypes
            }
        });

        updatedCharacter = processRepeatSaves(updatedCharacter, 'on_damage');

        return updatedCharacter;
    }, [addDamageNumber, characters, onLogEntry, processRepeatSaves, spellZones]);

    const shouldKeepScheduledEffectAfterTrigger = useCallback((
        scheduledEffect: ScheduledSpellEffect,
        currentTurnNumber: number
    ): boolean => {
        if (scheduledEffect.expiresAtRound && scheduledEffect.expiresAtRound <= currentTurnNumber) {
            return false;
        }

        return scheduledEffect.effects.some(effect => {
            const trigger = effect.trigger as { frequency?: string } | undefined;
            const frequency = scheduledEffect.recurringMechanic?.frequency ?? trigger?.frequency;
            return !frequency || frequency === 'every_time' || frequency === 'first_per_turn';
        });
    }, []);

    const processScheduledSpellEffects = useCallback((
        character: CombatCharacter,
        timing: 'turn_start' | 'turn_end',
        currentTurnNumber: number
    ): CombatCharacter => {
        let updatedCharacter = { ...character };
        const scheduledIdsToRemove = new Set<string>();

        scheduledSpellEffects
            .filter(effect => effect.targetId === character.id && effect.timing === timing)
            .forEach(scheduledEffect => {
                // `expiresAtRound` is an exclusive boundary. A one-minute
                // record created in round 1 may fire through round 10, but the
                // round-11 phase removes its source links without an extra tick.
                if (
                    typeof scheduledEffect.expiresAtRound === 'number'
                    && scheduledEffect.expiresAtRound <= currentTurnNumber
                ) {
                    updatedCharacter = removeScheduledSourceLinks(updatedCharacter, scheduledEffect);
                    scheduledIdsToRemove.add(scheduledEffect.id);
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'status',
                        message: `${scheduledEffect.spellId} expires before ${character.name}'s ${timing === 'turn_start' ? 'turn starts' : 'turn ends'}; no scheduled payload fires.`,
                        characterId: character.id,
                        data: {
                            spellId: scheduledEffect.spellId,
                            effectId: scheduledEffect.id,
                            trigger: timing,
                            cleanup: 'scheduled_effect_expiry',
                        },
                    });
                    return;
                }

                // A round/timing pair can be requested twice by overlapping UI,
                // AI, or replay callbacks. Claim it before any roll so the
                // second request is a strict no-op, including one-shot records.
                const phaseClaim = `${scheduledEffect.id}:${currentTurnNumber}:${timing}`;
                if (scheduledPhaseClaimsRef.current.has(phaseClaim)) {
                    return;
                }
                scheduledPhaseClaimsRef.current.add(phaseClaim);

                const movementEffects = scheduledEffect.effects.filter((effect): effect is MovementEffect => effect.type === 'MOVEMENT');
                const processedEffects = scheduledEffect.effects.flatMap(effect => convertSpellEffectToProcessed(
                    effect,
                    {
                        spellId: scheduledEffect.spellId,
                        casterId: scheduledEffect.casterId,
                        saveDC: scheduledEffect.saveDC
                    },
                    scheduledEffect.recurringMechanic
                ));
                let didTrigger = false;
                let endedByRecurringSave = false;

                movementEffects.forEach(effect => {
                    // Scheduled movement effects reuse the command layer so push, pull,
                    // teleport, speed-change, collision, and map-bound rules stay aligned
                    // with immediately-cast movement spells instead of growing a second
                    // implementation inside the combat hook.
                    const positionBeforeMovement = updatedCharacter.position;
                    const caster = characters.find(candidate => candidate.id === scheduledEffect.casterId) || updatedCharacter;
                    const stateCharacters = characters.map(candidate =>
                        candidate.id === updatedCharacter.id ? updatedCharacter : candidate
                    );
                    const occupiedTileKeys = new Set(stateCharacters
                        .filter(candidate => candidate.id !== updatedCharacter.id)
                        .map(candidate => `${candidate.position.x}-${candidate.position.y}`));
                    const maxTeleportTiles = Math.max(0, Math.floor((effect.distance || 0) / 5));
                    const validScheduledMoves = effect.movementType === 'teleport' && mapData
                        ? Array.from(mapData.tiles.values())
                            .map(tile => (tile as any).coordinates || (tile as any).position)
                            .filter((position): position is Position => Boolean(position))
                            .filter(position => getDistance(updatedCharacter.position, position) <= maxTeleportTiles)
                            .filter(position => !occupiedTileKeys.has(`${position.x}-${position.y}`))
                            .filter(position => {
                                // The shared command performs final validation. This pre-filter
                                // just gives teleport fallback a useful candidate list when the
                                // delayed effect does not already carry a concrete destination.
                                const tile = mapData.tiles.get(`${position.x}-${position.y}`);
                                return !tile || !(tile as any).blocksMovement;
                            })
                        : [];
                    const command = new MovementCommand(effect, {
                        spellId: scheduledEffect.spellId,
                        spellName: scheduledEffect.spellId,
                        castAtLevel: 0,
                        caster,
                        targets: [updatedCharacter],
                        gameState: { mapData } as any
                    });
                    const commandState: CombatState = {
                        isActive: true,
                        characters: stateCharacters,
                        turnState: {
                            currentTurn: currentTurnNumber,
                            turnOrder: stateCharacters.map(candidate => candidate.id),
                            currentCharacterId: updatedCharacter.id,
                            phase: 'planning',
                            actionsThisTurn: []
                        },
                        selectedCharacterId: null,
                        selectedAbilityId: null,
                        actionMode: 'select',
                        validTargets: [],
                        validMoves: validScheduledMoves,
                        combatLog: [],
                        reactiveTriggers: [],
                        activeLightSources: [],
                        mapData: mapData || undefined
                    };
                    const nextState = command.execute(commandState) as CombatState;
                    const nextCharacter = nextState.characters.find(candidate => candidate.id === updatedCharacter.id);

                    if (nextCharacter) {
                        updatedCharacter = nextCharacter;
                    }

                    // Compulsion-style effects promise a repeat save after forced
                    // movement resolves. Only trigger that timing when the shared
                    // movement command actually changed the target's tile; blocked
                    // movement should not grant a save for a movement that did not
                    // happen.
                    const didMoveTarget = nextCharacter
                        ? nextCharacter.position.x !== positionBeforeMovement.x || nextCharacter.position.y !== positionBeforeMovement.y
                        : false;
                    if (didMoveTarget && effect.trigger?.movementType === 'forced') {
                        updatedCharacter = processRepeatSaves(updatedCharacter, 'after_forced_movement');
                    }

                    // MovementCommand writes to CombatState.combatLog, while this hook
                    // reports through `onLogEntry`. Forward only the command-generated
                    // entries so scheduled movement stays visible in the normal combat log.
                    nextState.combatLog.forEach(entry => onLogEntry(entry));
                    didTrigger = true;
                });

                processedEffects.forEach(effect => {
                    if (effect.type === 'damage' && effect.dice) {
                        const rolledDamage = scheduledEffectDiceRoller
                            ? scheduledEffectDiceRoller(effect.dice, {
                                scheduledEffect,
                                timing,
                                payload: 'damage'
                            })
                            : rollDice(effect.dice);
                        const caster = characters.find(candidate => candidate.id === scheduledEffect.casterId);

                        // Scheduled damage now enters the same transaction as
                        // ordinary engine damage: source-aware defenses first,
                        // then temporary HP, downing/death saves, logs, and
                        // on-damage repeat-save hooks.
                        updatedCharacter = handleDamage(
                            updatedCharacter,
                            rolledDamage,
                            scheduledEffect.spellId,
                            effect.damageType,
                            currentTurnNumber,
                            caster,
                            timing,
                        );
                        didTrigger = true;
                    }

                    if (effect.type === 'heal' && effect.dice) {
                        const healing = scheduledEffectDiceRoller
                            ? scheduledEffectDiceRoller(effect.dice, {
                                scheduledEffect,
                                timing,
                                payload: 'heal'
                            })
                            : rollDice(effect.dice);
                        const updatedTarget = applyHealingAndRestore(updatedCharacter, healing);
                        const actualHealing = updatedTarget.currentHP - updatedCharacter.currentHP;
                        updatedCharacter = {
                            ...updatedCharacter,
                            currentHP: updatedTarget.currentHP,
                            deathSaves: updatedTarget.deathSaves,
                            statusEffects: updatedTarget.statusEffects,
                            conditions: updatedTarget.conditions
                        };
                        addDamageNumber(actualHealing, updatedCharacter.position, 'heal');
                        didTrigger = true;
                        onLogEntry({
                            id: generateId(),
                            timestamp: Date.now(),
                            type: 'heal',
                            message: `${character.name} heals ${actualHealing} HP from ${scheduledEffect.spellId}.`,
                            characterId: character.id,
                            data: { healAmount: actualHealing, heal: actualHealing, trigger: timing, spellId: scheduledEffect.spellId }
                        });
                    }

                    if (effect.type === 'status_condition' && effect.statusName) {
                        // Scheduled spell effects should spend their trigger even when the
                        // target resists or is immune. Otherwise one-time delayed effects
                        // would keep retrying every turn after a successful save.
                        didTrigger = true;

                        // The scheduled record keeps the caster id, so saves can use the
                        // original spellcaster's DC. If that caster is not available in the
                        // current combat list, fall back to the target instead of dropping the
                        // effect entirely; this preserves old encounter data until caster
                        // ownership is wired everywhere.
                        const caster = characters.find(candidate => candidate.id === scheduledEffect.casterId);
                        const saveDcSource = caster || updatedCharacter;
                        const isImmune = updatedCharacter.conditionImmunities?.includes(effect.statusName as any);
                        let shouldApplyCondition = true;

                        if (effect.requiresSave && effect.saveType) {
                            const dc = scheduledEffect.saveDC ?? calculateSpellDC(saveDcSource);
                            const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as any, dc);
                            shouldApplyCondition = !saveResult.success;

                            onLogEntry({
                                id: generateId(),
                                timestamp: Date.now(),
                                type: 'status',
                                message: saveResult.success
                                    ? `${character.name} succeeds on ${effect.saveType} save against ${scheduledEffect.spellId}.`
                                    : `${character.name} fails ${effect.saveType} save against ${scheduledEffect.spellId}.`,
                                characterId: character.id,
                                data: { trigger: timing, spellId: scheduledEffect.spellId, saveType: effect.saveType, dc }
                            });
                        }

                        if (isImmune) {
                            onLogEntry({
                                id: generateId(),
                                timestamp: Date.now(),
                                type: 'status',
                                message: `${character.name} is immune to ${effect.statusName} from ${scheduledEffect.spellId}.`,
                                characterId: character.id,
                                data: { trigger: timing, spellId: scheduledEffect.spellId, statusName: effect.statusName }
                            });
                            return;
                        }

                        if (!shouldApplyCondition) {
                            return;
                        }

                        // Mirror the condition into both legacy statusEffects and the newer
                        // structured conditions array. Both surfaces are still active runtime
                        // readers, so scheduled status payloads must not become a lossy bridge.
                        const durationRounds = 1;
                        const statusEffect = {
                            id: generateId(),
                            name: effect.statusName,
                            type: 'debuff' as const,
                            duration: durationRounds,
                            source: scheduledEffect.spellId,
                            sourceCasterId: scheduledEffect.casterId,
                            effect: { type: 'condition' as const },
                            repeatSave: effect.repeatSave,
                            escapeCheck: effect.escapeCheck,
                            breakTriggers: effect.breakTriggers
                        };
                        const activeCondition = {
                            name: effect.statusName,
                            duration: { type: 'rounds' as const, value: durationRounds },
                            appliedTurn: currentTurnNumber,
                            source: scheduledEffect.spellId,
                            sourceCasterId: scheduledEffect.casterId,
                            repeatSave: effect.repeatSave,
                            escapeCheck: effect.escapeCheck,
                            breakTriggers: effect.breakTriggers
                        };

                        const applied = applyRuntimeStatusCondition(updatedCharacter, statusEffect, activeCondition);
                        updatedCharacter = applied.character;

                        onLogEntry({
                            id: generateId(),
                            timestamp: Date.now(),
                            type: 'status',
                            message: `${character.name} gains ${effect.statusName} from ${scheduledEffect.spellId}.`,
                            characterId: character.id,
                            data: { trigger: timing, spellId: scheduledEffect.spellId, statusName: effect.statusName, statusId: applied.appliedStatus.id }
                        });
                    }
                });

                // Recurring saves happen after every payload in this schedule.
                // Searing Smite therefore applies Fire damage first, then rolls
                // the captured original Constitution save. A success removes
                // exactly this schedule and its caster-owned status mirrors;
                // failure preserves both for the next target turn.
                const recurringSaveType = scheduledEffect.recurringMechanic?.saveType;
                if (didTrigger && recurringSaveType) {
                    const caster = characters.find(candidate => candidate.id === scheduledEffect.casterId);
                    const saveDC = scheduledEffect.saveDC
                        ?? (caster ? calculateSpellDC(caster) : undefined);

                    if (saveDC === undefined) {
                        onLogEntry({
                            id: generateId(),
                            timestamp: Date.now(),
                            type: 'status',
                            message: `${character.name} cannot resolve ${scheduledEffect.spellId}'s ${recurringSaveType} save because the original DC and source are unavailable; the schedule remains.`,
                            characterId: character.id,
                            data: {
                                spellId: scheduledEffect.spellId,
                                effectId: scheduledEffect.id,
                                saveType: recurringSaveType,
                                trigger: timing,
                                status: 'missing_original_dc',
                            },
                        });
                    } else if (!isRepeatSaveRollAbility(recurringSaveType)) {
                        onLogEntry({
                            id: generateId(),
                            timestamp: Date.now(),
                            type: 'status',
                            message: `${character.name} keeps ${scheduledEffect.spellId}; scheduled save type ${recurringSaveType} has no saving-throw adapter.`,
                            characterId: character.id,
                            data: {
                                spellId: scheduledEffect.spellId,
                                effectId: scheduledEffect.id,
                                saveType: recurringSaveType,
                                dc: saveDC,
                                trigger: timing,
                                status: 'unsupported_save_type',
                            },
                        });
                    } else {
                        const saveResult = rollSavingThrow(
                            updatedCharacter,
                            recurringSaveType,
                            saveDC,
                            undefined,
                            {
                                damageType: scheduledEffect.recurringMechanic?.damage?.type,
                                tags: ['magic', 'scheduled_effect'],
                            },
                            undefined,
                            {
                                rng: scheduledEffectSaveRng
                                    ? () => scheduledEffectSaveRng({
                                        scheduledEffect,
                                        timing,
                                        target: updatedCharacter,
                                        saveDC,
                                    })
                                    : undefined,
                            },
                        );
                        endedByRecurringSave = saveResult.success;

                        if (endedByRecurringSave) {
                            updatedCharacter = removeScheduledSourceLinks(updatedCharacter, scheduledEffect);
                            scheduledIdsToRemove.add(scheduledEffect.id);
                        }

                        onLogEntry({
                            id: generateId(),
                            timestamp: Date.now(),
                            type: 'status',
                            message: saveResult.success
                                ? `${character.name} succeeds on the ${recurringSaveType} save against ${scheduledEffect.spellId}; the owned schedule and condition end.`
                                : `${character.name} fails the ${recurringSaveType} save against ${scheduledEffect.spellId}; the owned schedule and condition continue.`,
                            characterId: character.id,
                            data: {
                                spellId: scheduledEffect.spellId,
                                effectId: scheduledEffect.id,
                                saveType: recurringSaveType,
                                dc: saveDC,
                                saveTotal: saveResult.total,
                                saveSucceeded: saveResult.success,
                                trigger: timing,
                                cleanup: saveResult.success ? 'scheduled_source_links' : 'none',
                            },
                        });
                    }
                }

                if (
                    didTrigger
                    && !endedByRecurringSave
                    && !shouldKeepScheduledEffectAfterTrigger(scheduledEffect, currentTurnNumber)
                ) {
                    scheduledIdsToRemove.add(scheduledEffect.id);
                }
            });

        if (scheduledIdsToRemove.size > 0) {
            setScheduledSpellEffects(previousEffects => previousEffects.filter(
                effect => !scheduledIdsToRemove.has(effect.id),
            ));
        }

        return updatedCharacter;
    }, [addDamageNumber, characters, handleDamage, mapData, onLogEntry, processRepeatSaves, removeScheduledSourceLinks, scheduledEffectDiceRoller, scheduledEffectSaveRng, scheduledSpellEffects, shouldKeepScheduledEffectAfterTrigger]);

    const processTileEffects = useCallback((
        character: CombatCharacter,
        tilePos: Position
    ): CombatCharacter => {
        if (!mapData) return character;

        const tileKey = `${tilePos.x}-${tilePos.y}`;
        const tile = mapData.tiles.get(tileKey);
        const envEffect = tile ? (tile as any).environmentalEffect : null;
        if (!tile || !envEffect) return character;

        let updatedChar = { ...character };
        const env = envEffect;

        if (env.effect.effect.type === 'damage_per_turn') {
            const damage = env.effect.effect.value || 0;
            if (damage > 0) {
                updatedChar = handleDamage(updatedChar, damage, env.effect.name, env.type === 'fire' ? 'fire' : 'bludgeoning');
            } else {
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${character.name} enters ${env.effect.name}.`,
                    characterId: character.id
                });
            }
        } else if (env.effect.effect.type === 'condition') {
            // Environmental conditions share the spell status refresh policy so
            // stepping through the same hazardous tile updates both mirrors
            // instead of leaving stale duplicate condition records behind.
            updatedChar = applyRuntimeStatusCondition(
                updatedChar,
                {
                    ...env.effect,
                    id: generateId(),
                    duration: 1,
                    source: env.effect.source || env.effect.name
                },
                {
                    name: env.effect.name,
                    duration: { type: 'rounds', value: 1 },
                    appliedTurn: 0,
                    source: env.effect.source || env.effect.name
                }
            ).character;
            onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${character.name} is affected by ${env.effect.name}.`,
                characterId: character.id
            });
        }

        return updatedChar;
    }, [mapData, handleDamage, onLogEntry]);

    const processStartOfTurnEffects = useCallback((character: CombatCharacter, currentTurnNumber: number) => {
        let updatedCharacter = { ...character };
        const tracker = new AreaEffectTracker(spellZones);
        const zoneResults = tracker.processStartTurn(updatedCharacter, currentTurnNumber);

        for (const result of zoneResults) {
            for (const effect of result.effects) {
                if (effect.type !== 'damage' || !effect.dice) continue;

                let damage = rollDice(effect.dice);
                const sourceCaster = effect.sourceContext?.casterId
                    ? characters.find(candidate => candidate.id === effect.sourceContext?.casterId)
                    : undefined;

                // Turn-start area damage uses the source DC captured by the
                // zone. A successful save changes only this packet; the shared
                // damage transaction below still owns defenses, temporary HP,
                // downing, and the final combat receipt.
                if (effect.requiresSave && isRepeatSaveRollAbility(effect.saveType)) {
                    const dc = effect.sourceContext?.saveDC
                        ?? calculateSpellDC(sourceCaster || updatedCharacter);
                    const saveResult = rollSavingThrow(updatedCharacter, effect.saveType, dc);
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'status',
                        message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                        characterId: updatedCharacter.id,
                        data: { trigger: 'on_start_turn_in_area', saveDC: dc, saveResult: saveResult.success }
                    });
                    if (saveResult.success) {
                        damage = effect.saveEffect === 'half' ? Math.floor(damage / 2) : 0;
                    }
                }

                updatedCharacter = handleDamage(
                    updatedCharacter,
                    damage,
                    effect.sourceContext?.spellId ?? 'spell area',
                    effect.damageType,
                    currentTurnNumber,
                    sourceCaster,
                    'on_start_turn_in_area',
                );
            }
        }

        return processScheduledSpellEffects(updatedCharacter, 'turn_start', currentTurnNumber);
    }, [characters, handleDamage, onLogEntry, processScheduledSpellEffects, spellZones]);

    const processEndOfTurnEffects = useCallback((character: CombatCharacter, currentTurnNumber: number) => {
        let updatedCharacter = { ...character };

        updatedCharacter = processTileEffects(updatedCharacter, updatedCharacter.position);

        // AreaEffectTracker holds no state beyond its zones, so a fresh
        // per-call instance is cheap and safe.
        const tracker = new AreaEffectTracker(spellZones);
        const zoneResults = tracker.processEndTurn(updatedCharacter, currentTurnNumber);
        for (const result of zoneResults) {
            for (const effect of result.effects) {
                if (effect.type === 'damage' && effect.dice) {
                    let damage = rollDice(effect.dice);
                    const sourceCaster = effect.sourceContext?.casterId
                        ? characters.find(candidate => candidate.id === effect.sourceContext?.casterId)
                        : undefined;

                    // End-turn zones resolve the same captured save and damage
                    // transaction as turn-start zones. This prevents a hazard
                    // phase from bypassing Fire resistance, immunity, temporary
                    // HP, or the canonical unconscious/death-save mirrors.
                    if (effect.requiresSave && isRepeatSaveRollAbility(effect.saveType)) {
                        const dc = effect.sourceContext?.saveDC
                            ?? calculateSpellDC(sourceCaster || updatedCharacter);
                        const saveResult = rollSavingThrow(updatedCharacter, effect.saveType, dc);
                        onLogEntry({
                            id: generateId(),
                            timestamp: Date.now(),
                            type: 'status',
                            message: `${updatedCharacter.name} ${saveResult.success ? 'succeeds' : 'fails'} ${effect.saveType} save (${saveResult.total} vs DC ${dc})`,
                            characterId: updatedCharacter.id,
                            data: { trigger: 'on_end_turn_in_area', saveDC: dc, saveResult: saveResult.success }
                        });
                        if (saveResult.success) {
                            damage = effect.saveEffect === 'half' ? Math.floor(damage / 2) : 0;
                        }
                    }

                    updatedCharacter = handleDamage(
                        updatedCharacter,
                        damage,
                        effect.sourceContext?.spellId ?? 'spell area',
                        effect.damageType,
                        currentTurnNumber,
                        sourceCaster,
                        'on_end_turn_in_area',
                    );
                }
            }
        }

        updatedCharacter = processScheduledSpellEffects(updatedCharacter, 'turn_end', currentTurnNumber);

        updatedCharacter.statusEffects.forEach(effect => {
            if (!effect.effect) {
                return;
            }
            switch (effect.effect.type) {
                case 'damage_per_turn': {
                    const dmg = effect.effect.value || 0;
                    updatedCharacter = handleDamage(updatedCharacter, dmg, effect.name, 'necrotic');
                    break;
                }
                case 'heal_per_turn': {
                    const heal = effect.effect.value || 0;
                    const updatedTarget = applyHealingAndRestore(updatedCharacter, heal);
                    updatedCharacter = {
                        ...updatedCharacter,
                        currentHP: updatedTarget.currentHP,
                        deathSaves: updatedTarget.deathSaves,
                        statusEffects: updatedTarget.statusEffects,
                        conditions: updatedTarget.conditions
                    };
                    addDamageNumber(heal, updatedCharacter.position, 'heal');
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'heal',
                        message: `${character.name} heals ${heal} HP from ${effect.name}`,
                        characterId: character.id,
                        data: { healAmount: heal, heal: heal, source: effect.name }
                    });
                    break;
                }
            }
        });

        if (updatedCharacter.concentratingOn?.sustainCost && !updatedCharacter.concentratingOn.sustainedThisTurn) {
            onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${character.name} lost concentration on ${updatedCharacter.concentratingOn.spellName} (failed to sustain).`,
                characterId: character.id
            });
            updatedCharacter.concentratingOn = undefined;
        }

        updatedCharacter = processRepeatSaves(updatedCharacter, 'turn_end');

        updatedCharacter.damagedThisTurn = false;

        onCharacterUpdate(updatedCharacter);
        return updatedCharacter;
    }, [addDamageNumber, characters, onCharacterUpdate, onLogEntry, spellZones, handleDamage, processRepeatSaves, processScheduledSpellEffects, processTileEffects]);

    // --- State Managers ---
    const addSpellZone = useCallback((zone: ActiveSpellZone) => {
        setSpellZones(prev => [...prev, zone]);
    }, []);

    const addScheduledSpellEffect = useCallback((scheduledEffect: ScheduledSpellEffect) => {
        // A stable schedule identity represents one future payload. Reset,
        // hydration, or a repeated cast callback may publish that same record.
        // Replace it in its existing slot so refreshing one record cannot move
        // it behind an independent effect and change authored phase order.
        setScheduledSpellEffects(previousEffects => {
            const existingIndex = previousEffects.findIndex(effect => effect.id === scheduledEffect.id);
            if (existingIndex < 0) {
                // A record absent from the queue is a new cast or an explicit
                // remove-then-reset. It may reuse a stable preview id, so its
                // prior generation's phase claims must not suppress it.
                scheduledPhaseClaimsRef.current = new Set(
                    [...scheduledPhaseClaimsRef.current].filter(claim => (
                        !claim.startsWith(`${scheduledEffect.id}:`)
                    )),
                );
                return [...previousEffects, scheduledEffect];
            }

            // Refreshing a still-live record preserves its phase claim. This
            // prevents hydration or duplicate callbacks from reopening an
            // already resolved round/timing pair and double-firing damage.
            return previousEffects.map((effect, index) => (
                index === existingIndex ? scheduledEffect : effect
            ));
        });
    }, []);

    const removeScheduledSpellEffect = useCallback((scheduledEffectId: string) => {
        scheduledPhaseClaimsRef.current = new Set(
            [...scheduledPhaseClaimsRef.current].filter(claim => !claim.startsWith(`${scheduledEffectId}:`)),
        );
        setScheduledSpellEffects(prev => prev.filter(effect => effect.id !== scheduledEffectId));
    }, []);

    const addMovementDebuff = useCallback((debuff: MovementTriggerDebuff) => {
        setMovementDebuffs(prev => [...prev, debuff]);
    }, []);

    const addReactiveTrigger = useCallback((trigger: ReactiveTrigger) => {
        setReactiveTriggers(prev => [...prev, trigger]);
    }, []);

    const removeSpellZone = useCallback((zoneId: string) => {
        setSpellZones(prev => prev.filter(z => z.id !== zoneId));
    }, []);

    const updateRoundBasedEffects = useCallback((
        currentTurnNumber: number,
        boundaryCharacters: CombatCharacter[] = [],
    ) => {
        resetZoneTurnTracking(spellZones);
        setSpellZones(prev => prev.filter(z => !z.expiresAtRound || z.expiresAtRound > currentTurnNumber + 1));

        // The next round number is the exclusive expiry boundary. Clean the
        // matching source-owned condition at the same boundary that removes
        // its schedule, so a one-minute status cannot outlive its damage clock.
        const expiringScheduledEffects = scheduledSpellEffects.filter(effect => (
            typeof effect.expiresAtRound === 'number'
            && effect.expiresAtRound <= currentTurnNumber + 1
        ));
        // End-of-turn damage is published just before the round transition,
        // while React's parent roster can still be one render behind. Overlay
        // those just-processed actors so expiry cleanup never republishes stale
        // HP, temporary HP, downing, or condition state.
        const boundaryCharactersById = new Map(
            characters.map(character => [character.id, character]),
        );
        boundaryCharacters.forEach(character => {
            boundaryCharactersById.set(character.id, character);
        });
        expiringScheduledEffects.forEach(effect => {
            const target = boundaryCharactersById.get(effect.targetId);
            if (!target) {
                return;
            }

            const cleanedTarget = removeScheduledSourceLinks(target, effect);
            if (cleanedTarget !== target) {
                // Carry one cleanup into the next effect for the same target;
                // independently expiring schedules must compose rather than
                // restore one another's source-owned condition mirrors.
                boundaryCharactersById.set(cleanedTarget.id, cleanedTarget);
                onCharacterUpdate(cleanedTarget);
            }
            onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${effect.spellId} reaches its round ${effect.expiresAtRound} expiry boundary; its owned schedule and condition end before another tick.`,
                characterId: target.id,
                data: {
                    spellId: effect.spellId,
                    effectId: effect.id,
                    cleanup: 'scheduled_effect_expiry',
                },
            });
        });
        const expiringScheduledIds = new Set(expiringScheduledEffects.map(effect => effect.id));
        scheduledPhaseClaimsRef.current = new Set(
            [...scheduledPhaseClaimsRef.current].filter(claim => (
                ![...expiringScheduledIds].some(effectId => claim.startsWith(`${effectId}:`))
            )),
        );
        setScheduledSpellEffects(previousEffects => previousEffects.filter(
            effect => !expiringScheduledIds.has(effect.id),
        ));
        setMovementDebuffs(prev => prev.filter(d => d.expiresAtRound > currentTurnNumber + 1 && !d.hasTriggered));
        setReactiveTriggers(prev => prev.filter(t => !t.expiresAtRound || t.expiresAtRound > currentTurnNumber + 1));

        if (mapData && onMapUpdate) {
            let mapModified = false;
            const newTiles = new Map(mapData.tiles);

            for (const [key, tile] of newTiles) {
                const environmentalEffect = (tile as any).environmentalEffect;
                if (environmentalEffect) {
                    const newDuration = environmentalEffect.duration - 1;

                    if (newDuration <= 0) {
                        const newTile = { ...tile };
                        (newTile as any).environmentalEffect = undefined;
                        if (environmentalEffect.type === 'difficult_terrain') {
                            newTile.movementCost = 1; // Assuming default 1     
                        }
                        newTiles.set(key, newTile);
                        mapModified = true;
                    } else {
                        const newTile = { ...tile };
                        (newTile as any).environmentalEffect = {
                            ...environmentalEffect,
                            duration: newDuration
                        };
                        newTiles.set(key, newTile);
                        mapModified = true;
                    }
                }
            }

            if (mapModified) {
                onMapUpdate({
                    ...mapData,
                    tiles: newTiles
                });
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `Environmental effects updated for Round ${currentTurnNumber + 1}.`,
                });
            }
        }
    }, [characters, mapData, onCharacterUpdate, onLogEntry, onMapUpdate, removeScheduledSourceLinks, scheduledSpellEffects, spellZones]);

    return {
        // State
        spellZones,
        scheduledSpellEffects,
        movementDebuffs,
        reactiveTriggers,

        // State Setters
        addSpellZone,
        removeSpellZone,
        setSpellZones,
        addScheduledSpellEffect,
        removeScheduledSpellEffect,
        setScheduledSpellEffects,
        addMovementDebuff,
        setMovementDebuffs,
        addReactiveTrigger,
        setReactiveTriggers,

        // Mechanics
        handleDamage,
        processRepeatSaves,
        processScheduledSpellEffects,
        processStartOfTurnEffects,
        processTileEffects,
        processEndOfTurnEffects,
        updateRoundBasedEffects,
        expireSavePenaltiesForCaster: useCallback((allCharacters: CombatCharacter[], casterId: string, currentTurn: number) => {
            const savePenaltySystem = new SavePenaltySystem();
            const mockState = {
                characters: allCharacters,
                turnState: { currentTurn }
            } as any;

            const newState = savePenaltySystem.expirePenalties(mockState, casterId);

            newState.characters.forEach((updated: CombatCharacter, index: number) => {
                if (updated !== allCharacters[index]) {
                    onCharacterUpdate(updated);
                }
            });
        }, [onCharacterUpdate])
    };
};
