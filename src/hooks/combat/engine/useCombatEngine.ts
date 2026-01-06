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
    // TODO(lint-intent): 'Animation' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    Animation as _Animation
} from '../../../types/combat';
import {
    ActiveSpellZone,
    MovementTriggerDebuff,
    // TODO(lint-intent): 'processMovementTriggers' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    processMovementTriggers as _processMovementTriggers,
    resetZoneTurnTracking
} from '../../../systems/spells/effects';
import { AreaEffectTracker } from '../../../systems/spells/effects/AreaEffectTracker';
import { generateId, rollDice, calculateDamage } from '../../../utils/combatUtils';
// TODO(lint-intent): 'calculateSpellDC' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { calculateSpellDC as _calculateSpellDC, rollSavingThrow } from '../../../utils/savingThrowUtils';
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
    // TODO(lint-intent): 'characters' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    characters: _characters,
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
        const savedEffectIds: string[] = [];
        const savePenaltySystem = new SavePenaltySystem();

        updatedCharacter.statusEffects.forEach(effect => {
            const repeat = (effect as any).repeatSave;
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
            // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
            // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
            // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
            const saveType = repeat.saveType as unknown;
            const saveModifiers = savePenaltySystem.getActivePenalties(updatedCharacter);
            const roll = rollSavingThrow(updatedCharacter, saveType as any, dc, saveModifiers);

            let finalSuccess = roll.success;
            // ...advantage/disadvantage logic uses saveModifiers...
            if (hasAdvantage) {
                const roll2 = rollSavingThrow(updatedCharacter, saveType as any, dc, saveModifiers);
                finalSuccess = roll.success || roll2.success;
            } else if (hasDisadvantage) {
                const roll2 = rollSavingThrow(updatedCharacter, saveType as any, dc, saveModifiers);
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
