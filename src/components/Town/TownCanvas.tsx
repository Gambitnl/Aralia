import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { AssetPainter } from '../../services/RealmSmithAssetPainter';
import { Building, BuildingType } from '../../types/realmsmith';
import { TownPosition, TownDirection, TOWN_DIRECTION_VECTORS } from '../../types/town';
import { PlayerCharacter } from '../../types/character';
import type { Action } from '../../types';
import { isPositionWalkable, getAdjacentBuildings } from '../../utils/walkabilityUtils';
import TownNavigationControls from './TownNavigationControls';
import { TownDevControls } from './TownDevControls';
import { RefreshCw, ZoomIn, ZoomOut, Maximize, Moon, Sun, Grid, Settings, X, User } from 'lucide-react';
import { useTownController } from '../../hooks/useTownController';
import { CharacterVisualConfig } from '../../services/CharacterAssetService';
import { useAmbientLife } from '../../hooks/useAmbientLife';
import { useTownAnimation } from './hooks/useTownAnimation';
import { useTownCamera } from './hooks/useTownCamera';
import { useTownPointerHandlers } from './hooks/useTownPointerHandlers';
import { BUILDING_DESCRIPTIONS, COMMERCIAL_BUILDING_TYPES } from './townMetadata';
import { mapTownBiome, TOWN_TILE_SIZE_PX } from './townUtils';

// Tavern/inn buildings expose a secondary "Hire" affordance: the keeper can be
// invited to join the party. Only the drinking-house subset of commercial
// buildings is recruitable. (`OPEN_DYNAMIC_MERCHANT` with `hire:true` routes
// through the shared recruit pipeline in handleMerchantInteraction.) The town
// building enum has no dedicated INN type yet, so TAVERN is the lone member
// today — kept as a Set so an INN type slots in without touching call sites.
const HIREABLE_BUILDING_TYPES = new Set<BuildingType>([
    BuildingType.TAVERN,
]);

const isHireableBuilding = (type: BuildingType): boolean =>
    HIREABLE_BUILDING_TYPES.has(type);

interface TownCanvasProps {
    worldSeed: number;
    worldX: number;
    worldY: number;
    biome: string;
    settlementInfo?: unknown; // Settlement type information for culturally appropriate generation
    onAction: (action: Action) => void;
    // Additional props to match VillageScene signature if needed
    gameTime?: Date;
    currentLocation?: unknown;
    npcsInLocation?: unknown[];
    itemsInLocation?: unknown[];
    disabled?: boolean;
    geminiGeneratedActions?: Action[] | null;
    isDevDummyActive?: boolean;
    unreadDiscoveryCount?: number;
    hasNewRateLimitError?: boolean;
    // Player navigation props
    playerCharacter?: PlayerCharacter;
    playerPosition?: TownPosition;
    /** Direction player entered the town from (north/east/south/west) - affects spawn position */
    entryDirection?: 'north' | 'east' | 'south' | 'west' | null;
    onPlayerMove?: (direction: TownDirection) => void;
    onExitTown?: () => void;
}


const isCharacterVisualConfig = (
    visuals: PlayerCharacter['visuals']
): visuals is PlayerCharacter['visuals'] & CharacterVisualConfig => {
    return (
        typeof (visuals as CharacterVisualConfig)?.clothing === 'string' &&
        typeof (visuals as CharacterVisualConfig)?.hairColor === 'string'
    );
};

const resolvePlayerVisuals = (visuals?: PlayerCharacter['visuals']): CharacterVisualConfig | undefined => {
    if (!visuals) return undefined;
    if (isCharacterVisualConfig(visuals)) {
        return visuals;
    }

    return {
        gender: visuals.gender,
        skinColor: visuals.skinColor,
        hairStyle: visuals.hairStyle ?? 'Hair1',
        hairColor: 'Black',
        clothing: visuals.clothingStyle ?? 'Clothing1',
    };
};

const TownCanvas: React.FC<TownCanvasProps> = ({
    worldSeed,
    worldX,
    worldY,
    biome: araliaBiome,
    settlementInfo: _settlementInfo,
    onAction,
    gameTime: _gameTime,
    disabled = false,
    isDevDummyActive = false,
    unreadDiscoveryCount: _unreadDiscoveryCount,
    hasNewRateLimitError: _hasNewRateLimitError,
    playerCharacter,
    playerPosition,
    entryDirection,
    onPlayerMove,
    onExitTown,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // We attach a non-passive wheel listener directly to the viewport element so
    // we can reliably call `preventDefault()` for zoom (React's onWheel can end up
    // passive in some browser paths, which produces console errors + page scroll).
    const mainRef = useRef<HTMLElement | null>(null);

    // Deterministic seed based on world coords
    const townSeed = useMemo(() => {
        return worldSeed + (worldX * 1000) + worldY;
    }, [worldSeed, worldX, worldY]);

    // Initialize Town Controller
    const { state: townState, actions: townActions } = useTownController({
        townSeed,
        initialBiome: mapTownBiome(araliaBiome),
        entryDirection,
        playerPosition
    });

    // Destructure state for easier access
    const {
        seed, biome, density, connections,
        mapData, loading,
        localPlayerPosition,
        zoom, pan, isNight, showGrid,
        hoveredBuilding, hoverPos
    } = townState;

    const {
        setSeed, setBiome, setDensity, setConnections,
        generateMap,
        setZoom, setPan, setIsNight, setShowGrid,
        setHoveredBuilding, setHoverPos,
        resetView,
        setLocalPlayerPosition
    } = townActions;

    // Use external playerPosition if provided, otherwise use local state
    const effectivePlayerPosition = playerPosition ?? localPlayerPosition;

    // Ambient Life (NPCs)
    const ambientNpcs = useAmbientLife(mapData, townSeed);

    const { animatedPosition, isAnimating, playerFacing } = useTownAnimation(effectivePlayerPosition);
    const { setIsCameraLocked, jumpToPlayer, handleResetView } = useTownCamera({
        animatedPosition,
        effectivePlayerPosition,
        mapData,
        canvasRef,
        zoom,
        setPan,
        resetView,
    });

    const {
        isDragging,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        didDragRef,
        getBuildingAtClientPos,
        getNpcAtClientPos,
    } = useTownPointerHandlers({
        canvasRef,
        mapData,
        ambientNpcs,
        pan,
        zoom,
        hoveredBuilding,
        setHoveredBuilding,
        setHoverPos,
        setPan,
        setIsCameraLocked,
    });

    const [showDevControls, setShowDevControls] = useState(false);

    // Painting Effect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !mapData) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error("Could not get 2D rendering context.");
            return;
        }

        // Why: By moving the canvas sizing and painting logic into this useEffect,
        // we guarantee that it only runs when both the mapData is available and
        // the canvas element has been mounted to the DOM. This prevents the race
        // condition that was causing the "cannot read properties of null" error.
        canvas.width = mapData.width * TOWN_TILE_SIZE_PX;
        canvas.height = mapData.height * TOWN_TILE_SIZE_PX;

        // Clear canvas
        ctx.fillStyle = '#111827'; // Tailwind gray-900
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        try {
            const painter = new AssetPainter(ctx);
            painter.drawMap(mapData.tiles, mapData.buildings, mapData.biome, {
                isNight,
                showGrid,
                // Use animated position for smooth movement, fall back to effectivePlayerPosition
                playerPosition: animatedPosition ?? effectivePlayerPosition ?? undefined,
                playerFacing,
                isMoving: isAnimating,
                playerVisuals: resolvePlayerVisuals(playerCharacter?.visuals),
                npcs: ambientNpcs
            });
        } catch (err) {
            console.error("AssetPainter failed:", err);
            ctx.fillStyle = '#ef4444'; // Red error for visibility
            ctx.font = '16px sans-serif';
            ctx.fillText("Rendering Error. Check console for details.", 20, 30);
        }
    // TODO(lint-intent): If player visuals are large, memoize resolvePlayerVisuals output upstream to reduce redraws.
    }, [mapData, isNight, showGrid, effectivePlayerPosition, animatedPosition, playerFacing, isAnimating, playerCharacter?.visuals]);

    const handleDownload = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `town-${biome.toLowerCase()}-${seed}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
    };

    const handleRandomize = () => {
        setSeed(Math.floor(Math.random() * 100000));
    };

    const toggleConnection = (dir: keyof typeof connections) => {
        setConnections({ ...connections, [dir]: !connections[dir] });
    };

    // Local movement handler (used when no external onPlayerMove is provided)
    const handleLocalMove = useCallback((direction: TownDirection) => {
        if (!mapData || !effectivePlayerPosition) return;

        const delta = TOWN_DIRECTION_VECTORS[direction];
        const targetPos = {
            x: effectivePlayerPosition.x + delta.x,
            y: effectivePlayerPosition.y + delta.y,
        };

        if (isPositionWalkable(targetPos, mapData)) {
            setLocalPlayerPosition(targetPos);
        }
    }, [mapData, effectivePlayerPosition, setLocalPlayerPosition]);

    // Use external move handler if provided, otherwise use local
    const handleMove = onPlayerMove ?? handleLocalMove;

    useEffect(() => {
        const el = mainRef.current;
        if (!el) return;

        // Zoom with the mouse wheel. This is intentionally attached with
        // `{ passive: false }` so we can prevent the browser from scrolling the page.
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const scaleAmount = -e.deltaY * 0.001;
            setZoom(z => Math.min(Math.max(0.5, z + scaleAmount * z), 3));
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel as EventListener);
    }, [setZoom]);

    const openBuilding = useCallback((building: Building) => {
        const isCommercial = COMMERCIAL_BUILDING_TYPES.has(building.type);
        const buildingName = BUILDING_DESCRIPTIONS[building.type]?.name || 'Unknown Building';

        if (isCommercial) {
            onAction({
                type: 'OPEN_DYNAMIC_MERCHANT',
                label: `Visit ${buildingName}`,
                payload: {
                    merchantType: building.type,
                    buildingId: building.id
                }
            });
        } else {
            // Non-commercial interaction (Flavor text / Description)
            onAction({
                type: 'custom',
                label: `Examine ${buildingName}`,
                payload: {
                    villageContext: {
                        worldX,
                        worldY,
                        biomeId: biome, // Note: biome is string here, mapped from araliaBiome
                        buildingId: building.id,
                        buildingType: building.type,
                        description: `You stand before the ${buildingName}. ${BUILDING_DESCRIPTIONS[building.type]?.desc}`,
                        // Stub integration fields for now, as TownCanvas doesn't have full VillageLayout context
                        integrationProfileId: 'generic',
                        integrationPrompt: '',
                        integrationTagline: '',
                        culturalSignature: '',
                        encounterHooks: []
                    }
                }
            });
        }
    }, [onAction, worldX, worldY, biome]);

    // Secondary "Hire <name>" affordance for tavern/inn buildings. Dispatches the
    // same OPEN_DYNAMIC_MERCHANT action with `hire:true` so the merchant handler
    // short-circuits the browse flow and runs the recruit pipeline instead.
    const hireBuildingKeeper = useCallback((building: Building) => {
        if (!isHireableBuilding(building.type)) return;
        const buildingName = BUILDING_DESCRIPTIONS[building.type]?.name || 'Tavern';
        onAction({
            type: 'OPEN_DYNAMIC_MERCHANT',
            label: `Hire the ${buildingName} keeper`,
            payload: {
                merchantType: building.type,
                buildingId: building.id,
                hire: true,
            },
        });
    }, [onAction]);

    const handleBuildingClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[data-no-pan]')) return;
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }

        // Check for NPC click first
        const npcId = getNpcAtClientPos(e.clientX, e.clientY);
        if (npcId) {
            onAction({
                type: 'START_DIALOGUE_SESSION',
                label: 'Talk to Villager',
                payload: { npcId }
            });
            return;
        }

        const building = getBuildingAtClientPos(e.clientX, e.clientY);
        if (!building) return;

        openBuilding(building);
    };

    const handleBuildingKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            if (hoveredBuilding) {
                event.preventDefault();
                openBuilding(hoveredBuilding);
            }
        }
    };

    // Compute blocked directions for navigation
    const blockedDirections = useMemo((): TownDirection[] => {
        if (!mapData || !effectivePlayerPosition) return [];
        const blocked: TownDirection[] = [];
        const directions: TownDirection[] = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

        for (const dir of directions) {
            const delta = TOWN_DIRECTION_VECTORS[dir];
            const targetPos = {
                x: effectivePlayerPosition.x + delta.x,
                y: effectivePlayerPosition.y + delta.y,
            };
            if (!isPositionWalkable(targetPos, mapData)) {
                blocked.push(dir);
            }
        }
        return blocked;
    }, [mapData, effectivePlayerPosition]);

    // Get adjacent buildings for interaction display
    const adjacentBuildingData = useMemo(() => {
        if (!mapData || !effectivePlayerPosition) return [];
        const buildingIds = getAdjacentBuildings(effectivePlayerPosition, mapData);
        return buildingIds.map(id => {
            const building = mapData.buildings.find(b => b.id === id);
            if (!building) return null;
            const desc = BUILDING_DESCRIPTIONS[building.type];
            return {
                id: building.id,
                name: desc?.name || 'Unknown Building',
                type: building.type,
            };
        }).filter(Boolean) as Array<{ id: string; name: string; type: string }>;
    }, [mapData, effectivePlayerPosition]);

    // Adjacent tavern/inn buildings that expose the "Hire" affordance. Resolved
    // from the live building list so we can dispatch the typed hire action.
    const hireableAdjacentBuildings = useMemo(() => {
        if (!mapData) return [];
        return adjacentBuildingData
            .map(({ id }) => mapData.buildings.find(b => b.id === id))
            .filter((b): b is Building => !!b && isHireableBuilding(b.type));
    }, [mapData, adjacentBuildingData]);

    return (
        /* TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
        TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
        TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
        */
        <div className="relative w-full h-full bg-gray-900 text-gray-100 overflow-hidden">
            {/* Dev Controls Panel (Slide-in) */}
            {isDevDummyActive && showDevControls && (
                <div className="absolute top-0 left-0 z-[var(--z-index-modal-background)] h-full w-80 bg-gray-900/95 border-r border-gray-700 shadow-2xl p-4 overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-white">Dev Controls</h2>
                        <button
                            type="button"
                            onClick={() => setShowDevControls(false)}
                            className="p-1 hover:bg-gray-700 rounded"
                            title="Close Dev Controls"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <TownDevControls
                        seed={seed}
                        setSeed={setSeed}
                        handleRandomize={handleRandomize}
                        biome={biome}
                        setBiome={setBiome}
                        density={density}
                        setDensity={setDensity}
                        connections={connections}
                        toggleConnection={toggleConnection}
                        loading={loading}
                        generateMap={generateMap}
                        onAction={onAction}
                        handleDownload={handleDownload}
                    />
                </div>
            )}

            {/* Main Canvas Viewport - fills entire area */}
            
            
            <main
                ref={mainRef}
                className={`relative w-full h-full bg-gray-950 touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={handleBuildingClick}
                onKeyDown={handleBuildingKeyDown}
                role="button"
                tabIndex={0}
                aria-label="Town map viewport"
            >
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[var(--z-index-minimap)] bg-opacity-90">
                        <RefreshCw size={48} className="animate-spin text-blue-500 mb-4" />
                        <h2 className="text-xl font-serif animate-pulse">Forging World...</h2>
                    </div>
                )}

                {/* Tooltip */}
                {hoveredBuilding && hoverPos && (
                    <div
                        className="absolute z-[var(--z-index-content-overlay-medium)] pointer-events-none bg-gray-900/95 border border-gray-600 rounded-lg shadow-xl p-3 text-left min-w-[200px]"
                        style={{
                            top: hoverPos.y + 15,
                            left: hoverPos.x + 15,
                            // Keep tooltip on screen if near edge
                            transform: hoverPos.x > window.innerWidth - 250 ? 'translateX(-100%)' : 'none'
                        }}
                    >
                        <h3 className="text-yellow-400 font-serif font-bold text-lg">
                            {BUILDING_DESCRIPTIONS[hoveredBuilding.type]?.name || 'Unknown Building'}
                        </h3>
                        <div className="h-px bg-gray-700 my-2"></div>
                        <p className="text-gray-300 text-sm italic">
                            {BUILDING_DESCRIPTIONS[hoveredBuilding.type]?.desc}
                        </p>
                        <div className="mt-2 text-xs text-gray-500 font-mono">
                            Size: {hoveredBuilding.width * 5}ft x {hoveredBuilding.height * 5}ft
                        </div>
                        <div className="mt-2 text-xs text-blue-400 font-bold">
                            Click to Interact
                        </div>
                    </div>
                )}

                {/* Top Left Controls - Dev Toggle + Info */}
                <div className="fixed top-4 left-4 z-[var(--z-index-submap-overlay)] flex gap-2" data-no-pan>
                    {isDevDummyActive && (
                        <button
                            type="button"
                            onClick={() => setShowDevControls(!showDevControls)}
                            className={`p-2 rounded-lg transition-colors shadow-lg border ${showDevControls ? 'bg-amber-600 text-white border-amber-500' : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'}`}
                            title="Toggle Dev Controls"
                        >
                            <Settings size={20} />
                        </button>
                    )}
                    <div className="pointer-events-none opacity-60 flex items-center gap-2 bg-black/40 p-2 rounded text-xs text-gray-300">
                        <span>Scroll to Zoom</span>
                    </div>
                </div>

                {/* Map Toggles (Top Right) */}
                <div className="fixed top-4 right-4 flex gap-2 z-[var(--z-index-submap-overlay)]" data-no-pan>
                    <button
                        type="button"
                        onClick={() => setIsNight(!isNight)}
                        className={`p-2 rounded-lg transition-colors shadow-lg flex items-center gap-2 text-sm font-medium ${isNight ? 'bg-indigo-900 text-indigo-200 border border-indigo-500' : 'bg-yellow-100 text-orange-600 border border-yellow-300'}`}
                        title="Toggle Day/Night"
                    >
                        {isNight ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowGrid(!showGrid)}
                        className={`p-2 rounded-lg transition-colors shadow-lg border ${showGrid ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'}`}
                        title="Toggle Grid"
                    >
                        <Grid size={18} />
                    </button>
                </div>

                {/* Zoom Controls (Bottom Right) */}
                <div className="fixed bottom-4 right-4 flex flex-col gap-1 z-[var(--z-index-submap-overlay)] bg-gray-800/80 backdrop-blur p-1.5 rounded-lg border border-gray-700" data-no-pan>
                    <button type="button" onClick={() => setZoom(z => Math.min(z + 0.2, 3))} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors" title="Zoom In">
                        <ZoomIn size={18} />
                    </button>
                    <button type="button" onClick={jumpToPlayer} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Jump to Player" disabled={!effectivePlayerPosition}>
                        <User size={18} />
                    </button>
                    <button type="button" onClick={handleResetView} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors" title="Reset View">
                        <Maximize size={18} />
                    </button>
                    <button type="button" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors" title="Zoom Out">
                        <ZoomOut size={18} />
                    </button>
                </div>

                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                    <div
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: 'center',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            className="max-w-none shadow-2xl rounded-sm"
                            style={{ imageRendering: 'pixelated' }}
                        />
                    </div>
                </div>
            </main>

            {/* Hire affordance - tavern/inn keepers adjacent to the player can be
                invited to join the party (routes through OPEN_DYNAMIC_MERCHANT
                with hire:true). Rendered above the nav pad when available. */}
            {effectivePlayerPosition && hireableAdjacentBuildings.length > 0 && (
                <div className="fixed bottom-44 left-4 z-[var(--z-index-minimap)] flex flex-col gap-2" data-no-pan>
                    {hireableAdjacentBuildings.map((building) => {
                        const buildingName = BUILDING_DESCRIPTIONS[building.type]?.name || 'Tavern';
                        return (
                            <button
                                key={`hire-${building.id}`}
                                type="button"
                                onClick={() => hireBuildingKeeper(building)}
                                disabled={disabled}
                                className="px-3 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-amber-50 border border-amber-500 shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                                title={`Offer the ${buildingName} keeper a place in your party`}
                                aria-label={`Hire the ${buildingName} keeper`}
                            >
                                Hire the {buildingName} keeper
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Navigation Controls - shown when player position is available */}
            {effectivePlayerPosition && (
                <div className="fixed bottom-4 left-4 z-[var(--z-index-minimap)]" data-no-pan>
                    <TownNavigationControls
                        onMove={handleMove}
                        onExit={onExitTown ?? (() => { })}
                        blockedDirections={blockedDirections}
                        disabled={disabled}
                        adjacentBuildings={adjacentBuildingData}
                        onBuildingInteract={(buildingId) => {
                            const building = mapData?.buildings.find(b => b.id === buildingId);
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

// Wrap TownCanvas with React.memo to prevent unnecessary re-renders
// TownCanvas renders complex SVG/Canvas graphics for the town view, which is expensive to re-render.
// By memoizing it, we ensure it only re-renders when the town state or related props change,
// not when unrelated game state (like inventory or character stats) updates.
export default React.memo(TownCanvas);
