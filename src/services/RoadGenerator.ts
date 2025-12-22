import { RNG, NoiseGenerator } from '../utils/realmsmithRng';
import { Tile, TileType, DoodadType, TownOptions, TownDensity } from '../types/realmsmith';
import { WIDTH, HEIGHT } from '../constants/realmsmith';

export class RoadGenerator {
    private rng: RNG;
    private noise: NoiseGenerator;
    private options: TownOptions;

    constructor(rng: RNG, noise: NoiseGenerator, options: TownOptions) {
        this.rng = rng;
        this.noise = noise;
        this.options = options;
    }

    public generatePlaza(tiles: Tile[][], center: { x: number, y: number }) {
        const cx = center.x;
        const cy = center.y;

        // Very sparse towns shouldn't have a paved plaza, just a simple well at the crossroads
        if (this.options.density === TownDensity.VERY_SPARSE) {
            const isWater = (t: TileType) => t === TileType.WATER_DEEP || t === TileType.WATER_SHALLOW || t === TileType.LAVA || t === TileType.ICE;
            if (!isWater(tiles[cx][cy].type)) {
                tiles[cx][cy].doodad = {
                    type: DoodadType.WELL,
                    id: 'town-center',
                    offsetX: 0, offsetY: 0
                };
            }
            return;
        }

        const size = 3;
        const isWater = (t: TileType) => t === TileType.WATER_DEEP || t === TileType.WATER_SHALLOW || t === TileType.LAVA || t === TileType.ICE;
        if (isWater(tiles[cx][cy].type)) return;

        for (let x = cx - size; x <= cx + size; x++) {
            for (let y = cy - size; y <= cy + size; y++) {
                if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
                    if (!isWater(tiles[x][y].type)) {
                        // Rounded corners
                        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                        if (d <= size) {
                            tiles[x][y].type = TileType.ROAD_MAIN;
                        }
                    }
                }
            }
        }
        // Feature in the middle
        tiles[cx][cy].doodad = {
            type: DoodadType.WELL,
            id: 'town-center',
            offsetX: 0, offsetY: 0
        };
    }

    public generateRoads(tiles: Tile[][], center: { x: number, y: number }) {
        const isWater = (t: TileType) => t === TileType.WATER_DEEP || t === TileType.WATER_SHALLOW || t === TileType.LAVA || t === TileType.ICE;

        // Check if center is water
        if (isWater(tiles[center.x][center.y].type)) return;

        // Determine main road type based on density. Very sparse towns have dirt roads.
        const mainRoadType = this.options.density === TownDensity.VERY_SPARSE ? TileType.ROAD_DIRT : TileType.ROAD_MAIN;

        // 1. Main Arteries
        const targets: { x: number, y: number }[] = [];

        // Randomize exits along edges to break '+' shape
        const exitDev = 20;

        if (this.options.connections.north) targets.push({ x: Math.floor(WIDTH / 2 + this.rng.range(-exitDev, exitDev)), y: 0 });
        if (this.options.connections.south) targets.push({ x: Math.floor(WIDTH / 2 + this.rng.range(-exitDev, exitDev)), y: HEIGHT - 1 });
        if (this.options.connections.east) targets.push({ x: WIDTH - 1, y: Math.floor(HEIGHT / 2 + this.rng.range(-exitDev, exitDev)) });
        if (this.options.connections.west) targets.push({ x: 0, y: Math.floor(HEIGHT / 2 + this.rng.range(-exitDev, exitDev)) });

        if (targets.length === 0) targets.push({ x: Math.floor(WIDTH / 2), y: HEIGHT - 1 });

        const arteryPoints: { x: number, y: number }[] = [];

        for (const target of targets) {
            let cx = center.x;
            let cy = center.y;

            // Track previous integer coordinate to detect diagonal gaps
            let prevIx = Math.floor(cx);
            let prevIy = Math.floor(cy);

            const totalDx = target.x - cx;
            const totalDy = target.y - cy;
            const distTotal = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
            const stepX = totalDx / distTotal;
            const stepY = totalDy / distTotal;

            let currentDist = 0;

            while (currentDist < distTotal) {
                // Organic wander
                const noiseVal = this.noise.noise(cx * 0.05, cy * 0.05);
                const curve = (noiseVal - 0.5) * 0.8;

                // Perpendicular vector: (-stepY, stepX)
                cx += stepX + (-stepY * curve);
                cy += stepY + (stepX * curve);

                const ix = Math.floor(cx);
                const iy = Math.floor(cy);

                if (ix < 0 || ix >= WIDTH || iy < 0 || iy >= HEIGHT) break;

                // 4-Way Connectivity Check: If we moved diagonally, fill a corner
                if (ix !== prevIx && iy !== prevIy) {
                    // Moved diagonal. Try to fill (prevIx, iy) if it's valid land
                    const corner1 = tiles[prevIx][iy];
                    if (!isWater(corner1.type)) {
                        this.setRoadTile(tiles, prevIx, iy, mainRoadType, arteryPoints);
                    } else {
                        // Otherwise try (ix, prevIy)
                        this.setRoadTile(tiles, ix, prevIy, mainRoadType, arteryPoints);
                    }
                }

                const t = tiles[ix][iy].type;

                // Bridge Check
                if (t === TileType.WATER_SHALLOW) {
                    if (this.tryBuildBridge(tiles, ix, iy, stepX, stepY)) {
                        currentDist++;
                        prevIx = ix; prevIy = iy;
                        continue;
                    }
                }

                if (t === TileType.WATER_DEEP || t === TileType.WATER_SHALLOW) {
                    this.createDock(tiles, ix, iy, stepX, stepY);
                    break;
                }
                if (t === TileType.LAVA) break;

                this.setRoadTile(tiles, ix, iy, mainRoadType, arteryPoints);

                prevIx = ix;
                prevIy = iy;
                currentDist++;
            }
        }

        // 2. Ring Roads
        if (this.options.density !== TownDensity.VERY_SPARSE && this.options.density !== TownDensity.SPARSE) {
            const rings = [12, 22];
            for (const r of rings) {
                if (this.rng.chance(0.4)) {
                    this.createRingRoad(tiles, center.x, center.y, r);
                }
            }
        }

        // 3. Secondary Streets
        const allRoadPoints: { x: number, y: number }[] = [];
        for (let x = 0; x < WIDTH; x++) {
            for (let y = 0; y < HEIGHT; y++) {
                if (tiles[x][y].type === mainRoadType) allRoadPoints.push({ x, y });
            }
        }

        allRoadPoints.sort((a, b) => {
            const da = (a.x - center.x) ** 2 + (a.y - center.y) ** 2;
            const db = (b.x - center.x) ** 2 + (b.y - center.y) ** 2;
            return da - db;
        });

        const processed = new Set<string>();

        let branchChance = 0.15;
        switch (this.options.density) {
            case TownDensity.VERY_SPARSE: branchChance = 0.05; break;
            case TownDensity.SPARSE: branchChance = 0.10; break;
            case TownDensity.MEDIUM: branchChance = 0.20; break;
            case TownDensity.HIGH: branchChance = 0.35; break;
            case TownDensity.EXTREME: branchChance = 0.60; break;
        }

        for (const pt of allRoadPoints) {
            const hash = `${pt.x},${pt.y}`;
            if (processed.has(hash)) continue;
            processed.add(hash);

            if (this.rng.rangeInt(0, 100) > (branchChance * 100)) continue;

            const dirs = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
            this.rng.pick(dirs);

            for (const dir of dirs) {
                const nx = pt.x + dir.x;
                const ny = pt.y + dir.y;

                if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT && tiles[nx][ny].type === mainRoadType) continue;

                if (this.rng.chance(0.6)) {
                    // Allow Organic streets that turn
                    this.createStreet(tiles, pt.x, pt.y, dir.x, dir.y, this.rng.rangeInt(4, 12));
                }
            }
        }
    }

    private setRoadTile(tiles: Tile[][], x: number, y: number, type: TileType, points: { x: number, y: number }[]) {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
        const t = tiles[x][y].type;

        // Don't overwrite existing infrastructure or water (unless it's a bridge/dock handled elsewhere)
        if (t === type) return;
        if (t === TileType.ROAD_MAIN || t === TileType.ROAD_DIRT || t === TileType.BRIDGE || t === TileType.DOCK) return;
        if (t === TileType.WATER_DEEP || t === TileType.WATER_SHALLOW || t === TileType.LAVA || t === TileType.ICE) return;

        tiles[x][y].type = type;
        tiles[x][y].doodad = undefined;
        points.push({ x, y });
    }

    private tryBuildBridge(tiles: Tile[][], startX: number, startY: number, dirX: number, dirY: number): boolean {
        const dx = dirX > 0 ? 1 : (dirX < 0 ? -1 : 0);
        const dy = dirY > 0 ? 1 : (dirY < 0 ? -1 : 0);

        // Don't bridge diagonal
        if (dx !== 0 && dy !== 0) return false;

        const maxBridgeLen = 6;
        let foundLand = false;
        let bridgeLen = 0;

        for (let i = 1; i <= maxBridgeLen; i++) {
            const tx = startX + dx * i;
            const ty = startY + dy * i;
            if (tx < 0 || tx >= WIDTH || ty < 0 || ty >= HEIGHT) return false;

            const t = tiles[tx][ty].type;
            if (t !== TileType.WATER_DEEP && t !== TileType.WATER_SHALLOW) {
                foundLand = true;
                bridgeLen = i;
                break;
            }
        }

        if (foundLand && bridgeLen > 0) {
            for (let i = 0; i < bridgeLen; i++) {
                const tx = startX + dx * i;
                const ty = startY + dy * i;
                if (tiles[tx][ty].type === TileType.WATER_SHALLOW || tiles[tx][ty].type === TileType.WATER_DEEP) {
                    tiles[tx][ty].type = TileType.BRIDGE;
                    tiles[tx][ty].doodad = undefined;
                }
            }
            return true;
        }
        return false;
    }

    private createRingRoad(tiles: Tile[][], cx: number, cy: number, radius: number) {
        const steps = radius * 4;
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const rx = Math.round(cx + Math.cos(angle) * radius);
            const ry = Math.round(cy + Math.sin(angle) * radius * 0.8);

            if (rx >= 1 && rx < WIDTH - 1 && ry >= 1 && ry < HEIGHT - 1) {
                const t = tiles[rx][ry].type;
                if ([TileType.WATER_DEEP, TileType.WATER_SHALLOW, TileType.LAVA, TileType.ICE, TileType.DOCK, TileType.BRIDGE].includes(t)) continue;

                if (t !== TileType.ROAD_MAIN) {
                    tiles[rx][ry].type = TileType.ROAD_MAIN;
                }
            }
        }
    }

    private createDock(tiles: Tile[][], startX: number, startY: number, dirX: number, dirY: number) {
        let dx = 0;
        let dy = 0;
        if (Math.abs(dirX) > Math.abs(dirY)) {
            dx = dirX > 0 ? 1 : -1;
        } else {
            dy = dirY > 0 ? 1 : -1;
        }

        const length = this.rng.rangeInt(4, 7);
        let cx = startX;
        let cy = startY;

        for (let i = 0; i < length; i++) {
            if (cx < 0 || cx >= WIDTH || cy < 0 || cy >= HEIGHT) break;
            tiles[cx][cy].type = TileType.DOCK;
            cx += dx;
            cy += dy;
        }

        if (this.rng.chance(0.5) && cx >= 1 && cx < WIDTH - 1 && cy >= 1 && cy < HEIGHT - 1) {
            if (dx !== 0) {
                tiles[cx][cy].type = TileType.DOCK;
                tiles[cx][cy - 1].type = TileType.DOCK;
                tiles[cx][cy + 1].type = TileType.DOCK;
            } else {
                tiles[cx][cy].type = TileType.DOCK;
                tiles[cx - 1][cy].type = TileType.DOCK;
                tiles[cx + 1][cy].type = TileType.DOCK;
            }
        }
    }

    private createStreet(tiles: Tile[][], startX: number, startY: number, dx: number, dy: number, length: number) {
        let cx = startX;
        let cy = startY;

        let currentDx = dx;
        let currentDy = dy;

        for (let i = 0; i < length; i++) {
            cx += currentDx;
            cy += currentDy;

            if (cx < 1 || cx >= WIDTH - 1 || cy < 1 || cy >= HEIGHT - 1) break;

            const t = tiles[cx][cy];
            if (t.type === TileType.ROAD_MAIN) break;
            if ([TileType.WATER_DEEP, TileType.WATER_SHALLOW, TileType.LAVA, TileType.ICE, TileType.DOCK, TileType.BRIDGE].includes(t.type)) break;

            tiles[cx][cy].type = TileType.ROAD_DIRT;

            // Asymmetrical/Organic Turn Chance
            if (i > 2 && i < length - 2 && this.rng.chance(0.2)) {
                if (currentDx !== 0) {
                    currentDy = this.rng.chance(0.5) ? 1 : -1;
                    currentDx = 0;
                } else {
                    currentDx = this.rng.chance(0.5) ? 1 : -1;
                    currentDy = 0;
                }
            }
        }
    }
}
