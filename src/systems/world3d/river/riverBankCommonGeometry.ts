/**
 * Qualifies the frozen drawn terrain for one prospective fixed bank experiment.
 * This unwired CPU reader keeps the original triangles, proves ordinary-ground
 * coverage by bounded clipping, and exposes rock underside/overhang uncertainty.
 * A top-envelope winner is geometry evidence, not permission to fill a cavity.
 * No migration, HLL adapter, renderer or physical water step is connected here.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 08:49:50
 * Dependents: systems/world3d/river/riverBankCavityExperiment.ts, systems/world3d/river/riverTerrainBankGeometry.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const BANK_COMMON_LIMITS = Object.freeze({ resolution: 128, spacingM: 1 / 64,
  sourceTriangles: 512, binCandidates: 24, binInsertions: 100000,
  integrationLeavesPerCell: 16, faceNodes: 32, polygonVertices: 16 });
const X0 = 36, Z0 = 22, N = 128, DX = 1 / 64;
// These tolerances qualify floating-point topology arithmetic only. They are
// not an absolute volume allowance or a physical geometry acceptance budget.
const AREA_ROUNDOFF = 128 * Number.EPSILON * DX * DX;
const HEIGHT_ROUNDOFF = 128 * Number.EPSILON;
export type BankTerrainPoint = readonly [number, number, number]; // x, z, original bed y
type Point = BankTerrainPoint;
interface Triangle { id: number; object: number; source: string; points: readonly Point[];
  ground: boolean; orientation: number; plane: readonly [number, number, number] | null }
export interface FrozenBankTerrain {
  readonly identity: string;
  readonly sourceSha256: string;
  readonly vertices: readonly number[] | Float64Array;
  readonly triangles: readonly { readonly objectIndex: number }[];
  readonly objects: readonly { readonly sourceName: string }[];
}
export interface BankUndercutWitness {
  readonly x: number; readonly z: number; readonly groundY: number;
  readonly undersideY: number; readonly topY: number | null; readonly gapM: number;
  readonly groundTriangle: number; readonly undersideTriangle: number;
  readonly topTriangle: number | null; readonly sourceName: string;
}
export interface BankCellQualification {
  readonly cellId: number; readonly candidateTriangles: readonly number[];
  readonly groundCoverageM2: number; readonly groundOverlapM2: number;
  readonly affineWinner: number | null;
  readonly undercut: BankUndercutWitness | null;
  readonly status: 'ordinary-ground-qualified' | 'uncovered-ground' | 'overlapping-ground'
    | 'vertical-surface-unresolved' | 'undercut-water-relevance-unresolved' | 'rock-water-relevance-unresolved';
  readonly reason: string;
}
export interface BankGroundLevel {
  readonly etaM: number; readonly volumeM3: number; readonly wetAreaM2: number;
  readonly potentialIntegralM4: number; readonly depthSquaredIntegralM4: number;
  /** Independent rectangle-range integration, not two sampled resolutions.
   * It shares source clipping/FP topology assumptions with the exact integral.
   */
  readonly volumeBracketM3: readonly [number, number];
  readonly wetPolygons: readonly (readonly Point[])[];
  readonly basinComponents: number;
  readonly basinResolved: boolean;
}
export type BankCommonBuild = { ok: true; geometry: BankCommonGeometry }
  | { ok: false; reason: string };

function cross(a: Point, b: Point, c: Point) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function area(p: readonly Point[]) {
  let result = 0;
  for (let i = 1; i + 1 < p.length; i++) result += Math.abs(cross(p[0], p[i], p[i + 1])) / 2;
  return result;
}
function clip(p: readonly Point[], signed: (p: Point) => number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], fa = signed(a), fb = signed(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]);
    }
  }
  if (out.length > BANK_COMMON_LIMITS.polygonVertices) throw new Error('Fixed convex clipping vertex cap exceeded');
  return out;
}
function rectangle(p: readonly Point[], x: number, z: number, size: number) {
  return clip(clip(clip(clip(p, q => q[0] - x), q => x + size - q[0]), q => q[1] - z), q => z + size - q[1]);
}
function intersection(a: readonly Point[], b: readonly Point[]) {
  let p = [...a];
  let sign = 0;
  for (let i = 1; i + 1 < b.length && sign === 0; i++) sign = Math.sign(cross(b[0], b[i], b[i + 1]));
  for (let i = 0; i < b.length; i++) p = clip(p, q => sign * cross(b[i], b[(i + 1) % b.length], q));
  return p;
}
const height = (t: Triangle, x: number, z: number) => t.plane![0] * x + t.plane![1] * z + t.plane![2];
function contains(t: Triangle, x: number, z: number) {
  const p: Point = [x, z, 0], sign = Math.sign(t.orientation);
  return t.points.every((a, i) => sign * cross(a, t.points[(i + 1) % 3], p) >= 0);
}
function joined(a: readonly Point[], b: readonly Point[], eta: number) {
  // Positive shared wet edge, not a point contact. Do not invent connectivity
  // between isolated basins merely because their horizontal eta is the same.
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p = a[i], q = a[(i + 1) % a.length], r = b[j], s = b[(j + 1) % b.length];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (length === 0 || Math.abs(cross(p, q, r)) > AREA_ROUNDOFF || Math.abs(cross(p, q, s)) > AREA_ROUNDOFF) continue;
    const projection = (v: Point) => ((v[0] - p[0]) * (q[0] - p[0]) + (v[1] - p[1]) * (q[1] - p[1])) / length;
    const pr = projection(r), ps = projection(s);
    let lo = Math.max(0, Math.min(pr, ps)), hi = Math.min(length, Math.max(pr, ps));
    if (!(hi > lo) || ps === pr) continue;
    // A wet polygon's closure includes its zero-depth shoreline. The shared
    // edge connects basins only where BOTH one-sided traces have positive depth.
    const traces = [
      (t: number) => eta - (p[2] + t / length * (q[2] - p[2])),
      (t: number) => eta - (r[2] + (t - pr) / (ps - pr) * (s[2] - r[2])),
    ];
    for (const depth of traces) {
      const dl = depth(lo), dh = depth(hi);
      if (dl <= 0 && dh <= 0) { hi = lo; break; }
      if (dl <= 0) lo += (hi - lo) * dl / (dl - dh);
      else if (dh <= 0) hi = lo + (hi - lo) * dl / (dl - dh);
    }
    if (hi > lo) return true;
  }
  return false;
}

// The waterfall support adapter reuses the same bounded clipping and wet-edge
// connectivity rules. Exporting these does not widen the fixed bank reader's
// domain, budgets or approval of overhangs and rock cavities.
export { clip as clipBankPolygon, area as bankPolygonArea,
  intersection as intersectBankPolygons, joined as bankWetPolygonsJoined };

/** Fixed immutable bins plus explicit per-cell applicability observations. */
export class BankCommonGeometry {
  private readonly qualifications = new Map<number, BankCellQualification>();
  constructor(readonly identity: string, readonly sourceSha256: string,
    private readonly triangles: readonly Triangle[], private readonly bins: readonly (readonly number[])[],
    readonly binInsertions: number) {}

  private bounds(id: number) {
    if (!Number.isSafeInteger(id) || id < 0 || id >= N * N) throw new Error('Invalid fixed bank cell ID');
    return { x: X0 + (id % N) * DX, z: Z0 + Math.floor(id / N) * DX };
  }
  private pieces(id: number) {
    const { x, z } = this.bounds(id);
    return this.bins[id].map(i => ({ triangle: this.triangles[i], polygon: rectangle(this.triangles[i].points, x, z, DX) }))
      .filter(p => area(p.polygon) > 0);
  }
  describeCell(id: number): BankCellQualification {
    const old = this.qualifications.get(id); if (old) return old;
    const { x, z } = this.bounds(id), pieces = this.pieces(id), grounds = pieces.filter(p => p.triangle.ground);
    const coverage = grounds.reduce((s, p) => s + area(p.polygon), 0);
    let overlap = 0;
    for (let i = 0; i < grounds.length; i++) for (let j = 0; j < i; j++) overlap += area(intersection(grounds[i].polygon, grounds[j].polygon));
    let winner: number | null = null;
    for (const p of pieces) if (p.triangle.plane && Math.abs(area(p.polygon) - DX * DX) <= AREA_ROUNDOFF
      && pieces.every(q => q.polygon.every(v => v[2] <= height(p.triangle, v[0], v[1]) + HEIGHT_ROUNDOFF * Math.max(1, Math.abs(v[2]))))) {
      winner = p.triangle.id; break;
    }
    const px = x + DX / 2, pz = z + DX / 2;
    const hits = pieces.filter(p => p.triangle.plane && contains(p.triangle, px, pz))
      .map(p => ({ t: p.triangle, y: height(p.triangle, px, pz) }));
    const ground = hits.filter(h => h.t.ground).sort((a, b) => b.y - a.y)[0];
    const rocks = hits.filter(h => !h.t.ground && ground && h.y > ground.y).sort((a, b) => a.y - b.y);
    const underside = rocks[0]?.t.orientation > 0 ? rocks[0] : null;
    const top = underside ? rocks.find(h => h.t.object === underside.t.object && h.t.orientation < 0 && h.y >= underside.y) : null;
    const undercut: BankUndercutWitness | null = underside && ground ? { x: px, z: pz, groundY: ground.y, undersideY: underside.y,
      topY: top?.y ?? null, gapM: underside.y - ground.y, groundTriangle: ground.t.id, undersideTriangle: underside.t.id,
      topTriangle: top?.t.id ?? null, sourceName: underside.t.source } : null;
    // A ground affine winner proves all captured rock faces below it. Otherwise
    // rock relevance stays unresolved even if a top plane wins every center ray.
    const ordinaryOnly = pieces.every(p => p.triangle.ground) || winner !== null && this.triangles[winner].ground;
    let status: BankCellQualification['status'] = 'ordinary-ground-qualified', reason = 'Continuous nonoverlapping ordinary ground covers this cell; no captured solid lies above its qualified affine winner.';
    if (overlap > AREA_ROUNDOFF) { status = 'overlapping-ground'; reason = 'Positive-area overlap in original ground triangles; no double-counting allowed.'; }
    else if (Math.abs(coverage - DX * DX) > AREA_ROUNDOFF) { status = 'uncovered-ground'; reason = 'Continuous clipped ground area does not cover the complete cell.'; }
    else if (this.bins[id].some(i => !this.triangles[i].plane)) { status = 'vertical-surface-unresolved'; reason = 'A projected vertical surface requires explicit one-sided barrier/coverage qualification.'; }
    else if (undercut) { status = 'undercut-water-relevance-unresolved'; reason = 'First rock ray intersection is an underside above ground; top extrusion would fill an unqualified gap. Water relevance is pending.'; }
    else if (!ordinaryOnly) { status = 'rock-water-relevance-unresolved'; reason = 'Ground/rock envelope is not qualified as the physical shallow-water bottom; absence of a center-ray undercut is insufficient.'; }
    const result = Object.freeze({ cellId: id, candidateTriangles: Object.freeze([...this.bins[id]]), groundCoverageM2: coverage,
      groundOverlapM2: overlap, affineWinner: winner, undercut: undercut && Object.freeze(undercut), status, reason });
    this.qualifications.set(id, result); return result;
  }

  /** Exact affine-ground clipping and integrals, with a separately accumulated
   * fixed rectangle range bracket. Rock cells never acquire fake basin approval.
   */
  measureGroundAtLevel(id: number, eta: number): BankGroundLevel {
    if (!Number.isFinite(eta)) throw new Error('Nonfinite bank level');
    const qualification = this.describeCell(id);
    if (qualification.status !== 'ordinary-ground-qualified') throw new Error(qualification.status + ': ' + qualification.reason);
    const grounds = this.pieces(id).filter(p => p.triangle.ground);
    let volume = 0, wetArea = 0, potential = 0, squared = 0;
    const wetPolygons: Point[][] = [];
    for (const g of grounds) {
      const wet = clip(g.polygon, p => eta - p[2]);
      if (area(wet) === 0 || !wet.some(p => eta - p[2] > 0)) continue;
      wetPolygons.push(wet);
      for (let i = 1; i + 1 < wet.length; i++) {
        const q = [wet[0], wet[i], wet[i + 1]], a = area(q), b = q.map(v => v[2]), h = b.map(y => Math.max(eta - y, 0));
        const squareMean = (v: number[]) => (v.reduce((s, y) => s + y * y, 0) + v[0] * v[1] + v[0] * v[2] + v[1] * v[2]) / 6;
        wetArea += a; volume += a * (h[0] + h[1] + h[2]) / 3;
        squared += a * squareMean(h); potential += a * (eta * eta - squareMean(b)) / 2;
      }
    }
    const { x, z } = this.bounds(id), size = DX / 4;
    let low = 0, high = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const bed = grounds.flatMap(g => rectangle(g.triangle.points, x + i * size, z + j * size, size).map(p => p[2]));
      if (!bed.length) throw new Error('Independent range leaf lacks continuous ground');
      low += size * size * Math.max(eta - Math.max(...bed), 0);
      high += size * size * Math.max(eta - Math.min(...bed), 0);
    }
    const reached = new Set<number>(); let components = 0;
    for (let i = 0; i < wetPolygons.length; i++) if (!reached.has(i)) {
      components++; reached.add(i); const queue = [i];
      while (queue.length) {
        const k = queue.pop()!;
        for (let j = 0; j < wetPolygons.length; j++) if (!reached.has(j) && joined(wetPolygons[k], wetPolygons[j], eta)) { reached.add(j); queue.push(j); }
      }
    }
    if (![volume, wetArea, potential, squared, low, high].every(Number.isFinite)) throw new Error('Nonfinite bank integral');
    // Clipping reuses some original bed vertices internally. Return detached,
    // frozen copies so a diagnostic caller cannot alter the next observation
    // while leaving the frozen identity/plane/qualification cache unchanged.
    const detachedWetPolygons = Object.freeze(wetPolygons.map(polygon => Object.freeze(polygon.map(p => Object.freeze([...p]) as Point))));
    return { etaM: eta, volumeM3: volume, wetAreaM2: wetArea, potentialIntegralM4: potential, depthSquaredIntegralM4: squared,
      volumeBracketM3: [low, high], wetPolygons: detachedWetPolygons, basinComponents: components, basinResolved: components <= 1 };
  }
}

/** Construct at most the fixed declared triangle/bin work; never raise caps. */
export function buildBankCommonGeometry(input: FrozenBankTerrain): BankCommonBuild {
  try {
    if (!input.identity || !/^[a-f0-9]{64}$/i.test(input.sourceSha256) || !input.triangles.length
      || input.triangles.length > BANK_COMMON_LIMITS.sourceTriangles || input.vertices.length !== input.triangles.length * 9) throw new Error('Invalid frozen source identity/triangle cap');
    const triangles: Triangle[] = [], bins = Array.from({ length: N * N }, () => [] as number[]);
    let insertions = 0;
    for (let id = 0; id < input.triangles.length; id++) {
      const object = input.triangles[id].objectIndex, source = input.objects[object]?.sourceName;
      if (!Number.isSafeInteger(object) || !source) throw new Error('Invalid source triangle owner');
      const points: Point[] = [];
      for (let k = 0; k < 3; k++) {
        const n = id * 9 + k * 3, p: Point = [input.vertices[n], input.vertices[n + 2], input.vertices[n + 1]];
        if (!p.every(Number.isFinite)) throw new Error('Nonfinite source triangle'); points.push(p);
      }
      const orientation = cross(points[0], points[1], points[2]);
      let plane: Triangle['plane'] = null;
      if (orientation !== 0) {
        const [a, b, c] = points, ax = b[0] - a[0], az = b[1] - a[1], ay = b[2] - a[2], bx = c[0] - a[0], bz = c[1] - a[1], by = c[2] - a[2];
        const px = (ay * bz - by * az) / orientation, pz = (ax * by - bx * ay) / orientation;
        plane = [px, pz, a[2] - px * a[0] - pz * a[1]];
        if (!plane.every(Number.isFinite)) throw new Error('Nonfinite source affine plane');
      }
      triangles.push({ id, object, source, points, orientation, plane, ground: source.startsWith('ground-') });
      const loX = Math.max(0, Math.floor((Math.min(...points.map(p => p[0])) - X0) / DX)), hiX = Math.min(N - 1, Math.floor((Math.max(...points.map(p => p[0])) - X0) / DX));
      const loZ = Math.max(0, Math.floor((Math.min(...points.map(p => p[1])) - Z0) / DX)), hiZ = Math.min(N - 1, Math.floor((Math.max(...points.map(p => p[1])) - Z0) / DX));
      for (let z = loZ; z <= hiZ; z++) for (let x = loX; x <= hiX; x++) {
        if (++insertions > BANK_COMMON_LIMITS.binInsertions) throw new Error('Fixed bin insertion cap exceeded');
        const bin = bins[z * N + x]; if (bin.length >= BANK_COMMON_LIMITS.binCandidates) throw new Error('Fixed per-bin triangle cap exceeded'); bin.push(id);
      }
    }
    return { ok: true, geometry: new BankCommonGeometry(input.identity, input.sourceSha256, triangles, bins, insertions) };
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : String(e) }; }
}
