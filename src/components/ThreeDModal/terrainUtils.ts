import { SeededRandom } from '../../utils/random/seededRandom';
import { PerlinNoise } from '../../utils/random/perlinNoise';

export interface HeightSamplerConfig {
  amplitude: number;
  frequency: number;
  detailAmplitude: number;
  detailFrequency: number;
  /** Fractal parameters (optional). */
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  /** Domain warp applied to the base coordinates (optional). */
  warpAmplitude?: number;
  warpFrequency?: number;
  /** Ridged noise mixed into the terrain (optional). */
  ridgeStrength?: number;
  ridgeFrequency?: number;
  /** Applies a constant vertical shift, in feet (optional). */
  baseOffset?: number;
  /** Macro feature toggles / tuning. */
  riverEnabled?: boolean;
  riverWidthFt?: number;
  riverDepthFt?: number;
  riverBankHeightFt?: number;
  pathEnabled?: boolean;
  pathWidthFt?: number;
  pathFlattenStrength?: number;
  clearingEnabled?: boolean;
  clearingRadiusFt?: number;
}

export interface MoistureSamplerConfig {
  base: number;
  variance: number;
  frequency: number;
  detailFrequency: number;
  riverBoost?: number;
  pathDrying?: number;
}

const getHeightConfig = (biomeId: string): HeightSamplerConfig => {
  switch (biomeId) {
    case 'mountain':
      return {
        amplitude: 210,
        frequency: 1.3,
        detailAmplitude: 55,
        detailFrequency: 6.2,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.05,
        warpAmplitude: 0.16,
        warpFrequency: 0.8,
        ridgeStrength: 1.1,
        ridgeFrequency: 2.2,
        riverEnabled: true,
        riverWidthFt: 120,
        riverDepthFt: 85,
        riverBankHeightFt: 22,
        pathEnabled: true,
        pathWidthFt: 28,
        pathFlattenStrength: 0.55,
        clearingEnabled: true,
        clearingRadiusFt: 340,
      };
    case 'hills':
      return {
        amplitude: 110,
        frequency: 1.2,
        detailAmplitude: 34,
        detailFrequency: 5.6,
        octaves: 4,
        persistence: 0.52,
        lacunarity: 2.0,
        warpAmplitude: 0.14,
        warpFrequency: 0.85,
        ridgeStrength: 0.65,
        ridgeFrequency: 1.9,
        riverEnabled: true,
        riverWidthFt: 95,
        riverDepthFt: 55,
        riverBankHeightFt: 15,
        pathEnabled: true,
        pathWidthFt: 28,
        pathFlattenStrength: 0.6,
        clearingEnabled: true,
        clearingRadiusFt: 380,
      };
    case 'desert':
      return {
        amplitude: 52,
        frequency: 1.0,
        detailAmplitude: 22,
        detailFrequency: 4.6,
        octaves: 3,
        persistence: 0.55,
        lacunarity: 2.05,
        warpAmplitude: 0.1,
        warpFrequency: 0.7,
        ridgeStrength: 0.25,
        ridgeFrequency: 1.2,
        riverEnabled: false,
        pathEnabled: true,
        pathWidthFt: 34,
        pathFlattenStrength: 0.5,
        clearingEnabled: true,
        clearingRadiusFt: 420,
      };
    case 'swamp':
      return {
        amplitude: 30,
        frequency: 1.0,
        detailAmplitude: 12,
        detailFrequency: 4.2,
        octaves: 3,
        persistence: 0.55,
        lacunarity: 2.0,
        warpAmplitude: 0.12,
        warpFrequency: 0.75,
        ridgeStrength: 0.15,
        ridgeFrequency: 1.1,
        baseOffset: -6,
        riverEnabled: true,
        riverWidthFt: 150,
        riverDepthFt: 28,
        riverBankHeightFt: 10,
        pathEnabled: true,
        pathWidthFt: 26,
        pathFlattenStrength: 0.45,
        clearingEnabled: true,
        clearingRadiusFt: 300,
      };
    case 'ocean':
      return {
        amplitude: 20,
        frequency: 0.75,
        detailAmplitude: 7,
        detailFrequency: 3.1,
        octaves: 3,
        persistence: 0.55,
        lacunarity: 2.0,
        warpAmplitude: 0.1,
        warpFrequency: 0.7,
        ridgeStrength: 0.05,
        ridgeFrequency: 0.9,
        baseOffset: -25,
        riverEnabled: false,
        pathEnabled: false,
        clearingEnabled: false,
      };
    case 'cave':
    case 'dungeon':
      return {
        amplitude: 38,
        frequency: 1.1,
        detailAmplitude: 20,
        detailFrequency: 4.2,
        octaves: 3,
        persistence: 0.55,
        lacunarity: 2.0,
        warpAmplitude: 0.08,
        warpFrequency: 0.9,
        ridgeStrength: 0.35,
        ridgeFrequency: 2.0,
        riverEnabled: false,
        pathEnabled: false,
        clearingEnabled: false,
      };
    case 'forest':
      return {
        amplitude: 68,
        frequency: 1.1,
        detailAmplitude: 26,
        detailFrequency: 4.6,
        octaves: 4,
        persistence: 0.52,
        lacunarity: 2.0,
        warpAmplitude: 0.16,
        warpFrequency: 0.9,
        ridgeStrength: 0.35,
        ridgeFrequency: 1.6,
        riverEnabled: true,
        riverWidthFt: 110,
        riverDepthFt: 40,
        riverBankHeightFt: 14,
        pathEnabled: true,
        pathWidthFt: 26,
        pathFlattenStrength: 0.6,
        clearingEnabled: true,
        clearingRadiusFt: 360,
      };
    case 'plains':
      return {
        amplitude: 50,
        frequency: 0.95,
        detailAmplitude: 18,
        detailFrequency: 4.3,
        octaves: 3,
        persistence: 0.55,
        lacunarity: 2.0,
        warpAmplitude: 0.12,
        warpFrequency: 0.85,
        ridgeStrength: 0.2,
        ridgeFrequency: 1.4,
        riverEnabled: true,
        riverWidthFt: 95,
        riverDepthFt: 30,
        riverBankHeightFt: 10,
        pathEnabled: true,
        pathWidthFt: 30,
        pathFlattenStrength: 0.65,
        clearingEnabled: true,
        clearingRadiusFt: 440,
      };
    default:
      return {
        amplitude: 34,
        frequency: 1.0,
        detailAmplitude: 12,
        detailFrequency: 3.4,
        octaves: 3,
        persistence: 0.55,
        lacunarity: 2.0,
        warpAmplitude: 0.12,
        warpFrequency: 0.85,
        ridgeStrength: 0.2,
        ridgeFrequency: 1.4,
        riverEnabled: true,
        riverWidthFt: 95,
        riverDepthFt: 25,
        riverBankHeightFt: 10,
        pathEnabled: true,
        pathWidthFt: 28,
        pathFlattenStrength: 0.6,
        clearingEnabled: true,
        clearingRadiusFt: 380,
      };
  }
};

const getMoistureConfig = (biomeId: string): MoistureSamplerConfig => {
  switch (biomeId) {
    case 'ocean':
      return { base: 0.95, variance: 0.2, frequency: 0.55, detailFrequency: 2.4, riverBoost: 0, pathDrying: 0 };
    case 'swamp':
      return { base: 0.78, variance: 0.25, frequency: 0.85, detailFrequency: 3.0, riverBoost: 0.22, pathDrying: 0.06 };
    case 'forest':
      return { base: 0.56, variance: 0.25, frequency: 0.85, detailFrequency: 3.2, riverBoost: 0.24, pathDrying: 0.08 };
    case 'plains':
      return { base: 0.35, variance: 0.2, frequency: 0.78, detailFrequency: 3.0, riverBoost: 0.2, pathDrying: 0.09 };
    case 'desert':
      return { base: 0.12, variance: 0.1, frequency: 0.7, detailFrequency: 2.6, riverBoost: 0.12, pathDrying: 0.12 };
    case 'mountain':
    case 'hills':
      return { base: 0.3, variance: 0.2, frequency: 0.72, detailFrequency: 2.8, riverBoost: 0.18, pathDrying: 0.08 };
    case 'cave':
    case 'dungeon':
      return { base: 0.42, variance: 0.15, frequency: 0.78, detailFrequency: 2.3, riverBoost: 0, pathDrying: 0 };
    default:
      return { base: 0.35, variance: 0.2, frequency: 0.8, detailFrequency: 2.8, riverBoost: 0.18, pathDrying: 0.08 };
  }
};

type Vec2 = { x: number; z: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const distanceToSegment = (p: Vec2, a: Vec2, b: Vec2) => {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const apx = p.x - a.x;
  const apz = p.z - a.z;
  const abLenSq = abx * abx + abz * abz;
  if (abLenSq < 1e-6) return Math.hypot(apx, apz);
  const t = clamp((apx * abx + apz * abz) / abLenSq, 0, 1);
  const cx = a.x + abx * t;
  const cz = a.z + abz * t;
  return Math.hypot(p.x - cx, p.z - cz);
};

const distanceToPolyline = (p: Vec2, points: Vec2[]) => {
  if (points.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const d = distanceToSegment(p, points[i], points[i + 1]);
    if (d < best) best = d;
  }
  return best;
};

const fbm = (noise: PerlinNoise, x: number, z: number, octaves: number, lacunarity: number, persistence: number) => {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;

  for (let i = 0; i < octaves; i += 1) {
    sum += noise.get(x * frequency, z * frequency) * amplitude;
    norm += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return norm > 0 ? sum / norm : 0;
};

const ridgedFbm = (noise: PerlinNoise, x: number, z: number, octaves: number, lacunarity: number, persistence: number) => {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;

  for (let i = 0; i < octaves; i += 1) {
    const n = noise.get(x * frequency, z * frequency);
    // Ridged noise: valleys near 0, peaks near 1.
    const r = 1 - Math.abs(n);
    sum += (r * r) * amplitude;
    norm += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return norm > 0 ? sum / norm : 0;
};

type TerrainFeatureMasks = {
  river: number;
  riverBank: number;
  path: number;
  clearing: number;
};

export interface TerrainSamplers {
  heightSampler: (x: number, z: number) => number;
  moistureSampler: (x: number, z: number) => number;
  slopeSampler: (x: number, z: number) => number;
  featureSampler: (x: number, z: number) => TerrainFeatureMasks;
  heightRange: { min: number; max: number };
}

const buildPolyline = (rng: SeededRandom, size: number, axis: 'x' | 'z'): Vec2[] => {
  const half = size / 2;
  const span = half * 0.85;
  const points: Vec2[] = [];

  if (axis === 'x') {
    const z0 = (rng.next() * 2 - 1) * span;
    const z1 = (rng.next() * 2 - 1) * span;
    points.push({ x: -half, z: z0 });
    points.push({ x: -half * 0.3, z: lerp(z0, z1, 0.33) + (rng.next() * 2 - 1) * span * 0.18 });
    points.push({ x: 0, z: lerp(z0, z1, 0.55) + (rng.next() * 2 - 1) * span * 0.2 });
    points.push({ x: half * 0.35, z: lerp(z0, z1, 0.8) + (rng.next() * 2 - 1) * span * 0.16 });
    points.push({ x: half, z: z1 });
    return points;
  }

  const x0 = (rng.next() * 2 - 1) * span;
  const x1 = (rng.next() * 2 - 1) * span;
  points.push({ x: x0, z: -half });
  points.push({ x: lerp(x0, x1, 0.33) + (rng.next() * 2 - 1) * span * 0.18, z: -half * 0.3 });
  points.push({ x: lerp(x0, x1, 0.55) + (rng.next() * 2 - 1) * span * 0.2, z: 0 });
  points.push({ x: lerp(x0, x1, 0.8) + (rng.next() * 2 - 1) * span * 0.16, z: half * 0.35 });
  points.push({ x: x1, z: half });
  return points;
};

export const createTerrainSamplers = (seed: number, biomeId: string, size: number): TerrainSamplers => {
  const heightConfig = getHeightConfig(biomeId);
  const moistureConfig = getMoistureConfig(biomeId);
  const baseOctaves = heightConfig.octaves ?? 3;
  const persistence = heightConfig.persistence ?? 0.55;
  const lacunarity = heightConfig.lacunarity ?? 2.0;
  const warpAmp = heightConfig.warpAmplitude ?? 0.12;
  const warpFreq = heightConfig.warpFrequency ?? 0.85;
  const ridgeStrength = heightConfig.ridgeStrength ?? 0.25;
  const ridgeFreq = heightConfig.ridgeFrequency ?? 1.4;
  const baseOffset = heightConfig.baseOffset ?? 0;

  const baseNoise = new PerlinNoise(seed);
  const detailNoise = new PerlinNoise(seed + 1337);
  const ridgeNoise = new PerlinNoise(seed + 7331);
  const warpNoiseX = new PerlinNoise(seed + 404);
  const warpNoiseZ = new PerlinNoise(seed + 505);

  // Shared macro features so height/moisture agree about where the terrain is "special".
  const featureRng = new SeededRandom(seed + 90210);
  const pathAxis: 'x' | 'z' = featureRng.next() < 0.5 ? 'x' : 'z';
  const riverAxis: 'x' | 'z' = pathAxis === 'x' ? 'z' : 'x';
  const pathPoints = heightConfig.pathEnabled ? buildPolyline(new SeededRandom(seed + 8200), size, pathAxis) : [];
  const riverPoints = heightConfig.riverEnabled ? buildPolyline(new SeededRandom(seed + 8300), size, riverAxis) : [];
  const clearingCenter: Vec2 | null = heightConfig.clearingEnabled
    ? { x: (featureRng.next() * 2 - 1) * (size * 0.22), z: (featureRng.next() * 2 - 1) * (size * 0.22) }
    : null;
  const clearingRadius = heightConfig.clearingRadiusFt ?? 360;
  const riverWidth = heightConfig.riverWidthFt ?? 110;
  const riverDepth = heightConfig.riverDepthFt ?? 40;
  const riverBankHeight = heightConfig.riverBankHeightFt ?? 12;
  const pathWidth = heightConfig.pathWidthFt ?? 28;
  const pathFlatten = heightConfig.pathFlattenStrength ?? 0.6;

  const featureSampler = (x: number, z: number): TerrainFeatureMasks => {
    const p = { x, z };

    const pathDist = pathPoints.length ? distanceToPolyline(p, pathPoints) : Infinity;
    const pathMask = pathDist === Infinity ? 0 : 1 - smoothstep(pathWidth * 0.55, pathWidth, pathDist);

    const riverDist = riverPoints.length ? distanceToPolyline(p, riverPoints) : Infinity;
    const riverMask = riverDist === Infinity ? 0 : 1 - smoothstep(riverWidth * 0.45, riverWidth, riverDist);
    const riverBankMask = riverDist === Infinity
      ? 0
      : smoothstep(riverWidth * 0.55, riverWidth * 0.95, riverDist) * (1 - smoothstep(riverWidth * 1.05, riverWidth * 1.7, riverDist));

    const clearingDist = clearingCenter ? Math.hypot(x - clearingCenter.x, z - clearingCenter.z) : Infinity;
    const clearingMask = clearingDist === Infinity ? 0 : 1 - smoothstep(clearingRadius, clearingRadius * 1.2, clearingDist);

    return {
      river: riverMask,
      riverBank: riverBankMask,
      path: pathMask,
      clearing: clearingMask,
    };
  };

  const heightSampler = (x: number, z: number) => {
    const nx = x / size;
    const nz = z / size;

    // Domain-warped coordinates: prevents the "samey" repeating look where all
    // terrain is aligned to axes.
    const wx = nx + warpNoiseX.get(nx * warpFreq, nz * warpFreq) * warpAmp;
    const wz = nz + warpNoiseZ.get(nx * warpFreq, nz * warpFreq) * warpAmp;

    const base = fbm(baseNoise, wx * heightConfig.frequency, wz * heightConfig.frequency, baseOctaves, lacunarity, persistence);
    const ridges = ridgeStrength > 0
      ? ridgedFbm(ridgeNoise, wx * ridgeFreq, wz * ridgeFreq, Math.max(2, Math.round(baseOctaves * 0.75)), lacunarity, persistence)
      : 0;
    const detail = fbm(detailNoise, wx * heightConfig.detailFrequency + 100, wz * heightConfig.detailFrequency + 100, 2, 2.0, 0.55);

    let height = base * heightConfig.amplitude + detail * heightConfig.detailAmplitude + ridges * heightConfig.amplitude * ridgeStrength;

    const masks = featureSampler(x, z);
    if (masks.river > 0) height -= riverDepth * masks.river;
    if (masks.riverBank > 0) height += riverBankHeight * masks.riverBank;
    if (masks.path > 0) height = lerp(height, height * 0.5, masks.path * pathFlatten);
    if (masks.clearing > 0) height = lerp(height, height * 0.65, masks.clearing * 0.65);

    return height + baseOffset;
  };

  const moistureSampler = (x: number, z: number) => {
    const nx = x / size;
    const nz = z / size;
    const base = baseNoise.get(nx * moistureConfig.frequency + 33, nz * moistureConfig.frequency + 33);
    const detail = detailNoise.get(nx * moistureConfig.detailFrequency + 200, nz * moistureConfig.detailFrequency + 200);

    let value = moistureConfig.base + base * moistureConfig.variance + detail * moistureConfig.variance * 0.45;

    // Altitude proxy drying: keep this cheap (do not call heightSampler here).
    // We bias mountains/hills slightly drier at the highest macro values so
    // vegetation thins naturally.
    const altitudeProxy = (baseNoise.get(nx * 0.35 + 99, nz * 0.35 + 99) + 1) * 0.5; // [0,1]
    const biomeDrying = biomeId === 'mountain' || biomeId === 'hills' ? 0.1 : 0.06;
    value -= smoothstep(0.65, 0.95, altitudeProxy) * biomeDrying;

    const masks = featureSampler(x, z);
    if (masks.river > 0) value += (moistureConfig.riverBoost ?? 0.2) * masks.river;
    if (masks.path > 0) value -= (moistureConfig.pathDrying ?? 0.08) * masks.path;

    return clamp(value, 0, 1);
  };

  const slopeSampler = createSlopeSampler(heightSampler, 12);

  const max = (heightConfig.amplitude * (1 + ridgeStrength)) + heightConfig.detailAmplitude + (heightConfig.riverBankHeightFt ?? 0);
  const min = (baseOffset - max * 0.62) - (heightConfig.riverDepthFt ?? 0);

  return {
    heightSampler,
    moistureSampler,
    slopeSampler,
    featureSampler,
    heightRange: { min, max: max + baseOffset },
  };
};

export const createHeightSampler = (seed: number, biomeId: string, size: number) => (
  createTerrainSamplers(seed, biomeId, size).heightSampler
);

export const createMoistureSampler = (seed: number, biomeId: string, size: number) => (
  createTerrainSamplers(seed, biomeId, size).moistureSampler
);

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
  const ridgeStrength = config.ridgeStrength ?? 0;
  const riverDepth = config.riverDepthFt ?? 0;
  const bankHeight = config.riverBankHeightFt ?? 0;
  const baseOffset = config.baseOffset ?? 0;
  const max = (config.amplitude * (1 + ridgeStrength)) + config.detailAmplitude + bankHeight + baseOffset;
  const min = (baseOffset - max * 0.62) - riverDepth;
  return { min, max };
};
