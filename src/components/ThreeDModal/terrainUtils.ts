import { PerlinNoise } from '../../utils/random/perlinNoise';

export interface HeightSamplerConfig {
  amplitude: number;
  frequency: number;
  detailAmplitude: number;
  detailFrequency: number;
}

const getHeightConfig = (biomeId: string): HeightSamplerConfig => {
  switch (biomeId) {
    case 'mountain':
      return { amplitude: 180, frequency: 1.6, detailAmplitude: 45, detailFrequency: 6 };
    case 'hills':
      return { amplitude: 90, frequency: 1.4, detailAmplitude: 30, detailFrequency: 5 };
    case 'desert':
      return { amplitude: 40, frequency: 1.2, detailAmplitude: 18, detailFrequency: 4 };
    case 'swamp':
      return { amplitude: 25, frequency: 1.1, detailAmplitude: 12, detailFrequency: 4 };
    case 'ocean':
      return { amplitude: 18, frequency: 0.9, detailAmplitude: 6, detailFrequency: 3 };
    case 'cave':
    case 'dungeon':
      return { amplitude: 35, frequency: 1.3, detailAmplitude: 18, detailFrequency: 4 };
    case 'forest':
      return { amplitude: 55, frequency: 1.3, detailAmplitude: 22, detailFrequency: 4 };
    case 'plains':
    default:
      return { amplitude: 28, frequency: 1.1, detailAmplitude: 10, detailFrequency: 3 };
  }
};

export const createHeightSampler = (seed: number, biomeId: string, size: number) => {
  const config = getHeightConfig(biomeId);
  const noise = new PerlinNoise(seed);
  const detailNoise = new PerlinNoise(seed + 1337);

  return (x: number, z: number) => {
    const nx = x / size;
    const nz = z / size;
    const base = noise.get(nx * config.frequency, nz * config.frequency);
    const detail = detailNoise.get(nx * config.detailFrequency + 100, nz * config.detailFrequency + 100);
    return base * config.amplitude + detail * config.detailAmplitude;
  };
};

export const getHeightRangeForBiome = (biomeId: string) => {
  const config = getHeightConfig(biomeId);
  const max = config.amplitude + config.detailAmplitude;
  const min = -max * 0.6;
  return { min, max };
};
