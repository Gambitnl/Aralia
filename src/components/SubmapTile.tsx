/**
 * @file SubmapTile.tsx
 * A memoized component for rendering a single tile on the submap grid.
 * It only re-renders if its specific props have changed.
 *
 * USED BY:
 * - ./SubmapPane.tsx
 */
import React from 'react';
import Tooltip from './Tooltip';
import { SeededFeatureConfig } from '../types';

// Define the structure for the visuals object passed from the parent
interface TileVisuals {
  style: React.CSSProperties;
  content: React.ReactNode;
  animationClass: string;
  isResource: boolean;
  effectiveTerrainType: string;
  zIndex: number;
  activeSeededFeatureConfigForTile: SeededFeatureConfig | null;
  // tooltipContent is passed as a separate prop to ensure visual object stability
}

interface SubmapTileProps {
  r: number;
  c: number;
  visuals: TileVisuals;
  tooltipContent: string | React.ReactNode;
  isPlayerPos: boolean;
  isHighlightedForInspection: boolean;
  isInteractiveResource: boolean;
  isInQuickTravelPath: boolean;
  isQuickTravelMode: boolean;
  isBlockedForTravel: boolean;
  isDestination: boolean;
  isQuickTravelBlocked: boolean; // Specific to the destination tile
  onMouseEnter: (x: number, y: number) => void;
  onClick: (x: number, y: number, terrain: string, feature: SeededFeatureConfig | null) => void;
  isDisabled: boolean;
}

const SubmapTile: React.FC<SubmapTileProps> = React.memo(({
  r,
  c,
  visuals,
  tooltipContent,
  isPlayerPos,
  isHighlightedForInspection,
  isInteractiveResource,
  isInQuickTravelPath,
  isQuickTravelMode,
  isBlockedForTravel,
  isDestination,
  isQuickTravelBlocked,
  onMouseEnter,
  onClick,
  isDisabled
}) => {
  
  const handleClick = () => {
    if (!isDisabled) {
      onClick(c, r, visuals.effectiveTerrainType, visuals.activeSeededFeatureConfigForTile);
    }
  };

  const handleMouseEnter = () => {
    onMouseEnter(c, r);
  };

  // Determine dynamic classes
  let dynamicClasses = visuals.animationClass;
  
  if (isHighlightedForInspection) {
    dynamicClasses += ' cursor-pointer ring-2 ring-yellow-400 ring-inset hover:bg-yellow-500/20';
  } else if (isDisabled) {
    // If disabled (e.g. inspecting but not adjacent), apply opacity
    // Note: parent logic handles specific inspectable vs not, here we just receive the result
    // but we might need specific "not inspectable" visual if in inspect mode
  }

  // Inspection mode styling (if not highlighted/inspectable is handled by parent passing props or checking isDisabled logic contextually, 
  // but here we mostly render what we are told). 
  
  if (isInteractiveResource) {
      dynamicClasses += ' hover:ring-2 hover:ring-green-400 cursor-pointer';
  }
  
  if (isInQuickTravelPath) {
      dynamicClasses += ' bg-yellow-500/50';
  }
  
  if (isQuickTravelMode) {
      if (isBlockedForTravel) {
          dynamicClasses += ' cursor-not-allowed bg-red-800/30';
      } else {
          dynamicClasses += ' cursor-pointer';
      }
  }
  
  if (isDestination) {
      if (!isQuickTravelBlocked) {
          dynamicClasses += ' ring-2 ring-green-400 ring-inset';
      } else {
          dynamicClasses += ' ring-2 ring-red-500 ring-inset';
      }
  }

  return (
    <Tooltip content={tooltipContent}>
      <div
        role="gridcell"
        aria-label={`Tile at ${c},${r}. ${typeof tooltipContent === 'string' ? tooltipContent : 'Visual detail.'}`}
        className={`w-full h-full flex items-center justify-center text-center text-sm relative transition-all duration-150 border border-black/10 ${dynamicClasses}`}
        style={{ ...visuals.style, zIndex: visuals.zIndex, userSelect: 'none' }}
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
        tabIndex={isHighlightedForInspection ? 0 : -1}
      >
        <span className="pointer-events-none" style={{ textShadow: '0 0 2px black, 0 0 2px black, 0 0 1px black' }}>
          {visuals.content}
        </span>
        
        {isPlayerPos && (
            <div className="absolute inset-0 flex items-center justify-center text-lg text-yellow-300 filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] z-[100]">
                <span role="img" aria-label="Your Position">🧍</span>
            </div>
        )}

        {isHighlightedForInspection && (
            <div className="absolute inset-0 border-2 border-yellow-400 pointer-events-none animate-pulseInspectHighlight"></div>
        )}
        
        {isInQuickTravelPath && !isPlayerPos && (
          <div className="absolute w-1.5 h-1.5 bg-white/80 rounded-full pointer-events-none"></div>
        )}
      </div>
    </Tooltip>
  );
}, (prev, next) => {
    // Custom comparison to ensure performance
    // We only return false (re-render) if specific props change
    return (
        prev.visuals === next.visuals && // Relies on stable object from parent useMemo
        prev.tooltipContent === next.tooltipContent &&
        prev.isPlayerPos === next.isPlayerPos &&
        prev.isHighlightedForInspection === next.isHighlightedForInspection &&
        prev.isInteractiveResource === next.isInteractiveResource &&
        prev.isInQuickTravelPath === next.isInQuickTravelPath &&
        prev.isQuickTravelMode === next.isQuickTravelMode &&
        prev.isBlockedForTravel === next.isBlockedForTravel &&
        prev.isDestination === next.isDestination &&
        prev.isQuickTravelBlocked === next.isQuickTravelBlocked &&
        prev.isDisabled === next.isDisabled
        // Callbacks (onClick, onMouseEnter) are assumed stable via useCallback in parent
    );
});

export default SubmapTile;
