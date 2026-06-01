// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/05/2026, 23:25:34
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 10 files
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
import { useState, useCallback } from 'react';
import {
    CombatCharacter,
    CombatLogEntry,
    CombatState,
    BattleMapData,
    ReactiveTrigger,
    Position,
    // TODO(lint-intent): 'Animation' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    Animation as _Animation
} from '../../../types/combat';
import { MovementEffect } from '../../../types/spells';
import {
    ActiveSpellZone,
    ScheduledSpellEffect,
    MovementTriggerDebuff,
    // TODO(lint-intent): 'processMovementTriggers' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    processMovementTriggers as _processMovementTriggers,
    convertSpellEffectToProcessed,
    resetZoneTurnTracking
} from '../../../systems/spells/effects';
import { AreaEffectTracker } from '../../../systems/spells/effects/AreaEffectTracker';
import { MovementCommand } from '../../../commands/effects/MovementCommand';
import { generateId, rollDice, calculateDamage, rollD20, getDistance } from '../../../utils/combatUtils';
import { calculateSpellDC, rollSavingThrow } from '../../../utils/savingThrowUtils';
import { SavePenaltySystem } from '../../../systems/combat/SavePenaltySystem';
import { getAbilityModifierValue } from '../../../utils/statUtils';
import { hasLineOfSight } from '../../../utils/spatial/lineOfSight';

// Repeat-save metadata now lives on StatusEffect, but not every repeat-save
// shape is a saving throw. Some spell data asks for ability checks such as
// `strength_check`; those need a separate check resolver instead of being
// forced through the saving-throw roller.
type RepeatSaveRollAbility = Parameters<typeof rollSavingThrow>[1];
type RepeatSaveMetadata = NonNullable<CombatCharacter['statusEffects'][number]['repeatSave']>;
type RepeatSaveCheckAbility = 'strength_check' | 'wisdom_check';
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

const getRepeatSaveDc = (repeat: RepeatSaveMetadata): number => {
    const repeatWithRuntimeDc = repeat as RepeatSaveMetadata & { dc?: unknown };
    return typeof repeatWithRuntimeDc.dc === 'number' ? repeatWithRuntimeDc.dc : 10;
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
}

export const useCombatEngine = ({
    characters,
    mapData,
    onCharacterUpdate,
    onLogEntry,
    onMapUpdate,
    addDamageNumber,
}: UseCombatEngineProps) => {

    // --- Engine State ---
    const [spellZones, setSpellZones] = useState<ActiveSpellZone[]>([]);
    const [scheduledSpellEffects, setScheduledSpellEffects] = useState<ScheduledSpellEffect[]>([]);
    const [movementDebuffs, setMovementDebuffs] = useState<MovementTriggerDebuff[]>([]);
    const [reactiveTriggers, setReactiveTriggers] = useState<ReactiveTrigger[]>([]);

    // --- Core Mechanics ---

    const processRepeatSaves = useCallback((
        character: CombatCharacter,
        timing: 'turn_end' | 'turn_start' | 'on_damage' | 'on_action',
        actionEffectId?: string
    ): CombatCharacter => {
        let updatedCharacter = { ...character };
        const savedEffectIds: string[] = [];
        const savePenaltySystem = new SavePenaltySystem();

        updatedCharacter.statusEffects.forEach(effect => {
            const repeat = effect.repeatSave;
            if (!repeat) return;
            if (timing === 'on_action' && effect.id !== actionEffectId) return;
            if (repeat.timing !== timing) return;

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
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'status',
                        message: `${character.name} succeeds on ${checkResult.ability} check against ${effect.name}! (${checkResult.total} vs DC ${dc})`,
                        characterId: character.id
                    });
                    if (repeat.successEnds) {
                        savedEffectIds.push(effect.id);
                    }
                } else {
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'status',
                        message: `${character.name} fails ${checkResult.ability} check against ${effect.name}. (${checkResult.total} vs DC ${dc})`,
                        characterId: character.id
                    });
                }
                return;
            }

            if (!isRepeatSaveRollAbility(repeat.saveType)) {
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${character.name}'s repeat check against ${effect.name} is not implemented yet (${repeat.saveType}).`,
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
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${character.name} succeeds on repeat save against ${effect.name}!`,
                    characterId: character.id
                });
                if (repeat.successEnds) {
                    savedEffectIds.push(effect.id);
                }
            } else {
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${character.name} fails repeat save against ${effect.name}.`,
                    characterId: character.id
                });
            }
        });

        if (savedEffectIds.length > 0) {
            updatedCharacter.statusEffects = updatedCharacter.statusEffects.filter(e => !savedEffectIds.includes(e.id));
        }

        return updatedCharacter;
    }, [characters, mapData, onLogEntry]);

    const handleDamage = useCallback((
        character: CombatCharacter,
        amount: number,
        source: string,
        damageType?: string
    ): CombatCharacter => {
        let updatedCharacter = { ...character };

        // Apply Resistance/Vulnerability if damageType provided
        // We pass null for caster as environmental damage has no specific caster usually,
        // or we don't have the caster object handy here.
        const finalAmount = calculateDamage(amount, null, character, damageType);

        updatedCharacter.currentHP = Math.max(0, updatedCharacter.currentHP - finalAmount);
        updatedCharacter.damagedThisTurn = true;

        addDamageNumber(finalAmount, updatedCharacter.position, 'damage');

        // Check for death
        const isDeath = updatedCharacter.currentHP === 0 && character.currentHP > 0;

        onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'damage',
            message: `${character.name} takes ${amount} ${damageType || ''} damage from ${source}${isDeath ? ' and is defeated!' : ''}`,
            characterId: character.id,
            data: {
                damage: amount,
                damageType,
                source,
                isDeath,
                targetTags: character.creatureTypes
            }
        });

        updatedCharacter = processRepeatSaves(updatedCharacter, 'on_damage');

        return updatedCharacter;
    }, [addDamageNumber, onLogEntry, processRepeatSaves]);

    const shouldKeepScheduledEffectAfterTrigger = useCallback((
        scheduledEffect: ScheduledSpellEffect,
        currentTurnNumber: number
    ): boolean => {
        if (scheduledEffect.expiresAtRound && scheduledEffect.expiresAtRound <= currentTurnNumber) {
            return false;
        }

        return scheduledEffect.effects.some(effect => {
            const frequency = effect.trigger?.frequency;
            return !frequency || frequency === 'every_time' || frequency === 'first_per_turn';
        });
    }, []);

    const processScheduledSpellEffects = useCallback((
        character: CombatCharacter,
        timing: 'turn_start' | 'turn_end',
        currentTurnNumber: number
    ): CombatCharacter => {
        let updatedCharacter = { ...character };
        const triggeredScheduledIds: string[] = [];

        scheduledSpellEffects
            .filter(effect => effect.targetId === character.id && effect.timing === timing)
            .forEach(scheduledEffect => {
                const movementEffects = scheduledEffect.effects.filter((effect): effect is MovementEffect => effect.type === 'MOVEMENT');
                const processedEffects = scheduledEffect.effects.flatMap(effect => convertSpellEffectToProcessed(effect));
                let didTrigger = false;

                movementEffects.forEach(effect => {
                    // Scheduled movement effects reuse the command layer so push, pull,
                    // teleport, speed-change, collision, and map-bound rules stay aligned
                    // with immediately-cast movement spells instead of growing a second
                    // implementation inside the combat hook.
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
                    const commandState = {
                        isActive: true,
                        characters: stateCharacters,
                        turnState: { currentTurn: currentTurnNumber },
                        selectedCharacterId: null,
                        selectedAbilityId: null,
                        actionMode: 'select',
                        validTargets: [],
                        validMoves: validScheduledMoves,
                        combatLog: [],
                        reactiveTriggers: [],
                        activeLightSources: [],
                        mapData: mapData || undefined
                    } as CombatState;
                    const nextState = command.execute(commandState) as CombatState;
                    const nextCharacter = nextState.characters.find(candidate => candidate.id === updatedCharacter.id);

                    if (nextCharacter) {
                        updatedCharacter = nextCharacter;
                    }

                    // MovementCommand writes to CombatState.combatLog, while this hook
                    // reports through `onLogEntry`. Forward only the command-generated
                    // entries so scheduled movement stays visible in the normal combat log.
                    nextState.combatLog.forEach(onLogEntry);
                    didTrigger = true;
                });

                processedEffects.forEach(effect => {
                    if (effect.type === 'damage' && effect.dice) {
                        const damage = rollDice(effect.dice);
                        updatedCharacter = { ...updatedCharacter, currentHP: Math.max(0, updatedCharacter.currentHP - damage) };
                        addDamageNumber(damage, updatedCharacter.position, 'damage');
                        didTrigger = true;
                        onLogEntry({
                            id: generateId(),
                            timestamp: Date.now(),
                            type: 'damage',
                            message: `${character.name} takes ${damage} ${effect.damageType || ''} damage from ${scheduledEffect.spellId}.`,
                            characterId: character.id,
                            data: { damage, damageType: effect.damageType, trigger: timing, spellId: scheduledEffect.spellId }
                        });
                    }

                    if (effect.type === 'heal' && effect.dice) {
                        const healing = rollDice(effect.dice);
                        const nextHP = Math.min(updatedCharacter.maxHP, updatedCharacter.currentHP + healing);
                        const actualHealing = nextHP - updatedCharacter.currentHP;
                        updatedCharacter = { ...updatedCharacter, currentHP: nextHP };
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

                        updatedCharacter = {
                            ...updatedCharacter,
                            statusEffects: [...(updatedCharacter.statusEffects || []), statusEffect],
                            conditions: [...(updatedCharacter.conditions || []), activeCondition]
                        };

                        onLogEntry({
                            id: generateId(),
                            timestamp: Date.now(),
                            type: 'status',
                            message: `${character.name} gains ${effect.statusName} from ${scheduledEffect.spellId}.`,
                            characterId: character.id,
                            data: { trigger: timing, spellId: scheduledEffect.spellId, statusName: effect.statusName }
                        });
                    }
                });

                if (didTrigger && !shouldKeepScheduledEffectAfterTrigger(scheduledEffect, currentTurnNumber)) {
                    triggeredScheduledIds.push(scheduledEffect.id);
                }
            });

        if (triggeredScheduledIds.length > 0) {
            setScheduledSpellEffects(prev => prev.filter(effect => !triggeredScheduledIds.includes(effect.id)));
        }

        return updatedCharacter;
    }, [addDamageNumber, characters, mapData, onLogEntry, scheduledSpellEffects, shouldKeepScheduledEffectAfterTrigger]);

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
            const hasCondition = updatedChar.statusEffects.some(s => s.name === env.effect.name);
            if (!hasCondition) {
                updatedChar.statusEffects = [...updatedChar.statusEffects, {
                    ...env.effect,
                    id: generateId(),
                    duration: 1
                }];
                onLogEntry({
                    id: generateId(),
                    timestamp: Date.now(),
                    type: 'status',
                    message: `${character.name} is affected by ${env.effect.name}.`,
                    characterId: character.id
                });
            }
        }

        return updatedChar;
    }, [mapData, handleDamage, onLogEntry]);

    const processEndOfTurnEffects = useCallback((character: CombatCharacter, currentTurnNumber: number) => {
        let updatedCharacter = { ...character };

        updatedCharacter = processTileEffects(updatedCharacter, updatedCharacter.position);

        // TODO: `AreaEffectTracker` is instantiated fresh for each movement action (`new AreaEffectTracker(spellZones)`).
        // This is inefficient and loses any stateful tracking (though current impl doesn't hold state beyond zones).
        // If we add stateful behavior (e.g., caching position lookups), consider:
        // 1. Lifting `AreaEffectTracker` to a ref or context-level singleton.
        // 2. Passing the zones array at method call time instead of constructor time.
        const tracker = new AreaEffectTracker(spellZones);
        const zoneResults = tracker.processEndTurn(updatedCharacter, currentTurnNumber);
        for (const result of zoneResults) {
            for (const effect of result.effects) {
                if (effect.type === 'damage' && effect.dice) {
                    const damage = rollDice(effect.dice);
                    updatedCharacter = { ...updatedCharacter, currentHP: Math.max(0, updatedCharacter.currentHP - damage) };
                    addDamageNumber(damage, updatedCharacter.position, 'damage');
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'damage',
                        message: `${character.name} takes ${damage} ${effect.damageType || ''} damage for ending turn in a hazard!`,
                        characterId: character.id,
                        data: { damage, damageType: effect.damageType, trigger: 'on_end_turn_in_area' }
                    });
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
                    // TODO(lint-intent): Consider centralizing per-turn damage tick logic for status effects.
                    const dmg = effect.effect.value || 0;
                    updatedCharacter = handleDamage(updatedCharacter, dmg, effect.name, 'necrotic');
                    break;
                }
                case 'heal_per_turn': {
                    // TODO(lint-intent): Consider centralizing per-turn healing tick logic for status effects.
                    const heal = effect.effect.value || 0;
                    updatedCharacter.currentHP = Math.min(updatedCharacter.maxHP, updatedCharacter.currentHP + heal);
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
    }, [addDamageNumber, onCharacterUpdate, onLogEntry, spellZones, handleDamage, processRepeatSaves, processScheduledSpellEffects, processTileEffects]);

    // --- State Managers ---
    const addSpellZone = useCallback((zone: ActiveSpellZone) => {
        setSpellZones(prev => [...prev, zone]);
    }, []);

    const addScheduledSpellEffect = useCallback((scheduledEffect: ScheduledSpellEffect) => {
        setScheduledSpellEffects(prev => [...prev, scheduledEffect]);
    }, []);

    const removeScheduledSpellEffect = useCallback((scheduledEffectId: string) => {
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

    const updateRoundBasedEffects = useCallback((currentTurnNumber: number) => {
        resetZoneTurnTracking(spellZones);
        setSpellZones(prev => prev.filter(z => !z.expiresAtRound || z.expiresAtRound > currentTurnNumber + 1));
        setScheduledSpellEffects(prev => prev.filter(effect => !effect.expiresAtRound || effect.expiresAtRound > currentTurnNumber + 1));
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
    }, [mapData, onMapUpdate, onLogEntry, spellZones]);

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
