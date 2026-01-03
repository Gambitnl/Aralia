/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceContext.tsx
 * React context providing dice rolling capabilities throughout the app.
 * Enables both silent (instant) and visual (3D animated) dice rolls.
 */
import React, { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { DiceService, RollResult, VisualRollOptions } from '../services/DiceService';

/**
 * Context value providing dice rolling functionality.
 */
interface DiceContextValue {
    /** Perform a silent dice roll (no animation, instant result) */
    roll: (notation: string) => number;

    /** Perform a visual dice roll (3D animation, returns Promise) */
    visualRoll: (notation: string, options?: VisualRollOptions) => Promise<RollResult>;

    /** Clear dice from the canvas */
    clear: () => void;

    /** Whether the 3D dice engine is ready */
    isReady: boolean;

    /** Whether a roll animation is currently in progress */
    isRolling: boolean;

    /** Show the dice overlay */
    showOverlay: () => void;

    /** Hide the dice overlay */
    hideOverlay: () => void;

    /** Whether the overlay is visible */
    isOverlayVisible: boolean;
}

const DiceContext = createContext<DiceContextValue | null>(null);

/**
 * Hook to access dice rolling functionality.
 * Must be used within a DiceProvider.
 */
export function useDice(): DiceContextValue {
    const context = useContext(DiceContext);
    if (!context) {
        throw new Error('useDice must be used within a DiceProvider');
    }
    return context;
}

interface DiceProviderProps {
    children: React.ReactNode;
}

/**
 * Provider component that initializes the DiceService and provides
 * dice rolling functionality to the component tree.
 */
export const DiceProvider: React.FC<DiceProviderProps> = ({ children }) => {
    const [isReady, setIsReady] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [isOverlayVisible, setIsOverlayVisible] = useState(false);
    const initAttempted = useRef(false);

    // Initialize dice service when overlay becomes visible
    useEffect(() => {
        if (isOverlayVisible && !initAttempted.current) {
            initAttempted.current = true;
            DiceService.init('#dice-overlay-canvas')
                .then(() => setIsReady(true))
                .catch((err) => {
                    console.error('Failed to init dice:', err);
                    setIsReady(false);
                });
        }
    }, [isOverlayVisible]);

    const roll = useCallback((notation: string): number => {
        return DiceService.roll(notation);
    }, []);

    const visualRoll = useCallback(async (
        notation: string,
        options: VisualRollOptions = {}
    ): Promise<RollResult> => {
        // Show overlay and ensure initialized
        setIsOverlayVisible(true);

        // Wait a tick for the container to render
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize if needed
        if (!DiceService.isReady) {
            try {
                await DiceService.init('#dice-overlay-canvas');
                setIsReady(true);
            } catch (err) {
                console.error('Failed to init dice for visual roll:', err);
                // Fallback to silent roll
                const total = DiceService.roll(notation);
                return {
                    notation,
                    total: total + (options.modifier || 0),
                    rolls: [],
                    modifier: options.modifier || 0,
                };
            }
        }

        setIsRolling(true);

        try {
            const result = await DiceService.visualRoll(notation, {
                ...options,
                onRollComplete: (res) => {
                    setIsRolling(false);
                    options.onRollComplete?.(res);
                },
            });
            return result;
        } catch (err) {
            setIsRolling(false);
            throw err;
        }
    }, []);

    const clear = useCallback(() => {
        DiceService.clear();
    }, []);

    const showOverlay = useCallback(() => {
        setIsOverlayVisible(true);
    }, []);

    const hideOverlay = useCallback(() => {
        setIsOverlayVisible(false);
        DiceService.clear();
    }, []);

    const value: DiceContextValue = {
        roll,
        visualRoll,
        clear,
        isReady,
        isRolling,
        showOverlay,
        hideOverlay,
        isOverlayVisible,
    };

    return (
        <DiceContext.Provider value={value}>
            {children}
        </DiceContext.Provider>
    );
};

export default DiceProvider;
