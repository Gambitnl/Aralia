/**
 * @file src/components/TownNavigationControls.tsx
 * 8-directional compass-style navigation controls for town exploration.
 * 
 * Provides buttons for moving in all 8 directions plus a center action button.
 * Supports keyboard navigation with WASD and arrow keys.
 */

import React, { useCallback, useEffect } from 'react';
import { TownDirection } from '../types/town';
import {
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight,
    DoorOpen
} from 'lucide-react';

interface TownNavigationControlsProps {
    /** Called when a direction is pressed */
    onMove: (direction: TownDirection) => void;
    /** Called when exit town is pressed */
    onExit: () => void;
    /** Directions that are blocked (can't move that way) */
    blockedDirections?: TownDirection[];
    /** Whether controls are disabled */
    disabled?: boolean;
    /** Current tile description to show */
    tileDescription?: string;
    /** Show building interactions available */
    adjacentBuildings?: Array<{ id: string; name: string; type: string }>;
    /** Called when a building is interacted with */
    onBuildingInteract?: (buildingId: string) => void;
}

/**
 * Mapping of directions to their arrow icons
 */
const DIRECTION_ICONS: Record<TownDirection, React.ReactNode> = {
    north: <ArrowUp size={20} />,
    northeast: <ArrowUpRight size={18} />,
    east: <ArrowRight size={20} />,
    southeast: <ArrowDownRight size={18} />,
    south: <ArrowDown size={20} />,
    southwest: <ArrowDownLeft size={18} />,
    west: <ArrowLeft size={20} />,
    northwest: <ArrowUpLeft size={18} />,
};

/**
 * Mapping of keyboard keys to directions
 */
const KEY_TO_DIRECTION: Record<string, TownDirection> = {
    // Arrow keys
    'ArrowUp': 'north',
    'ArrowDown': 'south',
    'ArrowLeft': 'west',
    'ArrowRight': 'east',
    // WASD
    'w': 'north',
    'W': 'north',
    's': 'south',
    'S': 'south',
    'a': 'west',
    'A': 'west',
    'd': 'east',
    'D': 'east',
    // QEZC for diagonals
    'q': 'northwest',
    'Q': 'northwest',
    'e': 'northeast',
    'E': 'northeast',
    'z': 'southwest',
    'Z': 'southwest',
    'c': 'southeast',
    'C': 'southeast',
};

const TownNavigationControls: React.FC<TownNavigationControlsProps> = ({
    onMove,
    onExit,
    blockedDirections = [],
    disabled = false,
    tileDescription,
    adjacentBuildings = [],
    onBuildingInteract,
}) => {
    // Keyboard handler
    useEffect(() => {
        if (disabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't capture if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Check for exit key (Escape)
            if (e.key === 'Escape') {
                onExit();
                return;
            }

            // Check for movement keys
            const direction = KEY_TO_DIRECTION[e.key];
            if (direction && !blockedDirections.includes(direction)) {
                e.preventDefault();
                onMove(direction);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [disabled, onMove, onExit, blockedDirections]);

    const handleDirectionClick = useCallback((direction: TownDirection) => {
        if (!disabled && !blockedDirections.includes(direction)) {
            onMove(direction);
        }
    }, [disabled, blockedDirections, onMove]);

    const isBlocked = (dir: TownDirection) => blockedDirections.includes(dir);

    // Button styling
    const getButtonClass = (direction: TownDirection) => {
        const base = 'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 border';
        const isCorner = ['northwest', 'northeast', 'southwest', 'southeast'].includes(direction);

        if (disabled) {
            return `${base} bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed`;
        }

        if (isBlocked(direction)) {
            return `${base} bg-gray-800/50 border-gray-700/50 text-gray-600 cursor-not-allowed`;
        }

        return `${base} bg-gray-700 border-gray-600 text-gray-200 hover:bg-amber-600 hover:border-amber-500 hover:text-white active:scale-95 cursor-pointer ${isCorner ? 'opacity-80' : ''}`;
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 bg-gray-900/90 rounded-xl border border-gray-700 backdrop-blur-sm">
            {/* Tile Description */}
            {tileDescription && (
                <div className="text-center text-sm text-gray-300 max-w-[200px] leading-tight">
                    {tileDescription}
                </div>
            )}

            {/* 3x3 Compass Grid */}
            <div className="grid grid-cols-3 gap-1">
                {/* Row 1: NW, N, NE */}
                <button
                    className={getButtonClass('northwest')}
                    onClick={() => handleDirectionClick('northwest')}
                    disabled={disabled || isBlocked('northwest')}
                    title="Move Northwest (Q)"
                >
                    {DIRECTION_ICONS.northwest}
                </button>
                <button
                    className={getButtonClass('north')}
                    onClick={() => handleDirectionClick('north')}
                    disabled={disabled || isBlocked('north')}
                    title="Move North (W / ↑)"
                >
                    {DIRECTION_ICONS.north}
                </button>
                <button
                    className={getButtonClass('northeast')}
                    onClick={() => handleDirectionClick('northeast')}
                    disabled={disabled || isBlocked('northeast')}
                    title="Move Northeast (E)"
                >
                    {DIRECTION_ICONS.northeast}
                </button>

                {/* Row 2: W, CENTER, E */}
                <button
                    className={getButtonClass('west')}
                    onClick={() => handleDirectionClick('west')}
                    disabled={disabled || isBlocked('west')}
                    title="Move West (A / ←)"
                >
                    {DIRECTION_ICONS.west}
                </button>
                <button
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-amber-600 border border-amber-500 text-white hover:bg-amber-500 active:scale-95 transition-all duration-150"
                    onClick={onExit}
                    disabled={disabled}
                    title="Leave Town (Escape)"
                >
                    <DoorOpen size={20} />
                </button>
                <button
                    className={getButtonClass('east')}
                    onClick={() => handleDirectionClick('east')}
                    disabled={disabled || isBlocked('east')}
                    title="Move East (D / →)"
                >
                    {DIRECTION_ICONS.east}
                </button>

                {/* Row 3: SW, S, SE */}
                <button
                    className={getButtonClass('southwest')}
                    onClick={() => handleDirectionClick('southwest')}
                    disabled={disabled || isBlocked('southwest')}
                    title="Move Southwest (Z)"
                >
                    {DIRECTION_ICONS.southwest}
                </button>
                <button
                    className={getButtonClass('south')}
                    onClick={() => handleDirectionClick('south')}
                    disabled={disabled || isBlocked('south')}
                    title="Move South (S / ↓)"
                >
                    {DIRECTION_ICONS.south}
                </button>
                <button
                    className={getButtonClass('southeast')}
                    onClick={() => handleDirectionClick('southeast')}
                    disabled={disabled || isBlocked('southeast')}
                    title="Move Southeast (C)"
                >
                    {DIRECTION_ICONS.southeast}
                </button>
            </div>

            {/* Adjacent Buildings */}
            {adjacentBuildings.length > 0 && (
                <div className="w-full border-t border-gray-700 pt-3 mt-1">
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Nearby</div>
                    <div className="flex flex-col gap-1">
                        {adjacentBuildings.map((building) => (
                            <button
                                key={building.id}
                                className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 transition-colors border border-gray-700 hover:border-amber-500"
                                onClick={() => onBuildingInteract?.(building.id)}
                            >
                                <span className="font-medium">{building.name}</span>
                                <span className="text-xs text-gray-500 ml-2">({building.type})</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Keyboard Hints */}
            <div className="text-xs text-gray-500 flex gap-3">
                <span>WASD to move</span>
                <span>ESC to exit</span>
            </div>
        </div>
    );
};

export default TownNavigationControls;
