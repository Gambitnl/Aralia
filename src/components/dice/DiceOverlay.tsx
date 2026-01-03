/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceOverlay.tsx
 * Global overlay component that displays 3D dice rolling animation.
 * Renders a centered dice tray that appears when visual rolls are triggered.
 */
import React, { useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Dice6 } from 'lucide-react';
import { useDice } from '../../contexts/DiceContext';

/**
 * Global dice overlay component.
 * Should be rendered once at the app root level.
 */
export const DiceOverlay: React.FC = () => {
    const { isOverlayVisible, hideOverlay, isRolling, isReady } = useDice();

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape' && isOverlayVisible && !isRolling) {
            hideOverlay();
        }
    }, [isOverlayVisible, isRolling, hideOverlay]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <AnimatePresence>
            {isOverlayVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[90] pointer-events-none"
                    aria-hidden={!isOverlayVisible}
                >
                    {/* Semi-transparent backdrop - only clickable when not rolling */}
                    <div
                        className={`absolute inset-0 bg-black/60 ${!isRolling ? 'pointer-events-auto cursor-pointer' : ''}`}
                        onClick={() => !isRolling && hideOverlay()}
                    />

                    {/* Dice container */}
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                        <div className="relative w-full max-w-lg mx-4 pointer-events-auto">
                            {/* Header bar */}
                            <div className="flex items-center justify-between bg-gray-900/95 rounded-t-xl px-4 py-2 border-b border-gray-700">
                                <div className="flex items-center gap-2">
                                    <Dice6 className="w-5 h-5 text-amber-400" />
                                    <span className="text-amber-400 font-semibold">
                                        {isRolling ? 'Rolling...' : isReady ? 'Dice Ready' : 'Loading...'}
                                    </span>
                                </div>
                                <button
                                    onClick={hideOverlay}
                                    disabled={isRolling}
                                    className="text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed p-1"
                                    aria-label="Close dice overlay"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Dice canvas container */}
                            <div
                                id="dice-overlay-canvas"
                                className="w-full h-64 bg-gradient-to-b from-gray-800 to-gray-900 rounded-b-xl overflow-hidden"
                                style={{ minHeight: '256px' }}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default DiceOverlay;
