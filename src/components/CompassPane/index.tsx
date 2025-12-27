/**
 * @file CompassPane.tsx
 * This component displays the 8-directional compass for movement and a central "Look Around" button.
 * Movement options are dynamically enabled/disabled based on game state and map data.
 * It now also displays the player's current world and submap coordinates, and the current game time.
 * It also includes icon buttons to toggle the World Map and Submap views.
 * The submap toggle button is hidden if the compass is being shown within the SubmapPane itself.
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Action, Location, MapData } from '../../types';
import { BIOMES } from '../../constants'; // To get biome details like color
import { DIRECTION_VECTORS, SUBMAP_DIMENSIONS } from '../../config/mapConfig';
import { TimeWidget } from '../ui/TimeWidget';
import Tooltip from '../Tooltip'; // Import Tooltip
import PassTimeModal from '../PassTimeModal'; // Import the new modal

interface CompassPaneProps {
  currentLocation: Location;
  currentSubMapCoordinates: { x: number; y: number } | null;
  worldMapCoords: { x: number; y: number }; 
  subMapCoords: { x: number; y: number } | null;   
  onAction: (action: Action) => void;
  disabled: boolean;
  mapData: MapData | null;
  gameTime: Date; 
  isSubmapContext?: boolean; // New prop
}

type CompassPoint = {
  label: string;
  actionType: 'move' | 'look_around' | 'none';
  directionKey?: keyof typeof DIRECTION_VECTORS;
  gridPosition: string;
  ariaLabel: string;
};

const compassLayout: CompassPoint[] = [
  { label: 'NW', actionType: 'move', directionKey: 'NorthWest', gridPosition: 'row-start-1 col-start-1', ariaLabel: 'Move North-West' },
  { label: 'N',  actionType: 'move', directionKey: 'North',     gridPosition: 'row-start-1 col-start-2', ariaLabel: 'Move North'    },
  { label: 'NE', actionType: 'move', directionKey: 'NorthEast', gridPosition: 'row-start-1 col-start-3', ariaLabel: 'Move North-East' },
  { label: 'W',  actionType: 'move', directionKey: 'West',      gridPosition: 'row-start-2 col-start-1', ariaLabel: 'Move West'     },
  { label: '◎',  actionType: 'look_around',                     gridPosition: 'row-start-2 col-start-2', ariaLabel: 'Look Around' },
  { label: 'E',  actionType: 'move', directionKey: 'East',      gridPosition: 'row-start-2 col-start-3', ariaLabel: 'Move East'     },
  { label: 'SW', actionType: 'move', directionKey: 'SouthWest', gridPosition: 'row-start-3 col-start-1', ariaLabel: 'Move South-West' },
  { label: 'S',  actionType: 'move', directionKey: 'South',     gridPosition: 'row-start-3 col-start-2', ariaLabel: 'Move South'    },
  { label: 'SE', actionType: 'move', directionKey: 'SouthEast', gridPosition: 'row-start-3 col-start-3', ariaLabel: 'Move South-East' },
];

const CompassPane: React.FC<CompassPaneProps> = ({
  currentLocation,
  currentSubMapCoordinates,
  worldMapCoords,
  subMapCoords,
  onAction,
  disabled,
  mapData,
  gameTime, 
  isSubmapContext = false, // Default to false
}) => {
  const [isPassTimeModalOpen, setIsPassTimeModalOpen] = useState(false); // State for the modal

  const isCompassActionDisabled = (point: CompassPoint): boolean => {
    if (disabled) return true; 
    if (point.actionType === 'look_around') return false;

    if (point.actionType === 'move' && point.directionKey && currentSubMapCoordinates && mapData) {
        const { dx, dy } = DIRECTION_VECTORS[point.directionKey];
        const nextSubMapX = currentSubMapCoordinates.x + dx;
        const nextSubMapY = currentSubMapCoordinates.y + dy;

        if (nextSubMapX >= 0 && nextSubMapX < SUBMAP_DIMENSIONS.cols &&
            nextSubMapY >= 0 && nextSubMapY < SUBMAP_DIMENSIONS.rows) {
            return false; 
        } else {
            const currentWorldMapX = currentLocation.mapCoordinates.x;
            const currentWorldMapY = currentLocation.mapCoordinates.y;
            
            const targetWorldMapX = currentWorldMapX + dx;
            const targetWorldMapY = currentWorldMapY + dy;

            if (targetWorldMapY < 0 || targetWorldMapY >= mapData.gridSize.rows ||
                targetWorldMapX < 0 || targetWorldMapX >= mapData.gridSize.cols) {
                return true; 
            }

            const targetWorldTile = mapData.tiles[targetWorldMapY]?.[targetWorldMapX];
            if (!targetWorldTile) return true; 

            const targetBiome = BIOMES[targetWorldTile.biomeId];
            return !targetBiome?.passable; 
        }
    }
    return true;
  };

  const handlePassTimeConfirm = (totalSeconds: number) => {
    onAction({ type: 'wait', label: 'Pass time', payload: { seconds: totalSeconds } });
  };

  return (
    <>
      <PassTimeModal
        isOpen={isPassTimeModalOpen}
        onClose={() => setIsPassTimeModalOpen(false)}
        onConfirm={handlePassTimeConfirm}
        currentTime={gameTime}
      />
      <div className="flex flex-col gap-2">
        {/* Time Widget */}
        <TimeWidget
          gameTime={gameTime}
          onPassTimeClick={() => setIsPassTimeModalOpen(true)}
          disabled={disabled}
        />

        <div className="bg-gray-800 p-4 rounded-lg shadow-xl border border-gray-700 flex-shrink-0">
          <div className="mb-2 text-center">
            <h3 className="text-sm font-semibold text-sky-400">Current Position</h3>
            <p className="text-xs text-gray-300">World: <span className="font-semibold text-amber-300">({worldMapCoords.x}, {worldMapCoords.y})</span></p>
            {subMapCoords && (
              <p className="text-xs text-gray-300">Submap: <span className="font-semibold text-amber-300">({subMapCoords.x}, {subMapCoords.y})</span></p>
            )}
          </div>
          <h3 className="text-md text-sky-300 mb-2 text-center font-semibold">Navigation</h3>
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-36 h-36 mx-auto bg-gray-700 p-1 rounded-full shadow-inner">
            {compassLayout.map((point) => {
              const actionToPerform: Action | null =
                point.actionType === 'look_around' ? { type: 'look_around', label: 'Look Around' } :
                point.actionType === 'move' && point.directionKey ? { type: 'move', label: `Move ${point.directionKey}`, targetId: point.directionKey } :
                null;

              const isDisabledBySystem = isCompassActionDisabled(point);

              return (
                <motion.button
                  key={point.label}
                  onClick={() => actionToPerform && onAction(actionToPerform)}
                  disabled={isDisabledBySystem}
                  whileTap={!isDisabledBySystem ? { scale: 0.9 } : undefined}
                  whileHover={!isDisabledBySystem ? { scale: 1.1 } : undefined}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className={`
                    ${point.gridPosition}
                    flex items-center justify-center
                    text-md font-mono font-bold
                    rounded-md transition-colors duration-150
                    ${!isDisabledBySystem
                      ? 'bg-sky-600 hover:bg-sky-500 text-white focus:ring-2 focus:ring-sky-400'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }
                    ${point.label === '◎' ? 'text-xl' : ''}
                    focus:outline-none
                  `}
                  aria-label={point.ariaLabel + (isDisabledBySystem && point.actionType === 'move' ? ' (unavailable)' : '')}
                  title={point.ariaLabel + (isDisabledBySystem && point.actionType === 'move' ? ' (unavailable)' : '')}
                >
                  {point.label}
                </motion.button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-center items-center gap-3">
            <Tooltip content="Open World Map">
              <motion.button
                onClick={() => onAction({ type: 'toggle_map', label: 'Toggle World Map'})}
                disabled={disabled}
                whileTap={!disabled ? { scale: 0.9 } : undefined}
                whileHover={!disabled ? { scale: 1.1 } : undefined}
                className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-gray-600 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors text-xl"
                aria-label="Toggle World Map"
              >
                🌍
              </motion.button>
            </Tooltip>
            {!isSubmapContext && (
              <Tooltip content="Open Local Submap">
                <motion.button
                  onClick={() => onAction({ type: 'toggle_submap_visibility', label: 'Toggle Submap'})}
                  disabled={disabled}
                  whileTap={!disabled ? { scale: 0.9 } : undefined}
                  whileHover={!disabled ? { scale: 1.1 } : undefined}
                  className="p-2 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-gray-600 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-colors text-xl"
                  aria-label="Toggle Submap"
                >
                  🗺️
                </motion.button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CompassPane;
