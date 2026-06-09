// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 08/06/2026, 16:01:00
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, hooks/useBattleMap.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This hook acts as the central coordinator for turn-based combat encounters.
 *
 * It manages initiative rolling, round boundary transitions, starting and ending turns,
 * running death saving throws for downed players, ticking down active effect durations,
 * and driving the combat AI loop. It decouples turn scheduling (via useTurnOrder) from
 * damage application and status triggers (via useCombatEngine) and action execution semantics (via useActionExecutor).
 *
 * Called by: CombatView.tsx and BattleMapDemo.tsx during combat encounters.
 * Depends on: useTurnOrder, useCombatEngine, useActionExecutor, useActionEconomy, and useCombatVisuals.
 *
 * @file hooks/combat/useTurnManager.ts
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { CombatCharacter, CombatLogEntry, BattleMapData, LightSource } from '../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../config/combatConfig';
import { generateId } from '../../utils/combatUtils';
import { resetEconomy } from '../../utils/combat/actionEconomyUtils';
import { useActionEconomy } from './useActionEconomy';

import { useCombatVisuals } from './useCombatVisuals';
import { useTurnOrder } from './useTurnOrder';
import { useCombatEngine } from './engine/useCombatEngine';
import { useActionExecutor } from './useActionExecutor';
import { ROUND_DURATION_SECONDS } from '../../utils/core/spellTimeUtils';
import { evaluateCombatTurn } from '../../utils/combat/combatAI';

interface UseTurnManagerProps {
  difficulty?: keyof typeof AI_THINKING_DELAY_MS;
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onLogEntry: (entry: CombatLogEntry) => void;
  onRoundElapsed?: (seconds: number) => void;
  autoCharacters?: Set<string>;
  onMapUpdate?: (mapData: BattleMapData) => void;
  requestReaction?: (
    attackerId: string,
    targetId: string,
    triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack',
    reactionSpells?: import('../../types/spells').Spell[],
    reactionWeapons?: import('../../types/combat').Ability[]
  ) => Promise<string | null>;
}

export const useTurnManager = ({
  characters,
  mapData,
  onCharacterUpdate,
  onLogEntry,
  onRoundElapsed,
  autoCharacters,
  onMapUpdate,
  difficulty = 'normal',
  requestReaction
}: UseTurnManagerProps) => {

  // --- Decomposed Sub-Systems ---
  const {
    turnState,
    initializeTurnOrder,
    advanceTurn: advanceTurnOrder,
    joinTurnOrder,
    isCharacterTurn: checkIsCharacterTurn,
    setCurrentCharacter,
    recordAction
  } = useTurnOrder({ characters });

  const {
    damageNumbers,
    animations,
    addDamageNumber,
    queueAnimation,
    spellMovementVisuals,
    addSpellMovementVisual,
    spellDeliveryVisuals,
    addSpellDeliveryVisual
  } = useCombatVisuals();
  const [activeLightSources, setActiveLightSources] = useState<LightSource[]>([]);
  const { canAfford, consumeAction } = useActionEconomy();
  // Remember which concentration cleanup keys already ran in the current render batch.
  // This keeps stale synchronous updates from re-cleaning the same ally effects.
  const concentrationCleanupKeysRef = useRef<Set<string>>(new Set());
  const lastCharactersRef = useRef(characters);
  const getStatusCleanupKey = (characterId: string, effectId: string) => `status:${characterId}:${effectId}`;
  const getConditionCleanupKey = (characterId: string, source: string) => `condition:${characterId}:${source}`;

  // Wrapped character update callback to handle immediate concentration drop when a character is downed (0 HP)
  const handleCharacterUpdateWrapped = useCallback((updatedChar: CombatCharacter) => {
    if (lastCharactersRef.current !== characters) {
      concentrationCleanupKeysRef.current.clear();
      lastCharactersRef.current = characters;
    }

    const originalChar = characters.find(c => c.id === updatedChar.id);
    let finalChar = updatedChar;

    if (originalChar && originalChar.currentHP > 0 && updatedChar.currentHP === 0 && originalChar.concentratingOn) {
      const previousSpell = originalChar.concentratingOn.spellName;
      const previousSpellId = originalChar.concentratingOn.spellId;
      const trackedEffectIds = new Set(originalChar.concentratingOn.effectIds || []);
      const trackedConditionSources = [previousSpellId, previousSpell].filter((source): source is string => Boolean(source));
      const cleanedConcentrationKeys = concentrationCleanupKeysRef.current;
      const cleanedKeysThisCall = new Set<string>();

      // 1. Clear concentration on the downed character
      finalChar = {
        ...updatedChar,
        concentratingOn: undefined
      };

      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'status',
        message: `${finalChar.name} falls unconscious and loses concentration on ${previousSpell}`,
        characterId: finalChar.id
      });

      // 2. Clean up status effects and conditions on all OTHER characters
      characters.forEach(char => {
        if (char.id === finalChar.id) return;

        const statusEffectsToRemove = (char.statusEffects || []).filter(eff =>
          trackedEffectIds.has(eff.id) && !cleanedConcentrationKeys.has(getStatusCleanupKey(char.id, eff.id))
        );
        const conditionSourcesToRemove = trackedConditionSources.filter(source =>
          (char.conditions || []).some(cond => cond.source === source) &&
          !cleanedConcentrationKeys.has(getConditionCleanupKey(char.id, source))
        );

        if (statusEffectsToRemove.length > 0 || conditionSourcesToRemove.length > 0) {
          const statusEffectIdsToRemove = new Set(statusEffectsToRemove.map(effect => effect.id));
          const conditionSourcesToRemoveSet = new Set(conditionSourcesToRemove);
          const newStatusEffects = (char.statusEffects || []).filter(eff => !statusEffectIdsToRemove.has(eff.id));
          const newConditions = (char.conditions || []).filter(cond =>
            typeof cond.source !== 'string' || !conditionSourcesToRemoveSet.has(cond.source)
          );

          onCharacterUpdate({
            ...char,
            statusEffects: newStatusEffects,
            conditions: newConditions
          });

          statusEffectsToRemove.forEach(effect => cleanedKeysThisCall.add(getStatusCleanupKey(char.id, effect.id)));
          conditionSourcesToRemove.forEach(source => cleanedKeysThisCall.add(getConditionCleanupKey(char.id, source)));
        }
      });

      cleanedKeysThisCall.forEach(key => cleanedConcentrationKeys.add(key));

      // 3. Clean up light sources linked to this concentration spell
      setActiveLightSources(prev => prev.filter(ls => ls.sourceSpellId !== previousSpellId && !trackedEffectIds.has(ls.id)));
    }

    onCharacterUpdate(finalChar);
  }, [characters, onCharacterUpdate, onLogEntry]);

  // Ref to executeActionRef — set after useActionExecutor initializes.
  // Allows endTurn to trigger legendary actions without a circular useCallback dependency.
  const executeActionRef = useRef<((action: import('../../types/combat').CombatAction) => Promise<boolean>) | null>(null);

  const {
    spellZones,
    scheduledSpellEffects,
    movementDebuffs,
    reactiveTriggers,
    addSpellZone,
    removeSpellZone,
    addScheduledSpellEffect,
    removeScheduledSpellEffect,
    addMovementDebuff,
    addReactiveTrigger,
    setReactiveTriggers,
    setMovementDebuffs,
    handleDamage,
    processRepeatSaves,
    processScheduledSpellEffects,
    processTileEffects,
    processEndOfTurnEffects,
    updateRoundBasedEffects,
    expireSavePenaltiesForCaster
  } = useCombatEngine({
    characters,
    mapData,
    onCharacterUpdate: handleCharacterUpdateWrapped,
    onLogEntry,
    onMapUpdate,
    addDamageNumber
  });

  // Stabilize optional auto-controlled character set
  const defaultAutoCharacters = useMemo(() => new Set<string>(), []);
  const managedAutoCharacters = autoCharacters ?? defaultAutoCharacters;

  // --- Initialization & Setup ---
  const rollInitiative = useCallback((character: CombatCharacter): number => {
    const dexModifier = Math.floor((character.stats.dexterity - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    return roll + dexModifier + character.stats.baseInitiative;
  }, []);

  const startTurnFor = useCallback((character: CombatCharacter) => {
    let updatedChar = resetEconomy(character);

    // Roll Death Saving Throw for downed player character at start of turn
    if (character.currentHP === 0 && character.team === 'player' && character.deathSaves && !character.deathSaves.isStable) {
      const roll = Math.floor(Math.random() * 20) + 1;
      let successes = character.deathSaves.successes || 0;
      let failures = character.deathSaves.failures || 0;
      let isStable = character.deathSaves.isStable || false;
      let hp = character.currentHP;
      let newStatusEffects = [...character.statusEffects];
      let newConditions = [...(character.conditions || [])];

      if (roll === 20) {
        hp = 1;
        newStatusEffects = newStatusEffects.filter(se => se.name.toLowerCase() !== 'unconscious');
        newConditions = newConditions.filter(c => c.name.toLowerCase() !== 'unconscious');
        
        updatedChar = {
          ...updatedChar,
          currentHP: hp,
          deathSaves: undefined,
          statusEffects: newStatusEffects,
          conditions: newConditions
        };

        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: `${character.name} rolls a 20 on Death Saving Throw and revives with 1 HP!`,
          characterId: character.id
        });
      } else {
        if (roll === 1) {
          failures = Math.min(3, failures + 2);
        } else if (roll >= 10) {
          successes = Math.min(3, successes + 1);
        } else {
          failures = Math.min(3, failures + 1);
        }

        if (successes >= 3) {
          isStable = true;
        }

        updatedChar = {
          ...updatedChar,
          deathSaves: {
            successes,
            failures,
            isStable
          }
        };

        onLogEntry({
          id: generateId(),
          timestamp: Date.now(),
          type: 'action',
          message: `${character.name} rolls a ${roll} on Death Saving Throw (${successes} successes, ${failures} failures).`,
          characterId: character.id
        });
      }
    }
    
    // Tick down round-based activeEffects
    const tickedActiveEffects = (updatedChar.activeEffects || [])
      .map(effect => {
        if (effect.duration && effect.duration.type === 'rounds' && typeof effect.duration.value === 'number') {
          return {
            ...effect,
            duration: {
              ...effect.duration,
              value: effect.duration.value - 1
            }
          };
        }
        return effect;
      })
      .filter(effect => !effect.duration || effect.duration.type !== 'rounds' || (typeof effect.duration.value === 'number' && effect.duration.value > 0));

    // Tick down round-based conditions
    const tickedConditions = (updatedChar.conditions || [])
      .map(cond => {
        if (cond.duration && cond.duration.type === 'rounds' && typeof cond.duration.value === 'number') {
          return {
            ...cond,
            duration: {
              ...cond.duration,
              value: cond.duration.value - 1
            }
          };
        }
        return cond;
      })
      .filter(cond => !cond.duration || cond.duration.type !== 'rounds' || (typeof cond.duration.value === 'number' && cond.duration.value > 0));

    // Dynamic AC recalculation to keep defensive stats in sync with active effects.
    let baseAC = updatedChar.baseAC ?? 10;
    let acBonusSum = 0;
    tickedActiveEffects.forEach(effect => {
      if (effect.mechanics?.acBonus !== undefined) {
        acBonusSum += effect.mechanics.acBonus;
      }
      if (effect.mechanics?.baseAC !== undefined) {
        baseAC = effect.mechanics.baseAC;
      }
    });
    const finalAC = baseAC + acBonusSum;

    updatedChar = {
      ...updatedChar,
      statusEffects: updatedChar.statusEffects.map(effect => ({ ...effect, duration: effect.duration - 1 })).filter(effect => effect.duration > 0),
      activeEffects: tickedActiveEffects,
      conditions: tickedConditions,
      armorClass: finalAC,
      abilities: updatedChar.abilities.map(ability => {
        if (ability.recharge?.threshold && ability.isRecharging) {
          const roll = Math.floor(Math.random() * 6) + 1;
          if (roll >= ability.recharge.threshold) {
            return { ...ability, isRecharging: false, currentCooldown: 0 };
          }
          return { ...ability };
        }
        return {
          ...ability,
          currentCooldown: Math.max(0, (ability.currentCooldown || 0) - 1)
        };
      }),
      concentratingOn: updatedChar.concentratingOn ? {
        ...updatedChar.concentratingOn,
        sustainedThisTurn: false
      } : undefined,
      riders: updatedChar.riders?.map(r => ({ ...r, usedThisTurn: false })),
      featUsageThisTurn: []
    };

    // Some spell conditions repeat at the start of the affected creature's
    // turn. The combat engine already owns repeat-save resolution, so the turn
    // coordinator invokes that existing path here instead of duplicating save
    // logic in the scheduling layer.
    updatedChar = processRepeatSaves(updatedChar, 'turn_start');
    updatedChar = processScheduledSpellEffects(updatedChar, 'turn_start', turnState.currentTurn);

    handleCharacterUpdateWrapped(updatedChar);

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `${character.name}'s turn.`,
      characterId: character.id
    });
    // TODO(lint-intent): If resetEconomy becomes runtime-injected, add it to the dependency array.
  }, [handleCharacterUpdateWrapped, onLogEntry, processRepeatSaves, processScheduledSpellEffects, turnState.currentTurn]);

  const initializeCombat = useCallback((initialCharacters: CombatCharacter[]) => {
    // 1. Roll initiatives
    const charactersWithInitiative = initialCharacters.map(char => ({
      ...char,
      initiative: rollInitiative(char)
    }));

    // 2. Delegate sorting to TurnOrder hook
    initializeTurnOrder(charactersWithInitiative);

    // 3. Reset economy for everyone
    charactersWithInitiative.forEach(char => {
      handleCharacterUpdateWrapped(resetEconomy(char));
    });

    // 4. Start turn for the first character
    const sorted = [...charactersWithInitiative].sort((a, b) => b.initiative - a.initiative);
    const firstChar = sorted[0];

    if (firstChar) {
      startTurnFor(firstChar);
    }

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `Combat begins! Turn order: ${sorted.map(c => c.name).join(' → ')}`,
      data: { turnOrder: sorted.map(c => c.id), initiatives: sorted.map(c => ({ id: c.id, initiative: c.initiative })) }
    });
    // TODO(lint-intent): If resetEconomy becomes runtime-injected, add it to the dependency array.
  }, [handleCharacterUpdateWrapped, onLogEntry, rollInitiative, startTurnFor, initializeTurnOrder]);

  const joinCombat = useCallback((character: CombatCharacter, options: { initiative?: number } = {}) => {
    const initiative = options.initiative ?? rollInitiative(character);
    const charWithInit = { ...character, initiative };

    const readyChar = resetEconomy(charWithInit);
    handleCharacterUpdateWrapped(readyChar);

    joinTurnOrder(readyChar.id);

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `${readyChar.name} joins the combat! (Init: ${initiative})`,
      characterId: readyChar.id,
      data: { initiative }
    });
    // TODO(lint-intent): If resetEconomy becomes runtime-injected, add it to the dependency array.
  }, [handleCharacterUpdateWrapped, onLogEntry, rollInitiative, joinTurnOrder]);


  // --- End of Turn Logic ---
  const endTurn = useCallback(async () => {
    const currentCharacter = characters.find(c => c.id === turnState.currentCharacterId);
    if (!currentCharacter) return;

    // 1. Apply end-of-turn effects to the current character (Delegated to Engine)
    const processedChar = processEndOfTurnEffects(currentCharacter, turnState.currentTurn);

    // 2. Expire save penalties originating from this character
    expireSavePenaltiesForCaster(characters, currentCharacter.id, turnState.currentTurn);

    // 3. Advance the turn order
    const { isNewRound, nextCharacterId } = advanceTurnOrder();

    // 3. Handle New Round Events
    if (isNewRound) {
      // A full combat round has completed, so six seconds pass for the rest of
      // the world. The callback keeps global gameTime mutation centralized in
      // App.tsx -> ADVANCE_TIME -> worldReducer instead of importing global
      // state into the low-level combat coordinator.
      onRoundElapsed?.(ROUND_DURATION_SECONDS);

      updateRoundBasedEffects(turnState.currentTurn);

      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'turn_start',
        message: `Round ${turnState.currentTurn + 1} begins!`,
        data: { round: turnState.currentTurn + 1 }
      });
    }

    // 4. Legendary Action Opportunity
    // After each creature's turn ends, enemy legendary monsters with remaining
    // budget take one legendary action (D&D 5e: "at the end of each other creature's turn").
    // Uses executeActionRef to avoid a circular useCallback dependency with useActionExecutor.
    if (executeActionRef.current && mapData) {
      const endedId = currentCharacter.id;
      const livingEnemies = characters.filter(c => c.team === 'enemy' && c.currentHP > 0 && c.id !== endedId);
      for (const legendary of livingEnemies) {
        const budget = legendary.actionEconomy?.legendary;
        if (!budget || budget.total === 0 || budget.used >= budget.total) continue;

        // Ask the AI for its best play, then filter to legendary-cost abilities only.
        const fullPlan = evaluateCombatTurn(legendary, characters, mapData);
        if (fullPlan.type === 'end_turn') continue;

        // Only proceed if the chosen action is a legendary ability.
        if (fullPlan.type === 'ability' && fullPlan.abilityId) {
          const ability = legendary.abilities.find(a => a.id === fullPlan.abilityId);
          if (ability?.cost.type !== 'legendary') continue;
          await executeActionRef.current(fullPlan);
          onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'action',
            message: `${legendary.name} uses a legendary action: ${ability.name}.`,
            characterId: legendary.id,
          });
        }
      }
    }

    // 5. Start turn for the next character
    if (nextCharacterId) {
      let nextCharacter = characters.find(c => c.id === nextCharacterId);

      // Fix for stale closure: If the next character is the one we just processed (e.g. solo combat),
      // use the updated state returned from processEndOfTurnEffects instead of the stale one from 'characters'.
      // TODO(Stability): Refactor this Stale Closure Workaround.
      // Instead of patching `nextCharacter` with `processedChar` based on ID match,
      // `processEndOfTurnEffects` should return the definitive state or `useTurnOrder` 
      // should manage the "active" character reference more robustly to avoid race conditions.
      // Original FIXME: This workaround is fragile. A cleaner solution would be to have processEndOfTurnEffects
      // return the updated character ID alongside the updated character, or use a ref to track the latest
      // character state. This workaround will break if processEndOfTurnEffects ever returns a different
      // character (e.g., summoned creature).
      // TODO(Stability): Fix Stale Closure Workaround
      // This block patches `nextCharacter` with `processedChar` to handle cases where `processEndOfTurnEffects` updates state that `characters` array doesn't reflect yet.
      // This is fragile. `processEndOfTurnEffects` should ideally return a comprehensive state update or we should ensure `characters` is fresh using a ref or correct dependency flow.
      if (nextCharacter && processedChar && nextCharacter.id === processedChar.id) {
        nextCharacter = processedChar;
      }

      if (nextCharacter) {
        startTurnFor(nextCharacter);
      }
    }

  }, [turnState, characters, mapData, processEndOfTurnEffects, expireSavePenaltiesForCaster, onLogEntry, onRoundElapsed, startTurnFor, advanceTurnOrder, updateRoundBasedEffects]);


  const skipToCharacter = useCallback((characterId: string) => {
    const target = characters.find(c => c.id === characterId);
    if (!target) return;
    setCurrentCharacter(characterId);
    startTurnFor(target);
  }, [characters, setCurrentCharacter, startTurnFor]);

  const { executeAction } = useActionExecutor({
    characters,
    turnState,
    mapData,
    onCharacterUpdate: handleCharacterUpdateWrapped,
    onLogEntry,
    endTurn,
    canAfford,
    consumeAction,
    recordAction,
    addDamageNumber,
    queueAnimation,
    handleDamage,
    processRepeatSaves,
    processTileEffects,
    spellZones,
    movementDebuffs,
    reactiveTriggers,
    setMovementDebuffs,
    requestReaction
  });

  // Keep the ref in sync so endTurn can invoke executeAction without a circular dependency.
  executeActionRef.current = executeAction;

  const currentCharacter = useMemo(() => {
    return characters.find(c => c.id === turnState.currentCharacterId);
  }, [characters, turnState.currentCharacterId]);

  const getCurrentCharacter = useCallback(() => currentCharacter, [currentCharacter]);


  return {
    turnState,
    initializeCombat,
    joinCombat,
    // TODO(Refactor): Extract Reactive Trigger Processing
    // The logic for filtering and executing `reactiveTriggers` is duplicated/inlined across 'sustain', 'move', and 'attack'.
    // Create a dedicated helper `processReactiveTriggers(type, context, state)` to centralize this logic, ensuring consistent logging, damage application, and error handling.
    executeAction,
    endTurn,
    skipToCharacter,
    getCurrentCharacter,
    isCharacterTurn: checkIsCharacterTurn,
    canAffordAction: canAfford,
    addDamageNumber,
    damageNumbers,
    animations,
    addSpellZone,
    addMovementDebuff,
    removeSpellZone,
    addReactiveTrigger,
    setReactiveTriggers,
    spellZones,
    scheduledSpellEffects,
    movementDebuffs,
    reactiveTriggers,
    addScheduledSpellEffect,
    removeScheduledSpellEffect,
    activeLightSources,
    setActiveLightSources,
    spellMovementVisuals,
    addSpellMovementVisual,
    spellDeliveryVisuals,
    addSpellDeliveryVisual
  };
};
