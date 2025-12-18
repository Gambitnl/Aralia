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
    BattleMapData,
    ReactiveTrigger,
    Position,
    Animation
} from '../../../types/combat';
import {
    ActiveSpellZone,
    MovementTriggerDebuff,
    processMovementTriggers,
    resetZoneTurnTracking
} from '../../../systems/spells/effects';
import { AreaEffectTracker } from '../../../systems/spells/effects/AreaEffectTracker';
import { generateId, rollDice, calculateDamage } from '../../../utils/combatUtils';
import { calculateSpellDC, rollSavingThrow } from '../../../utils/savingThrowUtils';
import { SavePenaltySystem } from '../../../systems/combat/SavePenaltySystem';

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
    const [movementDebuffs, setMovementDebuffs] = useState<MovementTriggerDebuff[]>([]);
    const [reactiveTriggers, setReactiveTriggers] = useState<ReactiveTrigger[]>([]);

    // --- Core Mechanics ---

    const processRepeatSaves = useCallback((
        character: CombatCharacter,
        timing: 'turn_end' | 'turn_start' | 'on_damage' | 'on_action',
        actionEffectId?: string
    ): CombatCharacter => {
        let updatedCharacter = { ...character };
        let savedEffectIds: string[] = [];
        const savePenaltySystem = new SavePenaltySystem();

        updatedCharacter.statusEffects.forEach(effect => {
            const repeat = effect.repeatSave;
            if (!repeat) return;
            if (timing === 'on_action' && effect.id !== actionEffectId) return;
            if (repeat.timing !== timing) return;

            const dc = repeat.dc || 10;
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

            const saveType = repeat.saveType as any;
            const savePenalties = savePenaltySystem.getActivePenalties(character);
            const roll = rollSavingThrow(character, saveType, dc, savePenalties);

            let finalSuccess = roll.success;
            if (hasAdvantage) {
                const roll2 = rollSavingThrow(character, saveType, dc, savePenalties);
                finalSuccess = roll.success || roll2.success;
            } else if (hasDisadvantage) {
                const roll2 = rollSavingThrow(character, saveType, dc, savePenalties);
                finalSuccess = roll.success && roll2.success;
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

        if (updatedCharacter.savePenaltyRiders && updatedCharacter.savePenaltyRiders.length > 0) {
            updatedCharacter = {
                ...updatedCharacter,
                savePenaltyRiders: updatedCharacter.savePenaltyRiders.filter(r => r.applies !== 'next_save')
            };
        }

        return updatedCharacter;
    }, [onLogEntry]);

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

        onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'damage',
            message: `${character.name} takes ${amount} ${damageType || ''} damage from ${source}`,
            characterId: character.id,
            data: { damage: amount, damageType, source }
        });

        updatedCharacter = processRepeatSaves(updatedCharacter, 'on_damage');

        return updatedCharacter;
    }, [addDamageNumber, onLogEntry, processRepeatSaves]);

    const processTileEffects = useCallback((
        character: CombatCharacter,
        tilePos: Position
    ): CombatCharacter => {
        if (!mapData) return character;

        const tileKey = `${tilePos.x}-${tilePos.y}`;
        const tile = mapData.tiles.get(tileKey);
        if (!tile || !tile.environmentalEffect) return character;

        let updatedChar = { ...character };
        const env = tile.environmentalEffect;

        if (env.effect.effect.type === 'damage_per_turn') {
            const damage = env.effect.effect.value || 0;
            if (damage > 0) {
                updatedChar = handleDamage(updatedChar, damage, env.effect.name, env.type === 'fire' ? 'fire' : 'physical');
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

        updatedCharacter.statusEffects.forEach(effect => {
            switch (effect.effect.type) {
                case 'damage_per_turn':
                    const dmg = effect.effect.value || 0;
                    updatedCharacter = handleDamage(updatedCharacter, dmg, effect.name, 'necrotic');
                    break;
                case 'heal_per_turn':
                    const heal = effect.effect.value || 0;
                    updatedCharacter.currentHP = Math.min(updatedCharacter.maxHP, updatedCharacter.currentHP + heal);
                    addDamageNumber(heal, updatedCharacter.position, 'heal');
                    onLogEntry({
                        id: generateId(),
                        timestamp: Date.now(),
                        type: 'heal',
                        message: `${character.name} heals ${heal} HP from ${effect.name}`,
                        characterId: character.id,
                        data: { heal: heal, source: effect.name }
                    });
                    break;
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
    }, [addDamageNumber, onCharacterUpdate, onLogEntry, spellZones, handleDamage, processRepeatSaves, processTileEffects]);

    // --- State Managers ---
    const addSpellZone = useCallback((zone: ActiveSpellZone) => {
        setSpellZones(prev => [...prev, zone]);
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
        setMovementDebuffs(prev => prev.filter(d => d.expiresAtRound > currentTurnNumber + 1 && !d.hasTriggered));
        setReactiveTriggers(prev => prev.filter(t => !t.expiresAtRound || t.expiresAtRound > currentTurnNumber + 1));

        if (mapData && onMapUpdate) {
            let mapModified = false;
            const newTiles = new Map(mapData.tiles);

            for (const [key, tile] of newTiles) {
                if (tile.environmentalEffect) {
                    const newDuration = tile.environmentalEffect.duration - 1;

                    if (newDuration <= 0) {
                        const newTile = { ...tile };
                        newTile.environmentalEffect = undefined;
                        if (tile.environmentalEffect.type === 'difficult_terrain') {
                            newTile.movementCost = 1; // Assuming default 1
                        }
                        newTiles.set(key, newTile);
                        mapModified = true;
                    } else {
                        const newTile = { ...tile };
                        newTile.environmentalEffect = {
                            ...tile.environmentalEffect,
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
        movementDebuffs,
        reactiveTriggers,

        // State Setters
        addSpellZone,
        removeSpellZone,
        setSpellZones,
        addMovementDebuff,
        setMovementDebuffs,
        addReactiveTrigger,
        setReactiveTriggers,

        // Mechanics
        handleDamage,
        processRepeatSaves,
        processTileEffects,
        processEndOfTurnEffects,
        updateRoundBasedEffects
    };
};
