/**
 * What the world is made of.
 *
 * Before this file the ground knew one thing about itself: the color of a cut
 * face, from a single hardcoded forest stack. That was enough to draw a crater
 * wall and enough for nothing else. A world where spells dig, water drains and
 * bodies walk has to answer harder questions, and every one of them is a
 * property of the substance rather than of the renderer:
 *
 * - How long does this take to dig, and does a spell stop at it? — `hardness`
 * - Does water sit on it, or sink through it? — `permeabilityMS`
 * - Does a cut wall stand, or slump into a cone? — `angleOfReposeDeg`
 * - How much does a collapse weigh? — `densityKgM3`
 *
 * Two rules hold here.
 *
 * The registry is TOTAL over the `Material` enum. A missing entry is an error,
 * not a default, which follows the same no-fallback discipline the biome and
 * culture tables already use. A substance that silently became topsoil would be
 * a bug nobody could see.
 *
 * The colors are LINEAR. A renderer converts linear to sRGB on the way out and
 * that lift is severe — linear 0.16 leaves as sRGB 0.44. Values that look like
 * reasonable soil in a color picker render as a sand dune.
 */
import { Material } from './voxelVolume';

export type SubstanceState = 'solid' | 'granular' | 'liquid' | 'gas';

export interface Substance {
  id: Material;
  /** What a player would call it. */
  label: string;
  /** Linear RGB. Never sRGB — see the note at the top of this file. */
  rgb: readonly [number, number, number];
  /** Bulk density in kilograms per cubic meter. Decides what a collapse weighs. */
  densityKgM3: number;
  /**
   * How hard it is to break, from 0 (loose litter) to 1 (fresh granite).
   *
   * A single scalar rather than a rock-mechanics model, on purpose. The
   * questions asked of it are "how long does this dig take" and "does this
   * spell reach", and both are monotone in one number.
   */
  hardness: number;
  /**
   * How fast water moves through it, in meters per second.
   *
   * Real hydraulic conductivity, which spans eight orders of magnitude between
   * gravel and granite. That range is the point: it is why a clay basin holds a
   * lake and a gravel bar does not.
   */
  permeabilityMS: number;
  /**
   * The steepest angle a cut face holds, in degrees.
   *
   * Sand slumps near 34 degrees. Rock stands near vertical. This is what stops
   * a dug pit in sand from keeping the sheer walls a voxel edit would give it.
   */
  angleOfReposeDeg: number;
  /** Traction underfoot, 0 to 1. Ice is the reason this exists. */
  friction: number;
  state: SubstanceState;
}

/** Every substance in the world, keyed by the value a voxel stores. */
export const SUBSTANCES: Readonly<Record<Material, Substance>> = {
  [Material.Air]: {
    id: Material.Air, label: 'air', rgb: [0, 0, 0],
    densityKgM3: 1.2, hardness: 0, permeabilityMS: 1, angleOfReposeDeg: 0,
    friction: 0, state: 'gas',
  },

  // Organic covers. Dark, light, and the first thing a shovel meets.
  [Material.Litter]: {
    id: Material.Litter, label: 'leaf litter', rgb: [0.055, 0.043, 0.026],
    densityKgM3: 220, hardness: 0.02, permeabilityMS: 1e-3, angleOfReposeDeg: 30,
    friction: 0.55, state: 'granular',
  },
  [Material.Turf]: {
    id: Material.Turf, label: 'turf', rgb: [0.048, 0.070, 0.030],
    densityKgM3: 900, hardness: 0.06, permeabilityMS: 1e-4, angleOfReposeDeg: 45,
    friction: 0.7, state: 'solid',
  },
  [Material.Peat]: {
    id: Material.Peat, label: 'peat', rgb: [0.030, 0.022, 0.016],
    densityKgM3: 400, hardness: 0.06, permeabilityMS: 1e-6, angleOfReposeDeg: 40,
    friction: 0.5, state: 'granular',
  },

  // Soils.
  [Material.Topsoil]: {
    id: Material.Topsoil, label: 'topsoil', rgb: [0.085, 0.062, 0.038],
    densityKgM3: 1300, hardness: 0.10, permeabilityMS: 1e-5, angleOfReposeDeg: 35,
    friction: 0.65, state: 'granular',
  },
  [Material.Subsoil]: {
    id: Material.Subsoil, label: 'subsoil', rgb: [0.165, 0.125, 0.080],
    densityKgM3: 1600, hardness: 0.18, permeabilityMS: 1e-6, angleOfReposeDeg: 38,
    friction: 0.65, state: 'granular',
  },
  [Material.Clay]: {
    id: Material.Clay, label: 'clay', rgb: [0.150, 0.095, 0.070],
    // Nine orders of magnitude below gravel. This one number is why a clay pan
    // holds standing water and a gravel bar cannot.
    densityKgM3: 1750, hardness: 0.22, permeabilityMS: 1e-9, angleOfReposeDeg: 50,
    friction: 0.6, state: 'granular',
  },
  [Material.Silt]: {
    id: Material.Silt, label: 'silt', rgb: [0.140, 0.125, 0.100],
    densityKgM3: 1500, hardness: 0.14, permeabilityMS: 1e-6, angleOfReposeDeg: 32,
    friction: 0.55, state: 'granular',
  },

  // Loose mineral.
  [Material.Sand]: {
    id: Material.Sand, label: 'sand', rgb: [0.330, 0.280, 0.190],
    densityKgM3: 1600, hardness: 0.08, permeabilityMS: 1e-4, angleOfReposeDeg: 34,
    friction: 0.5, state: 'granular',
  },
  [Material.Gravel]: {
    id: Material.Gravel, label: 'gravel', rgb: [0.200, 0.195, 0.185],
    densityKgM3: 1800, hardness: 0.25, permeabilityMS: 1e-2, angleOfReposeDeg: 37,
    friction: 0.7, state: 'granular',
  },

  // Cemented and frozen ground.
  [Material.Hardpan]: {
    id: Material.Hardpan, label: 'hardpan', rgb: [0.260, 0.225, 0.170],
    densityKgM3: 2000, hardness: 0.45, permeabilityMS: 1e-8, angleOfReposeDeg: 70,
    friction: 0.7, state: 'solid',
  },
  [Material.Permafrost]: {
    id: Material.Permafrost, label: 'permafrost', rgb: [0.130, 0.140, 0.150],
    densityKgM3: 1900, hardness: 0.50, permeabilityMS: 0, angleOfReposeDeg: 80,
    friction: 0.6, state: 'solid',
  },

  // Rock. The bottom of every stack.
  [Material.Limestone]: {
    id: Material.Limestone, label: 'limestone', rgb: [0.290, 0.285, 0.265],
    densityKgM3: 2500, hardness: 0.60, permeabilityMS: 1e-6, angleOfReposeDeg: 85,
    friction: 0.75, state: 'solid',
  },
  [Material.Sandstone]: {
    id: Material.Sandstone, label: 'sandstone', rgb: [0.300, 0.230, 0.160],
    densityKgM3: 2300, hardness: 0.55, permeabilityMS: 1e-6, angleOfReposeDeg: 80,
    friction: 0.75, state: 'solid',
  },
  [Material.Granite]: {
    id: Material.Granite, label: 'granite', rgb: [0.230, 0.222, 0.208],
    densityKgM3: 2700, hardness: 0.95, permeabilityMS: 1e-11, angleOfReposeDeg: 89,
    friction: 0.8, state: 'solid',
  },

  // Frozen and free water.
  [Material.Ice]: {
    id: Material.Ice, label: 'ice', rgb: [0.520, 0.600, 0.650],
    densityKgM3: 917, hardness: 0.35, permeabilityMS: 0, angleOfReposeDeg: 70,
    friction: 0.08, state: 'solid',
  },
  [Material.Snow]: {
    id: Material.Snow, label: 'snow', rgb: [0.800, 0.830, 0.870],
    densityKgM3: 300, hardness: 0.03, permeabilityMS: 1e-4, angleOfReposeDeg: 38,
    friction: 0.35, state: 'granular',
  },
  [Material.Water]: {
    id: Material.Water, label: 'water', rgb: [0.020, 0.045, 0.070],
    densityKgM3: 1000, hardness: 0, permeabilityMS: 1, angleOfReposeDeg: 0,
    friction: 0.02, state: 'liquid',
  },
};

/**
 * Look up a substance, or fail loudly.
 *
 * No fallback. A substance that silently became topsoil would be invisible in
 * play and would take an hour to find.
 */
export function substance(m: Material): Substance {
  const s = SUBSTANCES[m];
  if (!s) throw new Error(`No substance registered for material ${m}`);
  return s;
}

/** One band of a ground column, measured downward from the surface. */
export interface GroundBand {
  substance: Material;
  /** How far below the surface this band reaches, in meters. Last one is Infinity. */
  depthM: number;
}

/**
 * What lies under each biome, top to bottom.
 *
 * The table is TOTAL over the closed FMG vocabulary of 0 to 12, and an unknown
 * id throws. That mirrors `climateForBiomeId`, which already refuses to guess.
 *
 * Each stack is chosen so that DIGGING tells you where you are. A shovel in
 * wetland peat, in desert sand and on a glacier should all feel different, and
 * they do here because they meet different substances at different depths.
 */
export const BIOME_GROUND: Readonly<Record<number, readonly GroundBand[]>> = {
  // 0 Marine — a seabed: fine material over rock.
  0: [
    { substance: Material.Sand, depthM: 0.4 },
    { substance: Material.Silt, depthM: 2.0 },
    { substance: Material.Clay, depthM: 6.0 },
    { substance: Material.Limestone, depthM: Infinity },
  ],
  // 1 Hot desert — deep sand over a cemented pan, then sandstone.
  1: [
    { substance: Material.Sand, depthM: 1.5 },
    { substance: Material.Hardpan, depthM: 2.6 },
    { substance: Material.Sandstone, depthM: 9.0 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // 2 Cold desert — stony pavement, thin sand, pan.
  2: [
    { substance: Material.Gravel, depthM: 0.3 },
    { substance: Material.Sand, depthM: 1.2 },
    { substance: Material.Hardpan, depthM: 3.0 },
    { substance: Material.Sandstone, depthM: Infinity },
  ],
  // 3 Savanna — thin turf over clay that bakes hard.
  3: [
    { substance: Material.Turf, depthM: 0.08 },
    { substance: Material.Topsoil, depthM: 0.5 },
    { substance: Material.Clay, depthM: 2.5 },
    { substance: Material.Hardpan, depthM: 5.0 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // 4 Grassland — the deep dark soil that makes it grassland.
  4: [
    { substance: Material.Turf, depthM: 0.1 },
    { substance: Material.Topsoil, depthM: 0.75 },
    { substance: Material.Subsoil, depthM: 2.2 },
    { substance: Material.Limestone, depthM: Infinity },
  ],
  // 5 Tropical seasonal forest.
  5: [
    { substance: Material.Litter, depthM: 0.1 },
    { substance: Material.Topsoil, depthM: 0.5 },
    { substance: Material.Clay, depthM: 3.0 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // 6 Temperate deciduous forest — the original stack this file generalizes.
  6: [
    { substance: Material.Litter, depthM: 0.12 },
    { substance: Material.Topsoil, depthM: 0.55 },
    { substance: Material.Subsoil, depthM: 2.0 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // 7 Tropical rainforest — famously THIN soil over deep leached clay.
  7: [
    { substance: Material.Litter, depthM: 0.08 },
    { substance: Material.Topsoil, depthM: 0.3 },
    { substance: Material.Clay, depthM: 4.0 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // 8 Temperate rainforest — thick litter and peat, wet all the way down.
  8: [
    { substance: Material.Litter, depthM: 0.2 },
    { substance: Material.Peat, depthM: 0.6 },
    { substance: Material.Topsoil, depthM: 1.2 },
    { substance: Material.Subsoil, depthM: 3.0 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // 9 Taiga — needle litter over acid peat.
  9: [
    { substance: Material.Litter, depthM: 0.15 },
    { substance: Material.Peat, depthM: 0.7 },
    { substance: Material.Subsoil, depthM: 1.8 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // 10 Tundra — a thin living layer over ground that never thaws.
  10: [
    { substance: Material.Litter, depthM: 0.06 },
    { substance: Material.Peat, depthM: 0.4 },
    { substance: Material.Permafrost, depthM: 3.0 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // 11 Glacier — snow, then a great thickness of ice, then ground moraine.
  11: [
    { substance: Material.Snow, depthM: 0.6 },
    { substance: Material.Ice, depthM: 20.0 },
    { substance: Material.Gravel, depthM: 22.0 },
    { substance: Material.Granite, depthM: Infinity },
  ],
  // 12 Wetland — peat and silt, on clay that keeps the water in.
  12: [
    { substance: Material.Peat, depthM: 1.2 },
    { substance: Material.Silt, depthM: 2.5 },
    { substance: Material.Clay, depthM: 5.0 },
    { substance: Material.Limestone, depthM: Infinity },
  ],
};

/** The stack under a biome, or an error. Never a guess. */
export function groundStackForBiome(biomeId: number): readonly GroundBand[] {
  const stack = BIOME_GROUND[biomeId];
  if (!stack) {
    throw new Error(
      `No ground stack for biome id ${biomeId} (known ids: ${Object.keys(BIOME_GROUND).join(', ')})`,
    );
  }
  return stack;
}

/** The default when no biome is known: temperate deciduous forest. */
export const DEFAULT_STACK = BIOME_GROUND[6];

/** Which substance sits at a given depth below the surface. */
export function substanceAtDepth(
  depthM: number,
  stack: readonly GroundBand[] = DEFAULT_STACK,
): Substance {
  for (const band of stack) {
    if (depthM <= band.depthM || !Number.isFinite(band.depthM)) return substance(band.substance);
  }
  return substance(stack[stack.length - 1].substance);
}

/**
 * The color at a given depth, blended across each boundary.
 *
 * Blended rather than switched. A hard switch draws a contour line down a cut
 * face, and a real soil horizon is a transition a few centimeters thick, not a
 * drawn edge. The vegetation clump field learned the same lesson: a hard cutoff
 * is visible from across the room.
 */
export function colorAtDepth(
  depthM: number,
  stack: readonly GroundBand[] = DEFAULT_STACK,
): [number, number, number] {
  const BLEND_M = 0.06;
  for (let i = 0; i < stack.length; i++) {
    const band = stack[i];
    const here = substance(band.substance).rgb;
    if (depthM <= band.depthM || !Number.isFinite(band.depthM)) {
      const next = stack[i + 1];
      if (next && Number.isFinite(band.depthM) && depthM > band.depthM - BLEND_M) {
        const t = (depthM - (band.depthM - BLEND_M)) / BLEND_M;
        const to = substance(next.substance).rgb;
        return [
          here[0] + (to[0] - here[0]) * t,
          here[1] + (to[1] - here[1]) * t,
          here[2] + (to[2] - here[2]) * t,
        ];
      }
      return [here[0], here[1], here[2]];
    }
  }
  const last = substance(stack[stack.length - 1].substance).rgb;
  return [last[0], last[1], last[2]];
}

/**
 * How long one cubic meter takes to remove, in seconds, at a given effort.
 *
 * The shape matters more than the constant: hardness enters as a cube, so
 * granite is not twice the work of topsoil but hundreds of times, and a spell
 * that clears a peat bog will stop dead at rock. A linear scale made every
 * substance feel the same.
 */
export function digSecondsPerM3(m: Material, power = 1): number {
  const s = substance(m);
  if (s.state === 'gas' || s.state === 'liquid') return 0;
  const BASE = 30;
  return (BASE * (1 + 400 * s.hardness ** 3)) / Math.max(0.01, power);
}

/**
 * Does standing water survive on this substance, or drain away?
 *
 * The threshold is where conductivity crosses the rate at which a shallow pool
 * loses depth visibly. Below it a pond holds; above it the ground drinks.
 */
export function holdsWater(m: Material): boolean {
  return substance(m).permeabilityMS < 1e-5;
}
