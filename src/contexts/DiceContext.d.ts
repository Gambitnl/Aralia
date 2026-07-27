/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceContext.tsx
 * React context providing dice rolling capabilities throughout the app.
 * Enables both silent (instant) and visual (3D animated) dice rolls.
 */
import React from 'react';
import { RollResult, VisualRollOptions } from '../services/DiceService';
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
/**
 * Hook to access dice rolling functionality.
 * Must be used within a DiceProvider.
 */
export declare function useDice(): DiceContextValue;
interface DiceProviderProps {
    children: React.ReactNode;
}
/**
 * Provider component that initializes the DiceService and provides
 * dice rolling functionality to the component tree.
 */
export declare const DiceProvider: React.FC<DiceProviderProps>;
export default DiceProvider;
