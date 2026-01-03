/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceRollerModal.tsx
 * 3D dice roller modal using @3d-dice/dice-box for visual dice rolling.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice6, X, RefreshCcw } from 'lucide-react';
import { useDiceBox } from '../../hooks/useDiceBox';

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

    const { isReady, isRolling, lastResult, error, roll, clear } = useDiceBox({
        containerId: '#dice-roller-canvas',
    });

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
            <div
                className="fixed inset-0 bg-black/80 flex items-center justify-center z-[80] p-4"
                onKeyDown={handleKeyDown}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dice-roller-title"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800">
                        <div className="flex items-center gap-3">
                            <Dice6 className="w-6 h-6 text-amber-400" />
                            <h2 id="dice-roller-title" className="text-xl font-bold text-amber-400 font-cinzel">
                                Dice Roller
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-200 text-3xl leading-none p-1"
                            aria-label="Close dice roller"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Dice Canvas */}
                    <div className="relative">
                        <div
                            id="dice-roller-canvas"
                            ref={containerRef}
                            className="w-full h-64 bg-gradient-to-b from-gray-800 to-gray-900"
                            style={{ minHeight: '256px' }}
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
                    <div className="p-4 border-t border-gray-700 bg-gray-800/50">
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
                                <p className="text-gray-500">
                                    {isRolling ? 'Rolling...' : 'Click a die or Roll to start'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="p-4 border-t border-gray-700 space-y-4">
                        {/* Quick Roll Buttons */}
                        <div className="flex flex-wrap justify-center gap-2">
                            {PRESET_ROLLS.map(({ label, notation: presetNotation }) => (
                                <button
                                    key={presetNotation}
                                    onClick={() => handleQuickRoll(presetNotation)}
                                    disabled={!isReady || isRolling}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-200 font-semibold rounded-lg transition-colors"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Custom Notation Input */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={notation}
                                onChange={(e) => setNotation(e.target.value)}
                                placeholder="e.g., 2d6+3"
                                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <input
                                type="number"
                                value={modifier}
                                onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
                                placeholder="+/-"
                                className="w-20 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                                title="Modifier"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleRoll}
                                disabled={!isReady || isRolling}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
                            >
                                <Dice6 className="w-5 h-5" />
                                {isRolling ? 'Rolling...' : 'Roll!'}
                            </button>
                            <button
                                onClick={clear}
                                disabled={!isReady}
                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-200 rounded-lg transition-colors"
                                title="Clear dice"
                            >
                                <RefreshCcw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default DiceRollerModal;
