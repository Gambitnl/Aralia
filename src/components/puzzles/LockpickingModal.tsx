/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file LockpickingModal.tsx
 * Accessible modal for lockpicking gameplay. Allows players to attempt
 * picking locks using Thieves' Tools or forcing them open with Strength.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Key, Hammer, AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Lock as LockType, LockpickResult, BreakResult, TrapDetectionResult } from '../../systems/puzzles/types';
import { attemptLockpick, attemptBreak, hasTool, hasToolProficiency, detectTrap } from '../../systems/puzzles/lockSystem';
import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useDice } from '../../contexts/DiceContext';

interface LockpickingModalProps {
    isOpen: boolean;
    onClose: () => void;
    lock: LockType;
    character: PlayerCharacter;
    inventory: Item[];
    onLockpickResult?: (result: LockpickResult) => void;
    onBreakResult?: (result: BreakResult) => void;
}

type ActionResult = {
    type: 'pick' | 'break' | 'detect';
    success: boolean;
    message: string;
    details?: string;
    trapTriggered?: boolean;
};

/**
 * Get difficulty label and styling based on lock DC
 */
function getDifficultyInfo(dc: number): { label: string; colorClass: string } {
    if (dc <= 10) return { label: 'Easy', colorClass: 'text-green-400 bg-green-900/50' };
    if (dc <= 15) return { label: 'Medium', colorClass: 'text-yellow-400 bg-yellow-900/50' };
    if (dc <= 20) return { label: 'Hard', colorClass: 'text-orange-400 bg-orange-900/50' };
    return { label: 'Deadly', colorClass: 'text-red-400 bg-red-900/50' };
}

export const LockpickingModal: React.FC<LockpickingModalProps> = ({
    isOpen,
    onClose,
    lock,
    character,
    inventory,
    onLockpickResult,
    onBreakResult,
}) => {
    const firstFocusableRef = useRef<HTMLButtonElement>(null);
    const [result, setResult] = useState<ActionResult | null>(null);
    const [trapDetected, setTrapDetected] = useState<boolean | null>(null);
    const [lockState, setLockState] = useState<LockType>(lock);
    const [isRolling, setIsRolling] = useState(false);

    // Dice context for visual rolling
    const { visualRoll } = useDice();

    // Reset state when modal opens with a new lock
    useEffect(() => {
        if (isOpen) {
            setResult(null);
            setTrapDetected(null);
            setLockState(lock);
        }
    }, [isOpen, lock]);

    const handleCloseModal = useCallback(() => {
        setResult(null);
        onClose();
    }, [onClose]);

    const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen, handleCloseModal);

    // Handle Escape key
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleCloseModal();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            firstFocusableRef.current?.focus();
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, handleCloseModal]);

    const hasThievesTools = hasTool(character, 'thieves-tools', inventory);
    const isProficient = hasToolProficiency(character, 'thieves-tools');
    const difficulty = getDifficultyInfo(lockState.dc);

    const handleDetectTrap = useCallback(() => {
        if (!lockState.isTrapped || !lockState.trap) {
            setResult({
                type: 'detect',
                success: true,
                message: 'No trap detected',
                details: 'The lock appears to be safe.',
            });
            setTrapDetected(false);
            return;
        }

        const detectionResult: TrapDetectionResult = detectTrap(character, lockState.trap);
        setTrapDetected(detectionResult.trapDetected);
        setResult({
            type: 'detect',
            success: detectionResult.success,
            message: detectionResult.trapDetected ? 'Trap detected!' : 'No trap detected',
            details: detectionResult.trapDetected
                ? `You notice a ${lockState.trap.name}. Be careful!`
                : 'You didn\'t find anything, but that doesn\'t mean it\'s safe...',
        });
    }, [character, lockState]);

    const handlePickLock = useCallback(async () => {
        setIsRolling(true);

        // Show visual dice roll first
        await visualRoll('1d20');

        // Then perform the actual check
        const pickResult: LockpickResult = attemptLockpick(character, lockState, inventory);
        setIsRolling(false);

        if (pickResult.success) {
            setLockState(prev => ({ ...prev, isLocked: false }));
            setResult({
                type: 'pick',
                success: true,
                message: 'Lock picked!',
                details: `Success by ${pickResult.margin}! The lock clicks open.`,
            });
        } else if (pickResult.triggeredTrap) {
            setResult({
                type: 'pick',
                success: false,
                message: 'Failed and triggered a trap!',
                details: pickResult.trapEffect?.type || 'Something terrible happens...',
                trapTriggered: true,
            });
        } else {
            setResult({
                type: 'pick',
                success: false,
                message: 'Lock pick failed',
                details: `Missed by ${Math.abs(pickResult.margin)}. The lock holds firm.`,
            });
        }

        onLockpickResult?.(pickResult);
    }, [character, lockState, inventory, onLockpickResult, visualRoll]);

    const handleBreakLock = useCallback(async () => {
        setIsRolling(true);

        // Show visual dice roll first
        await visualRoll('1d20');

        const breakResult: BreakResult = attemptBreak(character, lockState);
        setIsRolling(false);

        if (breakResult.success) {
            setLockState(prev => ({ ...prev, isLocked: false, isBroken: true }));
            setResult({
                type: 'break',
                success: true,
                message: 'Lock broken!',
                details: `With a mighty effort, you smash the lock open!`,
            });
        } else {
            setResult({
                type: 'break',
                success: false,
                message: 'Failed to break',
                details: `The lock holds. Missed by ${Math.abs(breakResult.margin)}.`,
            });
        }

        onBreakResult?.(breakResult);
    }, [character, lockState, onBreakResult, visualRoll]);

    if (!isOpen) return null;

    const canPickLock = hasThievesTools && lockState.isLocked && !lockState.isBroken;
    const canBreak = (lockState.breakDC || lockState.breakHP) && lockState.isLocked;

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 bg-black/75 flex items-center justify-center z-[70] p-4"
                aria-modal="true"
                role="dialog"
                aria-labelledby="lockpicking-modal-title"
                aria-describedby="lockpicking-modal-desc"
            >
                <motion.div
                    ref={focusTrapRef}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md"
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-900/50 rounded-lg">
                                {lockState.isLocked ? (
                                    <Lock className="w-6 h-6 text-amber-400" />
                                ) : lockState.isBroken ? (
                                    <Hammer className="w-6 h-6 text-gray-400" />
                                ) : (
                                    <Key className="w-6 h-6 text-green-400" />
                                )}
                            </div>
                            <div>
                                <h2 id="lockpicking-modal-title" className="text-xl font-bold text-amber-400 font-cinzel">
                                    {lockState.isLocked ? 'Locked' : lockState.isBroken ? 'Broken' : 'Unlocked'}
                                </h2>
                                <p id="lockpicking-modal-desc" className="text-sm text-gray-400">
                                    {lockState.isLocked ? 'Attempt to open this lock' : 'The lock is open'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleCloseModal}
                            className="text-gray-400 hover:text-gray-200 text-3xl leading-none p-1"
                            aria-label="Close lockpicking modal"
                        >
                            ×
                        </button>
                    </div>

                    {/* Lock Info */}
                    <div className="p-4 space-y-4">
                        {/* Difficulty & Status */}
                        <div className="flex flex-wrap gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${difficulty.colorClass}`}>
                                DC {lockState.dc} ({difficulty.label})
                            </span>
                            {lockState.breakDC && (
                                <span className="px-3 py-1 rounded-full text-sm font-semibold text-blue-400 bg-blue-900/50">
                                    Break DC {lockState.breakDC}
                                </span>
                            )}
                            {lockState.isTrapped && trapDetected === true && (
                                <span className="px-3 py-1 rounded-full text-sm font-semibold text-red-400 bg-red-900/50 flex items-center gap-1">
                                    <AlertTriangle className="w-4 h-4" /> Trapped
                                </span>
                            )}
                        </div>

                        {/* Tool & Proficiency Status */}
                        <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">Thieves' Tools:</span>
                                <span className={hasThievesTools ? 'text-green-400' : 'text-red-400'}>
                                    {hasThievesTools ? '✓ In inventory' : '✗ Not found'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">Proficiency:</span>
                                <span className={isProficient ? 'text-green-400' : 'text-gray-500'}>
                                    {isProficient ? '✓ Proficient' : '— Not proficient'}
                                </span>
                            </div>
                        </div>

                        {/* Result Display */}
                        {result && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-3 rounded-lg flex items-start gap-3 ${result.success
                                    ? 'bg-green-900/30 border border-green-700'
                                    : result.trapTriggered
                                        ? 'bg-red-900/30 border border-red-700'
                                        : 'bg-yellow-900/30 border border-yellow-700'
                                    }`}
                                role="alert"
                                aria-live="polite"
                            >
                                {result.success ? (
                                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                ) : result.trapTriggered ? (
                                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                )}
                                <div>
                                    <p className={`font-semibold ${result.success ? 'text-green-300' : result.trapTriggered ? 'text-red-300' : 'text-yellow-300'
                                        }`}>
                                        {result.message}
                                    </p>
                                    {result.details && (
                                        <p className="text-sm text-gray-400 mt-1">{result.details}</p>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="p-4 border-t border-gray-700 space-y-3">
                        {lockState.isLocked && (
                            <>
                                {/* Detect Trap Button */}
                                <button
                                    ref={firstFocusableRef}
                                    onClick={handleDetectTrap}
                                    disabled={trapDetected !== null}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                                    aria-describedby="detect-trap-hint"
                                >
                                    <Eye className="w-5 h-5" />
                                    {trapDetected === null ? 'Search for Traps' : trapDetected ? 'Trap Found!' : 'Searched'}
                                </button>
                                <p id="detect-trap-hint" className="sr-only">
                                    Uses Wisdom or Intelligence to detect hidden traps on the lock
                                </p>

                                {/* Pick Lock Button */}
                                <button
                                    onClick={handlePickLock}
                                    disabled={!canPickLock || isRolling}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                                    aria-describedby="pick-lock-hint"
                                >
                                    <Key className="w-5 h-5" />
                                    {isRolling ? 'Rolling...' : 'Pick Lock'}
                                </button>
                                <p id="pick-lock-hint" className="sr-only">
                                    {canPickLock
                                        ? 'Attempt to pick the lock using Dexterity and Thieves\' Tools'
                                        : 'Requires Thieves\' Tools in your inventory'}
                                </p>

                                {/* Break Lock Button */}
                                {canBreak && (
                                    <>
                                        <button
                                            onClick={handleBreakLock}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
                                            aria-describedby="break-lock-hint"
                                        >
                                            <Hammer className="w-5 h-5" />
                                            Force Open (Strength)
                                        </button>
                                        <p id="break-lock-hint" className="sr-only">
                                            Use brute force to break the lock. Requires a Strength check.
                                        </p>
                                    </>
                                )}
                            </>
                        )}

                        {/* Close / Done Button */}
                        <button
                            onClick={handleCloseModal}
                            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold rounded-lg transition-colors"
                        >
                            {lockState.isLocked ? 'Leave It' : 'Done'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default LockpickingModal;
