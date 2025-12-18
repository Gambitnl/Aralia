import React, { useState, useMemo } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { TownOptions, BiomeType, TownDensity, Building } from '../../types/realmsmith';
import { TownPosition, TownDirection, TOWN_DIRECTION_VECTORS } from '../../types/town';
import { isPositionWalkable, getAdjacentBuildings } from '../../utils/walkabilityUtils';
import TownNavigationControls from './TownNavigationControls';
import { TownDevControls } from './TownDevControls';
import { TownRenderer } from './TownRenderer';
import { TownTooltip } from './TownTooltip';
import { TownOverlay } from './TownOverlay';
import { useTownState } from '../../hooks/useTownState';
import { BUILDING_DESCRIPTIONS } from '../../data/town/buildings';

interface TownCanvasProps {
    worldSeed: number;
    worldX: number;
    worldY: number;
    biome: string;
    settlementInfo?: any; // Settlement type information for culturally appropriate generation
    onAction: (action: any) => void;
    // Additional props to match VillageScene signature if needed
    gameTime?: Date;
    currentLocation?: any;
    npcsInLocation?: any[];
    itemsInLocation?: any[];
    disabled?: boolean;
    geminiGeneratedActions?: any[];
    isDevDummyActive?: boolean;
    unreadDiscoveryCount?: number;
    hasNewRateLimitError?: boolean;
    // Player navigation props
    playerPosition?: TownPosition;
    /** Direction player entered the town from (north/east/south/west) - affects spawn position */
    entryDirection?: 'north' | 'east' | 'south' | 'west' | null;
    onPlayerMove?: (direction: TownDirection) => void;
    onExitTown?: () => void;
}

const TownCanvas: React.FC<TownCanvasProps> = ({
    worldSeed,
    worldX,
    worldY,
    biome: araliaBiome,
    onAction,
    disabled = false,
    isDevDummyActive = false,
    playerPosition,
    entryDirection,
    onPlayerMove,
    onExitTown,
}) => {
    // Use the custom hook for state management
    const state = useTownState({
        worldSeed,
        worldX,
        worldY,
        biome: araliaBiome,
        playerPosition,
        entryDirection,
        onPlayerMove
    });

    // Hover State
    const [hoveredBuilding, setHoveredBuilding] = useState<Building | null>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null);

    // Canvas ref for download
    const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

    const handleDownload = () => {
        if (!canvasEl) return;
        const link = document.createElement('a');
        link.download = `town-${state.biome.toLowerCase()}-${state.seed}.png`;
        link.href = canvasEl.toDataURL();
        link.click();
    };

    // --- Interaction Handlers ---

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const scaleAmount = -e.deltaY * 0.001;
        const newZoom = Math.min(Math.max(0.5, state.zoom + scaleAmount * state.zoom), 3);
        state.setZoom(newZoom);
    };

    const handleMouseDown = () => {
        setHoveredBuilding(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (canvasEl && state.mapData) {
            const rect = canvasEl.getBoundingClientRect();

            if (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            ) {
                const scaleX = canvasEl.width / rect.width;
                const scaleY = canvasEl.height / rect.height;

                const canvasX = (e.clientX - rect.left) * scaleX;
                const canvasY = (e.clientY - rect.top) * scaleY;

                const tileX = Math.floor(canvasX / 32);
                const tileY = Math.floor(canvasY / 32);

                if (tileX >= 0 && tileX < state.mapData.width && tileY >= 0 && tileY < state.mapData.height) {
                    const tile = state.mapData.tiles[tileX][tileY];
                    if (tile.buildingId) {
                        const building = state.mapData.buildings.find(b => b.id === tile.buildingId);
                        if (building && building !== hoveredBuilding) {
                            setHoveredBuilding(building);
                            setHoverPos({ x: e.clientX, y: e.clientY });
                        } else if (building) {
                            setHoverPos({ x: e.clientX, y: e.clientY });
                        }
                        return;
                    }
                }
            }
            setHoveredBuilding(null);
        }
    };

    const handleMouseUp = () => {
        state.setIsDragging(false);
    };

    const handleBuildingClick = () => {
        if (hoveredBuilding) {
            onAction({
                type: 'OPEN_DYNAMIC_MERCHANT',
                label: `Visit ${BUILDING_DESCRIPTIONS[hoveredBuilding.type]?.name}`,
                payload: {
                    merchantType: hoveredBuilding.type,
                    buildingId: hoveredBuilding.id
                }
            });
        }
    };

    // Compute blocked directions for navigation
    const blockedDirections = useMemo((): TownDirection[] => {
        if (!state.mapData || !state.effectivePlayerPosition) return [];
        const blocked: TownDirection[] = [];
        const directions: TownDirection[] = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

        for (const dir of directions) {
            const delta = TOWN_DIRECTION_VECTORS[dir];
            const targetPos = {
                x: state.effectivePlayerPosition.x + delta.x,
                y: state.effectivePlayerPosition.y + delta.y,
            };
            if (!isPositionWalkable(targetPos, state.mapData)) {
                blocked.push(dir);
            }
        }
        return blocked;
    }, [state.mapData, state.effectivePlayerPosition]);

    // Get adjacent buildings for interaction display
    const adjacentBuildingData = useMemo(() => {
        if (!state.mapData || !state.effectivePlayerPosition) return [];
        const buildingIds = getAdjacentBuildings(state.effectivePlayerPosition, state.mapData);
        return buildingIds.map(id => {
            const building = state.mapData!.buildings.find(b => b.id === id);
            if (!building) return null;
            const desc = BUILDING_DESCRIPTIONS[building.type];
            return {
                id: building.id,
                name: desc?.name || 'Unknown Building',
                type: building.type,
            };
        }).filter(Boolean) as Array<{ id: string; name: string; type: string }>;
    }, [state.mapData, state.effectivePlayerPosition]);

    return (
        <div className="relative w-full h-full bg-gray-900 text-gray-100 overflow-hidden">
            {/* Dev Controls Panel (Slide-in) */}
            {isDevDummyActive && state.showDevControls && (
                <div className="absolute top-0 left-0 z-50 h-full w-80 bg-gray-900/95 border-r border-gray-700 shadow-2xl p-4 overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-white">Dev Controls</h2>
                        <button
                            type="button"
                            onClick={() => state.setShowDevControls(false)}
                            className="p-1 hover:bg-gray-700 rounded"
                            title="Close Dev Controls"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <TownDevControls
                        seed={state.seed}
                        setSeed={state.setSeed}
                        handleRandomize={state.handleRandomize}
                        biome={state.biome}
                        setBiome={state.setBiome}
                        density={state.density}
                        setDensity={state.setDensity}
                        connections={state.connections}
                        toggleConnection={state.toggleConnection}
                        loading={state.loading}
                        generateMap={state.generateMap}
                        onAction={onAction}
                        handleDownload={handleDownload}
                    />
                </div>
            )}

            {/* Main Canvas Viewport - fills entire area */}
            <main
                className="relative w-full h-full bg-gray-950"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleBuildingClick}
                onWheel={handleWheel}
            >
                {state.loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-30 bg-opacity-90">
                        <RefreshCw size={48} className="animate-spin text-blue-500 mb-4" />
                        <h2 className="text-xl font-serif animate-pulse">Forging World...</h2>
                    </div>
                )}

                {/* Tooltip */}
                {hoveredBuilding && hoverPos && (
                    <TownTooltip hoveredBuilding={hoveredBuilding} hoverPos={hoverPos} />
                )}

                {/* Overlay Controls */}
                <TownOverlay
                    isNight={state.isNight}
                    setIsNight={state.setIsNight}
                    showGrid={state.showGrid}
                    setShowGrid={state.setShowGrid}
                    zoom={state.zoom}
                    setZoom={state.setZoom}
                    resetView={state.resetView}
                    isDevDummyActive={isDevDummyActive}
                    showDevControls={state.showDevControls}
                    setShowDevControls={state.setShowDevControls}
                />

                <TownRenderer
                    mapData={state.mapData}
                    isNight={state.isNight}
                    showGrid={state.showGrid}
                    animatedPosition={state.animatedPosition}
                    effectivePlayerPosition={state.effectivePlayerPosition}
                    playerFacing={state.playerFacing}
                    isAnimating={state.isAnimating}
                    zoom={state.zoom}
                    pan={state.pan}
                    isDragging={state.isDragging}
                    onCanvasRef={(ref) => {
                        state.setCanvasRef(ref);
                        setCanvasEl(ref);
                    }}
                />
            </main>

            {/* Navigation Controls - shown when player position is available */}
            {state.effectivePlayerPosition && (
                <div className="absolute bottom-4 left-4 z-30">
                    <TownNavigationControls
                        onMove={state.handleMove}
                        onExit={onExitTown ?? (() => {})}
                        blockedDirections={blockedDirections}
                        disabled={disabled}
                        adjacentBuildings={adjacentBuildingData}
                        onBuildingInteract={(buildingId) => {
                            const building = state.mapData?.buildings.find(b => b.id === buildingId);
                            if (building) {
                                onAction({
                                    type: 'OPEN_DYNAMIC_MERCHANT',
                                    label: `Visit ${BUILDING_DESCRIPTIONS[building.type]?.name}`,
                                    payload: {
                                        merchantType: building.type,
                                        buildingId: building.id
                                    }
                                });
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default TownCanvas;
