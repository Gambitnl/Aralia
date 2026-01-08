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
import { WindowFrame } from '../ui/WindowFrame';
import { Lock, Key, Hammer, AlertTriangle, CheckCircle, XCircle, Eye, Shield } from 'lucide-react';
import { Lock as LockType, LockpickResult, BreakResult, TrapDetectionResult, TrapDisarmResult } from '../../systems/puzzles/types';
import { attemptLockpick, attemptBreak, hasTool, hasToolProficiency, detectTrap, disarmTrap } from '../../systems/puzzles/lockSystem';
import { disarmGlyph } from '../../systems/puzzles/arcaneGlyphSystem';
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
    type: 'pick' | 'break' | 'detect' | 'disarm';
    success: boolean;
    message: string;
    details?: string;
    trapTriggered?: boolean;
    trapDisarmed?: boolean;
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
    const [trapDisarmed, setTrapDisarmed] = useState(false);

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

    // Determine if trap is magical (uses Arcana) or mechanical (uses Thieves' Tools)
    const isMagicalTrap = lockState.trap?.type === 'magical';

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

    const handleDisarmTrap = useCallback(async () => {
        if (!lockState.trap || trapDisarmed) return;

        setIsRolling(true);

        // Show visual dice roll first
        await visualRoll('1d20');

        // Route to appropriate disarm function based on trap type
        const disarmResult: TrapDisarmResult = lockState.trap.type === 'magical'
            ? disarmGlyph(character, lockState.trap)
            : disarmTrap(character, lockState.trap, inventory);
        setIsRolling(false);

        if (disarmResult.success) {
            setTrapDisarmed(true);
            setLockState(prev => ({
                ...prev,
                trap: prev.trap ? { ...prev.trap, isDisarmed: true } : undefined
            }));
            setResult({
                type: 'disarm',
                success: true,
                message: 'Trap disarmed!',
                details: `You carefully disarm the ${lockState.trap.name}. The lock is now safe.`,
                trapDisarmed: true,
            });
        } else if (disarmResult.triggeredTrap) {
            setResult({
                type: 'disarm',
                success: false,
                message: 'Failed and triggered the trap!',
                details: disarmResult.trapEffect?.type || 'The trap springs!',
                trapTriggered: true,
            });
        } else {
            setResult({
                type: 'disarm',
                success: false,
                message: 'Disarm failed',
                details: `Missed by ${Math.abs(disarmResult.margin)}. You can try again.`,
            });
        }
    }, [character, lockState, inventory, trapDisarmed, visualRoll]);

    if (!isOpen) return null;

    const canPickLock = hasThievesTools && lockState.isLocked && !lockState.isBroken;
    const canBreak = (lockState.breakDC || lockState.breakHP) && lockState.isLocked;

    return (
        <WindowFrame
            title="Lockpicking"
            onClose={onClose}
            storageKey="lockpicking-window"
        >
            <div className="flex flex-col h-full bg-gray-900 text-gray-200">
                {/* Header / Info Bar */}
                <div className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center shrink-0">
                    <div className="flex items-center space-x-4">
                        <div className={`px-3 py-1 rounded text-sm font-bold ${difficulty.colorClass}`}>
                            {difficulty.label} (DC {lockState.dc})
                        </div>
                        <div className="h-6 w-px bg-gray-700"></div>
                        <div className="flex items-center gap-2">
                            {lockState.isLocked ? <Lock className="w-4 h-4 text-amber-500" /> : <Key className="w-4 h-4 text-green-500" />}
                            <span className={lockState.isLocked ? "text-amber-500" : "text-green-500"}>
                                {lockState.isLocked ? "Locked" : "Open"}
                            </span>
                        </div>
                        {lockState.isBroken && (
                            <span className="text-red-500 font-bold ml-2">BROKEN</span>
                        )}
                        {trapDetected && (
                            <div className="flex items-center gap-1 text-red-400 font-bold animate-pulse">
                                <AlertTriangle className="w-4 h-4" />
                                <span>TRAP!</span>
                            </div>
                        )}
                        {trapDisarmed && (
                            <div className="flex items-center gap-1 text-green-400 font-bold">
                                <CheckCircle className="w-4 h-4" />
                                <span>Disarmed</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-grow flex flex-col items-center justify-center p-8 space-y-6 bg-gray-900">

                    {/* Result Display */}
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-lg border max-w-md w-full text-center ${result.success
                                    ? 'bg-green-900/30 border-green-500/50 text-green-100'
                                    : 'bg-red-900/30 border-red-500/50 text-red-100'
                                }`}
                        >
                            <h3 className="font-bold text-lg mb-1">{result.message}</h3>
                            <p className="text-sm opacity-90">{result.details}</p>
                        </motion.div>
                    )}

                    {!lockState.isLocked && !result?.success && (
                        <div className="text-green-400 text-xl font-bold flex items-center gap-2">
                            <CheckCircle className="w-8 h-8" />
                            The way is open.
                        </div>
                    )}

                    {/* Actions Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                        {/* 1. Detect Traps */}
                        <button
                            onClick={handleDetectTrap}
                            disabled={isRolling || !lockState.isLocked || trapDetected !== null}
                            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${trapDetected !== null
                                    ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-default'
                                    : 'bg-indigo-900/40 border-indigo-700 hover:bg-indigo-900/60 hover:border-indigo-500'
                                }`}
                        >
                            <Eye className="w-6 h-6 mb-2" />
                            <span className="font-bold">Inspect</span>
                            <span className="text-xs mt-1">Check for Traps</span>
                        </button>

                        {/* 2. Disarm Trap (conditional) */}
                        <button
                            onClick={handleDisarmTrap}
                            disabled={isRolling || !trapDetected || trapDisarmed}
                            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${!trapDetected || trapDisarmed
                                    ? 'bg-gray-800 border-gray-700 text-gray-500 opacity-50 cursor-not-allowed'
                                    : 'bg-cyan-900/40 border-cyan-700 hover:bg-cyan-900/60 hover:border-cyan-500'
                                }`}
                        >
                            <Shield className="w-6 h-6 mb-2" />
                            <span className="font-bold">Disarm</span>
                            <span className="text-xs mt-1">Make Safe</span>
                        </button>

                        {/* 3. Pick Lock */}
                        <button
                            onClick={handlePickLock}
                            disabled={!canPickLock || isRolling}
                            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${!canPickLock || isRolling
                                    ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-amber-900/40 border-amber-700 hover:bg-amber-900/60 hover:border-amber-500'
                                }`}
                        >
                            <Key className="w-6 h-6 mb-2" />
                            <span className="font-bold">Pick Lock</span>
                            <span className="text-xs mt-1">Dexterity Check</span>
                        </button>

                        {/* 4. Force Open */}
                        <button
                            onClick={handleBreakLock}
                            disabled={!canBreak || isRolling}
                            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${!canBreak || isRolling
                                    ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-red-900/40 border-red-700 hover:bg-red-900/60 hover:border-red-500'
                                }`}
                        >
                            <Hammer className="w-6 h-6 mb-2" />
                            <span className="font-bold">Break</span>
                            <span className="text-xs mt-1">Strength Check</span>
                        </button>
                    </div>
                </div>
            </div>
        </WindowFrame>
    );
};

export default LockpickingModal;
