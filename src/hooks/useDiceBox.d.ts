/**
 * Represents the result of a dice roll, extracted from DiceBox's raw output.
 */
interface DiceResult {
    /** The dice notation that was rolled (e.g., "2d6+3") */
    notation: string;
    /** The total sum of all dice plus any modifiers */
    total: number;
    /** Individual die results */
    rolls: Array<{
        die: string;
        value: number;
        sides: number;
    }>;
}
/**
 * Configuration options for the useDiceBox hook.
 */
interface UseDiceBoxOptions {
    /** CSS selector for the container element where the 3D canvas will be created */
    containerId: string;
    /** Path to DiceBox assets (dice models, physics engine, textures) */
    assetPath?: string;
    /** Visual theme name (must exist in assets/dice-box/themes/) */
    theme?: string;
    /** Scale of the 3D dice (default: 13.5) */
    scale?: number;
    /** Physics gravity strength (default: 3) */
    gravity?: number;
    /** Dice throw force (default: 11) */
    throwForce?: number;
}
/**
 * Return type for the useDiceBox hook.
 */
interface UseDiceBoxReturn {
    /** True when DiceBox is fully initialized and ready to roll */
    isReady: boolean;
    /** True while dice are currently animating */
    isRolling: boolean;
    /** The most recent roll result, or null if no roll yet */
    lastResult: DiceResult | null;
    /** Error message if initialization failed, null otherwise */
    error: string | null;
    /** Function to roll dice with a given notation (e.g., "1d20", "2d6+3") */
    roll: (notation: string | string[]) => Promise<DiceResult | null>;
    /** Function to clear all dice from the canvas */
    clear: () => void;
    /** Function to resize the 3D world to match container dimensions */
    resize: () => void;
    /** Function to update dice scale at runtime (1-20 typical range) */
    updateScale: (newScale: number) => void;
}
/**
 * React hook to manage the @3d-dice/dice-box library lifecycle.
 *
 * This hook handles:
 * - Lazy loading of the DiceBox library (to avoid SSR issues)
 * - 3D canvas initialization and cleanup
 * - Dice rolling and result extraction
 * - Proper cleanup to prevent duplicate canvas issues
 *
 * @example
 * ```tsx
 * const { isReady, roll, lastResult } = useDiceBox({
 *     containerId: '#dice-container'
 * });
 *
 * const handleRoll = async () => {
 *     await roll('1d20');
 *     // Result will be in lastResult after animation completes
 * };
 * ```
 */
export declare function useDiceBox(options: UseDiceBoxOptions): UseDiceBoxReturn;
export default useDiceBox;
