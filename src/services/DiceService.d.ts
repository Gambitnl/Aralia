/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file DiceService.ts
 * Singleton service for managing dice rolling with optional 3D visualization.
 * Provides both silent (Math.random) and visual (3D DiceBox) rolling.
 */
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
 * Singleton service managing dice rolling functionality.
 * Provides both silent and visual rolling capabilities.
 */
declare class DiceServiceClass {
    private diceBox;
    private containerId;
    private isInitialized;
    private initPromise;
    private pendingResolve;
    /**
     * Initialize the 3D dice engine.
     * Must be called before using visualRoll().
     */
    init(containerId: string): Promise<void>;
    private _doInit;
    /**
     * Check if the 3D dice engine is ready.
     */
    get isReady(): boolean;
    /**
     * Perform a silent dice roll (no animation).
     * Routed through the shared deterministic + audit contract (D-G3): the
     * roll is seeded, recorded, and reproducible after the fact.
     */
    roll(notation: string, context?: string): number;
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
    visualRoll(notation: string, options?: VisualRollOptions): Promise<RollResult>;
    /**
     * Clear all dice from the canvas.
     */
    clear(): void;
    /**
     * Destroy the dice engine and clean up.
     */
    destroy(): void;
}
export declare const DiceService: DiceServiceClass;
export default DiceService;
