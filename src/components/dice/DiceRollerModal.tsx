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

    const { isReady, isRolling, lastResult, error, roll, clear, resize } = useDiceBox({
        containerId: '#dice-roller-canvas',
    });

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
        <AnimatePresence>
            <WindowFrame
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
                    {/* Dice Canvas */}
                    <div className="relative flex-grow min-h-0">
                        <div
                            id="dice-roller-canvas"
                            ref={containerRef}
                            className="w-full h-full bg-gradient-to-b from-gray-800 to-gray-900"
                        />
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

                    {/* Result Display */}
                    <div className="p-4 border-t border-gray-700 bg-gray-800/50 flex-shrink-0">
                        {lastResult ? (
                            <div className="text-center">
                                <p className="text-sm text-gray-400 mb-1">{lastResult.notation}</p>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-4xl font-bold text-amber-400">{lastResult.total}</span>
                                    {modifier !== 0 && (
                                        <>
                                            <span className="text-2xl text-gray-500">
                                                {modifier > 0 ? '+' : ''}{modifier}
                                            </span>
                                            <span className="text-2xl text-gray-500">=</span>
                                            <span className="text-4xl font-bold text-green-400">{finalTotal}</span>
                                        </>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Rolls: {lastResult.rolls.map(r => r.value).join(' + ')}
                                </p>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-gray-500 text-lg">
                                    {isRolling ? 'Rolling...' : 'Select notation or custom and Roll!'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="p-4 border-t border-gray-700 space-y-4 bg-gray-800/80 flex-shrink-0">
                        {/* Quick Roll Buttons */}
                        <div className="flex flex-wrap justify-center gap-2">
                            {PRESET_ROLLS.map(({ label, notation: presetNotation }) => (
                                <button
                                    key={presetNotation}
                                    onClick={() => handleQuickRoll(presetNotation)}
                                    disabled={!isReady || isRolling}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-200 font-semibold rounded-lg transition-colors border border-gray-600"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Custom Notation Input */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    value={notation}
                                    onChange={(e) => setNotation(e.target.value)}
                                    placeholder="e.g., 2d6+3"
                                    className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                                <span className="absolute right-3 top-2 text-xs text-gray-500 uppercase font-bold">Notation</span>
                            </div>
                            <div className="relative w-24">
                                <input
                                    type="number"
                                    value={modifier}
                                    onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                                    placeholder="+/-"
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                                <span className="absolute -top-2 left-2 bg-gray-800 px-1 text-[10px] text-gray-400 uppercase font-bold">Mod</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleRoll}
                                disabled={!isReady || isRolling}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-xl rounded-lg shadow-lg transition-all active:scale-95"
                            >
                                <Dice6 className="w-6 h-6" />
                                {isRolling ? 'Rolling...' : 'Roll Dice'}
                            </button>
                            <button
                                onClick={clear}
                                disabled={!isReady}
                                className="px-6 py-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-200 rounded-lg transition-colors border border-gray-600"
                                title="Clear dice"
                            >
                                <RefreshCcw className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </WindowFrame>
        </AnimatePresence>
    );
};

export default DiceRollerModal;
