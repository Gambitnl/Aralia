/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceService.ts
 * Singleton service for managing dice rolling with optional 3D visualization.
 * Provides both silent (Math.random) and visual (3D DiceBox) rolling.
 */

import { rollDice as silentRollDice } from '../utils/combat/combatUtils';

// Dynamic import to avoid SSR issues
let DiceBox: any = null;

/**
 * Result of a dice roll with breakdown information.
 */
export interface RollResult {
    notation: string;
    total: number;
    rolls: Array<{
        die: string;
        value: number;
        sides: number;
    }>;
    modifier: number;
}

/**
 * Options for visual dice rolls.
 */
export interface VisualRollOptions {
    /** Additional modifier to add to the result */
    modifier?: number;
    /** Callback when animation starts */
    onRollStart?: () => void;
    /** Callback when dice finish rolling */
    onRollComplete?: (result: RollResult) => void;
}

/**
 * Singleton service managing dice rolling functionality.
 * Provides both silent and visual rolling capabilities.
 */
class DiceServiceClass {
    private diceBox: any = null;
    private containerId: string | null = null;
    private isInitialized = false;
    private initPromise: Promise<void> | null = null;
    private pendingResolve: ((result: RollResult) => void) | null = null;

    /**
     * Initialize the 3D dice engine.
     * Must be called before using visualRoll().
     */
    async init(containerId: string): Promise<void> {
        if (this.isInitialized && this.containerId === containerId) {
            return;
        }

        // Prevent multiple simultaneous initializations
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._doInit(containerId);
        return this.initPromise;
    }

    private async _doInit(containerId: string): Promise<void> {
        try {
            // Clean up previous instance
            if (this.diceBox) {
                this.diceBox.clear();
                this.diceBox = null;
            }

            // Dynamic import
            if (!DiceBox) {
                const module = await import('@3d-dice/dice-box');
                DiceBox = module.default;
            }

            const container = document.querySelector(containerId);
            if (!container) {
                throw new Error(`Dice container ${containerId} not found`);
            }

            // v1.1.0 API: single config object with container property
            this.diceBox = new DiceBox({
                container: containerId,
                assetPath: `${import.meta.env.BASE_URL}assets/dice-box/`, // Trailing slash required for path concatenation
                theme: 'default', // Use built-in theme (custom themes need specific setup)
                scale: 13.5,
                gravity: 3,
                throwForce: 11,
                offscreen: true,
                onRollComplete: (results: any) => {
                    if (results.length > 0 && this.pendingResolve) {
                        const firstResult = results[0];
                        const rollResult: RollResult = {
                            notation: firstResult.notation || '',
                            total: firstResult.value || 0,
                            rolls: firstResult.rolls?.map((r: any) => ({
                                die: r.die || 'd?',
                                value: r.value || 0,
                                sides: r.sides || 0,
                            })) || [],
                            modifier: 0,
                        };
                        this.pendingResolve(rollResult);
                        this.pendingResolve = null;
                    }
                },
            });

            await this.diceBox.init();
            this.containerId = containerId;
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize DiceService:', error);
            this.isInitialized = false;
            throw error;
        } finally {
            this.initPromise = null;
        }
    }

    /**
     * Check if the 3D dice engine is ready.
     */
    get isReady(): boolean {
        return this.isInitialized && this.diceBox !== null;
    }

    /**
     * Perform a silent dice roll (no animation).
     * Uses the existing Math.random-based rolling.
     */
    roll(notation: string): number {
        return silentRollDice(notation);
    }

    /**
     * Perform a visual dice roll with 3D animation.
     * Returns a Promise that resolves when dice settle.
     */
    async visualRoll(notation: string, options: VisualRollOptions = {}): Promise<RollResult> {
        const { modifier = 0, onRollStart, onRollComplete } = options;

        // Fallback to silent roll if not initialized
        if (!this.isReady) {
            console.warn('DiceService not ready, falling back to silent roll');
            const total = this.roll(notation);
            const result: RollResult = {
                notation,
                total: total + modifier,
                rolls: [],
                modifier,
            };
            onRollComplete?.(result);
            return result;
        }

        onRollStart?.();

        return new Promise<RollResult>((resolve) => {
            this.pendingResolve = (baseResult) => {
                const result: RollResult = {
                    ...baseResult,
                    total: baseResult.total + modifier,
                    modifier,
                };
                onRollComplete?.(result);
                resolve(result);
            };

            this.diceBox.roll(notation);
        });
    }

    /**
     * Clear all dice from the canvas.
     */
    clear(): void {
        if (this.diceBox) {
            this.diceBox.clear();
        }
    }

    /**
     * Destroy the dice engine and clean up.
     */
    destroy(): void {
        this.clear();
        this.diceBox = null;
        this.isInitialized = false;
        this.containerId = null;
    }
}

// Export singleton instance
export const DiceService = new DiceServiceClass();
export default DiceService;
