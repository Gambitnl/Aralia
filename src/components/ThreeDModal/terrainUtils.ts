import { PerlinNoise } from '../../utils/random/perlinNoise';

export interface HeightSamplerConfig {
  amplitude: number;
  frequency: number;
  detailAmplitude: number;
  detailFrequency: number;
}

export interface MoistureSamplerConfig {
  base: number;
  variance: number;
  frequency: number;
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
      return { amplitude: 42, frequency: 1.0, detailAmplitude: 16, detailFrequency: 4 };
    default:
      return { amplitude: 28, frequency: 1.1, detailAmplitude: 10, detailFrequency: 3 };
  }
};

const getMoistureConfig = (biomeId: string): MoistureSamplerConfig => {
  switch (biomeId) {
    case 'ocean':
      return { base: 0.95, variance: 0.2, frequency: 0.6, detailFrequency: 2.5 };
    case 'swamp':
      return { base: 0.75, variance: 0.25, frequency: 0.9, detailFrequency: 3.2 };
    case 'forest':
      return { base: 0.55, variance: 0.25, frequency: 0.9, detailFrequency: 3.4 };
    case 'plains':
      return { base: 0.35, variance: 0.2, frequency: 0.8, detailFrequency: 3.0 };
    case 'desert':
      return { base: 0.12, variance: 0.1, frequency: 0.7, detailFrequency: 2.6 };
    case 'mountain':
    case 'hills':
      return { base: 0.3, variance: 0.2, frequency: 0.7, detailFrequency: 2.8 };
    case 'cave':
    case 'dungeon':
      return { base: 0.4, variance: 0.15, frequency: 0.8, detailFrequency: 2.4 };
    default:
      return { base: 0.35, variance: 0.2, frequency: 0.8, detailFrequency: 2.8 };
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

export const createMoistureSampler = (seed: number, biomeId: string, size: number) => {
  const config = getMoistureConfig(biomeId);
  const noise = new PerlinNoise(seed + 4242);
  const detailNoise = new PerlinNoise(seed + 9001);

  return (x: number, z: number) => {
    const nx = x / size;
    const nz = z / size;
    const base = noise.get(nx * config.frequency, nz * config.frequency);
    const detail = detailNoise.get(nx * config.detailFrequency + 200, nz * config.detailFrequency + 200);
    const value = config.base + base * config.variance + detail * config.variance * 0.5;
    return Math.min(1, Math.max(0, value));
  };
};

export const createSlopeSampler = (heightSampler: (x: number, z: number) => number, sampleStep = 8) => {
  return (x: number, z: number) => {
    const hL = heightSampler(x - sampleStep, z);
    const hR = heightSampler(x + sampleStep, z);
    const hD = heightSampler(x, z - sampleStep);
    const hU = heightSampler(x, z + sampleStep);
    const dx = (hR - hL) / (2 * sampleStep);
    const dz = (hU - hD) / (2 * sampleStep);
    return Math.sqrt(dx * dx + dz * dz);
  };
};

export const getHeightRangeForBiome = (biomeId: string) => {
  const config = getHeightConfig(biomeId);
  const max = config.amplitude + config.detailAmplitude;
  const min = -max * 0.6;
  return { min, max };
};
