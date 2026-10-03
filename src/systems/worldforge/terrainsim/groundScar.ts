/**
 * @file groundScar.ts — the geometry of one scar: where it reaches, how deep it
 * is at a point, and what colour its mark leaves there.
 *
 * This is pure math over the records in `types.ts`. It knows nothing about
 * time (that is `terrainSim.ts`), nothing about spells (that is
 * `spellScarFootprint.ts`), and nothing about Three.js.
 *
 * Why this is not `ThreeDModal/Experimental/DeformationManager`: that class
 * bakes every deformation into a shared height grid the moment it is applied.
 * Once baked, an individual deformation no longer exists, so it cannot heal on
 * its own schedule, cannot be serialized as a record, and cannot leave a mark
 * behind when it finishes. A ground scar must survive a save and heal per
 * record, so it stays a list of records that is SAMPLED, not a grid that is
 * STAMPED. The falloff curve below is deliberately the same smoothstep that
 * DeformationManager uses, so the two agree on the shape of a soft edge.
 */
import type { GroundScar, ScarCause, ScarMark, ScarPosition, ScarShape } from './types';
import { SCAR_CAUSES, healRateFor, weatheringRateFor } from './scarCauses';

/** Smoothstep, the repo's existing soft-edge curve (see DeformationManager). */
function smoothstep(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 3 * t * t - 2 * t * t * t;
}

/** The largest distance from `position` at which a shape can still have weight. */
export function scarReachM(shape: ScarShape): number {
  return shape.kind === 'channel' ? shape.radiusM + shape.halfLengthM : shape.radiusM;
}

/**
 * Footprint weight at a world point: 1 at the deepest part of the shape,
 * falling smoothly to 0 at its edge. `y` is ignored — a scar is a change to the
 * ground surface, not a volume.
 */
export function scarFootprintWeight(
  shape: ScarShape,
  position: ScarPosition,
  x: number,
  z: number,
): number {
  const dx = x - position.x;
  const dz = z - position.z;

  if (shape.kind === 'channel') {
    // Distance to the channel's centre segment (a capsule in the XZ plane).
    const ax = Math.cos(shape.angleRad);
    const az = Math.sin(shape.angleRad);
    const along = Math.max(-shape.halfLengthM, Math.min(shape.halfLengthM, dx * ax + dz * az));
    const px = dx - ax * along;
    const pz = dz - az * along;
    const dist = Math.hypot(px, pz);
    if (dist >= shape.radiusM) return 0;
    return smoothstep(1 - dist / shape.radiusM);
  }

  const dist = Math.hypot(dx, dz);
  if (dist >= shape.radiusM) return 0;
  if (shape.kind === 'patch') {
    // A patch is flat in the middle and only softens near its rim, so a scorch
    // reads as a stain with an edge rather than a radial gradient blob.
    const t = 1 - dist / shape.radiusM;
    return smoothstep(Math.min(1, t / 0.35));
  }
  return smoothstep(1 - dist / shape.radiusM);
}

/**
 * How far this scar lowers the ground at (x, z), in metres. Positive means
 * lower than generated. Returns 0 outside the footprint.
 */
export function scarDepthAt(scar: GroundScar, x: number, z: number): number {
  const w = scarFootprintWeight(scar.shape, scar.position, x, z);
  return w === 0 ? 0 : scar.depthM * w;
}

/**
 * Height offset (metres, signed, ready to ADD to a generated ground height)
 * from every scar in the list. A depression returns a negative number.
 *
 * Overlapping scars take the deepest one rather than summing: two Fireballs on
 * the same spot make one crater, not a well. Summation is what turns a busy
 * battle into a canyon, and it is the failure this rule exists to prevent.
 */
export function groundScarHeightOffsetAt(scars: readonly GroundScar[], x: number, z: number): number {
  let deepest = 0;
  let highest = 0;
  for (const scar of scars) {
    const d = scarDepthAt(scar, x, z);
    if (d > deepest) deepest = d;
    else if (d < highest) highest = d; // a raised lip / mound
  }
  // A mound and a pit in the same place cancel: the offset is the negation of
  // depth (depth is measured DOWN, the offset is measured UP). `|| 0` folds the
  // negative zero that negation produces on clean ground, so callers and tests
  // can compare against 0 with Object.is.
  return -deepest - highest || 0;
}

/**
 * Build a sampling closure over a fixed scar list, with an axis-aligned
 * pre-filter so a heightfield with one crater on it does not test every vertex
 * against every scar in the window.
 */
export function makeScarHeightField(
  scars: readonly GroundScar[],
): (x: number, z: number) => number {
  if (scars.length === 0) return () => 0;
  const boxed = scars.map((scar) => {
    const reach = scarReachM(scar.shape);
    return {
      scar,
      minX: scar.position.x - reach,
      maxX: scar.position.x + reach,
      minZ: scar.position.z - reach,
      maxZ: scar.position.z + reach,
    };
  });
  return (x: number, z: number): number => {
    let deepest = 0;
    let highest = 0;
    for (const b of boxed) {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      const d = scarDepthAt(b.scar, x, z);
      if (d > deepest) deepest = d;
      else if (d < highest) highest = d;
    }
    return -deepest - highest || 0;
  };
}

/**
 * The same field, but sampled in a GRID space whose horizontal unit is not a
 * metre — which is the battle map's situation: `makeTerrainHeightSampler` takes
 * TILE coordinates horizontally and returns METRES vertically, because tile
 * elevation is authored per tile. `metersPerUnit` is the width of one grid unit
 * in metres (a battle-map tile is BATTLE_MAP_CELL_SIZE_FEET × 0.3048 m), and
 * `origin` is the metre-space point that grid (0, 0) sits on.
 *
 * The returned offset stays in METRES, ready to add to the sampler's output.
 */
export function makeScarHeightFieldForGrid(
  scars: readonly GroundScar[],
  metersPerUnit: number,
  origin: { x: number; z: number } = { x: 0, z: 0 },
): (gridX: number, gridZ: number) => number {
  const field = makeScarHeightField(scars);
  if (scars.length === 0) return () => 0;
  return (gridX: number, gridZ: number): number =>
    field(origin.x + gridX * metersPerUnit, origin.z + gridZ * metersPerUnit);
}

/**
 * Colour multiplier the ground takes at (x, z) from every mark covering it,
 * as linear RGB in 0..1. `[1, 1, 1]` means untouched ground.
 *
 * A fully weathered mark returns to nearly white (a hint of tint remains,
 * because "a mark does not expire"). The strongest mark at a point wins, for
 * the same reason the deepest scar does.
 */
export function scarMarkTintAt(
  marks: readonly ScarMark[],
  x: number,
  z: number,
): [number, number, number] {
  let bestStrength = 0;
  let best: ScarMark | null = null;
  for (const mark of marks) {
    const w = scarFootprintWeight(mark.shape, mark.position, x, z);
    if (w === 0) continue;
    const strength = w * (1 - 0.85 * Math.min(1, Math.max(0, mark.weathering)));
    if (strength > bestStrength) {
      bestStrength = strength;
      best = mark;
    }
  }
  if (!best) return [1, 1, 1];
  const tint = SCAR_CAUSES[best.cause].markTint;
  return [
    1 + (tint[0] - 1) * bestStrength,
    1 + (tint[1] - 1) * bestStrength,
    1 + (tint[2] - 1) * bestStrength,
  ];
}

/** Input for `createGroundScar`, with the cause-table defaults left optional. */
export interface CreateGroundScarInput {
  id: string;
  position: ScarPosition;
  shape: ScarShape;
  depthM: number;
  cause: ScarCause;
  bornDay: number;
  /** Board's `decayRate`. Falls back to the cause table. */
  healMetersPerDay?: number;
  source?: GroundScar['source'];
}

/** Make a ground scar record. Pure; does not touch any sim state. */
export function createGroundScar(input: CreateGroundScarInput): GroundScar {
  return {
    id: input.id,
    position: { ...input.position },
    shape: { ...input.shape },
    depthM: input.depthM,
    bornDepthM: input.depthM,
    cause: input.cause,
    bornDay: input.bornDay,
    healMetersPerDay: input.healMetersPerDay ?? healRateFor(input.cause),
    ...(input.source ? { source: { ...input.source } } : {}),
  };
}

/** Input for `createScarMark`. Used directly by surface treatments (scorch). */
export interface CreateScarMarkInput {
  id: string;
  position: ScarPosition;
  shape: ScarShape;
  cause: ScarCause;
  bornDay: number;
  weathering?: number;
  weatheringPerDay?: number;
  source?: GroundScar['source'];
}

/** Make a scar mark record. */
export function createScarMark(input: CreateScarMarkInput): ScarMark {
  return {
    id: input.id,
    position: { ...input.position },
    shape: { ...input.shape },
    cause: input.cause,
    bornDay: input.bornDay,
    weathering: input.weathering ?? 0,
    weatheringPerDay: input.weatheringPerDay ?? weatheringRateFor(input.cause),
    ...(input.source ? { source: { ...input.source } } : {}),
  };
}

/**
 * The mark a healed scar leaves. Called by the sim the day a scar reaches zero
 * depth: "the scar record ends and its mark begins".
 *
 * The mark keeps the scar's footprint but is born flat and fresh, and it keeps
 * the scar's id so a caller that was watching a scar can still find what became
 * of it.
 */
export function markFromHealedScar(scar: GroundScar, day: number): ScarMark {
  return createScarMark({
    id: scar.id,
    position: scar.position,
    shape: scar.shape,
    cause: scar.cause,
    bornDay: day,
    source: scar.source,
  });
}
