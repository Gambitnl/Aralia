
/**
 * @file BattleMapDemo.tsx
 * This component serves as a demonstration and test environment for the new procedural battle map feature.
 * It allows selecting a biome and seed to generate and display a procedural battle map.
 * It now accepts the characters for the battle as a prop.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import BattleMap from './BattleMap/BattleMap';
import { PlayerCharacter } from '../types';
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


interface BattleMapDemoProps {
  onExit: () => void;
  initialCharacters: CombatCharacter[];
  party: PlayerCharacter[]; // The full party data
}

type BiomeType = 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp';

const BattleMapDemo: React.FC<BattleMapDemoProps> = ({ onExit, initialCharacters, party }) => {
  const [biome, setBiome] = useState<BiomeType>('forest');
  const [seed, setSeed] = useState(Date.now());
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  const [characters, setCharacters] = useState<CombatCharacter[]>(initialCharacters);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  const [sheetCharacter, setSheetCharacter] = useState<PlayerCharacter | null>(null);

  // When initialCharacters prop changes (i.e., a new encounter starts), reset the component's state.
  useEffect(() => {
    setCharacters(initialCharacters); 
    setCombatLog([]);
    setSelectedCharacterId(null);
    setSheetCharacter(null);
    setSeed(Date.now()); // Generate a new map layout for the new encounter
  }, [initialCharacters]);

  const handleCharacterUpdate = useCallback((updatedChar: CombatCharacter) => {
      setCharacters(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
  }, []);

  const handleLogEntry = useCallback((entry: CombatLogEntry) => {
      setCombatLog(prev => [...prev, entry]);
  }, []);

  const turnManager = useTurnManager({ characters, onCharacterUpdate: handleCharacterUpdate, onLogEntry: handleLogEntry });
  
  const abilitySystem = useAbilitySystem({
    characters,
    mapData: null, // This will be passed to a different component that needs it
    onExecuteAction: turnManager.executeAction,
    onCharacterUpdate: handleCharacterUpdate,
  });

  const handleGenerate = () => {
    setSeed(Date.now());
    setCombatLog([]); // Clear log on new map
    // Re-initialize characters to their starting state for the new map
    setCharacters(initialCharacters);
  };

  const handleCharacterSelect = (charId: string) => {
    setSelectedCharacterId(charId);
  }

  const handleSheetOpen = (charId: string) => {
    const playerToShow = party.find(p => p.id === charId);
    if (playerToShow) {
        setSheetCharacter(playerToShow);
    } else {
        console.warn(`Could not find full character data for ID: ${charId} in the provided party prop.`);
    }
  };

  const handleSheetClose = () => {
    setSheetCharacter(null);
  };
  
  const currentCharacter = turnManager.getCurrentCharacter();

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col p-4">
       {sheetCharacter && (
        <CharacterSheetModal 
          isOpen={!!sheetCharacter}
          character={sheetCharacter}
          inventory={[]} // No inventory management in demo
          gold={0} // Default gold value for demo
          onClose={handleSheetClose}
          onAction={(action) => console.log('Action from sheet:', action)}
        />
      )}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-amber-400 font-cinzel">Battle Map</h1>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg shadow"
        >
          End Battle
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-4 items-center bg-gray-800 p-3 rounded-lg">
        <div>
          <label htmlFor="biomeSelect" className="block text-sm font-medium text-sky-300">
            Select Biome
          </label>
          <select
            id="biomeSelect"
            value={biome}
            onChange={(e) => setBiome(e.target.value as BiomeType)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 bg-gray-700 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md"
          >
            <option value="forest">Forest</option>
            <option value="cave">Cave</option>
            <option value="dungeon">Dungeon</option>
            <option value="desert">Desert</option>
            <option value="swamp">Swamp</option>
          </select>
        </div>
        <button
          onClick={handleGenerate}
          className="self-end px-5 py-2 bg-green-600 hover:bg-green-500 rounded-lg shadow"
        >
          New Map
        </button>
         <button
            onClick={turnManager.endTurn}
            disabled={!turnManager.isCharacterTurn(currentCharacter?.id || '')}
            className="self-end px-5 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg shadow disabled:bg-gray-500"
          >
            End Turn
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
        </div>
      </div>
    </div>
  );
};

export default BattleMapDemo;
