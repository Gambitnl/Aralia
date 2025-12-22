import { RNG, NoiseGenerator } from '../utils/realmsmithRng';
import { Tile, TileType, Building, DoodadType, TownOptions, TownDensity } from '../types/realmsmith';
import { BiomeConfig } from '../data/realmsmithBiomes';
import { WIDTH, HEIGHT } from '../constants/realmsmith';
import { BuildingGenerator } from './BuildingGenerator';

export class DoodadGenerator {
    private rng: RNG;
    private noise: NoiseGenerator;
    private options: TownOptions;
    private biomeConfig: BiomeConfig;

    constructor(rng: RNG, noise: NoiseGenerator, options: TownOptions, biomeConfig: BiomeConfig) {
        this.rng = rng;
        this.noise = noise;
        this.options = options;
        this.biomeConfig = biomeConfig;
    }

    public generateWalls(tiles: Tile[][], buildings: Building[]) {
        if (this.options.density === TownDensity.VERY_SPARSE || this.options.density === TownDensity.SPARSE) return;
        if (buildings.length < 5) return;

        let minX = WIDTH, maxX = 0, minY = HEIGHT, maxY = 0;
        for (const b of buildings) {
            if (b.x < minX) minX = b.x;
            if (b.x + b.width > maxX) maxX = b.x + b.width;
            if (b.y < minY) minY = b.y;
            if (b.y + b.height > maxY) maxY = b.y + b.height;
        }

        const padding = 6;
        minX = Math.max(2, minX - padding);
        maxX = Math.min(WIDTH - 3, maxX + padding);
        minY = Math.max(2, minY - padding);
        maxY = Math.min(HEIGHT - 3, maxY + padding);

        const isWater = (t: TileType) => t === TileType.WATER_DEEP || t === TileType.WATER_SHALLOW || t === TileType.LAVA || t === TileType.ICE;

        const setWall = (x: number, y: number) => {
            if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
            const t = tiles[x][y].type;

            if (isWater(t)) return;
            if (t === TileType.ROAD_MAIN) return;
            if (t === TileType.BUILDING_FLOOR) return;

            tiles[x][y].type = TileType.WALL;
            tiles[x][y].doodad = undefined;
        };

        for (let x = minX; x <= maxX; x++) {
            setWall(x, minY);
            setWall(x, maxY);
        }
        for (let y = minY; y <= maxY; y++) {
            setWall(minX, y);
            setWall(maxX, y);
        }

        tiles[minX][minY].type = TileType.EMPTY; setWall(minX + 1, minY + 1);
        tiles[maxX][minY].type = TileType.EMPTY; setWall(maxX - 1, minY + 1);
        tiles[minX][maxY].type = TileType.EMPTY; setWall(minX + 1, maxY - 1);
        tiles[maxX][maxY].type = TileType.EMPTY; setWall(maxX - 1, maxY - 1);
    }

    public placeDoodads(tiles: Tile[][]) {
        const { treeDensity, rockDensity, trees, secondaryDoodads } = this.biomeConfig;
        const treeThreshold = 1.0 - treeDensity;

        for (let x = 0; x < WIDTH; x++) {
            for (let y = 0; y < HEIGHT; y++) {
                const t = tiles[x][y];
                const validGround = [
                    TileType.GRASS, TileType.SAND, TileType.DIRT, TileType.SNOW,
                    TileType.ASH, TileType.MUD, TileType.ROCK_GROUND, TileType.CRYSTAL_FLOOR
                ];

                if (!validGround.includes(t.type)) continue;
                if (t.buildingId) continue;
                if (t.type === TileType.WALL) continue;
                if (t.type === TileType.FARM) continue;
                if (t.doodad) continue; // Skip if already has doodad

                const forestNoise = this.noise.noise(x * 0.15, y * 0.15);

                if (forestNoise > treeThreshold) {
                    if (this.rng.chance(0.6)) {
                        const treeType = this.rng.pick(trees);
                        t.doodad = {
                            type: treeType,
                            id: `d_${x}_${y}`, offsetX: 0, offsetY: 0
                        };
                    }
                }
                else if (this.rng.chance(rockDensity)) {
                    const doodad = this.rng.pick(secondaryDoodads);
                    t.doodad = { type: doodad, id: `d_${x}_${y}`, offsetX: 0, offsetY: 0 };
                }
            }
        }
    }

    public placeStreetLamps(tiles: Tile[][]) {
        if (this.options.density === TownDensity.VERY_SPARSE) return;

        for (let x = 2; x < WIDTH - 2; x++) {
            for (let y = 2; y < HEIGHT - 2; y++) {
                if (tiles[x][y].type === TileType.ROAD_MAIN) {
                    // Place lamps at regular intervals
                    if ((x + y) % 6 === 0) {
                        // Look for an empty adjacent spot (not road, not building)
                        const neighbors = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
                        for (const n of neighbors) {
                            const nx = x + n.x;
                            const ny = y + n.y;
                            const t = tiles[nx][ny];

                            if (![TileType.ROAD_MAIN, TileType.ROAD_DIRT, TileType.BUILDING_FLOOR, TileType.WALL, TileType.WATER_DEEP, TileType.LAVA].includes(t.type) && !t.doodad && !t.buildingId) {
                                t.doodad = {
                                    type: DoodadType.STREET_LAMP,
                                    id: `lamp_${nx}_${ny}`,
                                    offsetX: 0, offsetY: 0
                                };
                                break; // Only one lamp per interval
                            }
                        }
                    }
                }
            }
        }
    }

    public decorateDeadEnds(tiles: Tile[][], buildings: Building[]) {
        const deadEnds: { x: number, y: number, neighbor: { x: number, y: number } }[] = [];
        const roadTypes = [TileType.ROAD_MAIN, TileType.ROAD_DIRT];

        for (let x = 1; x < WIDTH - 1; x++) {
            for (let y = 1; y < HEIGHT - 1; y++) {
                const t = tiles[x][y];
                if (roadTypes.includes(t.type)) {
                    const neighbors = [];
                    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                    for (const [dx, dy] of dirs) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT) {
                            const nt = tiles[nx][ny].type;
                            // Include roads, bridges, and docks as valid connections
                            if (roadTypes.includes(nt) || nt === TileType.BRIDGE || nt === TileType.DOCK) {
                                neighbors.push({ x: nx, y: ny });
                            }
                        }
                    }

                    // A dead end has exactly 1 neighbor.
                    if (neighbors.length === 1) {
                        deadEnds.push({ x, y, neighbor: neighbors[0] });
                    }
                }
            }
        }

        let hasCemetery = false;

        for (const end of deadEnds) {
            // Pick feature based on RNG
            const roll = this.rng.next();
            let feature = 'nature';

            if (roll < 0.4) feature = 'nature';
            else if (roll < 0.6) feature = 'storage';
            else if (roll < 0.7) feature = 'cemetery';
            else feature = 'shrine';

            // Rule: Only one cemetery per town.
            if (feature === 'cemetery') {
                if (hasCemetery) {
                    feature = 'nature'; // Fallback to nature
                } else {
                    hasCemetery = true;
                }
            }

            // Convert the road tip to biome ground to place the feature "at the end"
            const groundType = this.biomeConfig.ground;
            tiles[end.x][end.y].type = groundType;
            tiles[end.x][end.y].doodad = undefined;

            const buildGen = new BuildingGenerator(this.rng, this.noise, this.options, this.biomeConfig);

            if (feature === 'storage') {
                tiles[end.x][end.y].doodad = {
                    type: DoodadType.CRATE,
                    id: `end_${end.x}_${end.y}`,
                    offsetX: 0, offsetY: 0
                };
                buildGen.scatterDoodads(tiles, end.x, end.y, 2, [DoodadType.CRATE, DoodadType.STUMP], 3);

                // Attempt to place a villager workshop nearby
                buildGen.placeWorkshopHut(tiles, buildings, end.x, end.y);

            } else if (feature === 'cemetery') {
                // Create 3x3 clearing
                buildGen.createClearing(tiles, end.x, end.y, 1, groundType);
                // Place tombstones
                buildGen.scatterDoodads(tiles, end.x, end.y, 1, [DoodadType.TOMBSTONE], 4);
            } else if (feature === 'shrine') {
                const shrineType = this.rng.pick([DoodadType.WELL, DoodadType.ROCK, DoodadType.CRYSTAL]);
                tiles[end.x][end.y].doodad = {
                    type: shrineType,
                    id: `shrine_${end.x}_${end.y}`,
                    offsetX: 0, offsetY: 0
                };
            } else {
                // 'nature' - simple end
                const natureDoodad = this.rng.pick([...this.biomeConfig.trees, DoodadType.ROCK, DoodadType.STUMP]);
                tiles[end.x][end.y].doodad = {
                    type: natureDoodad,
                    id: `end_nature_${end.x}_${end.y}`,
                    offsetX: 0, offsetY: 0
                };
            }
        }
    }
}
