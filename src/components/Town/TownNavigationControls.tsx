/**
 * @file src/components/Town/TownNavigationControls.tsx
 * 8-directional compass-style navigation controls for town exploration.
 * 
 * Provides buttons for moving in all 8 directions plus a center action button.
 * Supports keyboard navigation with WASD and arrow keys.
 */

import React, { useCallback, useEffect } from 'react';
import { TownDirection } from '../../types/town';
import {
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight,
    DoorOpen
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

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
    north: <ArrowUp size={20} aria-hidden="true" />,
    northeast: <ArrowUpRight size={18} aria-hidden="true" />,
    east: <ArrowRight size={20} aria-hidden="true" />,
    southeast: <ArrowDownRight size={18} aria-hidden="true" />,
    south: <ArrowDown size={20} aria-hidden="true" />,
    southwest: <ArrowDownLeft size={18} aria-hidden="true" />,
    west: <ArrowLeft size={20} aria-hidden="true" />,
    northwest: <ArrowUpLeft size={18} aria-hidden="true" />,
};

/**
 * Human-readable labels for directions
 */
const DIRECTION_LABELS: Record<TownDirection, string> = {
    north: "Move North",
    northeast: "Move Northeast",
    east: "Move East",
    southeast: "Move Southeast",
    south: "Move South",
    southwest: "Move Southwest",
    west: "Move West",
    northwest: "Move Northwest",
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

// Grid layout for the 3x3 control pad
const CONTROL_GRID: (TownDirection | 'EXIT')[] = [
    'northwest', 'north', 'northeast',
    'west', 'EXIT', 'east',
    'southwest', 'south', 'southeast'
];

const TownNavigationControls: React.FC<TownNavigationControlsProps> = ({
    onMove,
    onExit,
    blockedDirections = [],
    disabled = false,
    tileDescription,
    adjacentBuildings = [],
    onBuildingInteract,
}) => {
    const shouldReduceMotion = useReducedMotion();

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

    // Button styling generator
    const getButtonClass = (direction: TownDirection) => {
        const base = 'w-10 h-10 flex items-center justify-center rounded-lg border focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 shadow-sm';
        const isCorner = ['northwest', 'northeast', 'southwest', 'southeast'].includes(direction);

        if (disabled) {
            return `${base} bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed`;
        }

        if (isBlocked(direction)) {
            return `${base} bg-gray-800/50 border-gray-700/50 text-gray-600 cursor-not-allowed`;
        }

        return `${base} bg-gray-700 border-gray-600 text-gray-200 hover:bg-amber-600 hover:border-amber-500 hover:text-white cursor-pointer ${isCorner ? 'opacity-80' : ''}`;
    };

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: {
            opacity: 1,
            scale: 1,
            transition: {
                staggerChildren: 0.05,
                delayChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    const buttonTapScale = shouldReduceMotion ? 1 : 0.92;

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="flex flex-col items-center gap-4 p-4 bg-gray-900/95 rounded-xl border border-gray-700 backdrop-blur-md shadow-xl"
        >
            {/* Tile Description */}
            {tileDescription && (
                <motion.div
                    variants={itemVariants}
                    className="text-center text-sm text-gray-300 max-w-[200px] leading-tight font-medium"
                    role="status"
                    aria-live="polite"
                >
                    {tileDescription}
                </motion.div>
            )}

            {/* 3x3 Compass Grid */}
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Town Navigation Controls">
                {CONTROL_GRID.map((item) => {
                    if (item === 'EXIT') {
                        return (
                            <motion.button
                                key="exit"
                                variants={itemVariants}
                                whileTap={{ scale: buttonTapScale }}
                                className="w-10 h-10 flex items-center justify-center rounded-lg bg-amber-600 border border-amber-500 text-white hover:bg-amber-500 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                onClick={onExit}
                                disabled={disabled}
                                title="Leave Town (Escape)"
                                aria-label="Leave Town"
                            >
                                <DoorOpen size={20} aria-hidden="true" />
                            </motion.button>
                        );
                    }

                    const direction = item as TownDirection;
                    const shortcuts = {
                        north: '(W / ↑)',
                        south: '(S / ↓)',
                        east: '(D / →)',
                        west: '(A / ←)',
                        northeast: '(E)',
                        northwest: '(Q)',
                        southeast: '(C)',
                        southwest: '(Z)',
                    };

                    return (
                        <motion.button
                            key={direction}
                            variants={itemVariants}
                            whileTap={!disabled && !isBlocked(direction) ? { scale: buttonTapScale } : undefined}
                            className={getButtonClass(direction)}
                            onClick={() => handleDirectionClick(direction)}
                            disabled={disabled || isBlocked(direction)}
                            title={`${DIRECTION_LABELS[direction]} ${shortcuts[direction] || ''}`}
                            aria-label={DIRECTION_LABELS[direction]}
                        >
                            {DIRECTION_ICONS[direction]}
                        </motion.button>
                    );
                })}
            </div>

            {/* Adjacent Buildings */}
            {adjacentBuildings.length > 0 && (
                <motion.div
                    variants={itemVariants}
                    className="w-full border-t border-gray-700 pt-3 mt-1"
                    role="region"
                    aria-label="Nearby Buildings"
                >
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 font-semibold">Nearby</div>
                    <div className="flex flex-col gap-2">
                        {adjacentBuildings.map((building) => (
                            <motion.button
                                key={building.id}
                                whileHover={shouldReduceMotion ? {} : { scale: 1.02, x: 2 }}
                                whileTap={{ scale: buttonTapScale }}
                                className="w-full text-left px-3 py-2 bg-gray-800 hover:bg-gray-750 rounded-lg text-sm text-gray-200 transition-colors border border-gray-700 hover:border-amber-500/50 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                onClick={() => onBuildingInteract?.(building.id)}
                                aria-label={`Enter ${building.name} (${building.type})`}
                            >
                                <span className="font-medium text-amber-100/90">{building.name}</span>
                                <span className="text-xs text-gray-500 ml-2 block" aria-hidden="true">{building.type}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Keyboard Hints */}
            <motion.div variants={itemVariants} className="text-[10px] text-gray-500 flex gap-3 opacity-70" aria-hidden="true">
                <span>WASD to move</span>
                <span>ESC to exit</span>
            </motion.div>
        </motion.div>
    );
};

export default TownNavigationControls;
