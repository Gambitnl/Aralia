import React, { useMemo } from 'react';
import { MapTile as MapTileType, MapMarker } from '../types';
import { BIOMES, LOCATIONS } from '../constants';

interface MapTileProps {
  tile: MapTileType;
  isFocused: boolean;
  markers?: MapMarker[];
  onClick: (x: number, y: number, tile: MapTileType) => void;
}
const MapTile: React.FC<MapTileProps> = React.memo(({ tile, isFocused, markers, onClick }) => {
  const biome = BIOMES[tile.biomeId];
  const isClickable = tile.discovered || tile.isPlayerCurrent;

  const style = useMemo(() => {
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
  // TODO(lint-intent): If biome data becomes dynamic, include a version key so memoization stays accurate.
  }, [tile.discovered, tile.isPlayerCurrent, biome]);

  const tooltipText = useMemo(() => {
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

    if (markers?.length) {
      const poiLabels = markers.map(marker => marker.label).join(', ');
      tooltip += ` Points of interest: ${poiLabels}.`;
    }
    return tooltip;
  }, [tile, biome, markers]);

  const handleClick = () => {
    if (isClickable) {
      onClick(tile.x, tile.y, tile);
    }
  };

  return (
    <button
      data-x={tile.x}
      data-y={tile.y}
      onClick={handleClick}
      className={`relative flex items-center justify-center text-lg focus:outline-none transition-all duration-150
        ${isFocused ? 'ring-2 ring-offset-1 ring-offset-gray-800 ring-sky-400' : ''}
      `}
      style={style}
      disabled={!isClickable}
      tabIndex={isFocused ? 0 : -1}
      role="gridcell"
      aria-label={tooltipText}
      title={tooltipText}
      aria-selected={isFocused}
    >
      {tile.discovered && biome?.icon && (
        <span role="img" aria-label={biome.name} className="text-base sm:text-xl pointer-events-none">{biome.icon}</span>
      )}
      {tile.isPlayerCurrent && (
          <span role="img" aria-label="Player Location" className="absolute text-xl text-red-500 pointer-events-none">📍</span>
      )}
      {markers?.map(marker => (
        <span
          key={marker.id}
          role="img"
          aria-label={marker.label}
          className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 text-lg pointer-events-none drop-shadow"
          title={marker.label}
        >
          {marker.icon}
        </span>
      ))}
      {!tile.discovered && (
        <span className="text-gray-500 pointer-events-none">?</span>
      )}
    </button>
  );
});

MapTile.displayName = 'MapTile';

export default MapTile;
