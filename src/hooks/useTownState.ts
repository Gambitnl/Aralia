import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { BiomeType, TownDensity, TownMap, TownOptions } from '../types/realmsmith';
import { TownPosition, TownDirection, TOWN_DIRECTION_VECTORS } from '../types/town';
import { TownGenerator } from '../services/RealmSmithTownGenerator';
import { isPositionWalkable } from '../utils/walkabilityUtils';

// Animation constants
const MOVEMENT_DURATION_MS = 150; // Time to animate between tiles
const CAMERA_LERP_FACTOR = 0.15; // Camera smoothing (0-1, lower = smoother)

// Easing function for smooth movement
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

// Linear interpolation helper
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface UseTownStateProps {
    worldSeed: number;
    worldX: number;
    worldY: number;
    biome: string;
    playerPosition?: TownPosition;
    entryDirection?: 'north' | 'east' | 'south' | 'west' | null;
    onPlayerMove?: (direction: TownDirection) => void;
}

export const useTownState = ({
    worldSeed,
    worldX,
    worldY,
    biome: araliaBiome,
    playerPosition,
    entryDirection,
    onPlayerMove
}: UseTownStateProps) => {
    // Canvas ref
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Map Aralia biome to Realmsmith biome
    const mapBiome = useCallback((b: string): BiomeType => {
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
    }, []);

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

    // View Options
    const [isNight, setIsNight] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [showDevControls, setShowDevControls] = useState(false);

    const [loading, setLoading] = useState<boolean>(false);
    const [mapData, setMapData] = useState<TownMap | null>(null);

    // Viewport State (Zoom/Pan)
    const [zoom, setZoom] = useState<number>(1);
    const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    // Local player position state (used when no external playerPosition is provided)
    const [localPlayerPosition, setLocalPlayerPosition] = useState<TownPosition | null>(null);

    // Use external playerPosition if provided, otherwise use local state
    const effectivePlayerPosition = playerPosition ?? localPlayerPosition;

    // Animation state
    const [animatedPosition, setAnimatedPosition] = useState<TownPosition | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const previousPositionRef = useRef<TownPosition | null>(null);
    const animationStartTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);
    const [playerFacing, setPlayerFacing] = useState<TownDirection>('south');

    // Update state when props change
    useEffect(() => {
        setSeed(townSeed);
        setBiome(mapBiome(araliaBiome));
    }, [townSeed, araliaBiome, mapBiome]);

    // Initialize animated position when effectivePlayerPosition first becomes available
    useEffect(() => {
        if (effectivePlayerPosition && !animatedPosition) {
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
    }, [animatedPosition, mapData, zoom]);

    // Generate function
    const generateMap = useCallback(() => {
        setLoading(true);
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

                // Initialize local player position if no external position provided
                if (!playerPosition) {
                    let targetX: number;
                    let targetY: number;
                    const centerX = Math.floor(map.width / 2);
                    const centerY = Math.floor(map.height / 2);

                    switch (entryDirection) {
                        case 'north':
                            targetX = centerX;
                            targetY = map.height - 2;
                            break;
                        case 'south':
                            targetX = centerX;
                            targetY = 1;
                            break;
                        case 'east':
                            targetX = 1;
                            targetY = centerY;
                            break;
                        case 'west':
                            targetX = map.width - 2;
                            targetY = centerY;
                            break;
                        default:
                            targetX = centerX;
                            targetY = centerY;
                    }

                    let spawnPos = { x: targetX, y: targetY };

                    if (!isPositionWalkable(spawnPos, map)) {
                        outer: for (let radius = 1; radius < Math.max(map.width, map.height); radius++) {
                            for (let dx = -radius; dx <= radius; dx++) {
                                for (let dy = -radius; dy <= radius; dy++) {
                                    const testPos = { x: targetX + dx, y: targetY + dy };
                                    if (testPos.x < 0 || testPos.x >= map.width || testPos.y < 0 || testPos.y >= map.height) {
                                        continue;
                                    }
                                    if (isPositionWalkable(testPos, map)) {
                                        spawnPos = testPos;
                                        break outer;
                                    }
                                }
                            }
                        }
                    }
                    setLocalPlayerPosition(spawnPos);
                }
            } catch (error) {
                console.error("Failed to generate map:", error);
            } finally {
                setLoading(false);
                setZoom(1);
                setPan({ x: 0, y: 0 });
            }
        }, 50);
    }, [seed, biome, density, connections, playerPosition, entryDirection]);

    // Effect to generate on any param change
    useEffect(() => {
        generateMap();
    }, [generateMap]);

    const handleRandomize = () => {
        setSeed(Math.floor(Math.random() * 100000));
    };

    const toggleConnection = (dir: keyof typeof connections) => {
        setConnections(prev => ({ ...prev, [dir]: !prev[dir] }));
    };

    const resetView = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    // Local movement handler
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
    }, [mapData, effectivePlayerPosition]);

    const handleMove = onPlayerMove ?? handleLocalMove;

    return {
        // State
        seed, setSeed,
        biome, setBiome,
        density, setDensity,
        connections, toggleConnection,
        isNight, setIsNight,
        showGrid, setShowGrid,
        showDevControls, setShowDevControls,
        loading,
        mapData,
        zoom, setZoom,
        pan, setPan,
        isDragging, setIsDragging,
        localPlayerPosition,
        effectivePlayerPosition,
        animatedPosition,
        isAnimating,
        playerFacing,

        // Actions
        generateMap,
        handleRandomize,
        handleMove,
        resetView,

        // Ref setter
        setCanvasRef: (ref: HTMLCanvasElement | null) => { canvasRef.current = ref; }
    };
};
