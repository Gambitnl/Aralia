/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceService.ts
 * Singleton service for managing dice rolling with optional 3D visualization.
 * Provides both silent (Math.random) and visual (3D DiceBox) rolling.
 */

import { ENV } from '../config/env';
import { DiceAuditLog, RollAuditRecord } from '../systems/dice/rollContract';

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
    /** Human-readable purpose recorded in the roll audit log (e.g. "persuasion check"). */
    context?: string;
    /** Callback when animation starts */
    onRollStart?: () => void;
    /** Callback when dice finish rolling */
    onRollComplete?: (result: RollResult) => void;
}

/**
 * Builds the caller-facing RollResult from an authoritative audit record.
 * Dropped dice (advantage/disadvantage discards) are excluded from the
 * breakdown the UI shows; they remain inspectable in the audit log.
 */
function toRollResult(record: RollAuditRecord, modifier: number): RollResult {
    return {
        notation: record.spec.notation,
        total: record.outcome.total + modifier,
        rolls: record.outcome.dice
            .filter(d => !d.dropped)
            .map(d => ({ die: `d${d.sides}`, value: d.value, sides: d.sides })),
        modifier,
    };
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
                // DEBT: @ts-ignore used because @3d-dice/dice-box lacks local declaration files
                // and our environment does not have @types for it installed.
                // @ts-ignore
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
                assetPath: `${ENV.BASE_URL}assets/dice-box/`, // Trailing slash required for path concatenation
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
     * Routed through the shared deterministic + audit contract (D-G3): the
     * roll is seeded, recorded, and reproducible after the fact.
     */
    roll(notation: string, context?: string): number {
        return DiceAuditLog.perform({ notation }, { mode: 'silent', context }).outcome.total;
    }

    /**
     * Perform a visual dice roll with 3D animation.
     * Returns a Promise that resolves when dice settle.
     *
     * D-G3 contract: the AUTHORITATIVE result is decided up front by the same
     * deterministic seeded contract the silent path uses; the 3D physics roll
     * is presentation on top. This dice-box build cannot be forced to land on
     * predetermined faces, so the faces the player sees are attached to the
     * audit record (`presented`, with a matchesOutcome flag) instead of being
     * allowed to decide the result.
     */
    async visualRoll(notation: string, options: VisualRollOptions = {}): Promise<RollResult> {
        const { modifier = 0, context, onRollStart, onRollComplete } = options;

        // One roll at a time: pendingResolve is a single slot, so a second
        // concurrent roll would orphan the first caller's promise forever.
        // Checked before recording so an aborted attempt never pollutes the audit.
        if (this.isReady && this.pendingResolve) {
            return Promise.reject(new Error('A dice roll is already in progress.'));
        }

        // The one underlying roll — shared contract, mode 'visual'.
        const record = DiceAuditLog.perform({ notation }, { mode: 'visual', context });
        const result = toRollResult(record, modifier);

        // No renderer available: same roll, just without the animation.
        if (!this.isReady) {
            console.warn('DiceService not ready, resolving visual roll without animation');
            onRollComplete?.(result);
            return result;
        }

        onRollStart?.();

        return new Promise<RollResult>((resolve, reject) => {
            // Watchdog: the physics promise resolves only when the dice settle.
            // A lost WebGL context or a background-throttled tab can freeze the
            // simulation, which previously hung every awaiting caller forever
            // (observed live in the opening-standoff flow). The authoritative
            // roll already exists (and is audited), so resolve with it rather
            // than losing the roll to a rendering stall.
            const watchdog = window.setTimeout(() => {
                if (this.pendingResolve) {
                    this.pendingResolve = null;
                    console.warn('Dice renderer stalled; resolving with the audited contract roll.');
                    onRollComplete?.(result);
                    resolve(result);
                }
            }, 30000);

            this.pendingResolve = (physicsResult) => {
                window.clearTimeout(watchdog);
                // Record what the physics dice displayed; the contract outcome
                // stays authoritative.
                DiceAuditLog.attachPresentation(
                    record.id,
                    physicsResult.rolls.map(r => r.value)
                );
                onRollComplete?.(result);
                resolve(result);
            };

            try {
                this.diceBox.roll(notation);
            } catch (err) {
                window.clearTimeout(watchdog);
                this.pendingResolve = null;
                reject(err instanceof Error ? err : new Error(String(err)));
            }
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
