/**
 * Plans a move for existing yard furniture that intrudes into a home or route.
 * The original prop and its coordinate-based tactical identity travel with the
 * proposal. This does not regenerate dressing, apply a save migration, move a
 * player or grant ownership. Admission still needs a retained source, supported
 * destination and a safe stationary body, just like household layout repairs.
 *
 * Callers must supply measured horizontal bounds and actual footprint/route
 * geometry. A guessed size-class radius cannot qualify rendered clearance.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 03:10:38
 * Dependents: components/World3D/World3DWrapper.tsx, systems/worldforge/props/exteriorPropRevision.ts, systems/worldforge/props/prospectivePropPlacement.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { propSourceId, type PropInstance } from './propSchema';

export interface YardPoint { x: number; z: number }
export interface YardExclusion {
  id: string;
  /** A filled building/plot polygon, or a route/door approach polyline. */
  kind: 'building' | 'route';
  points: readonly YardPoint[];
  /** Wall gap, or half-width of the continuous public route. */
  clearanceM: number;
}
export interface ExteriorPropRepairContext {
  exclusions: readonly YardExclusion[];
  extent: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Explicit measured reach of this prop about its origin, including scale. */
  radiusM: number;
  /** Other measured props remain obstacles; their identity/order is unchanged. */
  neighbours: readonly { id: string; center: YardPoint; radiusM: number }[];
}
export type ExteriorPropRepair = {
  sourceId: string;
  original: PropInstance;
  issues: string[];
} & ({ status: 'clear' | 'unresolved' } | { status: 'proposed'; proposed: PropInstance });

/** Matches the existing tactical prop source address, before any movement. */
export function exteriorPropSourceId(prop: PropInstance): string {
  return propSourceId(prop);
}

function segmentDistance(p: YardPoint, a: YardPoint, b: YardPoint): number {
  const dx = b.x - a.x, dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}

function inside(p: YardPoint, polygon: readonly YardPoint[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > p.z) !== (b.z > p.z)
      && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) result = !result;
  }
  return result;
}

function validContext(ctx: ExteriorPropRepairContext): boolean {
  const point = (p: YardPoint) => Number.isFinite(p.x) && Number.isFinite(p.z);
  const positive = (v: number) => Number.isFinite(v) && v >= 0;
  const e = ctx.extent;
  return Number.isFinite(ctx.radiusM) && ctx.radiusM > 0
    && Object.values(e).every(Number.isFinite) && e.minX < e.maxX && e.minZ < e.maxZ
    && ctx.exclusions.every(x => x.id && positive(x.clearanceM)
      && (x.kind === 'building' || x.kind === 'route')
      && x.points.length >= (x.kind === 'building' ? 3 : 2) && x.points.every(point)
      // A collapsed polygon supplies no trustworthy building envelope.
      && (x.kind !== 'building' || Math.abs(x.points.reduce((s, a, i) => {
        const b = x.points[(i + 1) % x.points.length]; return s + a.x * b.z - b.x * a.z;
      }, 0)) > 1e-8))
    && ctx.neighbours.every(x => x.id && point(x.center) && positive(x.radiusM));
}

/** Full disc clearance, including the closing polygon edge and route ends. */
export function exteriorPropClearanceIssues(p: YardPoint, ctx: ExteriorPropRepairContext): string[] {
  if (!validContext(ctx) || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return ['invalid-geometry'];
  const issues: string[] = [];
  const r = ctx.radiusM, e = ctx.extent;
  if (p.x - r <= e.minX || p.x + r >= e.maxX || p.z - r <= e.minZ || p.z + r >= e.maxZ) issues.push('window-edge');
  for (const x of ctx.exclusions) {
    const count = x.kind === 'building' ? x.points.length : x.points.length - 1;
    let distance = Infinity;
    for (let i = 0; i < count; i++) distance = Math.min(distance,
      segmentDistance(p, x.points[i], x.points[(i + 1) % x.points.length]));
    if ((x.kind === 'building' && inside(p, x.points)) || distance <= r + x.clearanceM) issues.push(x.id);
  }
  for (const x of ctx.neighbours) if (Math.hypot(p.x - x.center.x, p.z - x.center.z) <= r + x.radiusM) issues.push(x.id);
  return issues;
}

/**
 * Bounded deterministic search around the ORIGINAL position. Candidate order
 * uses no generator RNG, so a repair cannot reroll another family's possessions.
 * The nearest sampled clear point wins. No space means an explicit unresolved
 * result with the original still present. Terrain seating is deliberately NOT
 * fabricated here: proposed poses omit the obsolete old surface fit and must
 * pass the existing surface gate before admission.
 */
/** Optional support feedback is pure: reject a site or return only its seated
 * surface fit. It cannot change identity, contents, appearance or the search
 * position. Rejection continues the existing bounded search. */
export interface ExteriorPropRepairOptions {
  /** Fresh generation may retry a clear position that the ground cannot hold.
   * Retained-property callers keep the original clear/no-change behavior. */
  searchWhenClear?: boolean;
  seatCandidate?: (candidate: Readonly<PropInstance>) => PropInstance | undefined;
}

/** Shared bounded candidate order. Fresh siting supplies actual hull checks;
 * retained repairs keep their existing disc and support admission below. */
export function* exteriorPropSearchPoints(origin: YardPoint): Generator<YardPoint> {
  for (let step=1;step<=48;step++) {
    const distance=step*.25;
    for (let direction=0;direction<64;direction++) {
      const angle=direction*Math.PI/32;
      yield {x:origin.x+Math.cos(angle)*distance,z:origin.z+Math.sin(angle)*distance};
    }
  }
}

export function proposeExteriorPropRepair(prop: PropInstance, ctx: ExteriorPropRepairContext,
  options: ExteriorPropRepairOptions = {}): ExteriorPropRepair {
  const original = structuredClone(prop), sourceId = exteriorPropSourceId(prop);
  const issues = exteriorPropClearanceIssues({ x: prop.xM, z: prop.zM }, ctx);
  if (!Number.isFinite(prop.rotationRad) || !Number.isFinite(prop.variation.scale)
    || prop.variation.scale <= 0 || !prop.defId || issues.includes('invalid-geometry')) {
    return { status: 'unresolved', sourceId, original, issues: ['invalid-geometry'] };
  }
  if (!issues.length && !options.searchWhenClear) return { status: 'clear', sourceId, original, issues };
  // Every candidate lies within twelve meters of the original. Property and
  // roads beyond that entire swept search area cannot affect any candidate.
  // Validate the full context above, then prune only these impossible contacts;
  // candidate order and exact edge/radius checks remain unchanged.
  const reach = 12 + ctx.radiusM;
  const searchContext: ExteriorPropRepairContext = {
    ...ctx,
    neighbours: ctx.neighbours.filter(n => Math.hypot(n.center.x-prop.xM,n.center.z-prop.zM) <= reach+n.radiusM),
    exclusions: ctx.exclusions.filter(e => {
      const minX=Math.min(...e.points.map(p=>p.x)),maxX=Math.max(...e.points.map(p=>p.x));
      const minZ=Math.min(...e.points.map(p=>p.z)),maxZ=Math.max(...e.points.map(p=>p.z));
      return Math.hypot(Math.max(minX-prop.xM,0,prop.xM-maxX),Math.max(minZ-prop.zM,0,prop.zM-maxZ)) <= reach+e.clearanceM;
    }),
  };
  for (const {x,z} of exteriorPropSearchPoints({x:prop.xM,z:prop.zM})) {
      if (exteriorPropClearanceIssues({ x, z }, searchContext).length) continue;
      const proposed = structuredClone(prop);
      proposed.xM = x; proposed.zM = z;
      proposed.retainedSourceId = sourceId;
      delete proposed.surface;
      if (options.seatCandidate) {
        const input = structuredClone(proposed), before = JSON.stringify(input);
        const seated = options.seatCandidate(input);
        if (JSON.stringify(input) !== before) return { status: 'unresolved', sourceId, original, issues: ['candidate-evaluator-mutated-input'] };
        if (!seated) continue;
        const withoutSurface = structuredClone(seated); delete withoutSurface.surface;
        const fit = seated.surface;
        if (JSON.stringify(withoutSurface) !== JSON.stringify(proposed) || !fit
          || ![fit.groundYM, fit.sinkM, fit.tiltRad, ...fit.tiltAxis].every(Number.isFinite)
          || fit.sinkM < 0 || fit.tiltRad < 0 || fit.tiltRad > Math.PI / 2) {
          return { status: 'unresolved', sourceId, original, issues: ['candidate-evaluator-changed-source'] };
        }
        return { status: 'proposed', sourceId, original, proposed: structuredClone(seated), issues };
      }
      return { status: 'proposed', sourceId, original, proposed, issues };
  }
  return { status: 'unresolved', sourceId, original, issues };
}
