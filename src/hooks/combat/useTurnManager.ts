/**
 * @file hooks/combat/useTurnManager.ts
 * Manages the turn-based combat state using the new action economy system.
 * Now integrates AI decision making, Damage Numbers, and Spell Effect Triggers.
 * REFACTORED:
 * - Turn Order logic extracted to `useTurnOrder`.
 * - Combat Engine logic extracted to `useCombatEngine`.
 * - Action Execution logic extracted to `useActionExecutor`.
 * - Remains the "Combat Coordinator" handling AI and orchestrating actions.
 */
import { useCallback, useMemo } from 'react';
import { CombatCharacter, CombatLogEntry, BattleMapData } from '../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../config/combatConfig';
import { generateId } from '../../utils/combatUtils';
import { resetEconomy } from '../../utils/combat/actionEconomyUtils';
import { useActionEconomy } from './useActionEconomy';
import { useCombatAI } from './useCombatAI';
import { useCombatVisuals } from './useCombatVisuals';
import { useTurnOrder } from './useTurnOrder';
import { useCombatEngine } from './engine/useCombatEngine';
import { useActionExecutor } from './useActionExecutor';

interface UseTurnManagerProps {
  difficulty?: keyof typeof AI_THINKING_DELAY_MS;
  characters: CombatCharacter[];
  mapData: BattleMapData | null;
  onCharacterUpdate: (character: CombatCharacter) => void;
  onLogEntry: (entry: CombatLogEntry) => void;
  autoCharacters?: Set<string>;
  onMapUpdate?: (mapData: BattleMapData) => void;
}

export const useTurnManager = ({
  characters,
  mapData,
  onCharacterUpdate,
  onLogEntry,
  autoCharacters,
  onMapUpdate,
  difficulty = 'normal'
}: UseTurnManagerProps) => {

  // --- Decomposed Sub-Systems ---
  const {
    turnState,
    initializeTurnOrder,
    advanceTurn: advanceTurnOrder,
    joinTurnOrder,
    isCharacterTurn: checkIsCharacterTurn,
    // TODO(lint-intent): 'setCurrentCharacter' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    setCurrentCharacter: _setCurrentCharacter,
    recordAction
  } = useTurnOrder({ characters });

  const { damageNumbers, animations, addDamageNumber, queueAnimation } = useCombatVisuals();
  const { canAfford, consumeAction } = useActionEconomy();

  const {
    spellZones,
    movementDebuffs,
    reactiveTriggers,
    addSpellZone,
    removeSpellZone,
    addMovementDebuff,
    addReactiveTrigger,
    setReactiveTriggers,
    setMovementDebuffs,
    handleDamage,
    processRepeatSaves,
    processTileEffects,
    processEndOfTurnEffects,
    updateRoundBasedEffects
  } = useCombatEngine({
    characters,
    mapData,
    onCharacterUpdate,
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
    // TODO: Also tick down conditions/activeEffects here and clean up expired AC/resistance/tempHP effects so defensive math stays accurate.
    updatedChar = {
      ...updatedChar,
      statusEffects: character.statusEffects.map(effect => ({ ...effect, duration: effect.duration - 1 })).filter(effect => effect.duration > 0),
      abilities: character.abilities.map(ability => ({
        ...ability,
        currentCooldown: Math.max(0, (ability.currentCooldown || 0) - 1)
      })),
      concentratingOn: character.concentratingOn ? {
        ...character.concentratingOn,
        sustainedThisTurn: false
      } : undefined,
      riders: character.riders?.map(r => ({ ...r, usedThisTurn: false })),
      // Reset per-turn feat usage tracking (e.g., Slasher's once-per-turn speed reduction)
      featUsageThisTurn: []
    };
    onCharacterUpdate(updatedChar);

    onLogEntry({
      id: generateId(),
      timestamp: Date.now(),
      type: 'turn_start',
      message: `${character.name}'s turn.`,
      characterId: character.id
    });
  // TODO(lint-intent): If resetEconomy becomes runtime-injected, add it to the dependency array.
  }, [onCharacterUpdate, onLogEntry]);

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
      onCharacterUpdate(resetEconomy(char));
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
  }, [onCharacterUpdate, onLogEntry, rollInitiative, startTurnFor, initializeTurnOrder]);

  const joinCombat = useCallback((character: CombatCharacter, options: { initiative?: number } = {}) => {
    const initiative = options.initiative ?? rollInitiative(character);
    const charWithInit = { ...character, initiative };

    const readyChar = resetEconomy(charWithInit);
    onCharacterUpdate(readyChar);

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
  }, [onCharacterUpdate, onLogEntry, rollInitiative, joinTurnOrder]);


  // --- End of Turn Logic ---
  const endTurn = useCallback(() => {
    const currentCharacter = characters.find(c => c.id === turnState.currentCharacterId);
    if (!currentCharacter) return;

    // 1. Apply end-of-turn effects to the current character (Delegated to Engine)
    const processedChar = processEndOfTurnEffects(currentCharacter, turnState.currentTurn);

    // 2. Advance the turn order
    const { isNewRound, nextCharacterId } = advanceTurnOrder();

    // 3. Handle New Round Events
    if (isNewRound) {
      updateRoundBasedEffects(turnState.currentTurn);

      onLogEntry({
        id: generateId(),
        timestamp: Date.now(),
        type: 'turn_start',
        message: `Round ${turnState.currentTurn + 1} begins!`,
        data: { round: turnState.currentTurn + 1 }
      });
    }

    // 4. Start turn for the next character
    if (nextCharacterId) {
      let nextCharacter = characters.find(c => c.id === nextCharacterId);

      // Fix for stale closure: If the next character is the one we just processed (e.g. solo combat),
      // use the updated state returned from processEndOfTurnEffects instead of the stale one from 'characters'.
      // FIXME: This workaround is fragile. A cleaner solution would be to have processEndOfTurnEffects
      // return the updated character ID alongside the updated character, or use a ref to track the latest
      // character state. This workaround will break if processEndOfTurnEffects ever returns a different
      // character (e.g., summoned creature).
      if (nextCharacter && processedChar && nextCharacter.id === processedChar.id) {
        nextCharacter = processedChar;
      }

      if (nextCharacter) {
        startTurnFor(nextCharacter);
      }
    }

  }, [turnState, characters, processEndOfTurnEffects, onLogEntry, startTurnFor, advanceTurnOrder, updateRoundBasedEffects]);


  const { executeAction } = useActionExecutor({
    characters,
    turnState,
    mapData,
    onCharacterUpdate,
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
    setMovementDebuffs
  });

  const currentCharacter = useMemo(() => {
    return characters.find(c => c.id === turnState.currentCharacterId);
  }, [characters, turnState.currentCharacterId]);

  const getCurrentCharacter = useCallback(() => currentCharacter, [currentCharacter]);

  useCombatAI({
    difficulty,
    characters,
    mapData,
    currentCharacterId: turnState.currentCharacterId,
    executeAction,
    endTurn,
    autoCharacters: managedAutoCharacters
  });

  return {
    turnState,
    initializeCombat,
    joinCombat,
    executeAction,
    endTurn,
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
    movementDebuffs,
    reactiveTriggers
  };
};
