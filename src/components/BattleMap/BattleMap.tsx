/**
 * @file BattleMap.tsx
 * The primary component for rendering the procedural battle map grid, tiles, and character tokens.
 */
import React, { useMemo } from 'react';
import { BattleMapData, CombatCharacter } from '../../types/combat';
import { useBattleMap } from '../../hooks/useBattleMap';
import BattleMapTile from './BattleMapTile';
import CharacterToken from './CharacterToken';
import { TILE_SIZE_PX } from '../../config/mapConfig';

interface BattleMapProps {
  biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp';
  seed: number;
  characters: CombatCharacter[];
  combatState: {
    turnManager: any; // The full turn manager hook return object
    turnState: any; // Simplified for now
    abilitySystem: any; // Simplified for now
    isCharacterTurn: (id: string) => boolean;
    onCharacterUpdate: (character: CombatCharacter) => void;
    setCharacters: React.Dispatch<React.SetStateAction<CombatCharacter[]>>;
  };
}

const BattleMap: React.FC<BattleMapProps> = ({ biome, seed, characters, combatState }) => {
  const { turnManager, turnState, abilitySystem, isCharacterTurn, setCharacters } = combatState;
  
  const battleMapState = useBattleMap(biome, seed, characters, setCharacters, turnManager, abilitySystem);

  // Guard against undefined state if the hook doesn't return immediately (though it should)
  if (!battleMapState) {
      return <div>Initializing battle map...</div>;
  }

  const {
    mapData,
    characterPositions,
    selectedCharacterId,
    validMoves,
    activePath,
    actionMode,
    attackableTargets,
    setActionMode,
    handleTileClick,
    handleCharacterClick,
  } = battleMapState;

  const tileArray = useMemo(() => {
    if (!mapData) return [];
    return Array.from(mapData.tiles.values());
  }, [mapData]);

  if (!mapData) {
    return <div>Generating map...</div>;
  }
  
  const currentCharacter = characters.find(c => c.id === turnState.currentCharacterId);

  return (
    <div className="relative">
       {currentCharacter && isCharacterTurn(currentCharacter.id) && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-700 p-2 rounded-md shadow-lg flex gap-2 z-20">
          <button 
            onClick={() => setActionMode('move')}
            className={`px-3 py-1 text-sm rounded transition-colors ${actionMode === 'move' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-gray-600 hover:bg-gray-500'}`}
          >Move</button>
          <button
            onClick={() => {
              setActionMode('ability');
              abilitySystem.startTargeting(currentCharacter.abilities[0], currentCharacter); // Example: always target with first ability
            }}
            className={`px-3 py-1 text-sm rounded transition-colors ${actionMode === 'ability' ? 'bg-red-600 text-white ring-2 ring-red-300' : 'bg-gray-600 hover:bg-gray-500'}`}
          >Attack</button>
        </div>
      )}
      <div className="battle-map-container bg-gray-800 p-2 rounded-lg shadow-lg"
          style={{
              width: `${mapData.dimensions.width * TILE_SIZE_PX + 2}px`,
              height: `${mapData.dimensions.height * TILE_SIZE_PX + 2}px`,
          }}>
        <div 
          className="battle-map-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${mapData.dimensions.width}, ${TILE_SIZE_PX}px)`,
            gridTemplateRows: `repeat(${mapData.dimensions.height}, ${TILE_SIZE_PX}px)`,
            position: 'relative',
            border: '1px solid #4A5568',
          }}
        >
          {tileArray.map(tile => {
            const isTargetable = abilitySystem.targetingMode && abilitySystem.isValidTarget(abilitySystem.selectedAbility, currentCharacter, tile.coordinates);
            const isAoePreview = abilitySystem.aoePreview?.affectedTiles.some((p: { x: number; y: number; }) => p.x === tile.coordinates.x && p.y === tile.coordinates.y);

            return (
              <BattleMapTile
                key={tile.id}
                tile={tile}
                isValidMove={actionMode === 'move' && validMoves.has(tile.id)}
                isInPath={activePath.some(p => p.id === tile.id)}
                isTargetable={isTargetable}
                isAoePreview={isAoePreview}
                onClick={() => handleTileClick(tile)}
              />
            )
          })}
          
          {Array.from(characterPositions.values()).map(charPos => {
            const character = characters.find(c => c.id === charPos.characterId);
            if (!character) return null;
            return (
              <CharacterToken
                key={character.id}
                character={character}
                position={charPos.coordinates}
                isSelected={selectedCharacterId === character.id}
                isTargetable={attackableTargets.has(character.id)}
                isTurn={turnState.currentCharacterId === character.id}
                onClick={() => handleCharacterClick(character)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BattleMap;