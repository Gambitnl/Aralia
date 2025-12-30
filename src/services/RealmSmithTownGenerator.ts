
import { RNG, NoiseGenerator } from '../utils/realmsmithRng';
// TODO(lint-intent): 'BuildingType' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Tile, TileType, TownMap, Building, BuildingType as _BuildingType, DoodadType as _DoodadType, TownOptions, BiomeType as _BiomeType, TownDensity as _TownDensity, RoofStyle as _RoofStyle, WallTexture as _WallTexture } from '../types/realmsmith';
import { BIOME_DATA, BiomeConfig } from '../data/realmsmithBiomes';
import { WIDTH, HEIGHT } from '../constants/realmsmith';
import { TerrainGenerator } from './TerrainGenerator';
import { RoadGenerator } from './RoadGenerator';
import { BuildingGenerator } from './BuildingGenerator';
import { DoodadGenerator } from './DoodadGenerator';

export class TownGenerator {
    private rng: RNG;
    private noise: NoiseGenerator;
    private options: TownOptions;
    private biomeConfig: BiomeConfig;

    constructor(options: TownOptions) {
        this.rng = new RNG(options.seed);
        this.noise = new NoiseGenerator(options.seed);
        this.options = options;
        this.biomeConfig = BIOME_DATA[options.biome];
    }

    public generate(): TownMap {
        // 1. Initialize Grid
        const tiles: Tile[][] = [];
        for (let x = 0; x < WIDTH; x++) {
            tiles[x] = [];
            for (let y = 0; y < HEIGHT; y++) {
                tiles[x][y] = {
                    x,
                    y,
                    type: TileType.EMPTY,
                    variation: this.rng.next(),
                    elevation: 0
                };
            }
        }

        // 2. Terrain Pass
        this.generateTerrain(tiles);

        // Determine Town Center (Randomized to avoid perfect symmetry)
        const centerX = Math.floor(WIDTH / 2) + this.rng.rangeInt(-12, 12);
        const centerY = Math.floor(HEIGHT / 2) + this.rng.rangeInt(-10, 10);
        const townCenter = { x: centerX, y: centerY };

        // 3. Plaza Pass
        this.generatePlaza(tiles, townCenter);

        // 4. Road Pass
        this.generateRoads(tiles, townCenter);

        // 5. Building Pass
        const buildings = this.placeBuildings(tiles, townCenter);

        // 6. Wall Pass
        this.generateWalls(tiles, buildings);

        // 7. Farm Pass - Now strictly attached to farmhouses
        this.attachFieldsToFarms(tiles, buildings);

        // 8. Dead End Decoration
        this.decorateDeadEnds(tiles, buildings);

        // 9. Doodad Pass
        this.placeDoodads(tiles);

        // 10. Street Lamps Pass
        this.placeStreetLamps(tiles);

        return {
            width: WIDTH,
            height: HEIGHT,
            tiles,
            buildings,
            seed: this.options.seed,
            biome: this.options.biome
        };
    }

    private generateTerrain(tiles: Tile[][]) {
        const terrainGen = new TerrainGenerator(this.noise, this.biomeConfig);
        terrainGen.generate(tiles);
    }

    private generatePlaza(tiles: Tile[][], center: { x: number, y: number }) {
        const roadGen = new RoadGenerator(this.rng, this.noise, this.options);
        roadGen.generatePlaza(tiles, center);
    }

    private generateRoads(tiles: Tile[][], center: { x: number, y: number }) {
        const roadGen = new RoadGenerator(this.rng, this.noise, this.options);
        roadGen.generateRoads(tiles, center);
    }

    private placeBuildings(tiles: Tile[][], center: { x: number, y: number }): Building[] {
        const buildGen = new BuildingGenerator(this.rng, this.noise, this.options, this.biomeConfig);
        return buildGen.placeBuildings(tiles, center);
    }

    private attachFieldsToFarms(tiles: Tile[][], buildings: Building[]) {
        const buildGen = new BuildingGenerator(this.rng, this.noise, this.options, this.biomeConfig);
        buildGen.attachFieldsToFarms(tiles, buildings);
    }

    private generateWalls(tiles: Tile[][], buildings: Building[]) {
        const doodadGen = new DoodadGenerator(this.rng, this.noise, this.options, this.biomeConfig);
        doodadGen.generateWalls(tiles, buildings);
    }

    private placeDoodads(tiles: Tile[][]) {
        const doodadGen = new DoodadGenerator(this.rng, this.noise, this.options, this.biomeConfig);
        doodadGen.placeDoodads(tiles);
    }

    private placeStreetLamps(tiles: Tile[][]) {
        const doodadGen = new DoodadGenerator(this.rng, this.noise, this.options, this.biomeConfig);
        doodadGen.placeStreetLamps(tiles);
    }

    private decorateDeadEnds(tiles: Tile[][], buildings: Building[]) {
        const doodadGen = new DoodadGenerator(this.rng, this.noise, this.options, this.biomeConfig);
        doodadGen.decorateDeadEnds(tiles, buildings);
    }
}
