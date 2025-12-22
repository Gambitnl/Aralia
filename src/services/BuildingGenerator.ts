import { RNG, NoiseGenerator } from '../utils/realmsmithRng';
import { Tile, TileType, Building, BuildingType, DoodadType, TownOptions, BiomeType, TownDensity, RoofStyle, WallTexture } from '../types/realmsmith';
import { BiomeConfig } from '../data/realmsmithBiomes';
import { WIDTH, HEIGHT } from '../constants/realmsmith';

export class BuildingGenerator {
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

    public placeBuildings(tiles: Tile[][], center: { x: number, y: number }): Building[] {
        const buildings: Building[] = [];
        const buildingCounts: Record<string, number> = {}; // Track counts of each building type

        const roadTiles: { x: number, y: number }[] = [];
        for (let x = 1; x < WIDTH - 1; x++) {
            for (let y = 1; y < HEIGHT - 1; y++) {
                if (tiles[x][y].type === TileType.ROAD_MAIN || tiles[x][y].type === TileType.ROAD_DIRT) {
                    roadTiles.push({ x, y });
                }
            }
        }

        const densityNoiseOffset = this.rng.next() * 100;

        let densityThreshold = 0.5;
        switch (this.options.density) {
            case TownDensity.VERY_SPARSE: densityThreshold = 0.85; break;
            case TownDensity.SPARSE: densityThreshold = 0.75; break;
            case TownDensity.MEDIUM: densityThreshold = 0.65; break;
            case TownDensity.HIGH: densityThreshold = 0.5; break;
            case TownDensity.EXTREME: densityThreshold = 0.3; break;
        }

        this.rng.pick(roadTiles);

        for (const rt of roadTiles) {
            const districtVal = this.noise.noise(rt.x * 0.1 + densityNoiseOffset, rt.y * 0.1 + densityNoiseOffset);
            const dist = Math.sqrt((rt.x - center.x) ** 2 + (rt.y - center.y) ** 2);

            let canSpawn = false;

            if (this.options.density === TownDensity.VERY_SPARSE) {
                canSpawn = this.rng.chance(0.05);
            } else {
                if ((1 - districtVal) > densityThreshold || dist < 10) {
                    canSpawn = true;
                }
            }

            if (!canSpawn) continue;

            const dirs = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
            for (const dir of dirs) {
                const plotX = rt.x + dir.x;
                const plotY = rt.y + dir.y;

                const attemptSizes = [];
                // Varied sizes and types based on distance
                if (dist < 15) {
                    attemptSizes.push({ w: 3, h: 4 });
                    attemptSizes.push({ w: 4, h: 3 });
                    attemptSizes.push({ w: 3, h: 3 });
                }
                attemptSizes.push({ w: 2, h: 2 });
                attemptSizes.push({ w: 2, h: 3 });
                attemptSizes.push({ w: 3, h: 2 });

                for (const size of attemptSizes) {
                    let bx = plotX;
                    let by = plotY;
                    if (dir.x === -1) bx = plotX - size.w + 1;
                    if (dir.y === -1) by = plotY - size.h + 1;

                    if (this.canBuild(tiles, bx, by, size.w, size.h)) {
                        // Pass buildingCounts to enforce limits
                        const b = this.createBuilding(tiles, bx, by, size.w, size.h, rt, dist, buildingCounts);
                        buildings.push(b);
                        break;
                    }
                }
            }
        }

        return buildings;
    }

    public canBuild(tiles: Tile[][], x: number, y: number, w: number, h: number): boolean {
        if (x < 5 || x + w >= WIDTH - 5 || y < 5 || y + h >= HEIGHT - 5) return false;

        const validGround = [
            TileType.GRASS, TileType.SAND, TileType.DIRT, TileType.SNOW,
            TileType.ASH, TileType.MUD, TileType.ROCK_GROUND, TileType.CRYSTAL_FLOOR
        ];

        for (let bx = x; bx < x + w; bx++) {
            for (let by = 0; by < h; by++) {
                const t = tiles[bx][y + by];
                if (!validGround.includes(t.type)) return false;
                if (t.buildingId) return false;
                if (t.doodad) return false;
            }
        }
        return true;
    }

    private createBuilding(tiles: Tile[][], x: number, y: number, w: number, h: number, roadTile: { x: number, y: number }, distToCenter: number, counts: Record<string, number>): Building {
        const id = `b_${x}_${y}`;
        let type = BuildingType.HOUSE_SMALL;

        // 1. Initial Type Selection based on Size and Distance
        if (w >= 3 && h >= 3) {
            // Large plots
            if (distToCenter < 10 && this.rng.chance(0.2)) type = BuildingType.TEMPLE;
            else if (distToCenter < 10 && this.rng.chance(0.15)) type = BuildingType.GUILD_HALL;
            else if (distToCenter < 10 && this.rng.chance(0.3)) type = BuildingType.CHURCH;
            else if (distToCenter < 12 && this.rng.chance(0.3)) type = BuildingType.LIBRARY;
            else if (distToCenter < 15 && this.rng.chance(0.25)) type = BuildingType.TAVERN;
            else if (distToCenter < 15 && this.rng.chance(0.2)) type = BuildingType.MANOR;
            else if (distToCenter < 20 && this.rng.chance(0.15)) type = BuildingType.BARRACKS;
            else if (distToCenter > 15 && this.rng.chance(0.15)) type = BuildingType.GRANARY;
            else if (this.rng.chance(0.3)) type = BuildingType.BLACKSMITH;
            else type = BuildingType.HOUSE_LARGE;
        } else if (w === 2 && h === 2) {
            // Small/Square plots
            if (distToCenter > 20 && this.rng.chance(0.35)) type = BuildingType.FARM_HOUSE;
            else if (distToCenter > 20 && this.rng.chance(0.15)) type = BuildingType.WINDMILL; // Outskirts
            else if (distToCenter < 12 && this.rng.chance(0.1)) type = BuildingType.JEWELER;
            else if (distToCenter < 15 && this.rng.chance(0.1)) type = BuildingType.TAILOR;
            else if (distToCenter < 15 && this.rng.chance(0.15)) type = BuildingType.BAKERY;
            else if (distToCenter < 15 && this.rng.chance(0.15)) type = BuildingType.ALCHEMIST; // In town
            else if (distToCenter < 20 && this.rng.chance(0.05)) type = BuildingType.TOWER;
            else if (this.rng.chance(0.05)) type = BuildingType.SHRINE;
            else type = BuildingType.HOUSE_SMALL;
        } else {
            // Irregular/Rectangular plots
            if (distToCenter < 10 && this.rng.chance(0.3)) type = BuildingType.MARKET_STALL;
            else if (distToCenter > 15 && this.rng.chance(0.1)) type = BuildingType.LUMBER_MILL;
            else if (distToCenter > 10 && this.rng.chance(0.1)) type = BuildingType.STABLE;
            else if (distToCenter < 15 && this.rng.chance(0.05)) type = BuildingType.SCHOOL;
            else type = BuildingType.HOUSE_SMALL;
        }

        // 2. Density Overrides (Specific downgrades for Very Sparse)
        if (this.options.density === TownDensity.VERY_SPARSE) {
            if (type === BuildingType.MANOR) type = BuildingType.FARM_HOUSE;
            if (type === BuildingType.TOWER) type = BuildingType.HOUSE_SMALL;
            if (type === BuildingType.LIBRARY) type = BuildingType.HOUSE_LARGE;
            if (type === BuildingType.BARRACKS) type = BuildingType.LUMBER_MILL;
            if (type === BuildingType.GUILD_HALL) type = BuildingType.TAVERN;
            if (type === BuildingType.JEWELER) type = BuildingType.MARKET_STALL;
            if (type === BuildingType.SCHOOL) type = BuildingType.HOUSE_SMALL;
        }

        // 3. Enforce Uniqueness Limits
        const LIMITS: Partial<Record<BuildingType, number>> = {
            [BuildingType.TEMPLE]: 1,
            [BuildingType.CHURCH]: 1,
            [BuildingType.LIBRARY]: 1,
            [BuildingType.ALCHEMIST]: 1,
            [BuildingType.BARRACKS]: 1,
            [BuildingType.MANOR]: 1,
            [BuildingType.GUILD_HALL]: 1,
            [BuildingType.SCHOOL]: 1,
            [BuildingType.JEWELER]: 1,
            [BuildingType.TOWER]: 2,
            [BuildingType.WINDMILL]: 2,
            [BuildingType.LUMBER_MILL]: 2,
            [BuildingType.BLACKSMITH]: 2,
            [BuildingType.TAVERN]: 2,
            [BuildingType.GRANARY]: 2,
            [BuildingType.BAKERY]: 2,
            [BuildingType.TAILOR]: 2,
            [BuildingType.SHRINE]: 3
        };

        const currentCount = counts[type] || 0;
        const limit = LIMITS[type];
        if (limit !== undefined && currentCount >= limit) {
            // Downgrade if limit reached
            if (w >= 3 || h >= 3) {
                type = BuildingType.HOUSE_LARGE;
            } else if (type === BuildingType.WINDMILL || type === BuildingType.FARM_HOUSE) {
                type = BuildingType.FARM_HOUSE;
            } else {
                type = BuildingType.HOUSE_SMALL;
            }
        }

        // Increment Count
        counts[type] = (counts[type] || 0) + 1;

        // 4. Mark Map Tiles
        for (let bx = 0; bx < w; bx++) {
            for (let by = 0; by < h; by++) {
                tiles[x + bx][y + by].type = TileType.BUILDING_FLOOR;
                tiles[x + bx][y + by].buildingId = id;
            }
        }

        // 5. Determine Door Position
        let doorX = 0;
        let doorY = 0;
        let minD = 999;

        for (let bx = 0; bx < w; bx++) {
            let d = (x + bx - roadTile.x) ** 2 + (y - roadTile.y) ** 2;
            if (d < minD) { minD = d; doorX = bx; doorY = 0; }
            d = (x + bx - roadTile.x) ** 2 + (y + h - 1 - roadTile.y) ** 2;
            if (d < minD) { minD = d; doorX = bx; doorY = h - 1; }
        }
        for (let by = 0; by < h; by++) {
            let d = (x - roadTile.x) ** 2 + (y + by - roadTile.y) ** 2;
            if (d < minD) { minD = d; doorX = 0; doorY = by; }
            d = (x + w - 1 - roadTile.x) ** 2 + (y + by - roadTile.y) ** 2;
            if (d < minD) { minD = d; doorX = w - 1; doorY = by; }
        }

        // 6. Visual Attributes
        let color = '#ffedd5';
        let roof = '#78350f';

        let roofStyle = this.rng.pick([RoofStyle.THATCHED, RoofStyle.TILED, RoofStyle.SLATE]);
        let wallTexture = this.rng.pick([WallTexture.TIMBER_FRAME, WallTexture.STONE, WallTexture.STUCCO, WallTexture.WOOD]);

        if (roofStyle === RoofStyle.THATCHED) roof = '#d97706';
        if (roofStyle === RoofStyle.TILED) roof = '#991b1b';
        if (roofStyle === RoofStyle.SLATE) roof = '#334155';

        // Visual Identity per Type
        if (type === BuildingType.TAVERN) { color = '#fbbf24'; roof = '#1e3a8a'; }
        if (type === BuildingType.BLACKSMITH) { color = '#94a3b8'; roof = '#334155'; wallTexture = WallTexture.STONE; }
        if (type === BuildingType.HOUSE_LARGE) { roof = '#7f1d1d'; }
        if (type === BuildingType.CHURCH) { color = '#e2e8f0'; roof = '#4f46e5'; wallTexture = WallTexture.STONE; }
        if (type === BuildingType.TEMPLE) { color = '#f5f5f4'; roof = '#facc15'; wallTexture = WallTexture.STUCCO; }
        if (type === BuildingType.LIBRARY) { color = '#e7e5e4'; roof = '#475569'; wallTexture = WallTexture.STONE; }
        if (type === BuildingType.MANOR) { color = '#d1fae5'; roof = '#065f46'; }
        if (type === BuildingType.TOWER) { color = '#9ca3af'; roof = '#111827'; }
        if (type === BuildingType.FARM_HOUSE) { color = '#fef3c7'; roof = '#92400e'; }
        if (type === BuildingType.ALCHEMIST) { color = '#fae8ff'; roof = '#7e22ce'; wallTexture = WallTexture.TIMBER_FRAME; }
        if (type === BuildingType.WINDMILL) { color = '#78350f'; roof = '#451a03'; wallTexture = WallTexture.WOOD; }
        if (type === BuildingType.LUMBER_MILL) { color = '#78350f'; roof = '#57534e'; wallTexture = WallTexture.WOOD; }
        if (type === BuildingType.BARRACKS) { color = '#57534e'; roof = '#1f2937'; wallTexture = WallTexture.STONE; }

        // New Buildings Visuals
        if (type === BuildingType.GUILD_HALL) { color = '#475569'; roof = '#1e293b'; wallTexture = WallTexture.TIMBER_FRAME; }
        if (type === BuildingType.STABLE) { color = '#78350f'; roof = '#d97706'; wallTexture = WallTexture.WOOD; }
        if (type === BuildingType.GRANARY) { color = '#fef3c7'; roof = '#713f12'; wallTexture = WallTexture.STUCCO; }
        if (type === BuildingType.SHRINE) { color = '#e5e5e5'; roof = '#0ea5e9'; wallTexture = WallTexture.STONE; }
        if (type === BuildingType.SCHOOL) { color = '#e7e5e4'; roof = '#be123c'; wallTexture = WallTexture.STONE; }
        if (type === BuildingType.BAKERY) { color = '#ffedd5'; roof = '#c2410c'; wallTexture = WallTexture.STUCCO; }
        if (type === BuildingType.TAILOR) { color = '#f3e8ff'; roof = '#7e22ce'; }
        if (type === BuildingType.JEWELER) { color = '#ecfeff'; roof = '#0e7490'; wallTexture = WallTexture.STONE; }

        if (type === BuildingType.HOUSE_SMALL && this.rng.chance(0.3)) roof = '#57534e';

        // Re-apply Rustic Looks for Very Sparse (Visuals only)
        if (this.options.density === TownDensity.VERY_SPARSE) {
            wallTexture = this.rng.pick([WallTexture.WOOD, WallTexture.TIMBER_FRAME]);
            roofStyle = this.rng.pick([RoofStyle.THATCHED, RoofStyle.SLATE]);

            if (type === BuildingType.CHURCH || type === BuildingType.TEMPLE || type === BuildingType.SHRINE) {
                color = '#d6d3d1';
                roof = '#57534e';
            }
            if (type === BuildingType.TAVERN) {
                color = '#78350f';
                roof = '#451a03';
            }
            if (type === BuildingType.ALCHEMIST) {
                roof = '#451a03';
            }
            if (roofStyle === RoofStyle.THATCHED) roof = '#d97706';
        }

        return {
            id, type, x, y, width: w, height: h, doorX, doorY, color, roofColor: roof, roofStyle, wallTexture
        };
    }

    public attachFieldsToFarms(tiles: Tile[][], buildings: Building[]) {
        // Skip farms for hostile or frozen environments
        if ([BiomeType.DESERT, BiomeType.GLACIER, BiomeType.VOLCANIC, BiomeType.CRYSTAL_WASTES, BiomeType.BADLANDS].includes(this.options.biome)) return;

        const farmHouses = buildings.filter(b => b.type === BuildingType.FARM_HOUSE);

        for (const house of farmHouses) {
            // Assign a "Family Crop" to this house
            const familyCrop = this.rng.pick([DoodadType.CROP_WHEAT, DoodadType.CROP_CORN, DoodadType.CROP_PUMPKIN]);

            // Attempt to place 1-3 fields around the house
            const numFields = this.rng.rangeInt(1, 3);
            let fieldsPlaced = 0;

            // Try all 4 directions (North, South, East, West) + variations
            const directions = [
                { dx: 0, dy: -1 }, // North
                { dx: 0, dy: 1 },  // South
                { dx: 1, dy: 0 },  // East
                { dx: -1, dy: 0 }  // West
            ];

            // Shuffle directions
            for (let i = directions.length - 1; i > 0; i--) {
                const j = Math.floor(this.rng.next() * (i + 1));
                [directions[i], directions[j]] = [directions[j], directions[i]];
            }

            for (const dir of directions) {
                if (fieldsPlaced >= numFields) break;

                // Determine random size for this field
                const fw = this.rng.rangeInt(3, 7);
                const fh = this.rng.rangeInt(3, 7);

                // Determine start position relative to house
                // Add a 1-tile buffer so it looks like a yard
                let startX = house.x;
                let startY = house.y;

                if (dir.dx === 1) startX = house.x + house.width + 1;
                if (dir.dx === -1) startX = house.x - fw - 1;
                if (dir.dy === 1) startY = house.y + house.height + 1;
                if (dir.dy === -1) startY = house.y - fh - 1;

                // Align centers if moving vertically, or horizontally
                if (dir.dx !== 0) {
                    // Adjust Y slightly to align with house or vary
                    startY += this.rng.rangeInt(-2, 2);
                } else {
                    startX += this.rng.rangeInt(-2, 2);
                }

                if (this.canPlaceFarm(tiles, startX, startY, fw, fh)) {
                    this.createFarmField(tiles, startX, startY, fw, fh, familyCrop);
                    fieldsPlaced++;
                }
            }
        }
    }

    private canPlaceFarm(tiles: Tile[][], x: number, y: number, w: number, h: number): boolean {
        if (x < 1 || x + w >= WIDTH - 1 || y < 1 || y + h >= HEIGHT - 1) return false;

        for (let fx = x; fx < x + w; fx++) {
            for (let fy = y; fy < y + h; fy++) {
                const t = tiles[fx][fy];
                // Must be on soil
                if (t.type !== TileType.GRASS && t.type !== TileType.DIRT && t.type !== TileType.MUD) return false;
                // Cannot overwrite existing structures/roads
                if (t.buildingId || t.doodad) return false;
            }
        }
        return true;
    }

    private createFarmField(tiles: Tile[][], x: number, y: number, w: number, h: number, crop: DoodadType) {
        for (let fx = x; fx < x + w; fx++) {
            for (let fy = y; fy < y + h; fy++) {
                tiles[fx][fy].type = TileType.FARM;
                // Plant crops in rows
                if (fx % 2 === 0) {
                    tiles[fx][fy].doodad = {
                        type: crop,
                        id: `crop_${fx}_${fy}`,
                        offsetX: 0, offsetY: 0
                    };
                }
            }
        }
    }

    public placeWorkshopHut(tiles: Tile[][], buildings: Building[], cx: number, cy: number) {
        // Try to find a 2x2 or 3x2 spot adjacent to the dead end
        const spots = [
            { x: cx + 1, y: cy - 1 }, // East
            { x: cx - 2, y: cy - 1 }, // West
            { x: cx - 1, y: cy + 1 }, // South
            { x: cx - 1, y: cy - 2 }  // North
        ];

        // Shuffle spots
        for (let i = spots.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng.next() * (i + 1));
            [spots[i], spots[j]] = [spots[i], spots[j]];
        }

        for (const spot of spots) {
            if (this.canBuild(tiles, spot.x, spot.y, 2, 2)) {
                // Manually creating a "Workshop" look
                const b: Building = {
                    id: `workshop_${spot.x}_${spot.y}`,
                    type: BuildingType.HOUSE_SMALL,
                    x: spot.x, y: spot.y, width: 2, height: 2,
                    doorX: 0, doorY: 1, // side door usually
                    color: '#78350f', // Dark wood
                    roofColor: '#d97706', // Thatch
                    roofStyle: RoofStyle.THATCHED,
                    wallTexture: WallTexture.WOOD
                };

                // Mark tiles
                for (let bx = 0; bx < 2; bx++) {
                    for (let by = 0; by < 2; by++) {
                        tiles[spot.x + bx][spot.y + by].type = TileType.BUILDING_FLOOR;
                        tiles[spot.x + bx][spot.y + by].buildingId = b.id;
                    }
                }
                buildings.push(b);
                break; // Only one hut
            }
        }
    }

    public scatterDoodads(tiles: Tile[][], cx: number, cy: number, radius: number, types: DoodadType[], count: number) {
        for (let i = 0; i < count; i++) {
            const tx = cx + this.rng.rangeInt(-radius, radius);
            const ty = cy + this.rng.rangeInt(-radius, radius);
            if (tx >= 0 && tx < WIDTH && ty >= 0 && ty < HEIGHT) {
                const t = tiles[tx][ty];
                // Only place on ground
                if ([TileType.GRASS, TileType.DIRT, TileType.SAND, TileType.SNOW, TileType.MUD].includes(t.type)) {
                    if (!t.doodad && !t.buildingId) {
                        t.doodad = {
                            type: this.rng.pick(types),
                            id: `scat_${tx}_${ty}_${i}`,
                            offsetX: this.rng.rangeInt(-5, 5),
                            offsetY: this.rng.rangeInt(-5, 5)
                        }
                    }
                }
            }
        }
    }

    public createClearing(tiles: Tile[][], cx: number, cy: number, radius: number, type: TileType) {
        for (let x = cx - radius; x <= cx + radius; x++) {
            for (let y = cy - radius; y <= cy + radius; y++) {
                if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
                    if (!tiles[x][y].buildingId && tiles[x][y].type !== TileType.WATER_DEEP && tiles[x][y].type !== TileType.WATER_SHALLOW) {
                        tiles[x][y].type = type;
                        tiles[x][y].doodad = undefined; // Remove pre-existing items
                    }
                }
            }
        }
    }
}
