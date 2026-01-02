/**
 * @file SubmapRendererPixi.tsx
 * GPU-accelerated PixiJS renderer for the submap with textured terrain,
 * drawn doodads, seeded features, and visual effects.
 *
 * This replaces the flat-colored emoji-based DOM tiles with a beautiful
 * canvas-rendered view using procedural textures and canvas-drawn elements.
 */

import React, { useCallback, useEffect, useRef, useMemo } from 'react';
import 'pixi.js/unsafe-eval'; // CSP patch - must be imported before pixi.js
import * as PIXI from 'pixi.js';
import { CaTileType } from '../../services/cellularAutomataService';
import { WfcGrid } from '../../services/wfcService';
import type { SeededFeatureConfig } from '../../types';

import {
    usePixiApplication,
    createLayerContainers,
    clearLayers,
    type LayerContainers,
} from './hooks/usePixiApplication';

import {
    TILE_SIZE,
    initNoise,
    simpleHash,
} from './painters/shared';
// TODO(lint-intent): 'TextureAtlasManager' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { TextureAtlasManager as _TextureAtlasManager, getTextureManager } from './painters/TextureAtlasManager';
import { SubmapTilePainter } from './painters/SubmapTilePainter';
// TODO(lint-intent): 'DoodadType' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { SubmapDoodadPainter, type DoodadType as _DoodadType } from './painters/SubmapDoodadPainter';
import { SubmapFeaturePainter } from './painters/SubmapFeaturePainter';
import { SubmapOverlayPainter, type TimeOfDay } from './painters/SubmapOverlayPainter';
import { SubmapPathPainter, type PathPoint } from './painters/SubmapPathPainter';
import { SubmapPlayerPainter, type FacingDirection } from './painters/SubmapPlayerPainter';
import { CharacterVisualConfig } from '../../services/CharacterAssetService';

// ============================================================================
// Types
// ============================================================================

export interface SubmapRendererPixiProps {
    dimensions: { rows: number; cols: number };
    playerSubmapCoords: { x: number; y: number };
    playerFacing?: FacingDirection;
    playerVisuals?: CharacterVisualConfig;
    wfcGrid?: WfcGrid;
    caGrid?: CaTileType[][];
    biomeBlendContext: { primaryBiomeId: string; secondaryBiomeId: string | null; blendFactor: number };
    seededFeatures: Array<{ x: number; y: number; config: SeededFeatureConfig; actualSize: number }>;
    scatterFeatures?: Array<{ x: number; y: number; icon: string; biomeId: string }>;
    worldSeed?: number;
    timeOfDay?: TimeOfDay;
    quickTravelPath?: PathPoint[];
    quickTravelDestination?: PathPoint | null;
    isQuickTravelBlocked?: boolean;
    blockedTiles?: Set<string>;
    paletteOverrides?: Partial<Record<string, number>>;
    biomeTintColor?: number | null;
    onHoverTile?: (coords: { x: number; y: number } | null) => void;
    onClickTile?: (coords: { x: number; y: number }) => void;
    onRenderMetrics?: (metrics: { lastMs: number; fpsEstimate: number }) => void;
}

// ============================================================================
// Component
// ============================================================================

const SubmapRendererPixi: React.FC<SubmapRendererPixiProps> = ({
    dimensions,
    playerSubmapCoords,
    playerFacing = 'south',
    playerVisuals,
    wfcGrid,
    caGrid,
    biomeBlendContext,
    seededFeatures,
    scatterFeatures,
    worldSeed = 12345,
    timeOfDay = 'day',
    quickTravelPath = [],
    quickTravelDestination = null,
    isQuickTravelBlocked = false,
    blockedTiles = new Set(),
    onHoverTile,
    onClickTile,
    onRenderMetrics,
}) => {
    // ========================================================================
    // PixiJS Application Setup
    // ========================================================================

    const { app, containerRef, isInitialized, isWebGLSupported, error } = usePixiApplication({
        rows: dimensions.rows,
        cols: dimensions.cols,
        backgroundColor: 0x0b0b0b,
        antialias: true,
    });

    const layersRef = useRef<LayerContainers | null>(null);
    const tickerCallbackRef = useRef<((delta: number) => void) | null>(null);

    // ========================================================================
    // Painters Setup (Memoized)
    // ========================================================================

    const textureManager = useMemo(() => {
        initNoise(worldSeed);
        return getTextureManager(worldSeed);
    }, [worldSeed]);

    const tilePainter = useMemo(() => new SubmapTilePainter(textureManager), [textureManager]);
    const doodadPainter = useMemo(() => new SubmapDoodadPainter(), []);
    const featurePainter = useMemo(() => new SubmapFeaturePainter(), []);
    const overlayPainter = useMemo(() => new SubmapOverlayPainter(), []);
    const pathPainter = useMemo(() => new SubmapPathPainter(), []);
    const playerPainter = useMemo(() => new SubmapPlayerPainter(), []);

    // ========================================================================
    // Grid Source Helper
    // ========================================================================

    const getGridSource = useCallback((): string[][] => {
        if (caGrid) return caGrid.map(row => row.map(cell => cell));
        if (wfcGrid) return wfcGrid;
        return Array.from({ length: dimensions.rows }, () =>
            Array(dimensions.cols).fill('grass')
        );
    }, [caGrid, wfcGrid, dimensions.rows, dimensions.cols]);

    // ========================================================================
    // Main Render Function
    // ========================================================================

    const renderScene = useCallback(() => {
        if (!app || !isInitialized) return;

        const startedAt = performance.now();
        const stage = app.stage;
        const biomeId = biomeBlendContext.primaryBiomeId;

        // Initialize layers if needed
        if (!layersRef.current) {
            layersRef.current = createLayerContainers(stage);
        } else {
            clearLayers(layersRef.current);
        }

        const layers = layersRef.current;
        const gridSource = getGridSource();

        // ====================================================================
        // Layer 0: Terrain
        // ====================================================================

        for (let y = 0; y < dimensions.rows; y++) {
            for (let x = 0; x < dimensions.cols; x++) {
                const terrainType = gridSource[y]?.[x] || 'grass';

                const result = tilePainter.renderTile({
                    x,
                    y,
                    terrainType,
                    effectiveTerrainType: terrainType,
                    biomeId,
                    variation: simpleHash(x, y, worldSeed),
                    elevation: 0.5,
                    isPath: terrainType === 'path',
                });

                // Add hover interaction
                result.sprite.eventMode = 'static';
                result.sprite.cursor = 'pointer';
                result.sprite.on('pointerover', () => onHoverTile?.({ x, y }));
                result.sprite.on('pointerout', () => onHoverTile?.(null));
                result.sprite.on('pointerdown', () => onClickTile?.({ x, y }));

                layers.terrain.addChild(result.sprite);
            }
        }

        // ====================================================================
        // Layer 1: Seeded Features
        // ====================================================================

        seededFeatures.forEach(feature => {
            featurePainter.renderFeature(
                {
                    config: feature.config,
                    centerX: feature.x,
                    centerY: feature.y,
                    actualSize: feature.actualSize,
                    biomeId,
                },
                layers.features
            );
        });

        // ====================================================================
        // Layer 2: Doodads (Scatter Features)
        // ====================================================================

        if (scatterFeatures) {
            scatterFeatures.forEach(scatter => {
                const doodadType = doodadPainter.emojiToDoodadType(scatter.icon);
                if (doodadType) {
                    const variation = Math.floor(simpleHash(scatter.x, scatter.y, worldSeed + 1000) * 4);
                    const sprite = doodadPainter.renderDoodad({
                        type: doodadType,
                        x: scatter.x,
                        y: scatter.y,
                        biomeId: scatter.biomeId,
                        variation,
                    });

                    // Z-sort based on Y position
                    sprite.zIndex = scatter.y * TILE_SIZE + TILE_SIZE;
                    layers.doodads.addChild(sprite);
                }
            });

            layers.doodads.sortChildren();
        }

        // ====================================================================
        // Layer 3: Overlay (Day/Night)
        // ====================================================================

        const overlayContainer = overlayPainter.createOverlays(
            dimensions.cols * TILE_SIZE,
            dimensions.rows * TILE_SIZE,
            {
                timeOfDay,
                biomeId,
                enableVignette: false, // Disabled - PixiJS v8 stacks semi-transparent ellipses incorrectly
                enableFog: biomeId === 'swamp',
                fogDensity: biomeId === 'swamp' ? 0.3 : 0,
            }
        );
        layers.overlay.addChild(overlayContainer);

        // ====================================================================
        // Layer 4: Path (Quick Travel)
        // ====================================================================

        if (quickTravelPath.length > 0 || quickTravelDestination) {
            const pathContainer = pathPainter.renderPath({
                path: quickTravelPath,
                destination: quickTravelDestination,
                isDestinationBlocked: isQuickTravelBlocked,
                blockedTiles,
                playerPosition: playerSubmapCoords,
            });
            layers.path.addChild(pathContainer);
        }

        // ====================================================================
        // Layer 5: UI (Player)
        // ====================================================================

        const playerContainer = playerPainter.renderPlayer({
            x: playerSubmapCoords.x,
            y: playerSubmapCoords.y,
            facing: playerFacing,
            visuals: playerVisuals,
        });
        layers.ui.addChild(playerContainer);

        // ====================================================================
        // Render
        // ====================================================================

        app.render();

        const elapsed = performance.now() - startedAt;
        onRenderMetrics?.({ lastMs: elapsed, fpsEstimate: elapsed > 0 ? 1000 / elapsed : 0 });
    // TODO(lint-intent): If player visuals churn often, memoize them upstream to avoid extra renders.
    }, [
        app,
        isInitialized,
        biomeBlendContext.primaryBiomeId,
        getGridSource,
        dimensions.rows,
        dimensions.cols,
        tilePainter,
        worldSeed,
        onHoverTile,
        onClickTile,
        seededFeatures,
        featurePainter,
        scatterFeatures,
        doodadPainter,
        overlayPainter,
        timeOfDay,
        quickTravelPath,
        quickTravelDestination,
        isQuickTravelBlocked,
        blockedTiles,
        pathPainter,
        playerSubmapCoords,
        playerPainter,
        playerFacing,
        playerVisuals,
        onRenderMetrics,
    ]);

    // ========================================================================
    // Animation Loop
    // ========================================================================

    useEffect(() => {
        if (!app || !isInitialized) return;

        // Set up animation ticker - PixiJS v8 passes Ticker object to callback
        const tickerCallback = (ticker: PIXI.Ticker) => {
            const delta = ticker.deltaTime;

            // Update painter animations
            tilePainter.updateWaterAnimation(delta);
            doodadPainter.updateAnimation(delta);
            pathPainter.updateAnimation(delta);
            playerPainter.updateAnimation(delta);

            // Apply breathing animation to player
            playerPainter.applyBreathingAnimation();

            // Apply pulse animation to destination marker
            if (quickTravelDestination && layersRef.current?.path.children[0]) {
                // pathPainter.applyPulseAnimation() could be called here
            }
        };

        // Store reference for cleanup - ticker.add expects (ticker: Ticker) => void
        tickerCallbackRef.current = tickerCallback as unknown as (delta: number) => void;
        app.ticker.add(tickerCallback);

        return () => {
            if (tickerCallbackRef.current) {
                // app may have been destroyed by the time this cleanup runs (e.g. renderer toggle).
                app.ticker?.remove(tickerCallback);
                tickerCallbackRef.current = null;
            }
        };
    }, [app, isInitialized, tilePainter, doodadPainter, pathPainter, playerPainter, quickTravelDestination]);

    // ========================================================================
    // Re-render on Data Changes
    // ========================================================================

    useEffect(() => {
        if (isInitialized) {
            renderScene();
        }
    }, [isInitialized, renderScene]);

    // ========================================================================
    // Error State
    // ========================================================================

    if (!isWebGLSupported || error) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-400 text-sm">
                <div className="text-center p-4">
                    <p className="mb-2">Canvas renderer unavailable</p>
                    <p className="text-xs text-gray-500">
                        {error || 'WebGL not supported. Using DOM renderer.'}
                    </p>
                </div>
            </div>
        );
    }

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div
            ref={containerRef}
            className="w-full overflow-hidden"
            style={{
                width: dimensions.cols * TILE_SIZE,
                height: dimensions.rows * TILE_SIZE,
            }}
        />
    );
};

export default SubmapRendererPixi;
