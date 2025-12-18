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
import { SUBMAP_DIMENSIONS } from '../../config/mapConfig';
import { Action, InspectSubmapTilePayload, Location, MapData, BiomeVisuals, PlayerCharacter, NPC, Item, SeededFeatureConfig, GlossaryDisplayItem } from '../../types';
import { BattleMapData, BattleMapTile } from '../../types/combat';
import GlossaryDisplay from '../Glossary/GlossaryDisplay';
import { SUBMAP_ICON_MEANINGS } from '../../data/glossaryData';
import { useSubmapProceduralData, PathDetails } from '../../hooks/useSubmapProceduralData';
import CompassPane from '../CompassPane';
import { biomeVisualsConfig, defaultBiomeVisuals } from '../../config/submapVisualsConfig';
import { findPath } from '../../utils/pathfinding';
import { getTimeOfDay, getTimeModifiers, TimeOfDay } from '../../utils/timeUtils';
import ActionPane from '../ActionPane';
import SubmapTile from './SubmapTile';
import { CaTileType } from '../../services/cellularAutomataService';
import SubmapRendererPixi from './SubmapRendererPixi';

// Modularized imports
import { submapTileHints } from './submapData';
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

interface SubmapPathNode {
    id: string;
    coordinates: { x: number; y: number };
    movementCost: number;
    blocksMovement: boolean;
    terrain?: any;
    elevation?: any;
    blocksLoS?: any;
    decoration?: any;
    effects?: any;
}

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

const getDayNightOverlayClass = (gameTime: Date): string => {
    const timeOfDay = getTimeOfDay(gameTime);
    switch (timeOfDay) {
        case TimeOfDay.Dusk:
            return 'bg-amber-700/20 mix-blend-overlay';
        case TimeOfDay.Night:
            return 'bg-indigo-900/40 mix-blend-multiply';
        case TimeOfDay.Dawn:
            return 'bg-amber-300/10 mix-blend-soft-light';
        default:
            return '';
    }
};


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
    const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
    const [isInspecting, setIsInspecting] = useState(false);
    const [inspectionMessage, setInspectionMessage] = useState<string | null>(null);

    // --- NEW STATE FOR QUICK TRAVEL ---
    const [isQuickTravelMode, setIsQuickTravelMode] = useState(false);
    const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
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

    const pathfindingGrid = useMemo(() => {
        const grid = new Map<string, SubmapPathNode>();
        for (let r = 0; r < submapDimensions.rows; r++) {
            for (let c = 0; c < submapDimensions.cols; c++) {
                const visuals = getTileVisuals(r, c);
                const { effectiveTerrainType } = visuals;
                let movementCost = 30; // Default: 30 minutes for regular ground
                let blocksMovement = false;

                if (playerCharacter.transportMode === 'foot') {
                    if (effectiveTerrainType === 'path') {
                        movementCost = 15;
                    } else if (effectiveTerrainType === 'wall') {
                        movementCost = Infinity;
                        blocksMovement = true;
                    } else {
                        movementCost = 30;
                    }
                }
                // Future: Add 'mounted' mode logic here

                if (effectiveTerrainType === 'water') {
                    blocksMovement = true;
                    movementCost = Infinity;
                }

                // Apply Time Modifiers (e.g., Night/Winter slows travel)
                const modifiers = getTimeModifiers(gameTime);
                if (movementCost !== Infinity) {
                    movementCost *= modifiers.travelCostMultiplier;
                }

                grid.set(`${c}-${r}`, {
                    id: `${c}-${r}`,
                    coordinates: { x: c, y: r },
                    movementCost,
                    blocksMovement
                });
            }
        }
        return grid;
    }, [submapDimensions, getTileVisuals, playerCharacter, gameTime]);

    const quickTravelData = useMemo(() => {
        if (!isQuickTravelMode || !hoveredTile || !playerSubmapCoords) {
            return { path: new Set<string>(), orderedPath: [], time: 0, isBlocked: false };
        }
        const startNode = pathfindingGrid.get(`${playerSubmapCoords.x}-${playerSubmapCoords.y}`);
        const endNode = pathfindingGrid.get(`${hoveredTile.x}-${hoveredTile.y}`);

        if (!startNode || !endNode || endNode.blocksMovement) {
            return { path: new Set<string>(), orderedPath: [], time: 0, isBlocked: !!endNode?.blocksMovement };
        }

        const themeForPathfinder = ((): BattleMapData['theme'] => {
            const validThemes: BattleMapData['theme'][] = ['forest', 'cave', 'dungeon', 'desert', 'swamp'];
            if ((validThemes as string[]).includes(currentWorldBiomeId)) {
                return currentWorldBiomeId as BattleMapData['theme'];
            }
            if (currentWorldBiomeId === 'plains' || currentWorldBiomeId === 'hills') return 'forest';
            if (currentWorldBiomeId === 'mountain') return 'cave';
            return 'forest';
        })();

        const mapForPathfinder: BattleMapData = {
            dimensions: { width: submapDimensions.cols, height: submapDimensions.rows },
            tiles: pathfindingGrid as unknown as Map<string, BattleMapTile>,
            theme: themeForPathfinder,
            seed: simpleHash(0, 0, 'pathfinder_seed'),
        };

        const pathNodes = findPath(startNode as unknown as BattleMapTile, endNode as unknown as BattleMapTile, mapForPathfinder);

        if (pathNodes.length === 0 && startNode !== endNode) {
            return { path: new Set<string>(), orderedPath: [], time: 0, isBlocked: true };
        }

        const pathCoords = new Set(pathNodes.map(p => p.id));
        const orderedPath = pathNodes.map(p => p.coordinates);
        const travelTime = pathNodes.reduce((acc, node) => acc + node.movementCost, 0) - (startNode.movementCost || 0);

        return { path: pathCoords, orderedPath, time: travelTime, isBlocked: false };
    }, [isQuickTravelMode, hoveredTile, playerSubmapCoords, pathfindingGrid, submapDimensions, currentWorldBiomeId, simpleHash]);


    const getHintForTile = useCallback((submapX: number, submapY: number, effectiveTerrain: string, featureConfig: SeededFeatureConfig | null): string => {
        const tileKey = `${parentWorldMapCoords.x}_${parentWorldMapCoords.y}_${submapX}_${submapY}`;
        if (inspectedTileDescriptions[tileKey]) {
            return inspectedTileDescriptions[tileKey];
        }

        const dx = Math.abs(submapX - playerSubmapCoords.x);
        const dy = Math.abs(submapY - playerSubmapCoords.y);
        const isAdjacent = (dx <= 1 && dy <= 1) && !(dx === 0 && dy === 0);

        // Build hint keys to try in order of specificity
        const hintKeys = [];

        if (featureConfig) {
            // Try biome-specific feature hints first (e.g., 'plains_village')
            hintKeys.push(`${currentWorldBiomeId}_${featureConfig.id}`);
            // Then generic feature hints (e.g., 'village')
            hintKeys.push(featureConfig.id);
        }

        if (effectiveTerrain !== 'default') {
            // Try biome-specific terrain hints (e.g., 'plains_village_area')
            hintKeys.push(`${currentWorldBiomeId}_${effectiveTerrain}`);
            // Then generic terrain hints (e.g., 'village_area')
            hintKeys.push(effectiveTerrain);
        }

        // Fallback to biome default
        hintKeys.push(`${currentWorldBiomeId}_default`);
        hintKeys.push('default');

        if (isAdjacent) {
            // Try each hint key in order until we find one with hints
            for (const key of hintKeys) {
                if (submapTileHints[key] && submapTileHints[key].length > 0) {
                    return submapTileHints[key][simpleHash(submapX, submapY, 'hint_adj') % submapTileHints[key].length];
                }
            }
        } else {
            // For distant tiles, use feature/terrain names
            if (featureConfig?.name) return `An area featuring a ${featureConfig.name.toLowerCase()}.`;
            if (effectiveTerrain !== 'default' && effectiveTerrain !== 'path_adj' && effectiveTerrain !== 'path') return `A patch of ${effectiveTerrain.replace(/_/g, ' ')}.`;
            return `A patch of ${currentBiome?.name || 'terrain'}.`;
        }
        return submapTileHints['default'][simpleHash(submapX, submapY, 'hint_adj_fallback') % submapTileHints['default'].length];

    }, [playerSubmapCoords, simpleHash, currentWorldBiomeId, currentBiome, inspectedTileDescriptions, parentWorldMapCoords]);

    const submapGrid = useMemo(() => {
        const grid = [];
        for (let r = 0; r < submapDimensions.rows; r++) {
            for (let c = 0; c < submapDimensions.cols; c++) {
                // Only compute the visuals structure here, NOT the tooltip content
                const visuals = getTileVisuals(r, c);
                grid.push({ r, c, visuals });
            }
        }
        return grid;
    }, [submapDimensions.rows, submapDimensions.cols, getTileVisuals]);

    /**
     * OPTIMIZATION: Memoize tooltip generation.
     * We attach the computed tooltip text to the grid data so that `SubmapTile` receives a stable string.
     * This prevents 600 string generations on every render (e.g. mouse hover in Quick Travel mode).
     * `getHintForTile` updates when player moves (changing adjacency context), which is correct.
     * But it remains stable during hover events.
     */
    const submapGridWithTooltips = useMemo(() => {
        return submapGrid.map(tile => ({
            ...tile,
            tooltipContent: getHintForTile(tile.c, tile.r, tile.visuals.effectiveTerrainType, tile.visuals.activeSeededFeatureConfigForTile)
        }));
    }, [submapGrid, getHintForTile]);

    const inspectableTiles = useMemo(() => {
        const tiles = new Set<string>();
        if (!isInspecting || !playerSubmapCoords) return tiles;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const adjX = playerSubmapCoords.x + dx;
                const adjY = playerSubmapCoords.y + dy;
                if (adjX >= 0 && adjX < submapDimensions.cols && adjY >= 0 && adjY < submapDimensions.rows) {
                    tiles.add(`${adjX},${adjY}`);
                }
            }
        }
        return tiles;
    }, [isInspecting, playerSubmapCoords, submapDimensions]);

    const handleTileClickForInspection = useCallback((tileX: number, tileY: number, effectiveTerrain: string, featureConfig: SeededFeatureConfig | null) => {
        if (disabled) return;

        if (isQuickTravelMode) {
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
        setRenderMetrics(metrics);
    }, []);

    useEffect(() => () => {
        if (hoverFrameRef.current) cancelAnimationFrame(hoverFrameRef.current);
    }, []);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Simple arrow key navigation for submap inspection could be added here if desired
    };

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

    const glossaryItems: GlossaryDisplayItem[] = useMemo(() => {
        const items: GlossaryDisplayItem[] = [];
        const addedIcons = new Set<string>();

        const addIcon = (icon: string, meaningKey: string, category?: string) => {
            if (icon && !addedIcons.has(icon)) {
                items.push({ icon, meaning: SUBMAP_ICON_MEANINGS[icon] || meaningKey, category });
                addedIcons.add(icon);
            }
        };

        addIcon('🧍', 'Your Position', 'Player');
        if (visualsConfig.pathIcon) addIcon(visualsConfig.pathIcon, 'Path Marker', 'Path');
        visualsConfig.seededFeatures?.forEach(sf => addIcon(sf.icon, sf.name || sf.id, 'Seeded Feature'));
        visualsConfig.scatterFeatures?.forEach(sc => addIcon(sc.icon, `Scatter: ${sc.icon}`, 'Scatter Feature'));
        visualsConfig.pathAdjacency?.scatter?.forEach(paSc => addIcon(paSc.icon, `Path Adjacency: ${paSc.icon}`, 'Path Adjacency Scatter'));
        if (visualsConfig.caTileVisuals) {
            if (visualsConfig.caTileVisuals.wall.icon) addIcon(visualsConfig.caTileVisuals.wall.icon, 'Wall', 'Structure');
            // Implicitly handle floors if they have icons, though usually they don't
        }

        return items.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.meaning.localeCompare(b.meaning));
    }, [visualsConfig]);

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

                <div className="flex-grow flex flex-col md:flex-row gap-4 overflow-hidden min-h-0"> {/* Use overflow-hidden on parent */}
                    {/* Submap Grid Container */}
                    <div
                        className="p-1 bg-gray-900/30 rounded-md shadow-inner flex-grow overflow-auto scrollable-content relative"
                        onKeyDown={handleKeyDown}
                        onMouseLeave={() => setHoveredTile(null)}
                        onMouseMove={(e) => setMousePosition({ x: e.clientX, y: e.clientY })}
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
                            {renderMetrics && (
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
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]" onClick={(e) => e.target === e.currentTarget && setIsGlossaryOpen(false)}>
                        <div className="bg-gray-800 p-4 rounded-lg shadow-xl max-w-md w-full max-h-[70vh] overflow-y-auto scrollable-content border border-gray-600" onClick={e => e.stopPropagation()}>
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
