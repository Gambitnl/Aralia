/**
 * @file terrainColor.ts
 * Map a biome id (+ height) to an RGB color for per-vertex terrain tinting.
 * Matches worldSim biome families plus a few common ids. Height shading darkens
 * lowlands slightly and lightens peaks.
 */
type RGB = [number, number, number];

const PALETTE: Record<string, RGB> = {
  ocean: [0.12, 0.28, 0.52],
  water: [0.16, 0.34, 0.58],
  desert: [0.82, 0.74, 0.48],
  plains: [0.46, 0.62, 0.34],
  grassland: [0.46, 0.62, 0.34],
  forest: [0.24, 0.44, 0.24],
  jungle: [0.18, 0.40, 0.20],
  tundra: [0.72, 0.74, 0.70],
  wetland: [0.34, 0.46, 0.34],
  swamp: [0.30, 0.40, 0.28],
  mountain: [0.46, 0.42, 0.40],
};

const FALLBACK: RGB = [0.45, 0.5, 0.4];

export function biomeColor(biomeId: string, height01: number): RGB {
  const base = PALETTE[biomeId] ?? FALLBACK;
  const shade = 0.92 + (height01 / 100) * 0.2;
  return [
    Math.max(0, Math.min(1, base[0] * shade)),
    Math.max(0, Math.min(1, base[1] * shade)),
    Math.max(0, Math.min(1, base[2] * shade)),
  ];
}
