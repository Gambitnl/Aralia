// TODO(lint-intent): 'useMemo' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { useState, useEffect, useCallback, useMemo as _useMemo } from 'react';
import { TownGenerator } from '../services/RealmSmithTownGenerator';
import { TownOptions, BiomeType, TownDensity, Building, TownMap } from '../types/realmsmith';
// TODO(lint-intent): 'TownDirection' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { TownPosition, TownDirection as _TownDirection } from '../types/town';
import { isPositionWalkable } from '../utils/walkabilityUtils';

interface UseTownControllerProps {
    /** The deterministic seed for the town */
    townSeed: number;
    /** The initial biome type */
    initialBiome: BiomeType;
    /** Optional entry direction to determine spawn point */
    entryDirection?: 'north' | 'east' | 'south' | 'west' | null;
    /** External player position if managed by parent */
    playerPosition?: TownPosition;
}

export interface UseTownControllerReturn {
    state: {
        seed: number;
        biome: BiomeType;
        density: TownDensity;
        connections: {
            north: boolean;
            east: boolean;
            south: boolean;
            west: boolean;
        };
        mapData: TownMap | null;
        loading: boolean;
        localPlayerPosition: TownPosition | null;
        zoom: number;
        pan: { x: number; y: number };
        isNight: boolean;
        showGrid: boolean;
        hoveredBuilding: Building | null;
        hoverPos: { x: number; y: number } | null;
    };
    actions: {
        setSeed: (s: number) => void;
        setBiome: (b: BiomeType) => void;
        setDensity: (d: TownDensity) => void;
        setConnections: (c: { north: boolean; east: boolean; south: boolean; west: boolean }) => void;
        generateMap: () => void;
        setZoom: (action: number | ((prev: number) => number)) => void;
        setPan: (action: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
        setIsNight: (v: boolean) => void;
        setShowGrid: (v: boolean) => void;
        setHoveredBuilding: (b: Building | null) => void;
        setHoverPos: (p: { x: number; y: number } | null) => void;
        resetView: () => void;
        setLocalPlayerPosition: (p: TownPosition) => void;
    };
}

/**
 * Hook to manage the state and logic of the TownCanvas.
 * Encapsulates generation parameters, map data, viewport state, and interaction state.
 */
export function useTownController({
    townSeed,
    initialBiome,
    entryDirection,
    playerPosition
}: UseTownControllerProps): UseTownControllerReturn {

    // --- Generation State ---
    const [seed, setSeed] = useState<number>(townSeed);
    const [biome, setBiome] = useState<BiomeType>(initialBiome);
    const [density, setDensity] = useState<TownDensity>(TownDensity.MEDIUM);
    const [connections, setConnections] = useState({
        north: true,
        east: true,
        south: true,
        west: true
    });

    // Sync with props when they change (e.g. world navigation)
    useEffect(() => {
        setSeed(townSeed);
        setBiome(initialBiome);
    }, [townSeed, initialBiome]);

    const [mapData, setMapData] = useState<TownMap | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    // --- Player State ---
    // Local player position (used when no external playerPosition is provided)
    const [localPlayerPosition, setLocalPlayerPosition] = useState<TownPosition | null>(null);

    // --- Viewport State ---
    const [zoom, setZoom] = useState<number>(1);
    const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [isNight, setIsNight] = useState(false);
    const [showGrid, setShowGrid] = useState(false);

    // --- Interaction State ---
    const [hoveredBuilding, setHoveredBuilding] = useState<Building | null>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

    const generateMap = useCallback(() => {
        setLoading(true);
        setHoveredBuilding(null);

        // Use setTimeout to yield to UI thread so loading spinner shows
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
                    // Calculate spawn position based on entry direction
                    let targetX: number;
                    let targetY: number;
                    const centerX = Math.floor(map.width / 2);
                    const centerY = Math.floor(map.height / 2);

                    switch (entryDirection) {
                        case 'north':
                            // Player was south of town (moving North), spawn on south edge
                            targetX = centerX;
                            targetY = map.height - 2;
                            break;
                        case 'south':
                            // Player was north of town (moving South), spawn on north edge
                            targetX = centerX;
                            targetY = 1;
                            break;
                        case 'east':
                            // Player was west of town (moving East), spawn on west edge
                            targetX = 1;
                            targetY = centerY;
                            break;
                        case 'west':
                            // Player was east of town (moving West), spawn on east edge
                            targetX = map.width - 2;
                            targetY = centerY;
                            break;
                        default:
                            targetX = centerX;
                            targetY = centerY;
                    }

                    let spawnPos = { x: targetX, y: targetY };

                    // Search for a walkable tile near the target position
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
                // Reset view on regenerate
                setZoom(1);
                setPan({ x: 0, y: 0 });
            }
        }, 50);
    }, [seed, biome, density, connections, entryDirection, playerPosition]);

    // Initial Generation
    useEffect(() => {
        generateMap();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seed, biome, density, connections]);

    const resetView = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    return {
        state: {
            seed, biome, density, connections,
            mapData, loading,
            localPlayerPosition,
            zoom, pan, isNight, showGrid,
            hoveredBuilding, hoverPos
        },
        actions: {
            setSeed, setBiome, setDensity, setConnections,
            generateMap,
            setZoom, setPan, setIsNight, setShowGrid,
            setHoveredBuilding, setHoverPos,
            resetView,
            setLocalPlayerPosition
        }
    };
}
