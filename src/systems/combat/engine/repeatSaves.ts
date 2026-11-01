/**
 * @file systems/combat/engine/repeatSaves.ts
 * Repeat saves on active status effects: timing, DC, rolls, progression and outcomes.
 *
 * C2 (agora-9ed9.2): moved out of hooks/combat/engine/useCombatEngine.ts so the
 * rules can be read and tested without React. Bodies are unchanged; values the
 * hook used to close over now arrive through a context object under the same
 * names. The hook keeps a useCallback wrapper with the original dependency list,
 * so callback identity and phase ownership do not change.
 *
 * Called by: hooks/combat/engine/useCombatEngine.ts
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: hooks/combat/engine/useCombatEngine.ts, systems/combat/engine/engineContextTypes.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter } from '../../../types/combat';
import { generateId } from '../../../utils/combat';
import { rollD20 } from '../../../systems/dice/rollers';
import { rollSavingThrow } from '../../../utils/character';
import { SavePenaltySystem } from '../../../systems/combat/SavePenaltySystem';
import { getAbilityModifierValue } from '../../../utils/character';
import { hasLineOfSight } from '../../../utils/spatial/lineOfSight';
import { removeRepeatSaveLinkedEffects } from '../../../utils/combat/repeatSaveUtils';
import type { RepeatSaveRunContext } from './engineContextTypes';

// Repeat-save metadata now lives on StatusEffect, but not every repeat-save
// shape is a saving throw. Some spell data asks for ability checks such as
// `strength_check`; those need a separate check resolver instead of being
// forced through the saving-throw roller.
export type RepeatSaveRollAbility = Parameters<typeof rollSavingThrow>[1];
export type RepeatSaveMetadata = NonNullable<CombatCharacter['statusEffects'][number]['repeatSave']>;
export type RepeatSaveRuntimeStatus = CombatCharacter['statusEffects'][number];
export type RepeatSaveCheckAbility = 'strength_check' | 'wisdom_check';
export type RepeatSaveRuntimeTiming = 'turn_end' | 'turn_start' | 'on_damage' | 'on_action' | 'after_forced_movement';
export type CharacterStatKey = keyof CombatCharacter['stats'];

export const REPEAT_SAVE_ROLL_ABILITIES = new Set<string>([
    'Strength',
    'Dexterity',
    'Constitution',
    'Intelligence',
    'Wisdom',
    'Charisma'
]);

export const isRepeatSaveRollAbility = (saveType: unknown): saveType is RepeatSaveRollAbility => (
    typeof saveType === 'string' && REPEAT_SAVE_ROLL_ABILITIES.has(saveType)
);

export const REPEAT_SAVE_CHECK_ABILITIES: Record<RepeatSaveCheckAbility, { statKey: CharacterStatKey; label: string }> = {
    strength_check: { statKey: 'strength', label: 'Strength' },
    wisdom_check: { statKey: 'wisdom', label: 'Wisdom' }
};

export const isRepeatSaveCheckAbility = (saveType: unknown): saveType is RepeatSaveCheckAbility => (
    typeof saveType === 'string' && saveType in REPEAT_SAVE_CHECK_ABILITIES
);

export const hasNoLineOfSightPrerequisite = (repeat: RepeatSaveMetadata): boolean => (
    repeat.prerequisites?.includes('no_line_of_sight_to_caster') === true
);

// Some spells, such as Tasha's Hideous Laughter, use one normal repeat-save
// timing and then add a second timing for special events like damage. Keep the
// match logic in one named helper so the engine does not accidentally treat
// additional timings as schema-only metadata again.
export const repeatSaveMatchesTiming = (
    repeat: RepeatSaveMetadata,
    timing: RepeatSaveRuntimeTiming
): boolean => (
    repeat.timing === timing || repeat.additionalTimings?.includes(timing) === true
);

export const getRepeatSaveDc = (repeat: RepeatSaveMetadata): number => {
    const repeatWithRuntimeDc = repeat as RepeatSaveMetadata & { dc?: unknown };
    return typeof repeatWithRuntimeDc.dc === 'number' ? repeatWithRuntimeDc.dc : 10;
};

// Flesh to Stone and Contagion do not end on a single repeat-save result. They
// count successes and failures until a configured threshold is reached. The
// count lives on the status effect because that is the durable runtime object
// already carried between turns.
export const recordRepeatSaveProgress = (
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

export const replaceRepeatSaveStatus = (
    character: CombatCharacter,
    updatedEffect: RepeatSaveRuntimeStatus
): CombatCharacter => ({
    ...character,
    statusEffects: character.statusEffects.map(effect =>
        effect.id === updatedEffect.id ? updatedEffect : effect
    )
});

export const repeatSaveProgressionReached = (
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

export const progressionSuccessEndsEffect = (repeat: RepeatSaveMetadata): boolean => {
    const outcome = repeat.progression?.successOutcome;
    return !outcome || ['spell_ends', 'ends_spell', 'ends_condition', 'not_restrained'].includes(outcome);
};

export const applyRepeatSaveFailureOutcome = (
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

export const rollRepeatSaveCheck = (
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

export function runRepeatSaves(
    ctx: RepeatSaveRunContext,
    character: CombatCharacter,
    timing: RepeatSaveRuntimeTiming,
    actionEffectId?: string,
): CombatCharacter {
    const { characters, mapData, onLogEntry } = ctx;
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
                data: { summonControl: 'broken', spellId: updatedCharacter.summonMetadata?.spellId }
            });
        }
    }

    return updatedCharacter;
}
