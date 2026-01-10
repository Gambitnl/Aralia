/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceRollerModal.tsx
 * 3D dice roller modal using @3d-dice/dice-box for visual dice rolling.
 * Features dice pool builder with count badges and +/- controls.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Dice6, RefreshCcw, Minus, Plus } from 'lucide-react';
import { useDiceBox } from '../../hooks/useDiceBox';
import { WindowFrame } from '../ui/WindowFrame';
import { DiceScaleSlider } from './DiceScaleSlider';
import { DiceSVG } from './DiceSVGs';

interface DiceRollerModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialNotation?: string;
    onRollComplete?: (total: number, rolls: Array<{ die: string; value: number }>) => void;
}

// Die types in order
const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;
type DieType = typeof DIE_TYPES[number];

// Initial empty pool
const EMPTY_POOL: Record<DieType, number> = {
    d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 0, d100: 0
};

export const DiceRollerModal: React.FC<DiceRollerModalProps> = ({
    isOpen,
    onClose,
    initialNotation = '1d20',
    onRollComplete,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dicePool, setDicePool] = useState<Record<DieType, number>>({ ...EMPTY_POOL });
    const [modifier, setModifier] = useState(0);
    const [diceScale, setDiceScale] = useState(10);

    const { isReady, isRolling, lastResult, error, roll, clear, resize, updateScale } = useDiceBox({
        containerId: '#dice-roller-canvas',
    });

    // Generate notation from dice pool
    const poolNotation = useMemo(() => {
        return DIE_TYPES
            .filter(die => dicePool[die] > 0)
            .map(die => `${dicePool[die]}${die}`)
            .join(', ');
    }, [dicePool]);

    // Check if pool has any dice
    const hasPoolDice = useMemo(() => {
        return DIE_TYPES.some(die => dicePool[die] > 0);
    }, [dicePool]);

    // Add a die to the pool
    const addDie = useCallback((die: DieType) => {
        setDicePool(prev => ({ ...prev, [die]: prev[die] + 1 }));
    }, []);

    // Remove a die from the pool
    const removeDie = useCallback((die: DieType, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering addDie
        setDicePool(prev => ({ ...prev, [die]: Math.max(0, prev[die] - 1) }));
    }, []);

    // Clear the pool
    const clearPool = useCallback(() => {
        setDicePool({ ...EMPTY_POOL });
        clear();
    }, [clear]);

    // Sync scale changes to DiceBox
    const handleScaleChange = useCallback((newScale: number) => {
        setDiceScale(newScale);
        updateScale(newScale);
    }, [updateScale]);

    // Handle container resizing
    useEffect(() => {
        if (!containerRef.current || !isReady) return;

        const observer = new ResizeObserver(() => {
            resize();
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [isReady, resize]);

    // Notify parent of roll completion
    useEffect(() => {
        if (lastResult && onRollComplete) {
            onRollComplete(lastResult.total + modifier, lastResult.rolls);
        }
    }, [lastResult, modifier, onRollComplete]);

    const handleRoll = useCallback(async () => {
        if (!isReady || isRolling || !hasPoolDice) return;
        // Create array of roll notations for each die type with count > 0
        const rollArray = DIE_TYPES
            .filter(die => dicePool[die] > 0)
            .map(die => `${dicePool[die]}${die}`);
        // Pass array to roll - dice-box accepts array of notations
        await roll(rollArray);
    }, [isReady, isRolling, hasPoolDice, dicePool, roll]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'Enter' && isReady && !isRolling && hasPoolDice) {
            handleRoll();
        }
    }, [onClose, isReady, isRolling, hasPoolDice, handleRoll]);

    if (!isOpen) return null;

    const finalTotal = lastResult ? lastResult.total + modifier : null;

    return (
        <>
            {/* TODO: Refactor the inline <style> block into a dedicated CSS file */}
            <style>
                {`
                    .dice-box-canvas, 
                    #dice-roller-canvas canvas {
                        pointer-events: none !important;
                    }
                `}
            </style>
            <AnimatePresence>
                <WindowFrame
                    key="dice-roller-window"
                    title="Dice Roller"
                    onClose={onClose}
                    storageKey="dice-roller-window"
                    headerActions={<Dice6 className="w-5 h-5 text-amber-400" />}
                >
                    <div
                        className="flex flex-col h-full bg-gray-900"
                        onKeyDown={handleKeyDown}
                        tabIndex={-1}
                    >
                        {/* Dice Canvas Container (The Tray) */}
                        <div className="relative flex-grow min-h-0 p-2 bg-black/40 overflow-hidden">
                            <div
                                id="dice-roller-canvas"
                                ref={containerRef}
                                className="w-full h-full bg-gradient-to-b from-gray-900/80 to-black/90 rounded-lg border-2 border-amber-900/40 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]"
                            />
                            {/* Decorative felt texture hint */}
                            <div className="absolute inset-2 pointer-events-none opacity-5 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/felt.png')]" />

                            {error && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
                                    <p className="text-red-400">Error: {error}</p>
                                </div>
                            )}
                            {!isReady && !error && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90">
                                    <p className="text-gray-400 animate-pulse">Loading dice...</p>
                                </div>
                            )}
                        </div>

                        {/* Controls - Single Row: Scale Slider | Dice Pool | Roll Controls */}
                        <div className="p-3 border-t border-gray-700 bg-gray-800/80 flex-shrink-0 relative z-10">
                            <div className="flex gap-3 items-center">
                                {/* Scale Slider */}
                                <div className="flex-shrink-0">
                                    <DiceScaleSlider
                                        value={diceScale}
                                        min={5}
                                        max={20}
                                        onChange={handleScaleChange}
                                    />
                                </div>

                                {/* Dice Pool Buttons */}
                                <div className="flex gap-1 flex-shrink-0">
                                    {DIE_TYPES.map((die) => {
                                        const count = dicePool[die];
                                        return (
                                            <div
                                                key={die}
                                                className="relative group"
                                            >
                                                {/* Main die button - click anywhere adds */}
                                                <button
                                                    onClick={() => addDie(die)}
                                                    disabled={!isReady || isRolling}
                                                    className={`relative flex flex-col items-center p-1 rounded-lg transition-all border ${count > 0
                                                        ? 'bg-amber-900/50 border-amber-500 ring-1 ring-amber-400/30'
                                                        : 'bg-gray-700 hover:bg-gray-600 border-gray-600'
                                                        } disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-200`}
                                                    title={`Add ${die} to pool`}
                                                >
                                                    <DiceSVG die={die} className="w-12 h-12" />
                                                    <span className="text-[10px] text-gray-400">{die}</span>

                                                    {/* Count badge */}
                                                    {count > 0 && (
                                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 text-gray-900 rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                                                            {count}
                                                        </div>
                                                    )}
                                                </button>

                                                {/* Minus button - left side, only visible when count > 0 */}
                                                {count > 0 && (
                                                    <button
                                                        onClick={(e) => removeDie(die, e)}
                                                        className="absolute -left-2 top-1/2 -translate-y-1/2 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title={`Remove ${die}`}
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                )}

                                                {/* Plus button - right side, always visible on hover */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        addDie(die);
                                                    }}
                                                    disabled={!isReady || isRolling}
                                                    className="absolute -right-2 top-1/2 -translate-y-1/2 w-5 h-5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title={`Add ${die}`}
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Separator */}
                                <div className="w-px h-16 bg-gray-600 flex-shrink-0" />

                                {/* Notation (read-only from pool) + Mod + Roll + Result + Clear */}
                                <div className="flex gap-2 items-center flex-1">
                                    <div className="relative flex-1 min-w-[80px]">
                                        <div className="w-full px-2 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-center text-sm min-h-[38px] flex items-center justify-center">
                                            {poolNotation || <span className="text-gray-500 italic">Click dice to add</span>}
                                        </div>
                                        <span className="absolute -top-2 left-1 bg-gray-800 px-1 text-[9px] text-gray-400 uppercase font-bold">Pool</span>
                                    </div>
                                    <div className="relative w-14">
                                        <input
                                            type="number"
                                            value={modifier}
                                            onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                                            placeholder="±"
                                            className="w-full px-1 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                                        />
                                        <span className="absolute -top-2 left-1 bg-gray-800 px-1 text-[9px] text-gray-400 uppercase font-bold">Mod</span>
                                    </div>
                                    <button
                                        onClick={handleRoll}
                                        disabled={!isReady || isRolling || !hasPoolDice}
                                        className="flex items-center justify-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95"
                                    >
                                        <Dice6 className="w-5 h-5" />
                                        {isRolling ? '...' : 'Roll'}
                                    </button>

                                    {/* Inline Result Display */}
                                    {lastResult && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 rounded-lg border border-amber-600/50 min-w-[80px] justify-center">
                                            <span className="text-2xl font-bold text-amber-400">{lastResult.total}</span>
                                            {modifier !== 0 && (
                                                <>
                                                    <span className="text-base text-gray-500">{modifier > 0 ? '+' : ''}{modifier}</span>
                                                    <span className="text-base text-gray-500">=</span>
                                                    <span className="text-2xl font-bold text-green-400">{finalTotal}</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        onClick={clearPool}
                                        disabled={!isReady}
                                        className="px-2 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-200 rounded-lg transition-colors border border-gray-600"
                                        title="Clear pool and dice"
                                    >
                                        <RefreshCcw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </WindowFrame>
            </AnimatePresence>
        </>
    );
};

export default DiceRollerModal;
