/**
 * @file src/components/Submap/hooks/usePixiApplication.ts
 * React hook for managing PixiJS Application lifecycle.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import 'pixi.js/unsafe-eval'; // CSP patch - must be imported before pixi.js
import * as PIXI from 'pixi.js';
import { TILE_SIZE } from '../painters/shared';

// ============================================================================
// Types
// ============================================================================

export interface PixiAppConfig {
    rows: number;
    cols: number;
    backgroundColor?: number;
    antialias?: boolean;
}

export interface UsePixiApplicationResult {
    app: PIXI.Application | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
    isInitialized: boolean;
    isWebGLSupported: boolean;
    error: string | null;
    resize: (rows: number, cols: number) => void;
}

// ============================================================================
// WebGL Support Detection
// ============================================================================

function detectWebGLSupport(): boolean {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return gl !== null;
    } catch {
        return false;
    }
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePixiApplication(config: PixiAppConfig): UsePixiApplicationResult {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);
    const [isWebGLSupported] = useState(() => detectWebGLSupport());
    const [error, setError] = useState<string | null>(null);

    // Initialize PixiJS application
    useEffect(() => {
        if (!containerRef.current || appRef.current) return;
        if (!isWebGLSupported) {
            setError('WebGL is not supported in this browser. Falling back to DOM renderer.');
            return;
        }

        let mounted = true;

        const initApp = async () => {
            try {
                const app = new PIXI.Application();

                await app.init({
                    width: config.cols * TILE_SIZE,
                    height: config.rows * TILE_SIZE,
                    background: config.backgroundColor ?? 0x0b0b0b,
                    antialias: config.antialias ?? true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true,
                });

                if (!mounted) {
                    app.destroy(true, true);
                    return;
                }

                appRef.current = app;

                // Append canvas to container
                if (app.canvas && containerRef.current) {
                    containerRef.current.appendChild(app.canvas);
                    setIsInitialized(true);
                } else {
                    throw new Error('Failed to get canvas element from PixiJS application');
                }
            } catch (err) {
                console.error('PixiJS initialization error:', err);
                setError(err instanceof Error ? err.message : 'Failed to initialize PixiJS');
            }
        };

        initApp();

        return () => {
            mounted = false;
            if (appRef.current) {
                appRef.current.destroy(true, true);
                appRef.current = null;
            }
            setIsInitialized(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isWebGLSupported]); // Only re-run if WebGL support changes (won't happen)

    // Handle resize
    const resize = useCallback((rows: number, cols: number) => {
        if (appRef.current) {
            const newWidth = cols * TILE_SIZE;
            const newHeight = rows * TILE_SIZE;
            appRef.current.renderer.resize(newWidth, newHeight);
        }
    }, []);

    // Auto-resize when config dimensions change
    useEffect(() => {
        if (isInitialized && appRef.current) {
            resize(config.rows, config.cols);
        }
    }, [config.rows, config.cols, isInitialized, resize]);

    return {
        app: appRef.current,
        containerRef,
        isInitialized,
        isWebGLSupported,
        error,
        resize,
    };
}

// ============================================================================
// Layer Container Creation Utility
// ============================================================================

export interface LayerContainers {
    terrain: PIXI.Container;
    features: PIXI.Container;
    setPieces: PIXI.Container;
    doodads: PIXI.Container;
    overlay: PIXI.Container;
    weather: PIXI.Container;
    path: PIXI.Container;
    ui: PIXI.Container;
}

/**
 * Create layer containers for the submap renderer.
 * Layers are added in rendering order (bottom to top).
 */
export function createLayerContainers(stage: PIXI.Container): LayerContainers {
    const terrain = new PIXI.Container();
    terrain.label = 'terrain';

    const features = new PIXI.Container();
    features.label = 'features';

    const doodads = new PIXI.Container();
    doodads.label = 'doodads';
    doodads.sortableChildren = true; // Enable z-sorting for doodads

    const setPieces = new PIXI.Container();
    setPieces.label = 'setPieces';
    setPieces.sortableChildren = true; // Enable z-sorting for set pieces

    const overlay = new PIXI.Container();
    overlay.label = 'overlay';

    const weather = new PIXI.Container();
    weather.label = 'weather';

    const path = new PIXI.Container();
    path.label = 'path';

    const ui = new PIXI.Container();
    ui.label = 'ui';

    // Add in order (bottom to top)
    stage.addChild(terrain);
    stage.addChild(features);
    stage.addChild(setPieces);
    stage.addChild(doodads);
    stage.addChild(overlay);
    stage.addChild(weather);
    stage.addChild(path);
    stage.addChild(ui);

    return { terrain, features, setPieces, doodads, overlay, weather, path, ui };
}

/**
 * Clear all layer containers.
 */
export function clearLayers(layers: LayerContainers): void {
    Object.values(layers).forEach(layer => {
        const children = layer.removeChildren();
        children.forEach((child: PIXI.ContainerChild) => child.destroy({ children: true }));
    });
}
