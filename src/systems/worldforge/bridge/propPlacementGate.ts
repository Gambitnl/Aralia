/**
 * @file propPlacementGate.ts — the bridge between a GroundWorld and the two
 * placement passes that were built but never called.
 *
 * TWO THINGS LIVE HERE.
 *
 *  1. `makeGroundWorldProbe` — a `SurfaceProbe` over the ground window's own
 *     heightfield. `groundToPlacementContext` hands it to the prop engine, so
 *     the stage-2 surface gate finally reads the ground it aims at. Before this
 *     the context carried no probe, `placePropsInstrumented` reported
 *     `considered: 0`, and every prop passed un-gated.
 *
 *  2. `runPropPlacementGate` — the WorldClaw refinement loop (placement/gate.ts)
 *     applied to placed props on the town and region surfaces, and to the crop
 *     of props a battle map extracts.
 *
 * UNITS. The probe and the gate are FEET (Worldforge is feet-canon).
 * `PropInstance` is METERS. Every crossing is explicit and happens here.
 *
 * PERF. Everything in this file runs at BAKE time — once per ground window, or
 * once per battle-map extraction. Nothing here may be called per frame.
 */
import {
  FEET_PER_METER,
  makeGridSurfaceProbe,
  type SurfaceProbe,
} from '../terrain/surfaceProbe';
import {
  fromMeterInstances,
  propSpeciesKey,
  runPlacementGate,
  SURFACE_THRESHOLDS,
  type GateResult,
  type MeterInstance,
  type PlacementSurface,
} from '../placement/gate';
import type { LocalBoundsFt } from '../placement/placedObject';
import type { DeformableSurface } from '../placement/groundPatch';
import { CELL_METERS, type PropInstance, type PropSizeClass } from '../props/propSchema';
import { PROPS_BY_ID, surfaceGateFor } from '../props/catalog';
import { heightToMeters } from '../../world3d/config';
import { GROUND_METERS_PER_CELL } from './groundWorldAdapter';

/** The slice of a GroundWorld this file reads. Keeps the module cycle-free. */
export interface GroundHeightField {
  /** 0..100 encoded heights, row-major (groundWorldAdapter domain). */
  heights: number[];
  cols: number;
  rows: number;
}

/** One combat cell in feet — the ground grid pitch. */
const CELL_FT = GROUND_METERS_PER_CELL * FEET_PER_METER;

/**
 * A probe over the ground window's heightfield, in feet.
 *
 * The elevations are the RENDERED surface: `heightToMeters` is the single source
 * of truth for the encoded-height → meters mapping, and `groundSurfaceY` reads
 * the same grid with the same bilinear filter. So a prop fitted against this
 * probe meets the ground the player actually walks on.
 *
 * Returns `null` for a grid too small to hold a gradient. That is an honest
 * "no gate ran", NOT a pass: the caller leaves `ctx.surface` undefined and
 * `placePropsInstrumented` then reports `considered: 0`, which is visible.
 */
export function makeGroundWorldProbe(ground: GroundHeightField): SurfaceProbe | null {
  const { cols, rows, heights } = ground;
  if (cols < 2 || rows < 2) return null;
  if (heights.length < cols * rows) return null;
  const elevationsFt = new Float32Array(cols * rows);
  for (let i = 0; i < elevationsFt.length; i++) {
    elevationsFt[i] = heightToMeters(heights[i] ?? 0) * FEET_PER_METER;
  }
  return makeGridSurfaceProbe({
    elevationsFt,
    cols,
    rows,
    cellSizeXFt: CELL_FT,
    cellSizeZFt: CELL_FT,
  });
}

// ── Prop → PlacedObject bounds ───────────────────────────────────────────────

/**
 * Nominal upright height per prop size class, feet — the MIDPOINT of the band
 * `DEFAULT_HEIGHT_RANGES` accepts for `prop-S` / `prop-M` / `prop-L`.
 *
 * A prop definition carries a size class, not a mesh. So the loop judges a prop
 * against its class nominal, and `scaleMutable: false` stops the corrector from
 * rescaling art to satisfy a nominal it invented. Only the POSE moves.
 */
const CLASS_HEIGHT_FT: Readonly<Record<PropSizeClass, number>> = Object.freeze({
  S: 2.75,
  M: 6.25,
  L: 17.5,
});

/**
 * Local bounds for one prop, feet.
 *
 * The half-extent is the catalog's OWN `baseRadiusFt` — the same number the
 * surface gate sinks the prop by. The referee size class is a cell footprint
 * (an S prop "fits in one 5 ft cell"), which is a claim about the tiles it
 * occupies, not about the width of the mesh that touches the ground. Judging a
 * 3 ft crate as a 5 ft slab reported floaters that do not exist.
 *
 * `minY = 0` on purpose: the prop renderers place a prop by its BASE, so the
 * object origin and the base plane coincide, and the loop's corrected
 * `positionFt.y` is directly the Y the renderer uses.
 */
export function propLocalBounds(sizeClass: PropSizeClass, baseRadiusFt: number): LocalBoundsFt {
  const r = baseRadiusFt > 0 ? baseRadiusFt : CELL_METERS * 0.5 * FEET_PER_METER;
  return { minX: -r, minY: 0, minZ: -r, maxX: r, maxY: CLASS_HEIGHT_FT[sizeClass], maxZ: r };
}

/**
 * Lower-hull profile of a TILTED base, feet above the object's lowest point.
 *
 * The refinement loop scores a level box. A prop that the surface gate leaned
 * into the slope is not a level box, and scoring it as one reports a floater
 * under every prop on any consistent grade. `lowerHullFt` is the hook the loop
 * already provides for a non-flat underside, so the lean is expressed there.
 *
 * The tilt axis arrives in WORLD XZ and the hook is called with LOCAL, unscaled
 * XZ, so the axis is turned back through the prop's own yaw first.
 *
 * SIGN. `fitToSurface` builds its axis as `[-nz, nx] / |n_xz|`. Turning about
 * THAT axis by +tiltRad under the right-hand rule lifts the base on the DOWNHILL
 * side — it leans the prop away from the ground, not onto it. Following the
 * ground needs the opposite turn, so the sign is applied here, once, and
 * `GroundProps.tsx` turns the mesh by the matching `-tiltRad`. Measured on a
 * live port window: a crate on a 7.2 deg grade spans 0.52 ft of footprint gap
 * untilted, 0.74 ft with the naive sign, and 0.31 ft with this one.
 */
export function tiltedLowerHull(
  tiltRad: number,
  tiltAxisWorld: readonly [number, number],
  yawRad: number,
  halfExtentFt: number,
): ((localX: number, localZ: number) => number) | undefined {
  if (!tiltRad) return undefined;
  const len = Math.hypot(tiltAxisWorld[0], tiltAxisWorld[1]);
  if (len < 1e-9) return undefined;
  const ax = tiltAxisWorld[0] / len;
  const az = tiltAxisWorld[1] / len;
  const cos = Math.cos(yawRad);
  const sin = Math.sin(yawRad);
  // Inverse of the yaw `footprintSamples` applies: local = R(-yaw) * world.
  const axL = ax * cos + az * sin;
  const azL = -ax * sin + az * cos;
  const s = Math.sin(-tiltRad);
  // Rise of a point turned about a horizontal axis. Offset so the LOWEST corner
  // of the footprint reads 0, which is what "above the base plane" means.
  const offset = (Math.abs(axL) + Math.abs(azL)) * halfExtentFt * Math.abs(s);
  return (localX: number, localZ: number) => (azL * localX - axL * localZ) * s + offset;
}

/** The render Y of a placed prop's base, meters. Reads the baked surface fit. */
export function propBaseYM(prop: PropInstance, probe: SurfaceProbe): number {
  if (prop.surface) return prop.surface.groundYM - prop.surface.sinkM;
  // No baked fit means no probe reached this prop. Read the ground directly
  // rather than guessing zero — a wrong Y would make the gate report noise.
  return probe.sampleAt(prop.xM * FEET_PER_METER, prop.zM * FEET_PER_METER).elevationFt / FEET_PER_METER;
}

// ── The gate, applied to props ───────────────────────────────────────────────

export interface PropGateOptions {
  /** 'town' | 'region' report; 'battlemap' throws. Sets the threshold profile. */
  surface: PlacementSurface;
  /**
   * true = the corrector may lay ground pads. The caller MUST then bake
   * `result.report.surface` deltas into the terrain it renders, or the pads
   * exist only in the loop's memory and the props float again.
   */
  groundMutable: boolean;
  report?: (line: string) => void;
  throwOnFailure?: boolean;
  /**
   * Extra iterations for the surface's own profile. Raises ONLY the budget —
   * every tolerance stays exactly as the profile authored it, so the standard
   * the gate holds objects to does not move. A ground pad may change the
   * terrain by one foot per iteration, and a battle-map crop cut out of ground
   * rendered at 12x vertical exaggeration can need more than eight of those to
   * seat a boulder in a ravine.
   */
  iterationBudget?: number;
}

export interface PropGateOutcome {
  /** The props with their corrected base Y folded back into `surface`. */
  props: PropInstance[];
  /** null only when the window had no probe or no props — never a silent pass. */
  result: GateResult | null;
  /** Present when `groundMutable` was true. Bake this, or the pads are a lie. */
  patchedSurface: DeformableSurface | null;
}

/**
 * Run the WorldClaw refinement loop over placed props.
 *
 * The loop corrects the POSE only (`scaleMutable: false`), so a crate that
 * floats is lowered onto the ground and a crate the ground cannot hold is
 * REPORTED. Nothing is dropped and nothing is nudged in silence.
 */
export function runPropPlacementGate(
  props: readonly PropInstance[],
  probe: SurfaceProbe | null,
  opts: PropGateOptions,
): PropGateOutcome {
  if (!probe || props.length === 0) {
    return { props: [...props], result: null, patchedSurface: null };
  }

  const meters: MeterInstance[] = [];
  const gated: number[] = []; // index into `props` for every entry in `meters`
  const halfExtents: number[] = [];
  props.forEach((p, i) => {
    const def = PROPS_BY_ID.get(p.defId);
    if (!def) return; // unknown def: the catalog owns that failure, not the gate
    const baseRadiusFt = surfaceGateFor(p.defId).baseRadiusFt;
    const bounds = propLocalBounds(def.sizeClass, baseRadiusFt);
    meters.push({
      id: `${p.defId}#${i}`,
      speciesKey: propSpeciesKey(def.sizeClass),
      xM: p.xM,
      yM: propBaseYM(p, probe),
      zM: p.zM,
      rotationRad: p.rotationRad,
      scale: p.variation.scale,
      localBoundsFt: bounds,
      transformMutable: true,
      groundMutable: opts.groundMutable,
      scaleMutable: false,
    });
    halfExtents.push(bounds.maxX);
    gated.push(i);
  });

  if (meters.length === 0) return { props: [...props], result: null, patchedSurface: null };

  // The loop scores the prop AS RENDERED, lean included. `fromMeterInstances`
  // has no tilt field, so the lean rides in through the lower-hull hook.
  const objects = fromMeterInstances(meters).map((obj, k) => {
    const src = props[gated[k]];
    const hull = src.surface
      ? tiltedLowerHull(src.surface.tiltRad, src.surface.tiltAxis, src.rotationRad, halfExtents[k])
      : undefined;
    return hull ? { ...obj, lowerHullFt: hull } : obj;
  });

  const result = runPlacementGate(objects, probe, {
    surface: opts.surface,
    thresholds:
      opts.iterationBudget === undefined
        ? undefined
        : { ...SURFACE_THRESHOLDS[opts.surface], iterationBudget: opts.iterationBudget },
    throwOnFailure: opts.throwOnFailure,
    report: opts.report,
  });

  const out = [...props];
  result.objects.forEach((obj, k) => {
    const srcIndex = gated[k];
    const p = out[srcIndex];
    const groundYM = obj.positionFt.y / FEET_PER_METER;
    out[srcIndex] = {
      ...p,
      // The loop worked in absolute base Y, so the corrected value IS the base.
      // Sink is folded in: keeping a separate sink term would double-count it.
      surface: {
        tiltRad: p.surface?.tiltRad ?? 0,
        tiltAxis: p.surface?.tiltAxis ?? [1, 0],
        sinkM: 0,
        groundYM,
      },
    };
  });

  return {
    props: out,
    result,
    patchedSurface: opts.groundMutable ? result.report.surface : null,
  };
}

/** Compact one-line summary of a gate run. Used by the surfaces' report sinks. */
export function summarizeGate(surface: PlacementSurface, result: GateResult | null): string {
  if (!result) return `[placement/${surface}] no probe or no instances — gate did NOT run`;
  const r = result.report;
  return (
    `[placement/${surface}] ${r.passedCount}/${r.outcomes.length} seated, ` +
    `${r.failures.length} unfixed, ${r.totalIterations} iterations, ${r.patches.length} pads`
  );
}
