
/**
 * @file MapPane.tsx
 * This component displays the game world map, allowing players to visualize
 * their location and travel to discovered areas. It now features enhanced
 * keyboard navigation using arrow keys and roving tabindex, and an icon glossary.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapData, MapTile, Biome, GlossaryDisplayItem } from '../types'; // Changed GlossaryItem to GlossaryDisplayItem
import { BIOMES, LOCATIONS } from '../constants'; // To get biome details like color and icon
import GlossaryDisplay from './GlossaryDisplay'; // Import the new component

interface MapPaneProps {
  mapData: MapData;
  onTileClick: (x: number, y: number, tile: MapTile) => void;
  onClose: () => void;
}

const MapPane: React.FC<MapPaneProps> = ({ mapData, onTileClick, onClose }) => {
  const { gridSize, tiles } = mapData;
  const [focusedCoords, setFocusedCoords] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null); // Ref for the close button

  // Set initial focus when map opens
  useEffect(() => {
    const playerTile = tiles.flat().find(tile => tile.isPlayerCurrent);
    if (playerTile) {
      setFocusedCoords({ x: playerTile.x, y: playerTile.y });
    } else if (tiles.length > 0 && tiles[0].length > 0) {
      setFocusedCoords({ x: tiles[0][0].x, y: tiles[0][0].y });
    }
    closeButtonRef.current?.focus();
  }, [tiles]); 

  // Focus the specific tile when focusedCoords change
  useEffect(() => {
    if (focusedCoords && gridRef.current) {
      const tileButton = gridRef.current.querySelector(`button[data-x='${focusedCoords.x}'][data-y='${focusedCoords.y}']`) as HTMLButtonElement;
      tileButton?.focus();
    }
  }, [focusedCoords]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!focusedCoords) return;

    let { x, y } = focusedCoords;
    let newX = x;
    let newY = y;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        newY = Math.max(0, y - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        newY = Math.min(gridSize.rows - 1, y + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        newX = Math.max(0, x - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        newX = Math.min(gridSize.cols - 1, x + 1);
        break;
      case 'Enter':
      case ' ': 
        event.preventDefault();
        const currentTile = tiles[y]?.[x];
        if (currentTile && (currentTile.discovered || currentTile.isPlayerCurrent)) {
          onTileClick(x, y, currentTile);
        }
        return; 
      case 'Escape':
        event.preventDefault();
        onClose();
        return;
      default:
        return; 
    }

    if (newX !== x || newY !== y) {
      setFocusedCoords({ x: newX, y: newY });
    }
  }, [focusedCoords, gridSize, tiles, onTileClick, onClose]);


  const getTileStyle = (tile: MapTile): React.CSSProperties => {
    const biome: Biome | undefined = BIOMES[tile.biomeId];
    let backgroundColor = 'rgba(107, 114, 128, 0.7)'; // Default discovered fallback
    
    if (tile.discovered) {
      if (biome && biome.rgbaColor) {
        backgroundColor = biome.rgbaColor;
      } 
    } else {
        backgroundColor = 'rgba(55, 65, 81, 0.7)'; // Undiscovered fog
    }

    return {
      backgroundColor,
      border: tile.isPlayerCurrent ? '2px solid #FBBF24' : '1px solid rgba(75, 85, 99, 0.5)', 
      aspectRatio: '1 / 1', 
    };
  };

  const getTileTooltip = (tile: MapTile): string => {
    const biome = BIOMES[tile.biomeId];
    if (!tile.discovered) {
      return `Undiscovered area (${tile.x}, ${tile.y}). Potential biome: ${biome?.name || 'Unknown'}.`;
    }
    
    let tooltip = `${biome?.name || 'Unknown Area'} (${tile.x}, ${tile.y})`;
    
    if (tile.locationId && LOCATIONS[tile.locationId]) {
      tooltip += ` - ${LOCATIONS[tile.locationId].name}.`;
    } else {
      tooltip += "."; // Add a period if no location name
    }
    
    if (biome?.description) {
        tooltip += ` ${biome.description}`;
    }

    if (tile.isPlayerCurrent) {
      tooltip += ' (Your current world map area)';
    }
    return tooltip;
  };

  const mapGlossaryItems: GlossaryDisplayItem[] = Object.values(BIOMES) // Changed GlossaryItem to GlossaryDisplayItem
    .filter(biome => biome.icon)
    .map(biome => ({
      icon: biome.icon!,
      meaning: biome.name,
      category: 'Biome'
    }));
  
  mapGlossaryItems.push({ icon: '📍', meaning: 'Your Current World Map Area', category: 'Player'});
  mapGlossaryItems.push({ icon: '?', meaning: 'Undiscovered Area', category: 'Map State'});


  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-40 p-4"
        aria-modal="true"
        role="dialog"
        aria-labelledby="map-pane-title"
        onKeyDown={handleKeyDown} 
    >
      <div 
        className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-3xl max-h-[90vh] flex flex-col"
        style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/old-paper.png')", backgroundSize: 'cover' }} 
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="map-pane-title" className="text-3xl font-bold text-amber-600 font-cinzel">World Map</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-gray-700 hover:text-amber-600 text-2xl font-bold py-1 px-3 rounded bg-amber-400 hover:bg-amber-500 transition-colors focus:ring-2 focus:ring-amber-300 focus:outline-none"
            aria-label="Close map"
          >
            &times;
          </button>
        </div>

        <div 
            className="overflow-auto scrollable-content flex-grow p-2 bg-black bg-opacity-10 rounded"
            ref={gridRef}
        >
          <div 
            className="grid gap-0.5" 
            style={{ 
              gridTemplateColumns: `repeat(${gridSize.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridSize.rows}, minmax(0, 1fr))`,
            }}
            role="grid" 
          >
            {tiles.flat().map((tile, index) => {
              const biome = BIOMES[tile.biomeId];
              const isFocused = focusedCoords?.x === tile.x && focusedCoords?.y === tile.y;
              const isClickable = tile.discovered || tile.isPlayerCurrent; 
              const tooltipText = getTileTooltip(tile);
              return (
                <button
                  key={`${tile.x}-${tile.y}-${index}`}
                  data-x={tile.x}
                  data-y={tile.y}
                  onClick={() => isClickable && onTileClick(tile.x, tile.y, tile)}
                  className={`flex items-center justify-center text-lg focus:outline-none transition-all duration-150
                    ${isFocused ? 'ring-2 ring-offset-1 ring-offset-gray-800 ring-sky-400' : ''}
                  `}
                  style={getTileStyle(tile)}
                  disabled={!isClickable} 
                  tabIndex={isFocused ? 0 : -1} 
                  role="gridcell" 
                  aria-label={tooltipText}
                  title={tooltipText} // Use title attribute for basic tooltip
                  aria-selected={isFocused} 
                >
                  {tile.discovered && biome?.icon && (
                    <span role="img" aria-label={biome.name} className="text-base sm:text-xl pointer-events-none">{biome.icon}</span>
                  )}
                  {tile.isPlayerCurrent && (
                     <span role="img" aria-label="Player Location" className="absolute text-xl text-red-500 pointer-events-none">📍</span>
                  )}
                  {!tile.discovered && (
                    <span className="text-gray-500 pointer-events-none">?</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <GlossaryDisplay items={mapGlossaryItems} title="Map Legend" />
        <p className="text-xs text-center mt-2 text-gray-700">Use Tab to focus the grid, Arrow Keys to navigate, Enter/Space to select a tile. Esc to close.</p>
      </div>
    </div>
  );
};

export default MapPane;