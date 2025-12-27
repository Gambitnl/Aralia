/**
 * @file CombatView.tsx
 * The main component for the active combat phase.
 * Initializes the turn manager and ability system with real game data.
 * Now handles Victory/Defeat states and Loot distribution.
 */
import React, { useState, useEffect, useCallback, useContext } from 'react';
import BattleMap from '../BattleMap/BattleMap';
import { PlayerCharacter, Item } from '../../types';
import { BattleMapData, CombatCharacter, CombatLogEntry } from '../../types/combat';
import ErrorBoundary from '../ErrorBoundary';
import { useTurnManager } from '../../hooks/combat/useTurnManager';
import { useCombatLog } from '../../hooks/combat/useCombatLog';
import { useAbilitySystem } from '../../hooks/useAbilitySystem';
import { generateBattleSetup } from '../../hooks/useBattleMapGeneration';
import { useSummons } from '../../hooks/combat/useSummons';
import InitiativeTracker from '../BattleMap/InitiativeTracker';
import AbilityPalette from '../BattleMap/AbilityPalette';
import CombatLog from '../BattleMap/CombatLog';
import ActionEconomyBar from '../BattleMap/ActionEconomyBar';
import PartyDisplay from '../BattleMap/PartyDisplay';
import CharacterSheetModal from '../CharacterSheet/CharacterSheetModal';
import { canUseDevTools } from '../../utils/permissions';
import { logger } from '../../utils/logger';
import { createPlayerCombatCharacter } from '../../utils/combatUtils';
import SpellContext from '../../context/SpellContext';
import { generateLoot } from '../../services/lootService';
import { motion } from 'framer-motion';

import AISpellInputModal from '../BattleMap/AISpellInputModal';
import { Spell } from '../../types/spells';
import { ReactionPrompt } from './ReactionPrompt';
import { Plane } from '../../types/planes';

interface CombatViewProps {
  party: PlayerCharacter[];
  enemies: CombatCharacter[];
  biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp';
  onBattleEnd: (result: 'victory' | 'defeat', rewards?: { gold: number; items: Item[]; xp: number }) => void;
  currentPlane?: Plane;
}

const CombatView: React.FC<CombatViewProps> = ({ party, enemies, biome, onBattleEnd, currentPlane }) => {
  // NEW: Get spell data to hydrate combat abilities
  const allSpells = useContext(SpellContext);

  // Ensure we have spell data (guaranteed by SpellProvider, but type safety check)
  if (!allSpells) throw new Error("CombatView must be used within a SpellProvider");

  const [seed] = useState(() => Date.now()); // Generate map once
  const { logs: combatLog, addLogEntry: handleLogEntry } = useCombatLog();

  // Initialize map and characters directly from props (Lazy Initialization)
  // This avoids a double-render and "Preparing..." flash that occurred with useEffect
  const [initialState] = useState(() => {
    // 1. Create base characters
    const partyCombatants = party.map(p => createPlayerCombatCharacter(p, allSpells as unknown as Record<string, Spell>));
    const initialCombatants = [...partyCombatants, ...enemies];

    // 2. Generate map and positions
    return generateBattleSetup(biome, seed, initialCombatants);
  });

  // Single source of truth for map and characters
  const [mapData, setMapData] = useState<BattleMapData | null>(initialState.mapData);
  const [characters, setCharacters] = useState<CombatCharacter[]>(initialState.positionedCharacters);

  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [sheetCharacter, setSheetCharacter] = useState<PlayerCharacter | null>(null);

  // Battle State
  const [battleState, setBattleState] = useState<'active' | 'victory' | 'defeat'>('active');
  const [rewards, setRewards] = useState<{ gold: number; items: Item[]; xp: number } | null>(null);

  // Auto-Battle State
  const [autoCharacters, setAutoCharacters] = useState<Set<string>>(new Set());

  // AI Spell Input State
  // Tracks the spell currently requesting player input (for AI-DM arbitration)
  const [inputModalSpell, setInputModalSpell] = useState<Spell | null>(null);
  // Callback to resume execution once input is confirmed
  const [inputModalCallback, setInputModalCallback] = useState<((input: string) => void) | null>(null);

  const handleCharacterUpdate = useCallback((updatedChar: CombatCharacter) => {
    setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
  }, []);

  const turnManager = useTurnManager({
    characters,
    mapData,
    onCharacterUpdate: handleCharacterUpdate,
    onLogEntry: handleLogEntry,
    autoCharacters, // Pass auto characters to turn manager if needed, but easier to modify turnManager props to accept "isAuto" check
    onMapUpdate: setMapData,
    // TODO: Feature: Bind difficulty to user settings or campaign state instead of hardcoding 'normal'.
    difficulty: 'normal'
  });

  // Initialize turn manager when characters are ready
  useEffect(() => {
    if (characters.length > 0 && turnManager.turnState.turnOrder.length === 0) {
      turnManager.initializeCombat(characters);
    }
  }, [characters, turnManager]);

  // Handle Summoning Integration
  const { addSummon, removeSummon, summonedEntities } = useSummons({
    onSummonAdded: (summon) => {
      setCharacters(prev => [...prev, summon]);
      turnManager.joinCombat(summon, { initiative: summon.initiative }); // Use preset initiative if available (e.g. shared)
    },
    // TODO: Integrate summon removal directly into turn manager by calling turnManager.leaveCombat(summonId) to immediately remove from turn order instead of relying on HP checks
    onSummonRemoved: (summonId) => {
      setCharacters(prev => prev.filter(c => c.id !== summonId));
      // TurnManager handles removal gracefully on next turn cycle usually, 
      // but ideally we'd remove from turnOrder immediately.
      // For now, rely on standard "HP > 0" checks or it's fine if they remain as "dead/gone".
    }
  });

  const handleRequestInput = useCallback((spell: Spell, onConfirm: (input: string) => void) => {
    setInputModalSpell(spell);
    // Wrap callback to ensure we set state correctly
    setInputModalCallback(() => onConfirm);
  }, []);

  const handleInputSubmit = (input: string) => {
    if (inputModalCallback) {
      inputModalCallback(input);
    }
    setInputModalSpell(null);
    setInputModalCallback(null);
  };

  const handleInputCancel = () => {
    setInputModalSpell(null);
    setInputModalCallback(null);
  };

  const abilitySystem = useAbilitySystem({
    characters,
    mapData: mapData,
    onExecuteAction: turnManager.executeAction,
    onCharacterUpdate: handleCharacterUpdate,
    onAbilityEffect: turnManager.addDamageNumber, // Pass the callback to show visual feedback
    onRequestInput: handleRequestInput,
    reactiveTriggers: turnManager.reactiveTriggers,
    onReactiveTriggerUpdate: turnManager.setReactiveTriggers,
    onMapUpdate: setMapData,
    currentPlane
  });

  const handleToggleAuto = useCallback((characterId: string) => {
    setAutoCharacters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(characterId)) {
        newSet.delete(characterId);
      } else {
        newSet.add(characterId);
      }
      return newSet;
    });
  }, []);

  // Update Turn Manager with auto status
  // Since useTurnManager is a hook, we can't just pass new props to it easily without re-initializing or it reacting to prop changes.
  // We need to modify useTurnManager to accept `autoCharacters` set.
  // But wait, `useTurnManager` is already initialized.
  // We can pass `autoCharacters` to `useTurnManager` and it will react if we put it in dependencies.
  // Let's check `useTurnManager.ts` again.

  // Check for win/loss conditions
  useEffect(() => {
    if (characters.length === 0 || battleState !== 'active') return;

    const players = characters.filter(c => c.team === 'player');
    const activeEnemies = characters.filter(c => c.team === 'enemy' && c.currentHP > 0);
    const activePlayers = players.filter(c => c.currentHP > 0);

    if (activeEnemies.length === 0 && enemies.length > 0) {
      setBattleState('victory');
      // Generate Rewards
      const originalMonsters = enemies.map(e => ({ name: e.name, cr: e.stats.cr, quantity: 1, description: e.name }));
      const loot = generateLoot(originalMonsters);
      const xp = enemies.length * 50;

      setRewards({ gold: loot.gold, items: loot.items, xp });

    } else if (activePlayers.length === 0 && players.length > 0) {
      setBattleState('defeat');
    }
  }, [characters, enemies, battleState]);


  const handleCharacterSelect = (charId: string) => {
    setSelectedCharacterId(charId);
  }

  const handleSheetOpen = (charId: string) => {
    const playerToShow = party.find(p => p.id === charId);
    if (playerToShow) {
      setSheetCharacter(playerToShow);
    }
  };

  const handleSheetClose = () => {
    setSheetCharacter(null);
  };

  const currentCharacter = turnManager.getCurrentCharacter();

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col p-4 relative">
      {/* Victory / Defeat Modal */}
      {battleState !== 'active' && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-800 p-8 rounded-xl border-2 border-amber-500 max-w-md w-full text-center"
          >
            <h2 className={`text-4xl font-cinzel mb-4 ${battleState === 'victory' ? 'text-amber-400' : 'text-red-500'}`}>
              {battleState === 'victory' ? 'Victory!' : 'Defeat!'}
            </h2>

            {battleState === 'victory' && rewards && (
              <div className="mb-6 text-left bg-gray-900/50 p-4 rounded-lg">
                <h3 className="text-sky-300 font-bold mb-2 border-b border-gray-700 pb-1">Rewards</h3>
                <p className="text-yellow-200">🪙 {rewards.gold} Gold</p>
                <p className="text-purple-300">✨ {rewards.xp} XP</p>
                {rewards.items.length > 0 && (
                  <div className="mt-2">
                    <p className="text-gray-400 text-sm">Items Found:</p>
                    <ul className="list-disc list-inside text-green-300 text-sm">
                      {rewards.items.map((item, i) => <li key={i}>{item.name}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => onBattleEnd(battleState, rewards || undefined)}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg shadow-lg transition-colors"
            >
              {battleState === 'victory' ? 'Collect & Continue' : 'Return to Title'}
            </button>
          </motion.div>
        </div>
      )}

      {/* AI Spell Input Modal */}
      {inputModalSpell && (
        <AISpellInputModal
          isOpen={!!inputModalSpell}
          spell={inputModalSpell}
          onSubmit={handleInputSubmit}
          onCancel={handleInputCancel}
        />
      )}

      {/* Reaction Prompt Modal */}
      {abilitySystem.pendingReaction && (
        <ReactionPrompt
          attackerName={characters.find(c => c.id === abilitySystem.pendingReaction!.attackerId)?.name || 'Unknown'}
          reactionSpells={abilitySystem.pendingReaction.reactionSpells}
          triggerType={abilitySystem.pendingReaction.triggerType}
          onResolve={abilitySystem.pendingReaction.onResolve}
        />
      )}

      {sheetCharacter && (
        <CharacterSheetModal
          isOpen={!!sheetCharacter}
          character={sheetCharacter}
          inventory={[]} // No inventory management during combat for now
          gold={0}
          onClose={handleSheetClose}
          onAction={(action) => {
            if (canUseDevTools()) {
              logger.debug('Action from sheet:', { action });
            }
          }}
        />
      )}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-red-500 font-cinzel">Combat Encounter</h1>
        {/* TODO: Wrap debug buttons with process.env.NODE_ENV check to hide in production builds (e.g., {import.meta.env.DEV && <button>...}) */}
        <button
          onClick={() => setBattleState('victory')} // Debug escape hatch
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg shadow text-sm"
        >
          Debug: Auto-Win
        </button>
      </div>

      <div className="flex-grow grid grid-cols-1 xl:grid-cols-5 gap-4 overflow-hidden">
        {/* Left Pane */}
        <div className="xl:col-span-1 flex flex-col gap-4 overflow-y-auto scrollable-content p-1">
          <PartyDisplay
            characters={characters}
            onCharacterSelect={handleCharacterSelect}
            currentTurnCharacterId={turnManager.turnState.currentCharacterId}
            autoCharacters={autoCharacters}
            onToggleAuto={handleToggleAuto}
          />
        </div>

        {/* Center Pane */}
        <div className="xl:col-span-3 flex items-center justify-center overflow-auto p-2">
          <ErrorBoundary fallbackMessage="An error occurred in the Battle Map.">
            {characters.length > 0 && mapData ? (
              <BattleMap
                mapData={mapData}
                characters={characters}
                combatState={{
                  turnManager: turnManager,
                  turnState: turnManager.turnState,
                  abilitySystem: abilitySystem,
                  isCharacterTurn: turnManager.isCharacterTurn,
                  onCharacterUpdate: handleCharacterUpdate
                }}
              />
            ) : (
              <div className="text-gray-400">Preparing battlefield...</div>
            )}
          </ErrorBoundary>
        </div>

        {/* Right Pane */}
        <div className="xl:col-span-1 flex flex-col gap-4 overflow-y-auto scrollable-content p-1">
          <InitiativeTracker
            characters={characters}
            turnState={turnManager.turnState}
            onCharacterSelect={handleSheetOpen}
          />
          {currentCharacter && (
            <ActionEconomyBar
              character={currentCharacter}
              onExecuteAction={turnManager.executeAction}
            />
          )}
          <AbilityPalette
            character={currentCharacter ?? null}
            onSelectAbility={(ability) => abilitySystem.startTargeting(ability, currentCharacter!)}
            canAffordAction={(cost) => currentCharacter ? turnManager.canAffordAction(currentCharacter, cost) : false}
          />
          <CombatLog logEntries={combatLog} />

          <div className="mt-auto">
            <button
              onClick={turnManager.endTurn}
              disabled={!currentCharacter || !turnManager.isCharacterTurn(currentCharacter.id)}
              className="w-full px-5 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg shadow disabled:bg-gray-600 font-bold text-lg"
            >
              End Turn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CombatView;
