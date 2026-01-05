/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file useDiceBox.ts
 * React hook for managing DiceBox lifecycle and rolls.
 */
import { useRef, useState, useCallback, useEffect } from 'react';

// We dynamically import to avoid SSR issues
let DiceBox: any = null;

interface DiceResult {
    notation: string;
    total: number;
    rolls: Array<{
        die: string;
        value: number;
        sides: number;
    }>;
}

interface UseDiceBoxOptions {
    containerId: string;
    assetPath?: string;
    theme?: string;
    scale?: number;
    gravity?: number;
    throwForce?: number;
}

interface UseDiceBoxReturn {
    isReady: boolean;
    isRolling: boolean;
    lastResult: DiceResult | null;
    error: string | null;
    roll: (notation: string) => Promise<DiceResult | null>;
    clear: () => void;
    resize: () => void;
}

/**
 * Hook to manage DiceBox lifecycle and provide roll functionality.
 */
export function useDiceBox(options: UseDiceBoxOptions): UseDiceBoxReturn {
    const {
        containerId,
        assetPath = `${import.meta.env.BASE_URL}assets/dice-box/`,
        theme = 'default',
        scale = 24,
        gravity = 4,
        throwForce = 14,
    } = options;

    const diceBoxRef = useRef<any>(null);
    const [isReady, setIsReady] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [lastResult, setLastResult] = useState<DiceResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Initialize DiceBox
    useEffect(() => {
        let mounted = true;

        const initDiceBox = async () => {
            try {
                // Dynamic import to avoid SSR issues
                if (!DiceBox) {
                    const module = await import('@3d-dice/dice-box');
                    DiceBox = module.default;
                }

                const container = document.querySelector(containerId);
                if (!container) {
                    throw new Error(`Container ${containerId} not found`);
                }

                const diceBox = new DiceBox({
                    container: containerId,
                    assetPath,
                    theme,
                    scale,
                    gravity,
                    throwForce,
                    width: container.clientWidth,
                    height: container.clientHeight,
                    offscreen: true, // Use offscreen canvas for performance
                    onRollComplete: (results: any) => {
                        if (mounted && results.length > 0) {
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

                await diceBox.init();

                if (mounted) {
                    diceBoxRef.current = diceBox;
                    setIsReady(true);
                    setError(null);
                }
            } catch (err) {
                console.error('Failed to initialize DiceBox:', err);
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to initialize dice');
                    setIsReady(false);
                }
            }
        };

        initDiceBox();

        return () => {
            mounted = false;
            if (diceBoxRef.current) {
                diceBoxRef.current.clear();
                diceBoxRef.current = null;
            }
        };
    }, [containerId, assetPath, theme, scale, gravity, throwForce]);

    const roll = useCallback(async (notation: string): Promise<DiceResult | null> => {
        if (!diceBoxRef.current || !isReady) {
            console.warn('DiceBox not ready');
            return null;
        }

        setIsRolling(true);
        setLastResult(null);

        try {
            const result = await diceBoxRef.current.roll(notation);
            return result;
        } catch (err) {
            console.error('Roll failed:', err);
            setIsRolling(false);
            return null;
        }
    }, [isReady]);

    const clear = useCallback(() => {
        if (diceBoxRef.current) {
            diceBoxRef.current.clear();
            setLastResult(null);
        }
    }, []);

    const resize = useCallback(() => {
        if (diceBoxRef.current && typeof diceBoxRef.current.resizeWorld === 'function') {
            diceBoxRef.current.resizeWorld();
        }
    }, []);

    return {
        isReady,
        isRolling,
        lastResult,
        error,
        roll,
        clear,
        resize,
    };
}

export default useDiceBox;
