/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceRollerModal.tsx
 * 3D dice roller modal using @3d-dice/dice-box for visual dice rolling.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice6, RefreshCcw } from 'lucide-react';
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

const PRESET_ROLLS = [
    { label: 'd4', notation: '1d4' },
    { label: 'd6', notation: '1d6' },
    { label: 'd8', notation: '1d8' },
    { label: 'd10', notation: '1d10' },
    { label: 'd12', notation: '1d12' },
    { label: 'd20', notation: '1d20' },
    { label: 'd100', notation: '1d100' },
];

export const DiceRollerModal: React.FC<DiceRollerModalProps> = ({
    isOpen,
    onClose,
    initialNotation = '1d20',
    onRollComplete,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [notation, setNotation] = useState(initialNotation);
    const [modifier, setModifier] = useState(0);
    const [diceScale, setDiceScale] = useState(10);

    const { isReady, isRolling, lastResult, error, roll, clear, resize, updateScale } = useDiceBox({
        containerId: '#dice-roller-canvas',
    });

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

    // Update notation when initialNotation prop changes
    useEffect(() => {
        setNotation(initialNotation);
    }, [initialNotation]);

    // Notify parent of roll completion
    useEffect(() => {
        if (lastResult && onRollComplete) {
            onRollComplete(lastResult.total + modifier, lastResult.rolls);
        }
    }, [lastResult, modifier, onRollComplete]);

    const handleRoll = useCallback(async () => {
        if (!isReady || isRolling) return;
        await roll(notation);
    }, [isReady, isRolling, notation, roll]);

    const handleQuickRoll = useCallback(async (quickNotation: string) => {
        setNotation(quickNotation);
        if (isReady && !isRolling) {
            await roll(quickNotation);
        }
    }, [isReady, isRolling, roll]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'Enter' && isReady && !isRolling) {
            handleRoll();
        }
    }, [onClose, isReady, isRolling, handleRoll]);

    if (!isOpen) return null;

    const finalTotal = lastResult ? lastResult.total + modifier : null;

    return (
        <>
            {/* TODO: Refactor the inline <style> block into a dedicated CSS file (e.g., src/components/dice/DiceRollerModal.css) or use a styled-component to keep the render function clean and avoid specificity wars. */}
            <style>
                {`
                        .dice-box-canvas, 
                        #dice-roller-canvas canvas {                        pointer-events: none !important;
                    }
                `}
            </style>
            {/* AnimatePresence enables exit animations for the modal */}
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

                        {/* Controls - Single Row: Troll Slider | Dice Buttons | Inputs/Actions */}
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

                                {/* Dice Buttons - 50% larger */}
                                <div className="flex gap-1 flex-shrink-0">
                                    {PRESET_ROLLS.map(({ label, notation: presetNotation }) => (
                                        <button
                                            key={presetNotation}
                                            onClick={() => handleQuickRoll(presetNotation)}
                                            disabled={!isReady || isRolling}
                                            className="flex flex-col items-center p-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-200 rounded-lg transition-colors border border-gray-600"
                                            title={`Roll ${presetNotation}`}
                                        >
                                            <DiceSVG die={label} className="w-14 h-14" />
                                            <span className="text-[10px] text-gray-400">{label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Separator */}
                                <div className="w-px h-16 bg-gray-600 flex-shrink-0" />

                                {/* Notation + Mod + Roll + Result + Clear */}
                                <div className="flex gap-2 items-center flex-1">
                                    <div className="relative w-20">
                                        <input
                                            type="text"
                                            value={notation}
                                            onChange={(e) => setNotation(e.target.value)}
                                            placeholder="2d6+3"
                                            className="w-full px-2 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                                        />
                                        <span className="absolute -top-2 left-1 bg-gray-800 px-1 text-[9px] text-gray-400 uppercase font-bold">Notation</span>
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
                                        disabled={!isReady || isRolling}
                                        className="flex items-center justify-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg transition-all active:scale-95"
                                    >
                                        <Dice6 className="w-5 h-5" />
                                        {isRolling ? '...' : 'Roll'}
                                    </button>

                                    {/* Inline Result Display */}
                                    {lastResult && (
                                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-900 rounded-lg border border-amber-600/50">
                                            <span className="text-xl font-bold text-amber-400">{lastResult.total}</span>
                                            {modifier !== 0 && (
                                                <>
                                                    <span className="text-sm text-gray-500">{modifier > 0 ? '+' : ''}{modifier}</span>
                                                    <span className="text-sm text-gray-500">=</span>
                                                    <span className="text-xl font-bold text-green-400">{finalTotal}</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <button
                                        onClick={clear}
                                        disabled={!isReady}
                                        className="px-2 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-200 rounded-lg transition-colors border border-gray-600"
                                        title="Clear dice"
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
