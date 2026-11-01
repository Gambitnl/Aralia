/**
 * @file hooks/combat/engine/useCombatEngine.ts
 * Core combat simulation engine.
 * Handles the "physics" of combat: damage, saving throws, area effects, and triggers.
 * Decoupled from turn scheduling (useTurnOrder) and UI (CombatView).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: hooks/combat/turnManager/useTurnLifecycle.ts, hooks/combat/useTurnManager.ts
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useState, useCallback, useEffect, useRef } from 'react';
import {
    CombatCharacter,
    CombatLogEntry,
    CombatState,
    BattleMapData,
    LightSource,
    ReactiveTrigger,
    Position
} from '../../../types/combat';
import { MovementEffect } from '../../../types/spells';
import type { ConditionName, SavingThrowAbility } from '../../../types/spells';
import {
    ActiveSpellZone,
    ScheduledSpellEffect,
    MovementTriggerDebuff,
    convertSpellEffectToProcessed,
    resetZoneTurnTracking
} from '../../../systems/spells/effects';
import { AreaEffectTracker } from '../../../systems/spells/effects/AreaEffectTracker';
import { MovementCommand } from '../../../commands/effects/MovementCommand';
import { generateId, getDistance } from '../../../utils/combat';
import { rollDice } from '../../../systems/dice/rollers';
import { calculateSpellDC, rollSavingThrow } from '../../../utils/character';
import { SavePenaltySystem } from '../../../systems/combat/SavePenaltySystem';
import type { SavePenaltyExpiryState } from '../../../systems/combat/SavePenaltySystem';
import { applyHealingAndRestore } from '../../../utils/combat/deathSaveUtils';
import { applyRuntimeStatusCondition } from '../../../utils/combat/statusConditionUtils';
import { getStatusDiscriminator } from '../../../types/combatMessages';
import { runRepeatSaves, isRepeatSaveRollAbility, type RepeatSaveRuntimeTiming } from '../../../systems/combat/engine/repeatSaves';
import { removeScheduledSourceLinks as removeScheduledSourceLinksRule, shouldKeepScheduledEffectAfterTrigger as shouldKeepScheduledEffectAfterTriggerRule } from '../../../systems/combat/engine/scheduledEffectRules';
import { breakConcentrationThroughCommandLayer as breakConcentrationRule } from '../../../systems/combat/engine/concentrationBreak';
import { resolveDamage } from '../../../systems/combat/engine/damage';
import { resolveTileEffects } from '../../../systems/combat/engine/tileEffects';

// C2 (agora-9ed9.2): the repeat-save rules, the damage packet, concentration
// breaks, tile effects and the scheduled-effect cleanup rules now live in
// systems/combat/engine/. This hook keeps state, phase ownership and the
// useCallback wrappers below.

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
    /**
     * Light sources currently on the board, owned by the composing hook.
     *
     * Concentration cleanup ends the lights a concentration spell created, and
     * the engine is where hook-path damage breaks concentration, so the owner
     * lends the list and takes back whatever survives.
     */
    activeLightSources?: LightSource[];
    /** Publishes the light sources that survive a concentration break. */
    onActiveLightSourcesUpdate?: (lightSources: LightSource[]) => void;
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
    activeLightSources,
    onActiveLightSourcesUpdate,
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
    ): CombatCharacter => runRepeatSaves({ characters, mapData, onLogEntry }, character, timing, actionEffectId), [characters, mapData, onLogEntry]);

    // Remove only the status/condition/active-effect mirrors owned by one
    // scheduled spell and caster. The repeat-save cleanup utility already
    // understands those paired records and restores movement when needed.
    const removeScheduledSourceLinks = useCallback((
        character: CombatCharacter,
        scheduledEffect: ScheduledSpellEffect,
    ): CombatCharacter => removeScheduledSourceLinksRule(character, scheduledEffect), []);

    /**
   * Ends one creature's concentration through `BreakConcentrationCommand`, the
   * same command `DamageCommand` runs when a command-path packet breaks
   * concentration. Running the command rather than a second hand-written
   * cleanup is what keeps the two paths from drifting: riders, status effects,
   * conditions, light sources, spell zones, emanations and every other
   * concentration-owned record are ended by one implementation.
   *
   * Returns the concentrator as the command left it. Every other combatant the
   * cleanup touched is published, and the surviving zones and lights are handed
   * back to their owners.
   */
    const breakConcentrationThroughCommandLayer = useCallback((
        concentrator: CombatCharacter,
    ): CombatCharacter => breakConcentrationRule({ activeLightSources, characters, mapData, onActiveLightSourcesUpdate, onCharacterUpdate, onLogEntry, spellZones, setSpellZones }, concentrator), [activeLightSources, characters, mapData, onActiveLightSourcesUpdate, onCharacterUpdate, onLogEntry, spellZones]);

    const handleDamage = useCallback((
        character: CombatCharacter,
        amount: number,
        source: string,
        damageType?: string,
        currentTurnNumber = 0,
        sourceCharacter?: CombatCharacter,
        damageTrigger?: 'turn_start' | 'turn_end' | 'on_start_turn_in_area' | 'on_end_turn_in_area',
    ): CombatCharacter => resolveDamage({ addDamageNumber, breakConcentrationThroughCommandLayer, characters, onLogEntry, processRepeatSaves, spellZones }, character, amount, source, damageType, currentTurnNumber, sourceCharacter, damageTrigger), [addDamageNumber, breakConcentrationThroughCommandLayer, characters, onLogEntry, processRepeatSaves, spellZones]);

    const shouldKeepScheduledEffectAfterTrigger = useCallback((
        scheduledEffect: ScheduledSpellEffect,
        currentTurnNumber: number
    ): boolean => shouldKeepScheduledEffectAfterTriggerRule(scheduledEffect, currentTurnNumber), []);

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
                            .map(tile => tile.coordinates)
                            .filter((position): position is Position => Boolean(position))
                            .filter(position => getDistance(updatedCharacter.position, position) <= maxTeleportTiles)
                            .filter(position => !occupiedTileKeys.has(`${position.x}-${position.y}`))
                            .filter(position => {
                                // The shared command performs final validation. This pre-filter
                                // just gives teleport fallback a useful candidate list when the
                                // delayed effect does not already carry a concrete destination.
                                const tile = mapData.tiles.get(`${position.x}-${position.y}`);
                                return !tile || !tile.blocksMovement;
                            })
                        : [];
                    const command = new MovementCommand(effect, {
                        spellId: scheduledEffect.spellId,
                        spellName: scheduledEffect.spellId,
                        castAtLevel: 0,
                        caster,
                        targets: [updatedCharacter]
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
                        const isImmune = updatedCharacter.conditionImmunities?.includes(effect.statusName as ConditionName);
                        let shouldApplyCondition = true;

                        if (effect.requiresSave && effect.saveType) {
                            const dc = scheduledEffect.saveDC ?? calculateSpellDC(saveDcSource);
                            const saveResult = rollSavingThrow(updatedCharacter, effect.saveType as SavingThrowAbility, dc);
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
                            // agora-db71.10: the emitter knows which status it just applied, so it says so.
                            // The adapter's live lookup can only classify a record whose named effect is still
                            // on the character when the record is converted; a stamp survives that.
                            eventClass: getStatusDiscriminator(statusEffect.type)?.eventClass,
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
    ): CombatCharacter => resolveTileEffects({ mapData, handleDamage, onLogEntry }, character, tilePos), [mapData, handleDamage, onLogEntry]);

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
                const environmentalEffect = tile.environmentalEffect;
                if (environmentalEffect) {
                    const newDuration = environmentalEffect.duration - 1;

                    if (newDuration <= 0) {
                        const newTile = { ...tile };
                        newTile.environmentalEffect = undefined;
                        if (environmentalEffect.type === 'difficult_terrain') {
                            newTile.movementCost = 1; // Assuming default 1     
                        }
                        newTiles.set(key, newTile);
                        mapModified = true;
                    } else {
                        const newTile = { ...tile };
                        newTile.environmentalEffect = {
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
            const mockState: SavePenaltyExpiryState = {
                characters: allCharacters,
                turnState: { currentTurn }
            };

            const newState = savePenaltySystem.expirePenalties(mockState, casterId);

            newState.characters.forEach((updated: CombatCharacter, index: number) => {
                if (updated !== allCharacters[index]) {
                    onCharacterUpdate(updated);
                }
            });
        }, [onCharacterUpdate])
    };
};
