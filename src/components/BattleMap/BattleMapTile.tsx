/**
 * @file BattleMapTile.tsx
 * A memoized component for rendering a single tile on the battle map.
 */
import React from 'react';
import { BattleMapTile as BattleMapTileData, BattleMapDecoration } from '../../types/combat';

interface BattleMapTileProps {
  tile: BattleMapTileData;
  isValidMove: boolean;
  isInPath: boolean;
  isTargetable: boolean;
  isAoePreview: boolean;
  onTileClick: (tile: BattleMapTileData) => void;
  onTileHover?: (tile: BattleMapTileData) => void;
}

const BattleMapTile: React.FC<BattleMapTileProps> = React.memo(({ tile, isValidMove, isInPath, isTargetable, isAoePreview, onTileClick, onTileHover }) => {
  const getTerrainColor = (terrain: string) => {
    switch (terrain) {
      case 'grass': return 'bg-green-800';
      case 'rock':
      case 'floor':
      case 'stone': return 'bg-gray-600';
      case 'water': return 'bg-blue-700';
      case 'difficult': return 'bg-yellow-700';
      case 'wall': return 'bg-gray-900';
      case 'sand': return 'bg-yellow-600';
      case 'mud': return 'bg-stone-700';
      default: return 'bg-black';
    }
  };

  const getDecoration = (decoration: BattleMapDecoration) => {
    switch (decoration) {
      case 'tree': return '🌳';
      case 'boulder': return '🪨';
      case 'stalagmite': return 'ʌ';
      case 'pillar': return '🏛️';
      case 'cactus': return '🌵';
      case 'mangrove': return '🌿';
      default: return null;
    }
  };
  
  const tileBaseClasses = 'w-full h-full flex items-center justify-center border border-gray-700/50';
  const terrainColor = getTerrainColor(tile.terrain);
  const decoration = getDecoration(tile.decoration);

  let overlayClass = '';
  if (isAoePreview) {
      overlayClass = 'bg-red-500/60';
  } else if (isTargetable) {
      overlayClass = 'bg-red-500/40';
  } else if (isInPath) {
    overlayClass = 'bg-yellow-500/50';
  } else if (isValidMove) {
    overlayClass = 'bg-blue-500/40';
  }
  
  const isInteractive = isValidMove || isTargetable;

  const handleActivate = () => {
    if (!isInteractive) return;
    onTileClick(tile);
  };

  return (
    <div
      className={`${tileBaseClasses} ${terrainColor} relative transition-colors duration-150`}
      onClick={handleActivate}
      onMouseEnter={() => onTileHover?.(tile)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      }}
      role="button"
      tabIndex={isInteractive ? 0 : -1}
      aria-disabled={!isInteractive}
      aria-label={`Tile ${tile.terrain} at ${tile.coordinates.x}, ${tile.coordinates.y}`}
      style={{ cursor: isInteractive ? 'pointer' : 'default' }}
      title={`(${tile.coordinates.x}, ${tile.coordinates.y}) - ${tile.terrain} - Elev: ${tile.elevation}`}
    >
      {tile.elevation > 0 && (
        <div className="absolute top-0 right-1 text-xs font-bold text-gray-400/50 pointer-events-none filter drop-shadow(0 1px 1px black)">
          {tile.elevation}
        </div>
      )}
      {decoration && <span className="text-lg pointer-events-none">{decoration}</span>}
      {overlayClass && <div className={`absolute inset-0 ${overlayClass} pointer-events-none`}></div>}
    </div>
  );
});

BattleMapTile.displayName = 'BattleMapTile';

export default BattleMapTile;
