/**
 * @file BattleMap.tsx
 * The primary component for rendering the procedural battle map grid, tiles, and character tokens.
 */
import React, { useMemo, useRef, useCallback } from 'react';
import { BattleMapData, CombatCharacter } from '../../types/combat';
import { useBattleMap } from '../../hooks/useBattleMap';
import { useTargetSelection } from '../../hooks/combat/useTargetSelection';
import BattleMapTile from './BattleMapTile';
import CharacterToken from './CharacterToken';
import BattleMapOverlay from './BattleMapOverlay';
import { TILE_SIZE_PX } from '../../config/mapConfig';
import { generateId } from '../../utils/combatUtils';

interface BattleMapProps {
  mapData: BattleMapData | null;
  characters: CombatCharacter[];
  combatState: {
    turnManager: any; // The full turn manager hook return object
    turnState: any; // Simplified for now
    abilitySystem: any; // Simplified for now
    isCharacterTurn: (id: string) => boolean;
    onCharacterUpdate: (character: CombatCharacter) => void;
  };
}

const BattleMap: React.FC<BattleMapProps> = ({ mapData, characters, combatState }) => {
  const { turnManager, turnState, abilitySystem, isCharacterTurn } = combatState;

  const battleMapState = useBattleMap(mapData, characters, turnManager, abilitySystem);

  // Use damage numbers from turnManager state prop if available
  // Assuming turnManager.damageNumbers is exposed (which we added in useTurnManager)
  const damageNumbers = turnManager.damageNumbers || [];

  const {
    characterPositions,
    selectedCharacterId,
    validMoves,
    activePath,
    actionMode,
    setActionMode,
    handleTileClick,
    handleCharacterClick,
  } = battleMapState;

  const gridRef = useRef<HTMLDivElement>(null);

  // Live AoE preview when hovering tiles while targeting
  const handleGridMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!abilitySystem?.previewAoE || !abilitySystem.targetingMode || !mapData) return;
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.floor((event.clientX - rect.left) / TILE_SIZE_PX);
      const y = Math.floor((event.clientY - rect.top) / TILE_SIZE_PX);
      if (x < 0 || y < 0 || x >= mapData.dimensions.width || y >= mapData.dimensions.height) return;

      const caster = characters.find(c => c.id === turnState.currentCharacterId);
      if (caster) {
        abilitySystem.previewAoE({ x, y }, caster);
      }
    },
    [abilitySystem, characters, mapData, turnState.currentCharacterId]
  );

  const tileArray = useMemo(() => {
    if (!mapData) return [];
    return Array.from(mapData.tiles.values());
  }, [mapData]);

  const currentCharacter = characters.find(c => c.id === turnState.currentCharacterId);

  // --- OPTIMIZATION START ---
  // Memoize sets to reduce O(N) lookups in render loop and prevent re-calcs on mouse move

  const { aoeSet, validTargetSet } = useTargetSelection({
    abilitySystem,
    currentCharacter,
    mapData,
    characters
  });

  // 2. Active Path Set: Validates if a tile is in the current movement path
  const activePathSet = useMemo(() => {
    const set = new Set<string>();
    activePath.forEach(p => set.add(p.id));
    return set;
  }, [activePath]);

  // --- OPTIMIZATION END ---

  if (!mapData) {
    return <div>Generating map...</div>;
  }

  // TODO(Ritualist): Implement ritual progress visualization in the map overlay or UI panel.
  // Ensure the progress bar clearly shows interruption conditions (e.g., "Damage breaks concentration").

  return (
    <div className="relative">
       {/* UI for current turn actions */}
       {currentCharacter && isCharacterTurn(currentCharacter.id) && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-700 p-2 rounded-md shadow-lg flex gap-2 z-20">
          <button 
            onClick={() => setActionMode('move')}
            className={`px-3 py-1 text-sm rounded transition-colors ${actionMode === 'move' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-gray-600 hover:bg-gray-500'}`}
          >Move</button>
          <button
            onClick={() => {
              setActionMode('ability');
              abilitySystem.startTargeting(currentCharacter.abilities[0], currentCharacter);
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
          ref={gridRef}
          onMouseMove={handleGridMouseMove}
        >
          {tileArray.map(tile => {
            // Optimised lookups using Sets (O(1)) instead of Array searches/Calculations (O(N))
            const isTargetable = validTargetSet.has(tile.id);
            const isAoePreview = aoeSet.has(tile.id);
            const isValidMove = actionMode === 'move' && validMoves.has(tile.id);
            const isInPath = activePathSet.has(tile.id);

            return (
              <BattleMapTile
                key={tile.id}
                tile={tile}
                isValidMove={isValidMove}
                isInPath={isInPath}
                isTargetable={isTargetable}
                isAoePreview={isAoePreview}
                onTileClick={handleTileClick}
              />
            )
          })}
          
          {characters.map(character => {
            // Optimized: Iterate characters directly instead of looking them up via characterPositions map
            // This removes an O(N) search inside the loop, making this rendering phase O(N) instead of O(N^2)
            const charTileId = `${character.position.x}-${character.position.y}`;
            const isTargetable = validTargetSet.has(charTileId);

            return (
              <CharacterToken
                key={character.id}
                character={character}
                position={character.position}
                isSelected={selectedCharacterId === character.id}
                isTargetable={isTargetable}
                isTurn={turnState.currentCharacterId === character.id}
                onCharacterClick={handleCharacterClick}
              />
            );
          })}
          <BattleMapOverlay
            mapData={mapData}
            characters={characters}
            damageNumbers={damageNumbers}
            animations={turnManager.animations || []}
            aoePreview={abilitySystem.aoePreview}
          />
        </div>
      </div>
    </div>
  );
};

export default BattleMap;
