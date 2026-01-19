
/**
 * @file BattleMapDemo.tsx
 * This component serves as a demonstration and test environment for the new procedural battle map feature.
 * It allows selecting a biome and seed to generate and display a procedural battle map.
 * It now accepts the characters for the battle as a prop.
 */
// TODO: Add ARIA labels, keyboard navigation, and screen reader support for interactive elements in battle maps and UI components
import React, { useState, useMemo, useEffect, useCallback, useRef, useContext } from 'react';
import BattleMap from './BattleMap';
import { PlayerCharacter } from '../../types';
import { BattleMapData, CombatCharacter, CombatLogEntry } from '../../types/combat';
import ErrorBoundary from '../ui/ErrorBoundary';
import { useTurnManager } from '../../hooks/combat/useTurnManager';
import { useAbilitySystem } from '../../hooks/useAbilitySystem';
import { generateBattleSetup } from '../../hooks/useBattleMapGeneration';
import InitiativeTracker from './InitiativeTracker';
import AbilityPalette from './AbilityPalette';
import CombatLog from './CombatLog';
import ActionEconomyBar from './ActionEconomyBar';
import PartyDisplay from './PartyDisplay';
import CharacterSheetModal from '../CharacterSheet/CharacterSheetModal';
import { canUseDevTools } from '../../utils/permissions';
import { logger } from '../../utils/logger';
import { createPlayerCombatCharacter } from '../../utils/combatUtils';
import SpellContext from '../../context/SpellContext';
import { Spell } from '../../types/spells';


interface BattleMapDemoProps {
  onExit: () => void;
  initialCharacters: CombatCharacter[];
  party: PlayerCharacter[]; // The full party data
}

type BiomeType = 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp';

const BattleMapDemo: React.FC<BattleMapDemoProps> = ({ onExit, initialCharacters, party }) => {
  const initialBiome: BiomeType = 'forest';
  const [biome, setBiome] = useState<BiomeType>(initialBiome);
  const [seed, setSeed] = useState(() => Date.now());
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);

  const allSpells = useContext(SpellContext);
  const spellsRecord = useMemo(
    () => (allSpells ?? {}) as unknown as Record<string, Spell>,
    [allSpells]
  );

  const getBaseCombatants = useCallback((): CombatCharacter[] => {
    const partyCombatants = party.map(p => createPlayerCombatCharacter(p, spellsRecord));
    return [...partyCombatants, ...initialCharacters];
  }, [initialCharacters, party, spellsRecord]);

  const [initialSetup] = useState(() => {
    const baseCombatants = getBaseCombatants();
    return generateBattleSetup(initialBiome, seed, baseCombatants);
  });

  const [mapData, setMapData] = useState<BattleMapData | null>(initialSetup.mapData);
  const [characters, setCharacters] = useState<CombatCharacter[]>(initialSetup.positionedCharacters);
  const [sheetCharacter, setSheetCharacter] = useState<PlayerCharacter | null>(null);
  const [autoCharacters, setAutoCharacters] = useState<Set<string>>(new Set());
  // TODO(next-agent): Preserve behavior; wire selection state into BattleMap interactions when the demo UI expands.
  const [_selectedCharacterId, _setSelectedCharacterId] = useState<string | null>(null);

  const biomeRef = useRef(biome);
  useEffect(() => {
    biomeRef.current = biome;
  }, [biome]);

  const handleCharacterUpdate = useCallback((updatedChar: CombatCharacter) => {
    setCharacters(prev => {
      const exists = prev.some(c => c.id === updatedChar.id);
      if (!exists) return [...prev, updatedChar];
      return prev.map(c => c.id === updatedChar.id ? updatedChar : c);
    });
  }, []);

  const handleLogEntry = useCallback((entry: CombatLogEntry) => {
    setCombatLog(prev => [...prev, entry]);
  }, []);

  const turnManager = useTurnManager({
    characters,
    mapData,
    onCharacterUpdate: handleCharacterUpdate,
    onLogEntry: handleLogEntry,
    onMapUpdate: setMapData,
    autoCharacters,
    difficulty: 'normal'
  });

  const initializeCombat = turnManager.initializeCombat;
  const turnOrderLength = turnManager.turnState.turnOrder.length;

  // Initialize combat once when the turn order is empty.
  useEffect(() => {
    if (characters.length > 0 && turnOrderLength === 0) {
      initializeCombat(characters);
    }
  }, [characters, initializeCombat, turnOrderLength]);

  // When initialCharacters prop changes (i.e., a new encounter starts), reset the component's state.
  const didInitFromPropsRef = useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!didInitFromPropsRef.current) {
      didInitFromPropsRef.current = true;
      return;
    }

    const nextSeed = Date.now();
    const baseCombatants = getBaseCombatants();
    const setup = generateBattleSetup(biomeRef.current, nextSeed, baseCombatants);

    setSeed(nextSeed);
    setCombatLog([]);
    setSheetCharacter(null);
    setMapData(setup.mapData);
    setCharacters(setup.positionedCharacters);
    initializeCombat(setup.positionedCharacters);
  }, [getBaseCombatants, initialCharacters, initializeCombat]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const abilitySystem = useAbilitySystem({
    characters,
    mapData,
    onExecuteAction: turnManager.executeAction,
    onCharacterUpdate: handleCharacterUpdate,
    onAbilityEffect: turnManager.addDamageNumber,
    reactiveTriggers: turnManager.reactiveTriggers,
    onReactiveTriggerUpdate: turnManager.setReactiveTriggers,
    onMapUpdate: setMapData
  });

  const handleToggleAuto = useCallback((characterId: string) => {
    setAutoCharacters(prev => {
      const next = new Set(prev);
      if (next.has(characterId)) {
        next.delete(characterId);
      } else {
        next.add(characterId);
      }
      return next;
    });
  }, []);

  const handleGenerate = () => {
    const nextSeed = Date.now();
    const baseCombatants = getBaseCombatants();
    const setup = generateBattleSetup(biome, nextSeed, baseCombatants);

    setSeed(nextSeed);
    setCombatLog([]); // Clear log on new map
    setSheetCharacter(null);
    setAutoCharacters(new Set());
    setMapData(setup.mapData);
    setCharacters(setup.positionedCharacters);
    turnManager.initializeCombat(setup.positionedCharacters);
  };

  const handleCharacterSelect = useCallback(() => { }, []);

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

  const currentCharacter = turnManager.getCurrentCharacter() ?? null;

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col p-4">
      {sheetCharacter && (
        <CharacterSheetModal
          isOpen={!!sheetCharacter}
          character={sheetCharacter}
          inventory={[]} // No inventory management in demo
          gold={0} // Default gold value for demo
          onClose={handleSheetClose}
          onAction={(action) => {
            if (canUseDevTools()) {
              logger.debug('Action from sheet:', { action });
            }
          }}
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
            onChange={(e) => {
              const nextBiome = e.target.value as BiomeType;
              const baseCombatants = getBaseCombatants();
              const setup = generateBattleSetup(nextBiome, seed, baseCombatants);

              setBiome(nextBiome);
              setCombatLog([]);
              setSelectedCharacterId(null);
              setSheetCharacter(null);
              setAutoCharacters(new Set());
              setMapData(setup.mapData);
              setCharacters(setup.positionedCharacters);
              turnManager.initializeCombat(setup.positionedCharacters);
            }}
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
            autoCharacters={autoCharacters}
            onToggleAuto={handleToggleAuto}
          />
        </div>

        {/* Center Pane */}
        <div className="xl:col-span-3 flex items-center justify-center overflow-auto p-2">
          <ErrorBoundary fallbackMessage="An error occurred in the Battle Map.">
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
            character={currentCharacter}
            onSelectAbility={(ability) => currentCharacter && abilitySystem.startTargeting(ability, currentCharacter)}
            canAffordAction={(cost) => currentCharacter ? turnManager.canAffordAction(currentCharacter, cost) : false}
          />
          <CombatLog logEntries={combatLog} />
        </div>
      </div>
    </div>
  );
};

export default BattleMapDemo;
