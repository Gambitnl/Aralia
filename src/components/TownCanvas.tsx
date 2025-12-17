import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { TownGenerator } from '../services/RealmSmithTownGenerator';
import { AssetPainter } from '../services/RealmSmithAssetPainter';
import { TownOptions, BiomeType, TownDensity, BuildingType, Building, TownMap } from '../types/realmsmith';
import { TownPosition, TownDirection, TOWN_DIRECTION_VECTORS } from '../types/town';
import { isPositionWalkable, getAdjacentBuildings } from '../utils/walkabilityUtils';
import TownNavigationControls from './TownNavigationControls';
import { TownDevControls } from './TownDevControls';
import { RefreshCw, Map as MapIcon, Sparkles, ZoomIn, ZoomOut, Maximize, Move, Moon, Sun, Grid } from 'lucide-react';

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
    onPlayerMove?: (direction: TownDirection) => void;
    onExitTown?: () => void;
}

const TownCanvas: React.FC<TownCanvasProps> = ({
    worldSeed,
    worldX,
    worldY,
    biome: araliaBiome,
    settlementInfo,
    onAction,
    gameTime,
    disabled = false,
    isDevDummyActive = false,
    playerPosition,
    onPlayerMove,
    onExitTown,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // State for Generation Options
    const [seed, setSeed] = useState<number>(townSeed);
    const [biome, setBiome] = useState<BiomeType>(mapBiome(araliaBiome));
    const [density, setDensity] = useState<TownDensity>(TownDensity.MEDIUM);
    const [connections, setConnections] = useState({
        north: true,
        east: true,
        south: true,
        west: true
    });

    // Update state when props change
    useEffect(() => {
        setSeed(townSeed);
        setBiome(mapBiome(araliaBiome));
    }, [townSeed, araliaBiome]);

    // View Options
    const [isNight, setIsNight] = useState(false);
    const [showGrid, setShowGrid] = useState(false);

    const [loading, setLoading] = useState<boolean>(false);
    const [mapData, setMapData] = useState<TownMap | null>(null);

    // Viewport State (Zoom/Pan)
    const [zoom, setZoom] = useState<number>(1);
    const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

    // Hover State
    const [hoveredBuilding, setHoveredBuilding] = useState<Building | null>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null);

    // Generate function
    const generateMap = () => {
        setLoading(true);
        setHoveredBuilding(null);
        // TODO: Cancel pending generation/painter work on unmount or prop changes (Reason: the setTimeout + canvas draws can fire after navigation and set state on an unmounted component; Expectation: smoother transitions without leaking contexts or triggering React warnings).
        // TODO: Offload town generation/painting to a worker or chunked loop; the current synchronous run can still freeze the main thread even with the 50ms defer.
        // Yield to UI thread so loading spinner shows
        setTimeout(() => {
            try {
                const options: TownOptions = {
                    seed,
                    biome,
                    density,
                    connections
                };
                const generator = new TownGenerator(options);
                const map = generator.generate();
                setMapData(map);
            } catch (error) {
                console.error("Failed to generate map:", error);
            } finally {
                setLoading(false);
                // Reset view on regenerate
                setZoom(1);
                setPan({ x: 0, y: 0 });
            }
        }, 50);
    };

    // Effect to generate on any param change
    useEffect(() => {
        generateMap();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seed, biome, density, connections]);

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
            painter.drawMap(mapData.tiles, mapData.buildings, mapData.biome, { isNight, showGrid });
        } catch (err) {
            console.error("AssetPainter failed:", err);
            ctx.fillStyle = '#ef4444'; // Red error for visibility
            ctx.font = '16px sans-serif';
            ctx.fillText("Rendering Error. Check console for details.", 20, 30);
        }

    }, [mapData, isNight, showGrid, playerPosition]);

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
        setConnections(prev => ({ ...prev, [dir]: !prev[dir] }));
    };

    // --- Zoom & Pan Handlers ---

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault(); // Prevent browser zoom
        }
        // Zoom logic
        const scaleAmount = -e.deltaY * 0.001;
        const newZoom = Math.min(Math.max(0.1, zoom + scaleAmount * zoom), 5);
        setZoom(newZoom);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Panning disabled - only clear tooltip on click
        setHoveredBuilding(null); // Clear tooltip on click
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Panning disabled - only handle hover (Building Detection)
        if (canvasRef.current && mapData) {
            const rect = canvasRef.current.getBoundingClientRect();

            // Check if mouse is within canvas bounds
            if (
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom
            ) {
                // Map screen coordinates to internal canvas coordinates
                const scaleX = canvasRef.current.width / rect.width;
                const scaleY = canvasRef.current.height / rect.height;

                const canvasX = (e.clientX - rect.left) * scaleX;
                const canvasY = (e.clientY - rect.top) * scaleY;

                // TILE_SIZE is 32
                const tileX = Math.floor(canvasX / 32);
                const tileY = Math.floor(canvasY / 32);

                if (tileX >= 0 && tileX < mapData.width && tileY >= 0 && tileY < mapData.height) {
                    const tile = mapData.tiles[tileX][tileY];
                    if (tile.buildingId) {
                        const building = mapData.buildings.find(b => b.id === tile.buildingId);
                        if (building && building !== hoveredBuilding) {
                            setHoveredBuilding(building);
                            setHoverPos({ x: e.clientX, y: e.clientY });
                        } else if (building) {
                            // Update pos only
                            setHoverPos({ x: e.clientX, y: e.clientY });
                        }
                        return;
                    }
                }
            }
            // Clear if not hovering a building
            setHoveredBuilding(null);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleBuildingClick = (e: React.MouseEvent) => {
        if (hoveredBuilding) {
            // Map Realmsmith building types to Aralia actions
            // This is a basic mapping, can be expanded
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

    const resetView = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    // Compute blocked directions for navigation
    const blockedDirections = useMemo((): TownDirection[] => {
        if (!mapData || !playerPosition) return [];
        const blocked: TownDirection[] = [];
        const directions: TownDirection[] = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

        for (const dir of directions) {
            const delta = TOWN_DIRECTION_VECTORS[dir];
            const targetPos = {
                x: playerPosition.x + delta.x,
                y: playerPosition.y + delta.y,
            };
            if (!isPositionWalkable(targetPos, mapData)) {
                blocked.push(dir);
            }
        }
        return blocked;
    }, [mapData, playerPosition]);

    // Get adjacent buildings for interaction display
    const adjacentBuildingData = useMemo(() => {
        if (!mapData || !playerPosition) return [];
        const buildingIds = getAdjacentBuildings(playerPosition, mapData);
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
    }, [mapData, playerPosition]);

    return (
        <div className="flex flex-col items-center w-full h-full min-h-screen bg-gray-900 text-gray-100 p-6">

            {/* Header & Controls */}
            <header className="w-full flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-6">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                        <MapIcon size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-wider text-white">Town View</h1>
                        <p className="text-gray-400 text-sm">Procedural Generation</p>
                    </div>
                </div>

                {isDevDummyActive && (
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
                )}
            </header>

            {/* Main Canvas Viewport */}
            <main
                className="relative w-full flex-1 bg-gray-950 rounded-xl overflow-hidden border-4 border-gray-800 shadow-2xl"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleBuildingClick} // Added click handler
                onWheel={handleWheel}
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

                {/* Map Toggles (Top Right) */}
                <div className="absolute top-6 right-6 flex gap-2 z-20">
                    <button
                        onClick={() => setIsNight(!isNight)}
                        className={`p-3 rounded-lg transition-colors shadow-lg flex items-center gap-2 font-bold ${isNight ? 'bg-indigo-900 text-indigo-200 border border-indigo-500' : 'bg-yellow-100 text-orange-600 border border-yellow-300'}`}
                        title="Toggle Day/Night"
                    >
                        {isNight ? <Moon size={20} /> : <Sun size={20} />}
                        <span>{isNight ? 'Night' : 'Day'}</span>
                    </button>
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        className={`p-3 rounded-lg transition-colors shadow-lg border ${showGrid ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-400 border-gray-600 hover:bg-gray-700'}`}
                        title="Toggle Grid"
                    >
                        <Grid size={20} />
                    </button>
                </div>

                {/* Zoom Controls (Bottom Right) */}
                <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20 bg-gray-800/80 backdrop-blur p-2 rounded-lg border border-gray-700">
                    <button onClick={() => setZoom(z => Math.min(z + 0.2, 5))} className="p-2 hover:bg-gray-700 rounded text-white transition-colors" title="Zoom In">
                        <ZoomIn size={20} />
                    </button>
                    <button onClick={resetView} className="p-2 hover:bg-gray-700 rounded text-white transition-colors" title="Reset View">
                        <Maximize size={20} />
                    </button>
                    <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.1))} className="p-2 hover:bg-gray-700 rounded text-white transition-colors" title="Zoom Out">
                        <ZoomOut size={20} />
                    </button>
                </div>

                {/* Drag Indicator */}
                <div className="absolute top-4 left-4 z-20 pointer-events-none opacity-50 flex items-center gap-2 bg-black/40 p-2 rounded text-xs">
                    <span>Scroll to Zoom</span>
                </div>

                <div className="w-full h-full flex items-center justify-center cursor-default overflow-hidden">
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

            {/* Navigation Controls - shown when in player navigation mode */}
            {playerPosition && onPlayerMove && onExitTown && (
                <div className="fixed bottom-6 left-6 z-30">
                    <TownNavigationControls
                        onMove={onPlayerMove}
                        onExit={onExitTown}
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

            <footer className="mt-6 text-gray-500 text-xs flex gap-6">
                <span>Left-Click: View Details (N/A)</span>
                <span>Scroll: Zoom ({Math.round(zoom * 100)}%)</span>
                <span>Generated with &lt;Canvas /&gt;</span>
            </footer>
        </div>
    );
};

export default TownCanvas;
