
/**
 * @file MapPane.tsx
 * This component displays the game world map, allowing players to visualize
 * their location and travel to discovered areas. It now features enhanced
 * keyboard navigation using arrow keys and roving tabindex, and an icon glossary.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapData, MapTile as MapTileType, GlossaryDisplayItem, MapMarker } from '../types'; // Changed GlossaryItem to GlossaryDisplayItem
import { BIOMES } from '../constants'; // To get biome details like color and icon
import GlossaryDisplay from './GlossaryDisplay'; // Import the new component
import { POIS } from '../data/world/pois';
import { buildPoiMarkers } from '../utils/locationUtils';
import MapTile from './MapTile';
import oldPaperBg from '../assets/images/old-paper.svg';

interface MapPaneProps {
  mapData: MapData;
  onTileClick: (x: number, y: number, tile: MapTileType) => void;
  onClose: () => void;
}

const MapPane: React.FC<MapPaneProps> = ({ mapData, onTileClick, onClose }) => {
  const { gridSize, tiles } = mapData;
  const [focusedCoords, setFocusedCoords] = useState<{ x: number; y: number } | null>(null);

  /**
   * Precompute POI markers using shared logic so both the main map and
   * minimap stay in sync. Using a memo keeps re-renders cheap even when
   * the grid is large or when panning triggers fast updates.
   */
  const poiMarkers: MapMarker[] = useMemo(() => buildPoiMarkers(POIS, mapData), [mapData]);

  // Quick lookup map: "x-y" => markers sitting on that tile
  const markersByCoordinate = useMemo(() => {
    const map = new Map<string, MapMarker[]>();
    poiMarkers.forEach(marker => {
      if (!marker.isDiscovered) return; // Only draw known POIs on the big map
      const key = `${marker.coordinates.x}-${marker.coordinates.y}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(marker);
    });
    return map;
  }, [poiMarkers]);

  // New state for pan and zoom
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const gridRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Handle mouse wheel for zooming
  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      const zoomSensitivity = 0.1;
      const delta = -Math.sign(e.deltaY) * zoomSensitivity;
      const newScale = Math.min(Math.max(0.5, scale + delta), 3); // Limit zoom between 0.5x and 3x
      setScale(newScale);
  };

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  // Handle mouse move for panning
  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return;
      setOffset({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
      });
  };

  // Handle mouse up to stop panning
  const handleMouseUp = () => {
      setIsDragging(false);
  };

  const handleRecenter = () => {
      setOffset({ x: 0, y: 0 });
      setScale(1);
  };


  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    // If modifier key is pressed, don't interfere (allows browser shortcuts)
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    let { x, y } = focusedCoords || { x: 0, y: 0 }; // Default to 0,0 if null
    let newX = x;
    let newY = y;
    let handled = false;

    switch (event.key) {
      case 'ArrowUp':
        handled = true;
        newY = Math.max(0, y - 1);
        break;
      case 'ArrowDown':
        handled = true;
        newY = Math.min(gridSize.rows - 1, y + 1);
        break;
      case 'ArrowLeft':
        handled = true;
        newX = Math.max(0, x - 1);
        break;
      case 'ArrowRight':
        handled = true;
        newX = Math.min(gridSize.cols - 1, x + 1);
        break;
      case 'Enter':
      case ' ': 
        handled = true;
        const currentTile = tiles[y]?.[x];
        if (currentTile && (currentTile.discovered || currentTile.isPlayerCurrent)) {
          onTileClick(x, y, currentTile);
        }
        break;
      case 'Escape':
        handled = true;
        onClose();
        break;
      case '+':
      case '=':
        handled = true;
        setScale(s => Math.min(3, s + 0.1));
        break;
      case '-':
      case '_':
        handled = true;
        setScale(s => Math.max(0.5, s - 0.1));
        break;
      case '0':
        handled = true;
        handleRecenter();
        break;
    }

    if (handled) {
        event.preventDefault();
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

    const markers = markersByCoordinate.get(`${tile.x}-${tile.y}`);
    if (markers?.length) {
      const poiLabels = markers.map(marker => marker.label).join(', ');
      tooltip += ` Points of interest: ${poiLabels}.`;
    }
    return tooltip;
  };

  const mapGlossaryItems: GlossaryDisplayItem[] = useMemo(() => {
    const items: GlossaryDisplayItem[] = Object.values(BIOMES)
      .filter(biome => biome.icon)
      .map(biome => ({
        icon: biome.icon!,
        meaning: biome.name,
        category: 'Biome'
      }));

    items.push({ icon: '📍', meaning: 'Your Current World Map Area', category: 'Player'});
    items.push({ icon: '?', meaning: 'Undiscovered Area', category: 'Map State'});

    // Surface each unique POI category in the legend using the first icon we encounter for that class of marker.
    const poiCategoryToIcon = new Map<string, string>();
    poiMarkers.forEach(marker => {
      if (!marker.category) return;
      if (!poiCategoryToIcon.has(marker.category)) {
        poiCategoryToIcon.set(marker.category, marker.icon);
      }
    });

    poiCategoryToIcon.forEach((icon, category) => {
      items.push({
        icon,
        meaning: `${category.charAt(0).toUpperCase()}${category.slice(1)} point of interest`,
        category: 'Points of Interest'
      });
    });

    return items;
  }, [poiMarkers]);


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
        style={{ backgroundImage: `url(${oldPaperBg})`, backgroundSize: 'cover' }}
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
            className="overflow-hidden flex-grow p-2 bg-black bg-opacity-10 rounded relative cursor-grab active:cursor-grabbing"
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
          <div 
            className="grid gap-0.5 transition-transform duration-75 ease-out origin-center"
            style={{ 
              gridTemplateColumns: `repeat(${gridSize.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridSize.rows}, minmax(0, 1fr))`,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            }}
            role="grid" 
            ref={gridRef}
          >
            {tiles.flat().map((tile, index) => {
              const isFocused = focusedCoords?.x === tile.x && focusedCoords?.y === tile.y;
              const markers = markersByCoordinate.get(`${tile.x}-${tile.y}`);

              return (
                <MapTile
                  key={`${tile.x}-${tile.y}-${index}`}
                  tile={tile}
                  isFocused={isFocused}
                  markers={markers}
                  onClick={onTileClick}
                />
              );
            })}
          </div>

          {/* Controls Overlay */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
              <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded shadow" aria-label="Zoom In">+</button>
              <button onClick={handleRecenter} className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded shadow" aria-label="Reset View">⟲</button>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded shadow" aria-label="Zoom Out">-</button>
          </div>
        </div>
        <GlossaryDisplay items={mapGlossaryItems} title="Map Legend" />
        <p className="text-xs text-center mt-2 text-gray-700">Use Tab to focus the grid, Arrow Keys to navigate, +/- to zoom, drag to pan. Esc to close.</p>
      </div>
    </div>
  );
};

export default MapPane;