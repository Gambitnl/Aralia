import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { AssetPainter } from '../../services/RealmSmithAssetPainter';
import { BiomeType, BuildingType, Building } from '../../types/realmsmith';
import { TownPosition, TownDirection, TOWN_DIRECTION_VECTORS } from '../../types/town';
import { PlayerCharacter } from '../../types/character';
import type { Action } from '../../types';
import { isPositionWalkable, getAdjacentBuildings } from '../../utils/walkabilityUtils';
import TownNavigationControls from './TownNavigationControls';
import { TownDevControls } from './TownDevControls';
import { RefreshCw, ZoomIn, ZoomOut, Maximize, Moon, Sun, Grid, Settings, X, User } from 'lucide-react';
import { useTownController } from '../../hooks/useTownController';
import { CharacterVisualConfig } from '../../services/CharacterAssetService';

const BUILDING_DESCRIPTIONS: Record<BuildingType, { name: string; desc: string }> = {
    [BuildingType.HOUSE_SMALL]: { name: 'Small House', desc: 'A modest residence for common folk.' },
    [BuildingType.HOUSE_LARGE]: { name: 'Large House', desc: 'A two-story home for wealthier merchants.' },
    [BuildingType.TAVERN]: { name: 'Tavern', desc: 'The social hub, warm and inviting.' },
    [BuildingType.BLACKSMITH]: { name: 'Blacksmith', desc: 'Echoes with the sound of hammer on anvil.' },
    [BuildingType.MARKET_STALL]: { name: 'Market Stall', desc: 'Traders selling local goods and wares.' },
    [BuildingType.CHURCH]: { name: 'Church', desc: 'A peaceful sanctuary with stained glass.' },
    [BuildingType.TEMPLE]: { name: 'Temple', desc: 'A grand structure dedicated to high deities.' },
    [BuildingType.LIBRARY]: { name: 'Library', desc: 'Filled with ancient scrolls and knowledge.' },
    [BuildingType.ALCHEMIST]: { name: 'Alchemist', desc: 'Smells of sulfur and strange herbs.' },
    [BuildingType.TOWER]: { name: 'Tower', desc: 'A fortified lookout overlooking the town.' },
    [BuildingType.MANOR]: { name: 'Manor', desc: 'The luxurious estate of a noble family.' },
    [BuildingType.BARRACKS]: { name: 'Barracks', desc: 'Housing for the town guard.' },
    [BuildingType.FARM_HOUSE]: { name: 'Farm House', desc: 'A rustic home surrounded by fields.' },
    [BuildingType.WINDMILL]: { name: 'Windmill', desc: 'Grinds grain with the power of the wind.' },
    [BuildingType.LUMBER_MILL]: { name: 'Lumber Mill', desc: 'Processes timber from the nearby forest.' },
    [BuildingType.GUILD_HALL]: { name: 'Guild Hall', desc: 'A headquarters for local artisans and merchants.' },
    [BuildingType.STABLE]: { name: 'Stables', desc: 'Shelter for horses and travelers\' mounts.' },
    [BuildingType.GRANARY]: { name: 'Granary', desc: 'A large storehouse for the town\'s food supply.' },
    [BuildingType.SHRINE]: { name: 'Shrine', desc: 'A small holy site for quiet prayer.' },
    [BuildingType.SCHOOL]: { name: 'School', desc: 'A place of learning for the town\'s youth.' },
    [BuildingType.BAKERY]: { name: 'Bakery', desc: 'Fills the street with the smell of fresh bread.' },
    [BuildingType.TAILOR]: { name: 'Tailor', desc: 'Fine clothes and fabrics are sold here.' },
    [BuildingType.JEWELER]: { name: 'Jeweler', desc: 'A secure shop selling precious gems and metals.' },
};

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

// Animation constants
const MOVEMENT_DURATION_MS = 150; // Time to animate between tiles
const CAMERA_LERP_FACTOR = 0.15; // Camera smoothing (0-1, lower = smoother)

// Easing function for smooth movement
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

// Linear interpolation helper
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

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

    // Map Aralia biome to Realmsmith biome
    const mapBiome = (b: string): BiomeType => {
        switch (b) {
            case 'plains': return BiomeType.PLAINS;
            case 'forest': return BiomeType.FOREST;
            case 'mountain': return BiomeType.MOUNTAIN;
            case 'hills': return BiomeType.HIGHLANDS;
            case 'desert': return BiomeType.DESERT;
            case 'swamp': return BiomeType.SWAMP;
            case 'ocean': return BiomeType.COASTAL;
            case 'cave': return BiomeType.CRYSTAL_WASTES;
            case 'dungeon': return BiomeType.DEAD_LANDS;
            default: return BiomeType.PLAINS;
        }
    };

    // Deterministic seed based on world coords
    const townSeed = useMemo(() => {
        return worldSeed + (worldX * 1000) + worldY;
    }, [worldSeed, worldX, worldY]);

    // Initialize Town Controller
    const { state: townState, actions: townActions } = useTownController({
        townSeed,
        initialBiome: mapBiome(araliaBiome),
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

    // Animation state
    const [animatedPosition, setAnimatedPosition] = useState<TownPosition | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const previousPositionRef = useRef<TownPosition | null>(null);
    const animationStartTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);
    const [playerFacing, setPlayerFacing] = useState<TownDirection>('south');

    const [showDevControls, setShowDevControls] = useState(false);

    // --- Click-and-drag panning state ---
    // The TownCanvas camera supports two modes:
    // 1) "Locked": it smoothly follows the player (camera follow effect).
    // 2) "Free": the player can pan the view by dragging anywhere on the map.
    //
    // We keep drag bookkeeping in refs to avoid re-renders on every pointermove and to
    // ensure we always read the starting coordinates for the current drag gesture.
    const [isDragging, setIsDragging] = useState(false);
    const [isCameraLocked, setIsCameraLocked] = useState(true);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const dragStartPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const didDragRef = useRef(false);

    // Initialize animated position when effectivePlayerPosition first becomes available
    useEffect(() => {
        if (effectivePlayerPosition && !animatedPosition) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAnimatedPosition(effectivePlayerPosition);
            previousPositionRef.current = effectivePlayerPosition;
        }
    }, [effectivePlayerPosition, animatedPosition]);

    // Animation effect - triggered when effectivePlayerPosition changes
    useEffect(() => {
        if (!effectivePlayerPosition || !previousPositionRef.current) return;

        // Check if position actually changed
        const prevPos = previousPositionRef.current;
        if (prevPos.x === effectivePlayerPosition.x && prevPos.y === effectivePlayerPosition.y) return;

        // Determine facing direction based on movement
        const dx = effectivePlayerPosition.x - prevPos.x;
        const dy = effectivePlayerPosition.y - prevPos.y;

        let newFacing: TownDirection = 'south';
        if (dx > 0 && dy < 0) newFacing = 'northeast';
        else if (dx > 0 && dy > 0) newFacing = 'southeast';
        else if (dx < 0 && dy < 0) newFacing = 'northwest';
        else if (dx < 0 && dy > 0) newFacing = 'southwest';
        else if (dx > 0) newFacing = 'east';
        else if (dx < 0) newFacing = 'west';
        else if (dy < 0) newFacing = 'north';
        else if (dy > 0) newFacing = 'south';

        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPlayerFacing(newFacing);

        // Start animation
        setIsAnimating(true);
        animationStartTimeRef.current = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - animationStartTimeRef.current;
            const progress = Math.min(elapsed / MOVEMENT_DURATION_MS, 1);
            const easedProgress = easeOutCubic(progress);

            // Interpolate position
            const newX = lerp(prevPos.x, effectivePlayerPosition.x, easedProgress);
            const newY = lerp(prevPos.y, effectivePlayerPosition.y, easedProgress);

            setAnimatedPosition({ x: newX, y: newY });

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                // Animation complete
                setAnimatedPosition(effectivePlayerPosition);
                setIsAnimating(false);
                previousPositionRef.current = effectivePlayerPosition;
            }
        };

        // Cancel any existing animation
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(animate);

        // Cleanup on unmount
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [effectivePlayerPosition]);

    // Camera follow effect - smooth pan to keep player centered
    useEffect(() => {
        if (!isCameraLocked) return;
        if (!animatedPosition || !mapData || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const containerWidth = canvas.parentElement?.clientWidth || canvas.width;
        const containerHeight = canvas.parentElement?.clientHeight || canvas.height;

        const TILE_SIZE = 32;

        // Calculate target pan to center player
        const playerPixelX = animatedPosition.x * TILE_SIZE + TILE_SIZE / 2;
        const playerPixelY = animatedPosition.y * TILE_SIZE + TILE_SIZE / 2;

        // Center the player in the viewport
        const targetPanX = (containerWidth / 2) / zoom - playerPixelX;
        const targetPanY = (containerHeight / 2) / zoom - playerPixelY;

        // Smooth lerp toward target
        setPan(currentPan => ({
            x: lerp(currentPan.x, targetPanX, CAMERA_LERP_FACTOR),
            y: lerp(currentPan.y, targetPanY, CAMERA_LERP_FACTOR),
        }));
    }, [animatedPosition, isCameraLocked, mapData, setPan, zoom]);


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
        const TILE_SIZE = 32;
        canvas.width = mapData.width * TILE_SIZE;
        canvas.height = mapData.height * TILE_SIZE;

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

    // --- Zoom & Pan Handlers ---

    const getBuildingAtClientPos = useCallback((clientX: number, clientY: number): Building | null => {
        if (!canvasRef.current || !mapData) return null;
        const rect = canvasRef.current.getBoundingClientRect();

        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
            return null;
        }

        // Map screen coordinates to internal canvas coordinates
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;

        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;

        // TILE_SIZE is 32
        const tileX = Math.floor(canvasX / 32);
        const tileY = Math.floor(canvasY / 32);

        if (tileX < 0 || tileX >= mapData.width || tileY < 0 || tileY >= mapData.height) {
            return null;
        }

        const tile = mapData.tiles[tileX][tileY];
        if (!tile.buildingId) return null;

        return mapData.buildings.find(b => b.id === tile.buildingId) ?? null;
    }, [mapData]);

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

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[data-no-pan]')) return;

        // Capture the pointer so pan continues even if the cursor leaves the canvas area
        // while the mouse button remains pressed.
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        didDragRef.current = false;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        dragStartPanRef.current = { x: pan.x, y: pan.y };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (dragStartRef.current) {
            const dxPx = e.clientX - dragStartRef.current.x;
            const dyPx = e.clientY - dragStartRef.current.y;

            // Small movements during click are common; require a tiny threshold
            // before we treat the gesture as an intentional pan.
            const hasExceededThreshold = Math.abs(dxPx) > 3 || Math.abs(dyPx) > 3;
            if (!didDragRef.current && hasExceededThreshold) {
                didDragRef.current = true;
                setIsCameraLocked(false);
                setHoveredBuilding(null);
            }

            if (didDragRef.current) {
                setPan({
                    x: dragStartPanRef.current.x + dxPx / zoom,
                    y: dragStartPanRef.current.y + dyPx / zoom,
                });
            }
            return;
        }

        // Hover (Building Detection)
        const building = getBuildingAtClientPos(e.clientX, e.clientY);
        if (building && building !== hoveredBuilding) {
            setHoveredBuilding(building);
            setHoverPos({ x: e.clientX, y: e.clientY });
            return;
        }
        if (building) {
            setHoverPos({ x: e.clientX, y: e.clientY });
            return;
        }
        setHoveredBuilding(null);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragStartRef.current) return;
        setIsDragging(false);
        dragStartRef.current = null;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // Ignore if capture isn't held.
        }
    };

    const openBuilding = useCallback((building: Building) => {
        onAction({
            type: 'OPEN_DYNAMIC_MERCHANT',
            label: `Visit ${BUILDING_DESCRIPTIONS[building.type]?.name}`,
            payload: {
                merchantType: building.type,
                buildingId: building.id
            }
        });
    }, [onAction]);

    const handleBuildingClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[data-no-pan]')) return;
        if (didDragRef.current) {
            didDragRef.current = false;
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

    // Center camera on player position
    const jumpToPlayer = useCallback(() => {
        if (!effectivePlayerPosition || !canvasRef.current || !mapData) return;

        const TILE_SIZE = 32;
        const canvas = canvasRef.current;
        const containerWidth = canvas.parentElement?.clientWidth || canvas.width;
        const containerHeight = canvas.parentElement?.clientHeight || canvas.height;

        const playerPixelX = effectivePlayerPosition.x * TILE_SIZE + TILE_SIZE / 2;
        const playerPixelY = effectivePlayerPosition.y * TILE_SIZE + TILE_SIZE / 2;

        setIsCameraLocked(true);
        setPan({
            x: (containerWidth / 2) / zoom - playerPixelX,
            y: (containerHeight / 2) / zoom - playerPixelY,
        });
    }, [effectivePlayerPosition, mapData, setPan, zoom]);

    const handleResetView = useCallback(() => {
        setIsCameraLocked(true);
        resetView();
    }, [resetView]);

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

    return (
        /* TODO(lint-intent): This element is being used as an interactive control, but its semantics are incomplete.
        TODO(lint-intent): Prefer a semantic element (button/label) or add role, tabIndex, and keyboard handlers.
        TODO(lint-intent): If the element is purely decorative, remove the handlers to keep intent clear.
        */
        <div className="relative w-full h-full bg-gray-900 text-gray-100 overflow-hidden">
            {/* Dev Controls Panel (Slide-in) */}
            {isDevDummyActive && showDevControls && (
                <div className="absolute top-0 left-0 z-50 h-full w-80 bg-gray-900/95 border-r border-gray-700 shadow-2xl p-4 overflow-y-auto">
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
<<<<<<< HEAD
                onKeyDown={handleBuildingKeyDown}
                role="button"
                tabIndex={0}
                aria-label="Town map viewport"
=======
                role="img"
                aria-label="Interactive Town Map"
>>>>>>> 1fa8c21 (Apply patch /tmp/774d4dfd-e98c-4cc1-ba11-9ef5fbf50531.patch)
            >
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-30 bg-opacity-90">
                        <RefreshCw size={48} className="animate-spin text-blue-500 mb-4" />
                        <h2 className="text-xl font-serif animate-pulse">Forging World...</h2>
                    </div>
                )}

                {/* Tooltip */}
                {hoveredBuilding && hoverPos && (
                    <div
                        className="absolute z-40 pointer-events-none bg-gray-900/95 border border-gray-600 rounded-lg shadow-xl p-3 text-left min-w-[200px]"
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
                <div className="fixed top-4 left-4 z-20 flex gap-2" data-no-pan>
                    {isDevDummyActive && (
                        <button
                            type="button"
                            onClick={() => setShowDevControls(!showDevControls)}
                            className={`p-2 rounded-lg transition-colors shadow-lg border ${showDevControls ? 'bg-amber-600 text-white border-amber-500' : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'}`}
                            title="Toggle Dev Controls"
                            aria-label="Toggle Developer Controls"
                            aria-pressed={showDevControls}
                        >
                            <Settings size={20} />
                        </button>
                    )}
                    <div className="pointer-events-none opacity-60 flex items-center gap-2 bg-black/40 p-2 rounded text-xs text-gray-300">
                        <span>Scroll to Zoom</span>
                    </div>
                </div>

                {/* Map Toggles (Top Right) */}
                <div className="fixed top-4 right-4 flex gap-2 z-20" data-no-pan>
                    <button
                        type="button"
                        onClick={() => setIsNight(!isNight)}
                        className={`p-2 rounded-lg transition-colors shadow-lg flex items-center gap-2 text-sm font-medium ${isNight ? 'bg-indigo-900 text-indigo-200 border border-indigo-500' : 'bg-yellow-100 text-orange-600 border border-yellow-300'}`}
                        title="Toggle Day/Night"
                        aria-label={isNight ? "Switch to Day Mode" : "Switch to Night Mode"}
                        aria-pressed={isNight}
                    >
                        {isNight ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowGrid(!showGrid)}
                        className={`p-2 rounded-lg transition-colors shadow-lg border ${showGrid ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'}`}
                        title="Toggle Grid"
                        aria-label="Toggle Grid Overlay"
                        aria-pressed={showGrid}
                    >
                        <Grid size={18} />
                    </button>
                </div>

                {/* Zoom Controls (Bottom Right) */}
                <div className="fixed bottom-4 right-4 flex flex-col gap-1 z-20 bg-gray-800/80 backdrop-blur p-1.5 rounded-lg border border-gray-700" data-no-pan>
                    <button type="button" onClick={() => setZoom(z => Math.min(z + 0.2, 3))} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors" title="Zoom In" aria-label="Zoom In">
                        <ZoomIn size={18} />
                    </button>
                    <button type="button" onClick={jumpToPlayer} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Jump to Player" disabled={!effectivePlayerPosition} aria-label="Center on Player">
                        <User size={18} />
                    </button>
                    <button type="button" onClick={handleResetView} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors" title="Reset View" aria-label="Reset Camera View">
                        <Maximize size={18} />
                    </button>
                    <button type="button" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="p-1.5 hover:bg-gray-700 rounded text-white transition-colors" title="Zoom Out" aria-label="Zoom Out">
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

            {/* Navigation Controls - shown when player position is available */}
            {effectivePlayerPosition && (
                <div className="fixed bottom-4 left-4 z-30" data-no-pan>
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

export default TownCanvas;
