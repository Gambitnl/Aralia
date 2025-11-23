
/**
 * @file CombatView.tsx
 * The main component for the active combat phase.
 * Initializes the turn manager and ability system with real game data.
 * Now handles Victory/Defeat states and Loot distribution.
 */
import React, { useState, useEffect, useCallback, useContext } from 'react';
import BattleMap from './BattleMap/BattleMap';
import { PlayerCharacter, Item } from '../types';
import { CombatCharacter, CombatLogEntry } from '../types/combat';
import ErrorBoundary from './ErrorBoundary';
import { useTurnManager } from '../hooks/combat/useTurnManager';
import { useAbilitySystem } from '../hooks/useAbilitySystem';
import InitiativeTracker from './BattleMap/InitiativeTracker';
import AbilityPalette from './BattleMap/AbilityPalette';
import CombatLog from './BattleMap/CombatLog';
import ActionEconomyBar from './BattleMap/ActionEconomyBar';
import PartyDisplay from './BattleMap/PartyDisplay';
import CharacterSheetModal from './CharacterSheetModal';
import { createPlayerCombatCharacter } from '../utils/combatUtils';
import SpellContext from '../context/SpellContext';
import { generateLoot } from '../services/lootService';
import { motion } from 'framer-motion';

interface CombatViewProps {
  party: PlayerCharacter[];
  enemies: CombatCharacter[];
  biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp';
  onBattleEnd: (result: 'victory' | 'defeat', rewards?: { gold: number; items: Item[]; xp: number }) => void;
}

const CombatView: React.FC<CombatViewProps> = ({ party, enemies, biome, onBattleEnd }) => {
  const [seed] = useState(Date.now()); // Generate map once
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  const [characters, setCharacters] = useState<CombatCharacter[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [sheetCharacter, setSheetCharacter] = useState<PlayerCharacter | null>(null);
  
  // Battle State
  const [battleState, setBattleState] = useState<'active' | 'victory' | 'defeat'>('active');
  const [rewards, setRewards] = useState<{ gold: number; items: Item[]; xp: number } | null>(null);
  
  // NEW: Get spell data to hydrate combat abilities
  const allSpells = useContext(SpellContext);

  // Initialize combat characters
  useEffect(() => {
    if (allSpells) {
        const partyCombatants = party.map(p => createPlayerCombatCharacter(p, allSpells));
        setCharacters([...partyCombatants, ...enemies]);
    }
  }, [party, enemies, allSpells]);

  const handleCharacterUpdate = useCallback((updatedChar: CombatCharacter) => {
      setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
  }, []);

  const handleLogEntry = useCallback((entry: CombatLogEntry) => {
      setCombatLog(prev => [...prev, entry]);
  }, []);

  const turnManager = useTurnManager({ 
      characters, 
      onCharacterUpdate: handleCharacterUpdate, 
      onLogEntry: handleLogEntry 
  });
  
  const abilitySystem = useAbilitySystem({
    characters,
    mapData: null, // Passed to BattleMap context implicitly via hooks in useBattleMap
    onExecuteAction: turnManager.executeAction,
    onCharacterUpdate: handleCharacterUpdate,
  });

  // Check for win/loss conditions
  useEffect(() => {
      if (characters.length === 0 || battleState !== 'active') return;

      const players = characters.filter(c => c.team === 'player');
      const activeEnemies = characters.filter(c => c.team === 'enemy' && c.currentHP > 0);
      const activePlayers = players.filter(c => c.currentHP > 0);

      if (activeEnemies.length === 0 && enemies.length > 0) {
          setBattleState('victory');
          // Generate Rewards
          // Map combat characters back to Monster-like objects for loot generation if needed, 
          // or just use the original enemies prop which has CR data.
          const originalMonsters = enemies.map(e => ({ name: e.name, cr: e.stats.cr, quantity: 1, description: e.name })); 
          const loot = generateLoot(originalMonsters);
          
          // Calculate XP
          // Simple calculation: Sum of XP values for CRs
          // For now, placeholder:
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
  
  if (!allSpells) return <div>Loading Spell Data for Combat...</div>;

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

       {sheetCharacter && (
        <CharacterSheetModal 
          isOpen={!!sheetCharacter}
          character={sheetCharacter}
          inventory={[]} // No inventory management during combat for now
          gold={0}
          onClose={handleSheetClose}
          onAction={(action) => console.log('Action from sheet:', action)}
        />
      )}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-red-500 font-cinzel">Combat Encounter</h1>
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
            />
        </div>
        
        {/* Center Pane */}
        <div className="xl:col-span-3 flex items-center justify-center overflow-auto p-2">
            <ErrorBoundary fallbackMessage="An error occurred in the Battle Map.">
            {characters.length > 0 ? (
                <BattleMap
                    biome={biome}
                    seed={seed}
                    characters={characters}
                    combatState={{
                        turnManager: turnManager,
                        turnState: turnManager.turnState,
                        abilitySystem: abilitySystem,
                        isCharacterTurn: turnManager.isCharacterTurn,
                        onCharacterUpdate: handleCharacterUpdate,
                        setCharacters: setCharacters
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
             {currentCharacter && <ActionEconomyBar actionEconomy={currentCharacter.actionEconomy} />}
             <AbilityPalette 
                character={currentCharacter} 
                onSelectAbility={(ability) => abilitySystem.startTargeting(ability, currentCharacter!)}
                canAffordAction={(cost) => turnManager.canAffordAction(currentCharacter, cost)}
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
