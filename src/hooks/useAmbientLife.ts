import { useState, useEffect, useRef } from 'react';
import { TownMap, TileType } from '../types/realmsmith';
import { TownDirection, TOWN_DIRECTION_VECTORS, TownPosition } from '../types/town';
import { SeededRandom } from '@/utils/random';

export interface AmbientNPC {
    id: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    facing: TownDirection;
    isMoving: boolean;
    colors: { skin: string; hair: string; clothing: string };
    moveSpeed: number; // tiles per second approx
    lastMoveTime: number;
}

const NPC_COLORS = [
    { skin: '#d4a574', hair: '#451a03', clothing: '#374151' },
    { skin: '#8d5524', hair: '#000000', clothing: '#1f2937' },
    { skin: '#e0ac69', hair: '#eab308', clothing: '#166534' },
    { skin: '#ffdbac', hair: '#b91c1c', clothing: '#1e3a8a' },
    { skin: '#f1c27d', hair: '#713f12', clothing: '#78350f' },
];

function isWalkable(x: number, y: number, mapData: TownMap): boolean {
    if (x < 0 || y < 0 || x >= mapData.width || y >= mapData.height) return false;
    const tile = mapData.tiles[x][y];
    // Check for blocking tile types
    if (tile.type === TileType.WATER_DEEP || tile.type === TileType.WALL || tile.type === TileType.BUILDING_FLOOR) return false;
    return true;
}

export function useAmbientLife(mapData: TownMap | null, seed: number) {
    const [npcs, setNpcs] = useState<AmbientNPC[]>([]);
    const lastUpdateRef = useRef<number>(Date.now());
    const animationFrameRef = useRef<number | null>(null);

    // Initialization
    useEffect(() => {
        if (!mapData) return;

        const rng = new SeededRandom(seed);
        const newNpcs: AmbientNPC[] = [];
        const count = 8 + Math.floor(rng.next() * 5); // 8-12 NPCs

        for (let i = 0; i < count; i++) {
            let x = 0, y = 0;
            let attempts = 0;
            while (attempts < 50) {
                x = Math.floor(rng.next() * mapData.width);
                y = Math.floor(rng.next() * mapData.height);
                if (isWalkable(x, y, mapData)) break;
                attempts++;
            }

            if (attempts < 50) {
                const colors = NPC_COLORS[Math.floor(rng.next() * NPC_COLORS.length)];
                newNpcs.push({
                    id: `npc-${i}`,
                    x, y,
                    targetX: x, targetY: y,
                    facing: 'south',
                    isMoving: false,
                    colors,
                    moveSpeed: 1.5 + rng.next(), // Random speed
                    lastMoveTime: 0
                });
            }
        }
        setNpcs(newNpcs);
    }, [mapData, seed]);

    // Game Loop
    useEffect(() => {
        if (!mapData) return;

        const update = () => {
            const now = Date.now();
            const deltaTime = (now - lastUpdateRef.current) / 1000;
            lastUpdateRef.current = now;

            setNpcs(prevNpcs => prevNpcs.map(npc => {
                let { x, y, targetX, targetY, facing, isMoving, lastMoveTime } = npc;

                // 1. Behavior: Pick new target if idle
                if (!isMoving && now - lastMoveTime > 2000 && Math.random() < 0.02) {
                    // Pick a random neighbor
                    const dirs: TownDirection[] = ['north', 'south', 'east', 'west'];
                    const dir = dirs[Math.floor(Math.random() * dirs.length)];
                    const vec = TOWN_DIRECTION_VECTORS[dir];
                    const nx = Math.round(x + vec.x);
                    const ny = Math.round(y + vec.y);

                    if (isWalkable(nx, ny, mapData)) {
                        targetX = nx;
                        targetY = ny;
                        facing = dir;
                        isMoving = true;
                    }
                }

                // 2. Movement: Lerp towards target
                if (isMoving) {
                    const dx = targetX - x;
                    const dy = targetY - y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist < 0.05) {
                        x = targetX;
                        y = targetY;
                        isMoving = false;
                        lastMoveTime = now;
                    } else {
                        const moveDist = npc.moveSpeed * deltaTime;
                        x += (dx / dist) * moveDist;
                        y += (dy / dist) * moveDist;
                    }
                }

                return { ...npc, x, y, targetX, targetY, facing, isMoving, lastMoveTime };
            }));

            animationFrameRef.current = requestAnimationFrame(update);
        };

        animationFrameRef.current = requestAnimationFrame(update);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [mapData]);

    return npcs;
}
