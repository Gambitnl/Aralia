import { NoiseGenerator } from '../utils/realmsmithRng';
import { Tile, TileType } from '../types/realmsmith';
import { BiomeConfig } from '../data/realmsmithBiomes';
import { WIDTH, HEIGHT } from '../constants/realmsmith';

export class TerrainGenerator {
    private noise: NoiseGenerator;
    private biomeConfig: BiomeConfig;

    constructor(noise: NoiseGenerator, biomeConfig: BiomeConfig) {
        this.noise = noise;
        this.biomeConfig = biomeConfig;
    }

    public generate(tiles: Tile[][]) {
        const scale = 0.02;
        const { ground, beach, waterDeep, waterShallow, elevationOffset } = this.biomeConfig;

        for (let x = 0; x < WIDTH; x++) {
            for (let y = 0; y < HEIGHT; y++) {
                // Base noise
                let val = this.noise.noise(x * scale, y * scale);
                val += this.noise.noise(x * 0.08, y * 0.08) * 0.1;

                const dx = (x - WIDTH / 2) / (WIDTH / 2);
                const dy = (y - HEIGHT / 2) / (HEIGHT / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Bias towards center land
                const centerBias = 0.25 * (1.0 - Math.min(1.0, dist));

                let elevation = val + centerBias + elevationOffset;
                elevation = Math.max(0, Math.min(1, elevation));
                tiles[x][y].elevation = elevation;

                // Thresholds
                if (elevation < 0.35) {
                    tiles[x][y].type = waterDeep;
                } else if (elevation < 0.42) {
                    tiles[x][y].type = waterShallow;
                } else if (elevation < 0.48) {
                    tiles[x][y].type = beach;
                } else {
                    tiles[x][y].type = ground;
                }
            }
        }
    }
}
