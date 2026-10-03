/**
 * @file groundPatch.ts — local ground co-deformation for Phase B.
 *
 * Method source: arXiv 2608.05248 ("WorldClaw"), Phase B. When a transform
 * cannot seat an object, the ground under it moves instead. The paper calls
 * this co-deformation and leaves the shape of the edit open.
 *
 * The shape chosen here is a PAD: a circular core that follows the object's
 * base, and a smoothstep feather that returns to the untouched terrain. A pad
 * is the only edit that cannot leave a crease, because its weight and its
 * first derivative both reach zero at the feather edge.
 *
 * This file NEVER writes to the terrain modules. It wraps a `SurfaceProbe` and
 * returns a new probe. The owning terrain system reads `patches()` when it
 * wants to bake the edit into a real heightfield.
 *
 * Units: FEET.
 */
import { makeFieldSurfaceProbe, type SurfaceProbe } from '../terrain/surfaceProbe';

/** One local ground edit. Immutable once added. */
export interface GroundPatch {
  /** Instance that asked for the edit. Names the patch in the report. */
  ownerId: string;
  centerXFt: number;
  centerZFt: number;
  /** Radius of the full-weight core, feet. Normally the footprint radius. */
  coreRadiusFt: number;
  /**
   * Width of the falloff ring outside the core, feet.
   *
   * The corrector passes 1.5x the core radius. A feather narrower than the
   * core reads as a raised disc; wider than 2x starts to move ground the
   * object never touches.
   */
  featherFt: number;
  /** Rigid vertical shift of the pad, feet. Positive lifts the ground. */
  deltaFt: number;
  /** 0..1 blend of the pad toward `planeYFt`. 1 = fully flat pad. */
  flatten: number;
  /** Target plane the flatten blends toward, feet. */
  planeYFt: number;
  /** Hard cap on the elevation change this patch may produce, feet. */
  maxChangeFt: number;
}

/** A probe whose ground can be edited. Still a plain `SurfaceProbe` to callers. */
export interface DeformableSurface extends SurfaceProbe {
  addPatch(patch: GroundPatch): void;
  /** Every patch applied, oldest first. The terrain owner bakes these. */
  patches(): readonly GroundPatch[];
  /** Total elevation change this stack applies at one point, feet. */
  deltaAt(xFt: number, zFt: number): number;
}

/** Smoothstep weight: 1 inside the core, 0 past the feather, C1 at both ends. */
export function patchWeight(patch: GroundPatch, xFt: number, zFt: number): number {
  const d = Math.hypot(xFt - patch.centerXFt, zFt - patch.centerZFt);
  if (d <= patch.coreRadiusFt) return 1;
  const outer = patch.coreRadiusFt + patch.featherFt;
  if (d >= outer || patch.featherFt <= 0) return 0;
  const t = 1 - (d - patch.coreRadiusFt) / patch.featherFt;
  return t * t * (3 - 2 * t);
}

/**
 * Wrap a probe so patches can be laid over it.
 *
 * Slope and normal are recomputed by finite difference over the PATCHED
 * elevation, so a corrected pad reports the flat slope it now has. Reusing
 * the base probe's slope would lie about ground this file just changed.
 *
 * `finiteDifferenceFt` defaults to 5 ft, one combat cell — the same step
 * `makeFieldSurfaceProbe` uses, so an unpatched point reads identically to the
 * base probe.
 */
export function makeDeformableSurface(
  base: SurfaceProbe,
  finiteDifferenceFt = 5,
): DeformableSurface {
  /** A patch plus the amplitude limit resolved when it was added. */
  interface AppliedPatch {
    patch: GroundPatch;
    /**
     * 0..1 multiplier on the whole pad.
     *
     * The cap scales the WHOLE pad, it does not clip each point. Clipping each
     * point would drive the core to the cap and leave the feather short, which
     * builds a mesa with a hard rim — the exact crease the pad shape exists to
     * avoid. Scaling the amplitude keeps the shape and only slows the move, so
     * the next iteration finishes it.
     *
     * Resolved ONCE, at add time, against the surface the patch actually
     * landed on. Re-resolving per sample would make the pad's own weight
     * change its cap, and the pad would no longer be a fixed edit.
     */
    amplitude: number;
  }

  const applied: AppliedPatch[] = [];

  /** Change one patch contributes at a point, given the ground below it. */
  const changeOf = (ap: AppliedPatch, xFt: number, zFt: number, belowY: number): number => {
    const p = ap.patch;
    const w = patchWeight(p, xFt, zFt);
    if (w <= 0) return 0;
    const shifted = belowY + p.deltaFt;
    const target = shifted + (p.planeYFt - shifted) * p.flatten;
    return (target - belowY) * w * ap.amplitude;
  };

  const elevation = (xFt: number, zFt: number): number => {
    let y = base.sampleAt(xFt, zFt).elevationFt;
    for (const ap of applied) y += changeOf(ap, xFt, zFt, y);
    return y;
  };

  const deltaAt = (xFt: number, zFt: number): number =>
    elevation(xFt, zFt) - base.sampleAt(xFt, zFt).elevationFt;

  const field = makeFieldSurfaceProbe(elevation, {
    epsilonXFt: finiteDifferenceFt,
    epsilonZFt: finiteDifferenceFt,
  });

  return {
    sampleAt: (xFt, zFt) => field.sampleAt(xFt, zFt),
    addPatch: (patch) => {
      // Resolve the amplitude cap against the surface as it stands right now.
      const belowY = elevation(patch.centerXFt, patch.centerZFt);
      const shifted = belowY + patch.deltaFt;
      const target = shifted + (patch.planeYFt - shifted) * patch.flatten;
      const want = Math.abs(target - belowY);
      const amplitude = want <= patch.maxChangeFt || want === 0 ? 1 : patch.maxChangeFt / want;
      applied.push({ patch, amplitude });
    },
    patches: () => applied.map((a) => a.patch),
    deltaAt,
  };
}
