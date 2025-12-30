/**
 * @file SubmapPane.tsx
 * This component displays the visual submap for the player's current
 * world map tile location, showing their precise position within a 25x25 grid.
 * It now features more varied tile visuals, including feature clumping and paths,
 * an icon glossary accessible via a modal, and tooltips with contextual hints.
 * It uses the useSubmapProceduralData hook for data generation and has a decomposed getTileVisuals function.
 * CompassPane is now integrated into this modal.
 */
import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { BIOMES } from '../../constants';
import { Action, InspectSubmapTilePayload, Location, MapData, PlayerCharacter, NPC, Item, SeededFeatureConfig } from '../../types';
import CompassPane from '../CompassPane';
import ActionPane from '../ActionPane';
import GlossaryDisplay from '../Glossary/GlossaryDisplay';
import { useSubmapProceduralData } from '../../hooks/useSubmapProceduralData';
import { biomeVisualsConfig, defaultBiomeVisuals } from '../../config/submapVisualsConfig';
import SubmapTile from './SubmapTile';
import { CaTileType } from '../../services/cellularAutomataService';
import SubmapRendererPixi from './SubmapRendererPixi';

// Modularized imports
import {
    cssColorToHex,
    getAnimationClass,
    getIsResource,
    VisualLayerOutput,
    getBaseVisuals,
    applyPathVisuals,
    applyWfcVisuals,
    applySeededFeatureVisuals,
    applyScatterVisuals
} from './submapVisuals';
import { useSubmapGlossaryItems } from './useSubmapGlossaryItems';
import { useTileHintGenerator } from './useTileHintGenerator';
import { useSubmapGrid } from './useSubmapGrid';
import { usePathfindingGrid, useQuickTravelData } from './useQuickTravel';
import { useInspectableTiles } from './useInspectableTiles';
import { getDayNightOverlayClass } from './useDayNightOverlay';

interface SubmapPaneProps {
    currentLocation: Location;
    currentWorldBiomeId: string;
    playerSubmapCoords: { x: number; y: number };
    onClose: () => void;
    submapDimensions: { rows: number; cols: number };
    parentWorldMapCoords: { x: number; y: number };
    onAction: (action: Action) => void;
    disabled: boolean;
    inspectedTileDescriptions: Record<string, string>;
    mapData: MapData | null;
    gameTime: Date;
    playerCharacter: PlayerCharacter;
    worldSeed: number;
    npcsInLocation: NPC[];
    itemsInLocation: Item[];
    geminiGeneratedActions: Action[] | null;
    isDevDummyActive: boolean;
    unreadDiscoveryCount: number;
    hasNewRateLimitError: boolean;
}


const SubmapPane: React.FC<SubmapPaneProps> = ({
    currentLocation,
    currentWorldBiomeId,
    playerSubmapCoords,
    onClose,
    submapDimensions,
    parentWorldMapCoords,
    onAction,
    disabled,
    inspectedTileDescriptions,
    mapData,
    gameTime,
    playerCharacter,
    worldSeed,
    npcsInLocation,
    itemsInLocation,
    geminiGeneratedActions,
    isDevDummyActive,
    unreadDiscoveryCount,
    hasNewRateLimitError,
}) => {
    const firstFocusableElementRef = useRef<HTMLButtonElement>(null);
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const hoverFrameRef = useRef<number | null>(null);
    const lastRenderMetricsUpdateAtRef = useRef<number>(0);
    const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
    const [isInspecting, setIsInspecting] = useState(false);
    const [inspectionMessage, setInspectionMessage] = useState<string | null>(null);

    // --- NEW STATE FOR QUICK TRAVEL ---
    const [isQuickTravelMode, setIsQuickTravelMode] = useState(false);
    const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    // TODO[PIXI-PREFERENCE]: Persist usePixiRenderer to localStorage so users don't re-enable each session.
    const [usePixiRenderer, setUsePixiRenderer] = useState(false);
    const [renderMetrics, setRenderMetrics] = useState<{ lastMs: number; fpsEstimate: number } | null>(null);

    const currentBiome = BIOMES[currentWorldBiomeId] || null;
    const visualsConfig = (currentBiome && biomeVisualsConfig[currentBiome.id]) || defaultBiomeVisuals;

    const pixiPaletteOverrides = useMemo(() => {
        // Translate the React visuals palette into numeric colors Pixi can consume so both renderers stay visually aligned.
        const overrides: Partial<Record<string, number>> = {};
        const baseHex = cssColorToHex(visualsConfig.baseColors?.[0]);
        if (baseHex !== null) {
            overrides.grass = baseHex;
            overrides.default = baseHex;
        }

        const pathHex = cssColorToHex(visualsConfig.pathColor);
        if (pathHex !== null) overrides.path = pathHex;

        const caFloorHex = cssColorToHex(visualsConfig.caTileVisuals?.floor?.color);
        if (caFloorHex !== null) overrides.floor = caFloorHex;

        const caWallHex = cssColorToHex(visualsConfig.caTileVisuals?.wall?.color);
        if (caWallHex !== null) overrides.wall = caWallHex;

        const waterFeature = visualsConfig.seededFeatures?.find((feature) => feature.generatesEffectiveTerrainType === 'water');
        const waterHex = cssColorToHex(waterFeature?.color);
        if (waterHex !== null) overrides.water = waterHex;

        return overrides;
    }, [visualsConfig]);

    const isOpen = true;

    const adjacentBiomeIds = useMemo(() => {
        // Neighbor biomes give us context for blending (edge tiles near oceans, mountains, etc.).
        if (!mapData) return [] as string[];
        const candidates = new Set<string>();
        const neighborOffsets = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
        ];
        neighborOffsets.forEach(({ dx, dy }) => {
            const nx = parentWorldMapCoords.x + dx;
            const ny = parentWorldMapCoords.y + dy;
            const biomeId = mapData.tiles?.[ny]?.[nx]?.biomeId;
            if (biomeId) candidates.add(biomeId);
        });
        return Array.from(candidates);
    }, [mapData, parentWorldMapCoords]);

    const { simpleHash, activeSeededFeatures, pathDetails, caGrid, wfcGrid, biomeBlendContext } = useSubmapProceduralData({
        submapDimensions,
        currentWorldBiomeId,
        parentWorldMapCoords,
        seededFeaturesConfig: visualsConfig.seededFeatures,
        worldSeed,
        adjacentBiomeIds,
    });

    const secondaryBiomeTint = useMemo(() => {
        if (!biomeBlendContext.secondaryBiomeId) return null;
        const neighborBiome = BIOMES[biomeBlendContext.secondaryBiomeId];
        return cssColorToHex(neighborBiome?.rgbaColor);
    }, [biomeBlendContext.secondaryBiomeId]);

    // Modal lifecycle: handle Escape semantics and restore focus when no sub-mode is active.
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (isQuickTravelMode) setIsQuickTravelMode(false);
                else if (isGlossaryOpen) setIsGlossaryOpen(false);
                else if (isInspecting) {
                    setIsInspecting(false);
                    setInspectionMessage(null);
                } else {
                    onClose();
                }
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            if (!isInspecting && !isGlossaryOpen && !isQuickTravelMode) {
                firstFocusableElementRef.current?.focus();
            }
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, isGlossaryOpen, isInspecting, isQuickTravelMode]);

    // Central visual resolver: driven by biome visuals config + procedural data (paths, CA, WFC).
    const getTileVisuals = useCallback((rowIndex: number, colIndex: number): VisualLayerOutput => {
        const tileHash = simpleHash(colIndex, rowIndex, 'tile_visual_seed_v4');

        // --- NEW LOGIC: Check for CA Grid first ---
        if (caGrid && visualsConfig.caTileVisuals) {
            const tileType: CaTileType = caGrid[rowIndex]?.[colIndex] || 'wall';
            const tileVisual = visualsConfig.caTileVisuals[tileType];

            let visuals: VisualLayerOutput = {
                style: { backgroundColor: tileVisual.color },
                content: tileVisual.icon ? <span role="img" aria-label={tileType}>{tileVisual.icon}</span> : null,
                animationClass: '',
                isResource: false,
                effectiveTerrainType: tileType,
                zIndex: 0,
                activeSeededFeatureConfigForTile: null,
                isSeedTile: false,
            };

            // Apply scatter features on top of 'floor' tiles
            if (tileType === 'floor') {
                visuals = applyScatterVisuals(visuals, tileHash, visualsConfig);
            }

            return visuals;
        }

        // --- Standard Logic ---
        let visuals = getBaseVisuals(rowIndex, colIndex, tileHash, visualsConfig);

        if (wfcGrid) {
            // When a WFC grid is present, use its tile IDs to drive the base terrain so movement and tooltips match the Pixi preview.
            const wfcTileType = wfcGrid[rowIndex]?.[colIndex];
            if (wfcTileType) {
                visuals = applyWfcVisuals(visuals, wfcTileType, visualsConfig, tileHash);
            }
        }

        visuals = applyPathVisuals(visuals, rowIndex, colIndex, pathDetails, visualsConfig, tileHash);
        visuals = applySeededFeatureVisuals(visuals, rowIndex, colIndex, activeSeededFeatures);
        visuals = applyScatterVisuals(visuals, tileHash, visualsConfig);

        const iconContent = React.isValidElement(visuals.content) ? (visuals.content.props as { children?: React.ReactNode }).children : null;
        const icon = typeof iconContent === 'string' ? iconContent : null;

        visuals.animationClass = getAnimationClass(icon);
        visuals.isResource = getIsResource(icon);

        return visuals;
    }, [simpleHash, visualsConfig, pathDetails, activeSeededFeatures, caGrid, wfcGrid]);

    // Pathfinding grid feeds quick travel previews and path overlays; split out for clarity.
    // TODO: Share the visuals computed below with the quick-travel grid instead of re-running
    // `getTileVisuals` twice (once for the render grid, once for pathfinding). Memoizing a single
    // visuals map would cut this work roughly in half.
    const pathfindingGrid = usePathfindingGrid({
        submapDimensions,
        getTileVisuals,
        playerCharacter,
        gameTime,
    });

    const quickTravelData = useQuickTravelData({
        isQuickTravelMode,
        hoveredTile,
        playerSubmapCoords,
        pathfindingGrid,
        submapDimensions,
        currentWorldBiomeId,
        simpleHash,
    });

    const getHintForTile = useTileHintGenerator({
        inspectedTileDescriptions,
        playerSubmapCoords,
        parentWorldMapCoords,
        currentWorldBiomeId,
        currentBiomeName: currentBiome?.name,
        simpleHash,
    });

    // Memoized grid + tooltip data keeps SubmapTile renders stable when hovering during quick travel.
    const submapGridWithTooltips = useSubmapGrid({
        submapDimensions,
        getTileVisuals,
        getHintForTile,
    });

    const inspectableTiles = useInspectableTiles({
        isInspecting,
        playerSubmapCoords,
        submapDimensions,
    });

    // TODO: Consolidate the quick-travel/inspect gating logic into a shared helper so the rules
    // used here stay in sync with the props passed to each tile (e.g., `isDisabled` checks below).
    // Small drift can otherwise cause UI buttons to misreport whether a tile should accept input.
    // Tile click handler coordinates the two sub-modes (inspect vs quick travel) before dispatching actions.
    const handleTileClickForInspection = useCallback((tileX: number, tileY: number, effectiveTerrain: string, featureConfig: SeededFeatureConfig | null) => {
        if (disabled) return;

        if (isQuickTravelMode) {
            // TODO[QUICK-TRAVEL-RESOURCES]: Add food/water consumption and fatigue accumulation
            // for quick travel. Consider: fatigue = travelTime * fatigueMultiplier.
            const travelData = quickTravelData;
            if (travelData.path.size > 0) {
                onAction({ type: 'QUICK_TRAVEL', label: `Quick travel to (${tileX},${tileY})`, payload: { quickTravel: { destination: { x: tileX, y: tileY }, durationSeconds: travelData.time * 60 } } });
                setIsQuickTravelMode(false);
            }
            return;
        }

        if (isInspecting) {
            if (inspectableTiles.has(`${tileX},${tileY}`)) {
                const payload: InspectSubmapTilePayload = {
                    tileX, tileY, effectiveTerrainType: effectiveTerrain, worldBiomeId: currentWorldBiomeId,
                    parentWorldMapCoords, activeFeatureConfig: featureConfig || undefined,
                };
                onAction({ type: 'inspect_submap_tile', label: `Inspect tile (${tileX},${tileY})`, payload: { inspectTileDetails: payload } });
                setInspectionMessage(`Inspecting tile (${tileX}, ${tileY})...`);
            } else {
                setInspectionMessage("You can only inspect adjacent tiles.");
            }
        }
    }, [disabled, isQuickTravelMode, isInspecting, quickTravelData, inspectableTiles, onAction, currentWorldBiomeId, parentWorldMapCoords]);

    const scheduleHoverUpdate = useCallback((nextHover: { x: number; y: number } | null) => {
        // Use rAF to coalesce rapid mousemove events; this keeps hover updates from thrashing React state.
        if (hoverFrameRef.current) cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = requestAnimationFrame(() => {
            setHoveredTile(nextHover);
            hoverFrameRef.current = null;
        });
    }, []);

    const handleTileHover = useCallback((x: number, y: number) => {
        if (isQuickTravelMode) scheduleHoverUpdate({ x, y });
    }, [isQuickTravelMode, scheduleHoverUpdate]);

    const handlePixiHover = useCallback((coords: { x: number; y: number } | null) => {
        if (!isQuickTravelMode) return;
        if (!coords) {
            scheduleHoverUpdate(null);
            return;
        }
        scheduleHoverUpdate({ x: coords.x, y: coords.y });
    }, [isQuickTravelMode, scheduleHoverUpdate]);

    const handleRenderMetrics = useCallback((metrics: { lastMs: number; fpsEstimate: number }) => {
        // Persist the latest frame time so UI can surface performance regressions quickly.
        // Throttle to avoid render loops (Pixi can render multiple times during prop reconciliation).
        const now = performance.now();
        if (now - lastRenderMetricsUpdateAtRef.current < 250) return;
        lastRenderMetricsUpdateAtRef.current = now;
        setRenderMetrics(metrics);
    }, []);

    useEffect(() => () => {
        // Ensure any pending hover rAF callbacks are cancelled when the pane unmounts.
        if (hoverFrameRef.current) cancelAnimationFrame(hoverFrameRef.current);
    }, []);
    const toggleGlossary = () => setIsGlossaryOpen(!isGlossaryOpen);

    const handleInspectClick = () => {
        if (disabled) return;
        setIsQuickTravelMode(false);
        setIsInspecting(!isInspecting);
        setInspectionMessage(isInspecting ? null : "Select an adjacent tile to inspect.");
    };

    const handleQuickTravelClick = () => {
        if (disabled) return;
        setIsInspecting(false);
        setInspectionMessage(null);
        setIsQuickTravelMode(!isQuickTravelMode);
    };

    // Legend items are generated from the visuals config so React + Pixi share the same glossary.
    const glossaryItems = useSubmapGlossaryItems(visualsConfig);

    const gridContainerStyle: React.CSSProperties & { '--tile-size': string } = {
        '--tile-size': '1.75rem',
        display: 'grid',
        gridTemplateColumns: `repeat(${submapDimensions.cols}, var(--tile-size))`,
        gridTemplateRows: `repeat(${submapDimensions.rows}, var(--tile-size))`,
        position: 'relative',
    };

    const dayNightOverlayClass = getDayNightOverlayClass(gameTime);


    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 md:p-4"
            aria-modal="true"
            role="dialog"
            aria-labelledby="submap-pane-title"
        >
            <div className="bg-gray-800 p-3 md:p-4 rounded-xl shadow-2xl border border-gray-700 w-full max-w-7xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-3">
                    <h2 id="submap-pane-title" className="text-xl md:text-2xl font-bold text-amber-400 font-cinzel">
                        Local Area Scan - {currentLocation.name}
                    </h2>
                    <button
                        ref={firstFocusableElementRef}
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-200 text-2xl p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-400"
                        aria-label="Close submap"
                    >
                        &times;
                    </button>
                </div>

                {isInspecting && inspectionMessage && (
                    <p className="text-center text-sm text-yellow-300 mb-2 italic">{inspectionMessage}</p>
                )}

                {/*
                  TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
                  TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
                  TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
                */}
                <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden min-h-0"> {/* Use overflow-hidden on parent */}
                    {/* Submap Grid Container */}
                    
                    
                    <div
                        className="p-1 bg-gray-900/30 rounded-md shadow-inner flex-grow overflow-auto scrollable-content relative"
                        onMouseLeave={() => setHoveredTile(null)}
                        onMouseMove={(e) => setMousePosition({ x: e.clientX, y: e.clientY })}
                        role="button"
                        aria-label="Submap viewport"
                    >
                        <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    className="accent-amber-400"
                                    checked={usePixiRenderer}
                                    onChange={(e) => setUsePixiRenderer(e.target.checked)}
                                />
                                <span>Use PixiJS renderer (beta)</span>
                            </label>
                            {usePixiRenderer && renderMetrics && (
                                <span className="text-emerald-300">
                                    {renderMetrics.lastMs.toFixed(1)} ms · ~{Math.max(renderMetrics.fpsEstimate, 0).toFixed(0)} fps
                                </span>
                            )}
                        </div>

                        {usePixiRenderer && (
                            <div className="mb-2 border border-gray-700 rounded bg-black/30">
                                <SubmapRendererPixi
                                    dimensions={submapDimensions}
                                    playerSubmapCoords={playerSubmapCoords}
                                    wfcGrid={wfcGrid}
                                    caGrid={caGrid as CaTileType[][] | undefined}
                                    biomeBlendContext={biomeBlendContext}
                                    paletteOverrides={pixiPaletteOverrides}
                                    biomeTintColor={secondaryBiomeTint}
                                    onHoverTile={handlePixiHover}
                                    onRenderMetrics={handleRenderMetrics}
                                    seededFeatures={activeSeededFeatures}
                                />
                            </div>
                        )}

                        <div
                            ref={gridContainerRef}
                            style={gridContainerStyle}
                            role="grid"
                            aria-labelledby="submap-grid-description"
                        >
                            <p id="submap-grid-description" className="sr-only">
                                Submap grid showing local terrain features. Your current position is marked with a person icon.
                            </p>
                            {/* OPTIMIZATION: Use submapGridWithTooltips to avoid re-generating strings on hover */}
                            {submapGridWithTooltips.map(({ r, c, visuals, tooltipContent }) => {
                                const isPlayerPos = playerSubmapCoords?.x === c && playerSubmapCoords?.y === r;
                                const tileKey = `${c},${r}`;
                                const isHighlightedForInspection = isInspecting && inspectableTiles.has(tileKey);
                                const isInteractiveResource = !isInspecting && !isQuickTravelMode && visuals.isResource && ((Math.abs(c - playerSubmapCoords.x) <= 1 && Math.abs(r - playerSubmapCoords.y) <= 1));
                                const isInQuickTravelPath = isQuickTravelMode && quickTravelData.path.has(tileKey);
                                const isBlockedForTravel = pathfindingGrid.get(tileKey)?.blocksMovement === true;
                                const isHovered = hoveredTile?.x === c && hoveredTile?.y === r;
                                const isDestination = isQuickTravelMode && isHovered;

                                return (
                                    <SubmapTile
                                        key={tileKey}
                                        r={r}
                                        c={c}
                                        visuals={visuals}
                                        tooltipContent={tooltipContent}
                                        isPlayerPos={isPlayerPos}
                                        isHighlightedForInspection={isHighlightedForInspection}
                                        isInteractiveResource={isInteractiveResource}
                                        isInQuickTravelPath={isInQuickTravelPath}
                                        isQuickTravelMode={isQuickTravelMode}
                                        isBlockedForTravel={isBlockedForTravel}
                                        isDestination={!!isDestination}
                                        isQuickTravelBlocked={quickTravelData.isBlocked}
                                        onMouseEnter={handleTileHover}
                                        onClick={handleTileClickForInspection}
                                        isDisabled={disabled || (isInspecting && !isPlayerPos && !isHighlightedForInspection)}
                                    />
                                );
                            })}

                            {/* Dynamic SVG Path Overlay */}
                            {isQuickTravelMode && quickTravelData.orderedPath.length > 0 && (
                                <svg
                                    className="absolute inset-0 w-full h-full pointer-events-none z-[20]"
                                    viewBox={`0 0 ${submapDimensions.cols} ${submapDimensions.rows}`}
                                    preserveAspectRatio="none" // Stretch to fit container
                                >
                                    <polyline
                                        points={quickTravelData.orderedPath.map(p =>
                                            `${p.x + 0.5},${p.y + 0.5}`
                                        ).join(' ')}
                                        fill="none"
                                        stroke="yellow"
                                        strokeWidth="0.15" // Relative to tile size of 1
                                        strokeOpacity="0.6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    {/* Destination Marker */}
                                    {hoveredTile && !quickTravelData.isBlocked && (
                                        <circle
                                            cx={hoveredTile.x + 0.5}
                                            cy={hoveredTile.y + 0.5}
                                            r="0.3"
                                            fill="yellow"
                                            stroke="white"
                                            strokeWidth="0.05"
                                        />
                                    )}
                                </svg>
                            )}
                        </div>
                        <div className={`day-night-overlay ${dayNightOverlayClass}`}></div>
                    </div>


                    {/* Controls Column */}
                    <div className="flex flex-col gap-3 md:w-auto md:max-w-sm flex-shrink-0 overflow-hidden">
                        <div className="flex-shrink-0">
                            <CompassPane
                                currentLocation={currentLocation}
                                currentSubMapCoordinates={playerSubmapCoords}
                                worldMapCoords={currentLocation.mapCoordinates}
                                subMapCoords={playerSubmapCoords}
                                onAction={onAction}
                                disabled={disabled || isInspecting || isQuickTravelMode}
                                mapData={mapData}
                                gameTime={gameTime}
                                isSubmapContext={true}
                            />
                        </div>
                        <div className="flex flex-col items-stretch gap-2 p-3 bg-gray-700/50 rounded-lg border border-gray-600/70 shadow-md flex-shrink-0">
                            <button
                                onClick={handleQuickTravelClick}
                                disabled={disabled}
                                className={`px-3 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors w-full
                                ${isQuickTravelMode ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}
                                disabled:bg-gray-500 disabled:cursor-not-allowed`}
                            >
                                {isQuickTravelMode ? 'Cancel Travel' : 'Quick Travel'}
                            </button>
                            <button
                                onClick={handleInspectClick}
                                disabled={disabled}
                                className={`px-3 py-2 text-sm font-semibold rounded-md shadow-sm transition-colors w-full
                                ${isInspecting ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'}
                                disabled:bg-gray-500 disabled:cursor-not-allowed`}
                            >
                                {isInspecting ? 'Cancel Inspect' : 'Inspect Tile'}
                            </button>
                            <button
                                onClick={toggleGlossary}
                                disabled={disabled}
                                className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-md shadow-sm transition-colors w-full disabled:bg-gray-500 disabled:cursor-not-allowed"
                                aria-label="Toggle submap legend"
                            >
                                {isGlossaryOpen ? 'Hide Legend' : 'Show Legend'}
                            </button>
                        </div>
                        <div className="mt-2 flex-grow overflow-y-auto scrollable-content border-t border-gray-700 pt-2">
                            <ActionPane
                                currentLocation={currentLocation}
                                npcsInLocation={npcsInLocation}
                                itemsInLocation={itemsInLocation}
                                onAction={onAction}
                                disabled={disabled || isInspecting || isQuickTravelMode}
                                geminiGeneratedActions={geminiGeneratedActions}
                                isDevDummyActive={isDevDummyActive}
                                unreadDiscoveryCount={unreadDiscoveryCount}
                                hasNewRateLimitError={hasNewRateLimitError}
                                subMapCoordinates={playerSubmapCoords}
                                worldSeed={worldSeed}
                            />
                        </div>
                    </div>
                </div>

                {isGlossaryOpen && (
                    
                    
                    /* TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
                    TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
                    TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
                    */
                    <div
                        className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]"
                        onClick={(e) => e.target === e.currentTarget && setIsGlossaryOpen(false)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setIsGlossaryOpen(false);
                            }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label="Close submap legend"
                    >
                        
                        
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl max-w-md w-full max-h-[70vh] overflow-y-auto scrollable-content border border-gray-600">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-lg font-semibold text-amber-400">Submap Legend</h3>
                                <button onClick={toggleGlossary} className="text-gray-300 hover:text-white text-xl">&times;</button>
                            </div>
                            <GlossaryDisplay items={glossaryItems} title="" />
                        </div>
                    </div>
                )}

                {isQuickTravelMode && (
                    <div
                        className="fixed bg-gray-900/80 text-white text-xs px-2 py-1 rounded-md shadow-lg pointer-events-none"
                        style={{ top: mousePosition.y + 20, left: mousePosition.x + 20, zIndex: 100 }}
                    >
                        {quickTravelData.isBlocked ? (
                            <span className="text-red-400 font-bold">Path Blocked</span>
                        ) : (
                            quickTravelData.path.size > 0 ? `Travel Time: ${quickTravelData.time} minutes` : 'Select a tile to travel'
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
export default SubmapPane;
