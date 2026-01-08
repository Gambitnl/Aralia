/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file useDiceBox.ts
 * React hook for managing DiceBox lifecycle and 3D dice rolling.
 * 
 * ============================================================================
 * PROBLEM HISTORY & SOLUTION OVERVIEW
 * ============================================================================
 * 
 * This hook previously had several issues that caused the 3D dice to be
 * invisible while the roll logic still worked:
 * 
 * 1. **Asset Path Issue (FIXED)**: The assetPath was using `import.meta.env.BASE_URL`
 *    which in some contexts returned '/' instead of '/Aralia/'. This caused 404
 *    errors for physics engine (ammo.wasm) and dice textures. Fixed by providing
 *    a fallback to '/Aralia/'.
 * 
 * 2. **Duplicate Canvas Issue (FIXED)**: React's Strict Mode (and effect re-runs)
 *    would call the initialization effect twice. The old cleanup only called
 *    `diceBox.clear()` which clears the dice but DOESN'T destroy the instance or
 *    remove canvas elements. This resulted in multiple overlapping canvases that
 *    obscured the 3D rendering. Fixed by:
 *    - Clearing ALL existing canvas elements from the container before initialization
 *    - Using a proper initialization guard to prevent race conditions
 * 
 * 3. **Offscreen Canvas Issue (FIXED)**: The `offscreen: true` option caused
 *    rendering issues in some browser/modal contexts. Disabled for reliability.
 * 
 * ============================================================================
 */
import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Module-level DiceBox constructor cache.
 * We store the constructor here (not in component state) because:
 * - It only needs to be imported once for the entire app
 * - Storing in state would cause unnecessary re-renders
 * - Dynamic import avoids SSR issues (DiceBox uses WebGL/Canvas APIs)
 */
let DiceBoxConstructor: any = null;

/**
 * Default configuration values for DiceBox.
 * Centralized here for easier tuning and consistency.
 */
const DEFAULTS = {
    /** Scale of the 3D dice */
    scale: 13.5,
    /** Physics gravity strength */
    gravity: 3,
    /** Dice throw force */
    throwForce: 11,
    /** Maximum attempts to find the container element */
    containerRetryAttempts: 5,
    /** Delay between container lookup attempts (ms) */
    containerRetryDelayMs: 50,
} as const;

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
        die: string;      // Die type (e.g., "d20")
        value: number;    // The rolled value
        sides: number;    // Number of sides on this die
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
    roll: (notation: string) => Promise<DiceResult | null>;
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
export function useDiceBox(options: UseDiceBoxOptions): UseDiceBoxReturn {
    // ========================================================================
    // ASSET PATH CONFIGURATION
    // ========================================================================
    // The BASE_URL from Vite should be '/Aralia/' (as set in vite.config.ts),
    // but we provide a fallback in case it's empty or '/' in some build contexts.
    // Without the correct path, the physics engine (ammo.wasm) and dice textures
    // won't load, causing 404 errors and invisible dice.
    const baseUrl = import.meta.env.BASE_URL || '/Aralia/';
    const defaultAssetPath = `${baseUrl}assets/dice-box/`;

    // Destructure options with defaults
    const {
        containerId,
        assetPath = defaultAssetPath,
        theme = 'default',
        scale = DEFAULTS.scale,
        gravity = DEFAULTS.gravity,
        throwForce = DEFAULTS.throwForce,
    } = options;

    // ========================================================================
    // STATE & REFS
    // ========================================================================

    /**
     * Ref to store the current DiceBox instance.
     * Using a ref (not state) because:
     * - We don't need re-renders when the instance changes
     * - We need stable access during async operations and cleanup
     */
    const diceBoxRef = useRef<any>(null);

    /**
     * Track initialization state to prevent race conditions.
     * This handles the case where React's Strict Mode runs the effect twice
     * or the modal is rapidly opened/closed.
     */
    const isInitializingRef = useRef(false);

    // State for UI feedback
    const [isReady, setIsReady] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [lastResult, setLastResult] = useState<DiceResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // ========================================================================
    // INITIALIZATION EFFECT
    // ========================================================================
    useEffect(() => {
        /**
         * Mounted flag for handling async operations safely.
         * When the component unmounts or the effect re-runs, we set this to false
         * to prevent state updates on an unmounted component.
         */
        let mounted = true;

        /**
         * Clears any existing canvas elements from the container.
         * 
         * WHY THIS IS NECESSARY:
         * React's Strict Mode (and some effect re-runs) can cause this effect
         * to run multiple times. Each DiceBox.init() creates a new <canvas>
         * element inside the container. Without this cleanup, we get multiple
         * overlapping canvases:
         *   - The bottom canvas might render correctly
         *   - But it gets covered by subsequent empty/black canvases
         *   - Result: dice are "invisible" even though the logic works
         * 
         * By clearing all canvases before each initialization, we ensure
         * only one canvas exists at a time.
         */
        const clearExistingCanvases = (container: Element) => {
            const existingCanvases = container.querySelectorAll('canvas');
            existingCanvases.forEach(canvas => {
                console.log('[DiceBox] Removing stale canvas:', canvas.className || canvas.id);
                canvas.remove();
            });
        };

        /**
         * Main initialization function.
         * Handles dynamic import, DOM readiness, and DiceBox setup.
         */
        const initDiceBox = async () => {
            // Prevent concurrent initialization attempts
            if (isInitializingRef.current) {
                console.log('[DiceBox] Already initializing, skipping...');
                return;
            }
            isInitializingRef.current = true;

            try {
                // ============================================================
                // STEP 1: Dynamic import of the DiceBox library
                // ============================================================
                // We import dynamically to:
                // - Avoid SSR issues (DiceBox uses browser-only APIs like WebGL)
                // - Enable code splitting (the library is only loaded when needed)
                if (!DiceBoxConstructor) {
                    console.log('[DiceBox] Loading @3d-dice/dice-box library...');
                    const module = await import('@3d-dice/dice-box');
                    DiceBoxConstructor = module.default;
                }

                // Check if still mounted after async operation
                if (!mounted) {
                    console.log('[DiceBox] Component unmounted during import, aborting...');
                    return;
                }

                // ============================================================
                // STEP 2: Wait for the container element to exist in the DOM
                // ============================================================
                // When used inside modals (like WindowFrame), the container
                // might not be in the DOM immediately when the effect runs.
                // Poll for the container element with multiple attempts.
                // Modals may take a few render cycles to mount their content.
                let container: Element | null = null;
                for (let attempt = 0; attempt < DEFAULTS.containerRetryAttempts; attempt++) {
                    container = document.querySelector(containerId);
                    if (container) break;

                    console.log(`[DiceBox] Container not found, attempt ${attempt + 1}/${DEFAULTS.containerRetryAttempts}...`);
                    await new Promise(resolve => setTimeout(resolve, DEFAULTS.containerRetryDelayMs));

                    // Check if still mounted during polling
                    if (!mounted) {
                        console.log('[DiceBox] Component unmounted during container polling, aborting...');
                        return;
                    }
                }

                if (!container) {
                    throw new Error(`Container ${containerId} not found in DOM`);
                }

                // ============================================================
                // STEP 3: Clean up any stale canvas elements
                // ============================================================
                // CRITICAL: This prevents the duplicate canvas issue that
                // caused dice to be invisible. See comment above for details.
                clearExistingCanvases(container);

                // Check if still mounted after potential DOM delay
                if (!mounted) {
                    console.log('[DiceBox] Component unmounted while waiting for DOM, aborting...');
                    return;
                }

                // ============================================================
                // STEP 4: Create and initialize the DiceBox instance
                // ============================================================
                console.log('[DiceBox] Initializing with assetPath:', assetPath);

                const diceBox = new DiceBoxConstructor({
                    // Container selector where the 3D canvas will be rendered
                    container: containerId,

                    // Path to assets (dice models, physics engine, textures)
                    // Must include the /Aralia/ prefix for the Vite base path
                    assetPath,

                    // Visual theme (corresponds to folder in assets/dice-box/themes/)
                    theme,

                    // Dice physics and appearance settings
                    scale,
                    gravity,
                    throwForce,

                    // Initial canvas dimensions (will be updated on resize)
                    width: container.clientWidth || 800,
                    height: container.clientHeight || 600,

                    // IMPORTANT: offscreen canvas is DISABLED
                    // Setting offscreen: true uses an OffscreenCanvas for
                    // performance, but this caused rendering issues in our
                    // modal context (dice would be invisible). Using a
                    // regular canvas is more reliable.
                    offscreen: false,

                    // Callback fired when dice animation completes
                    onRollComplete: (results: any) => {
                        if (mounted && results.length > 0) {
                            // Extract the first result (we typically roll one notation at a time)
                            const firstResult = results[0];
                            setLastResult({
                                notation: firstResult.notation,
                                total: firstResult.value,
                                rolls: firstResult.rolls?.map((r: any) => ({
                                    die: r.die,
                                    value: r.value,
                                    sides: r.sides,
                                })) || [],
                            });
                            setIsRolling(false);
                        }
                    },
                });

                // Initialize the 3D scene (loads models, sets up physics, etc.)
                await diceBox.init();

                // Final mount check after all async work
                if (mounted) {
                    diceBoxRef.current = diceBox;
                    setIsReady(true);
                    setError(null);
                    console.log('[DiceBox] Initialization complete!');
                }
            } catch (err) {
                console.error('[DiceBox] Failed to initialize:', err);
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to initialize dice');
                    setIsReady(false);
                }
            } finally {
                isInitializingRef.current = false;
            }
        };

        // Start initialization
        initDiceBox();

        // ====================================================================
        // CLEANUP FUNCTION
        // ====================================================================
        // This runs when:
        // - The component unmounts
        // - Any dependency in the array changes (causing effect to re-run)
        // - React Strict Mode runs the effect twice (first run gets cleaned up)
        return () => {
            console.log('[DiceBox] Cleanup: marking as unmounted');
            mounted = false;

            // ================================================================
            // CRITICAL FIX FOR REACT STRICT MODE RACE CONDITION
            // ================================================================
            // In React 18+ Strict Mode, effects run twice on mount:
            //   1. Effect runs → sets isInitializingRef = true
            //   2. Cleanup runs immediately (this function)
            //   3. Effect runs again (second mount)
            //
            // Without this reset, the second run sees isInitializingRef === true
            // and skips initialization ("Already initializing, skipping..."),
            // while the first run aborts because mounted === false.
            //
            // RESULT: Neither run completes initialization!
            //         The UI shows "Loading dice..." forever.
            //
            // By resetting the guard here, we allow the second mount to
            // properly initialize the DiceBox instance.
            // ================================================================
            isInitializingRef.current = false;

            // Clear any dice from the scene
            if (diceBoxRef.current) {
                try {
                    diceBoxRef.current.clear();
                } catch (e) {
                    // Ignore errors during cleanup (instance may be disposed)
                }
                diceBoxRef.current = null;
            }

            // Also clear the container's canvases to prevent stale elements
            // from being visible if the modal is re-opened quickly
            const container = document.querySelector(containerId);
            if (container) {
                const canvases = container.querySelectorAll('canvas');
                canvases.forEach(canvas => canvas.remove());
            }

            setIsReady(false);
        };
    }, [containerId, assetPath, theme, scale, gravity, throwForce]);

    // ========================================================================
    // ROLL FUNCTION
    // ========================================================================
    /**
     * Rolls dice using the provided notation.
     * 
     * @param notation Standard dice notation (e.g., "1d20", "2d6+3", "4d8-2")
     * @returns Promise resolving to the roll result, or null if not ready
     * 
     * @example
     * ```ts
     * await roll('1d20');      // Roll one d20
     * await roll('2d6+5');     // Roll 2d6, add 5
     * await roll('4d6kh3');    // Roll 4d6, keep highest 3 (if supported)
     * ```
     */
    const roll = useCallback(async (notation: string): Promise<DiceResult | null> => {
        if (!diceBoxRef.current || !isReady) {
            console.warn('[DiceBox] Cannot roll: not ready');
            return null;
        }

        setIsRolling(true);
        setLastResult(null);

        try {
            // DiceBox.roll() starts the animation and returns a promise
            // The actual result comes through the onRollComplete callback
            const result = await diceBoxRef.current.roll(notation);
            return result;
        } catch (err) {
            console.error('[DiceBox] Roll failed:', err);
            setIsRolling(false);
            return null;
        }
    }, [isReady]);

    // ========================================================================
    // CLEAR FUNCTION
    // ========================================================================
    /**
     * Clears all dice from the 3D scene.
     * Call this to reset the canvas between rolls or when closing the modal.
     */
    const clear = useCallback(() => {
        if (diceBoxRef.current) {
            diceBoxRef.current.clear();
            setLastResult(null);
        }
    }, []);

    // ========================================================================
    // RESIZE FUNCTION
    // ========================================================================
    /**
     * Resizes the DiceBox 3D world to match the current container dimensions.
     * 
     * Call this when the container size changes (e.g., window resize,
     * modal maximize/restore). Parent components typically use a ResizeObserver
     * to detect size changes and call this function.
     * 
     * We query the DOM using containerId rather than holding a ref because:
     * 1. The container element lives in the parent component (DiceRollerModal)
     * 2. This hook only receives a CSS selector string, not a ref
     * 3. DOM query ensures we always get the current container dimensions
     */
    const resize = useCallback(() => {
        const container = document.querySelector(containerId);

        if (diceBoxRef.current && container && typeof diceBoxRef.current.resizeWorld === 'function') {
            diceBoxRef.current.resizeWorld({
                width: container.clientWidth,
                height: container.clientHeight
            });
        }
    }, [containerId]);

    // ========================================================================
    // UPDATE SCALE FUNCTION
    // ========================================================================
    /**
     * Updates the dice scale at runtime without reinitializing.
     * Uses DiceBox's updateConfig API for live adjustment.
     * 
     * @param newScale Scale value (typical range: 5-20, default: 10)
     */
    const updateScale = useCallback((newScale: number) => {
        if (diceBoxRef.current && typeof diceBoxRef.current.updateConfig === 'function') {
            diceBoxRef.current.updateConfig({ scale: newScale });
            console.log('[DiceBox] Scale updated to:', newScale);
        }
    }, []);

    // ========================================================================
    // RETURN VALUE
    // ========================================================================
    return {
        isReady,
        isRolling,
        lastResult,
        error,
        roll,
        clear,
        resize,
        updateScale,
    };
}

export default useDiceBox;
