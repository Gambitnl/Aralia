/** Runs independent normalized Norway terrain diagnostics with the existing contact/film
 * mechanics. The pool plane collects explicit arrivals; none enter the native
 * river. These are coarse physical state comparisons, not realism acceptance. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/10/2026, 03:01:38
 * Dependents: components/World3D/water/waterfallTerrainComparisonView.ts, systems/world3d/river/waterfallTerrainComparisons.worker.ts, systems/world3d/river/waterfallTerrainInspection.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { getWaterfallContactSurfaces, WaterfallContactFlow, type ContactTransactionCheckpoint, type ContactArrival, type ContactSnapshot, type ContactSource, type ContactSurface, type ContactVec3 } from './waterfallContactFlow';
import type { WaterfallDisplaySnapshot, WaterfallPackedPresentationSnapshot } from './waterfallPresentationSnapshot';
import {WaterfallSourceContact} from './waterfallSourceContact';

import { TERRAIN_COMPARISON_CASES, type TerrainComparisonId, type TerrainComparisonCase } from './waterfallTerrainProfiles';
export { TERRAIN_COMPARISON_CASES, type TerrainComparisonId, type TerrainComparisonCase } from './waterfallTerrainProfiles';
export const TERRAIN_COMPARISON_DT = 1 / 120;
export const TERRAIN_COMPARISON_SOURCE: Readonly<ContactSource> = Object.freeze({ q: 1.5, width: 10, depth: .7, speed: 1.5 / 7, top: 78, pool: 18 });

// Every visible top is also a solver contact face. Slopes are planar within
// each rectangle, matching the existing support-coordinate assumptions.
function quad(id: string, x0: number, x1: number, z0: number, z1: number, y0: number, sx: number, sz: number): ContactSurface {
  const point = (x: number, z: number): ContactVec3 => [x, y0 + sx * (x - x0) + sz * z, z];
  const length = Math.hypot(sx, 1, sz);
  return { id, vertices: [point(x0, z0), point(x1, z0), point(x1, z1), point(x0, z1)], normal: [-sx / length, 1 / length, -sz / length] };
}
export const GENERIC_TERRAIN_COMPARISON_CASES: readonly TerrainComparisonCase[] = Object.freeze([
  { id: 'stepped', label: 'Stepped ledges', description: 'Generic legacy stepped fixture.', clipAt: '', buildSurfaces: () => getWaterfallContactSurfaces(78, 18, 10) },
  { id: 'sloped', label: 'Long incline', description: 'Generic legacy slope fixture.', clipAt: '', buildSurfaces: () => [quad('incline', -.5, 16, -12, 12, 70, -.95, .10), quad('terminal', 17, 32, -12, 12, 38, -.8, .15)] },
  { id: 'broken', label: 'Broken lower ledge', description: 'Generic legacy gap fixture.', clipAt: '', buildSurfaces: () => {
    const original = getWaterfallContactSurfaces(78, 18, 10);
    // Keep the first pressure-bearing film continuous. The lower split has
    // a real three-meter opening, with a separate lower shelf catching it.
    return [original[0], quad('broken-negative', 9, 20, -12, -1.5, 47, -.6, -.2),
      quad('broken-positive', 9, 20, 1.5, 12, 47, -.6, -.2),
      quad('gap-catch', 8, 24, -2, 2, 36, -.35, 0), original[2]];
  } },
]);

export interface TerrainComparisonCaseReading {
  id: TerrainComparisonId; emittedVolume: number; storedVolume: number; arrivedVolume: number;
  closureError: number; contactCount: number; surfaceContactCounts: Record<string, number>; parcelCount: number;
}
export interface TerrainComparisonReading {
  physicalTime: number; sourceOn: boolean; running: boolean; failure: string | null; lastStepMilliseconds: number;
  cases: TerrainComparisonCaseReading[];
  /** Cumulative export accounting plus only the last committed tick's rows.
   * Keeping all historical rows would make an ongoing inspection unbounded. */
  arrivals: TerrainComparisonArrivalLedger[];
}
export interface TerrainComparisonArrivalLedger {
  id: TerrainComparisonId; volume: number; momentum: ContactVec3; weightedPosition: ContactVec3;
  count: number; lastTick: ContactArrival[];
}
export interface TerrainComparisonSnapshot {
  snapshots: { id: TerrainComparisonId; snapshot: ContactSnapshot }[];
  reading: TerrainComparisonReading;
  /** Optional qualified display packet; physical snapshots/accounting are unchanged. */
  preparedSurface?: import('@/components/World3D/water/waterfallContactView').ContactSurfacePacket;
  /** Wall-clock work on the worker, excluding between-tick yields, postMessage serialization and
   * delivery. These overlapping totals must not be added to render CPU time. */
  workerTimings?: { executeMs: number; surfaceMs: number; packMs: number; totalMs: number; yieldMs?: number };
}
export interface TerrainComparisonWorkerRequest { requestId?: number; type: 'reset' | 'step' | 'source' | 'running' | 'dispose' | 'select'; sourceOn?: boolean; running?: boolean; id?: TerrainComparisonId; ticks?: number }
export type TerrainComparisonDisplaySnapshot = Omit<TerrainComparisonSnapshot, 'snapshots'> & { snapshots: {id: TerrainComparisonId; snapshot: WaterfallDisplaySnapshot | WaterfallPackedPresentationSnapshot}[] };
export type TerrainComparisonWorkerResponse = ({ type: 'snapshot'; requestId?: number } & TerrainComparisonDisplaySnapshot)
  | { type: 'error'; requestId?: number; error: string; retainedSnapshot: TerrainComparisonSnapshot };
export type TerrainComparisonRequest = TerrainComparisonWorkerRequest;
export type TerrainComparisonResponse = TerrainComparisonWorkerResponse;

/** One fixed tick is a transaction across all selected cases. A failed case
 * stops the run and restores every owned ledger; only explicit reset clears it. */
export class WaterfallTerrainComparisonRun {
  private readonly cases: readonly TerrainComparisonCase[];
  private flows: WaterfallContactFlow[];
  private ledger: TerrainComparisonArrivalLedger[];
  constructor(cases: readonly TerrainComparisonCase[] = TERRAIN_COMPARISON_CASES) {
    if (!cases.length || new Set(cases.map(c => c.id)).size !== cases.length) throw Error('invalid-terrain-comparison-cases');
    this.cases = Object.freeze(cases.map(c=>Object.freeze({...c, ...(c.streamSpans ? {streamSpans:Object.freeze(c.streamSpans.map(s=>Object.freeze({...s})))} : {})}))); this.flows = this.createFlows(); this.ledger = this.createLedger();
  }
  private tick = 0;
  private sourceOn = true;
  private running = false;
  private failure: string | null = null;
  private lastStepMilliseconds = 0;

  private createFlows(): WaterfallContactFlow[] {
    return this.cases.map(c => new WaterfallContactFlow({ startTime: 0, dt: TERRAIN_COMPARISON_DT,
      // Appending preserves the first pressure-bearing shelf. The same bank
      // quads are drawn by the landscape builder; legacy fixtures stay unchanged.
      parcelsPerStep: Math.max(6, c.streamSpans?.length ?? 1), maxParcels: 20000, maxStepsPerAdvance: 1,
      surfaces: [...c.buildSurfaces(), ...(c.buildBanks?.() ?? [])], ...(c.streamSpans ? { sourceSpans: c.streamSpans } : {}) }));
  }
  private createLedger(): TerrainComparisonArrivalLedger[] {
    return this.cases.map(c => ({ id: c.id, volume: 0, momentum: [0, 0, 0], weightedPosition: [0, 0, 0], count: 0, lastTick: [] }));
  }
  /** Reconstruct first contact from a source record the running comparison
   * already owns. The future boundary receiver can query real width/time
   * instead of inventing an impact patch around the parcel center. This pure
   * query does not move or debit the current coarse simulation's water. */
  sourceContact(id:TerrainComparisonId,parcelId:number):WaterfallSourceContact {
    const index=this.cases.findIndex(c=>c.id===id);if(index<0)throw Error('source-contact-unknown-terrain');
    const terrain=this.cases[index],snapshot=this.flows[index].snapshot(),parcel=snapshot.parcels.find(p=>p.id===parcelId);
    if(!parcel?.sourceRelease||parcel.contactCount!==0)throw Error('source-contact-not-unlanded-source');
    const release=parcel.sourceRelease,volume=parcel.volume;
    if(terrain.streamSpans&&!terrain.streamSpans.some(s=>release.start[2]>=s.z0&&release.end[2]<=s.z1))throw Error('source-contact-crosses-inlet-gap');
    return new WaterfallSourceContact(release,volume,snapshot.surfaces,TERRAIN_COMPARISON_SOURCE.pool);
  }
  setSourceOn(value: boolean): void { this.sourceOn = value; }
  setRunning(value: boolean): void {
    if (value && this.failure) throw Error(this.failure);
    this.running = value;
  }
  reset(): TerrainComparisonSnapshot {
    this.flows = this.createFlows(); this.ledger = this.createLedger();
    this.tick = 0; this.failure = null; this.running = false; this.lastStepMilliseconds = 0;
    return this.snapshot();
  }
  step(): TerrainComparisonSnapshot {
    this.advanceTick();
    return this.snapshot();
  }
  /** Advance the same atomic physical tick without copying a public display
   * record. Inspection batches publish once after their committed ticks; callers
   * of step() still receive the complete independently mutable snapshot. */
  advanceTick(): boolean {
    if (this.failure) throw Error(this.failure);
    if (!this.running) return false;
    const started = performance.now();
    // Keep all selected water owners restorable using Flow's compact numerical copy.
    // Public snapshots remain independently mutable records for display and export.
    const checkpoints: Array<ContactTransactionCheckpoint | undefined> = [];
    const target = (this.tick + 1) * TERRAIN_COMPARISON_DT;
    const source = { ...TERRAIN_COMPARISON_SOURCE, q: this.sourceOn ? TERRAIN_COMPARISON_SOURCE.q : 0 };
    try {
      const arrivals = this.flows.map((flow, index) => {
        const result = flow.advanceTransactionalTick(target, () => source);
        checkpoints[index] = result.checkpoint;
        if (result.failure) throw Error(this.cases[index].id + ': ' + result.failure);
        return result.advance.arrivals;
      });
      // Commit exports only after all selected numerical ticks succeeded.
      const committed = this.ledger.map((previous, index) => {
        const next = structuredClone(previous), rows = arrivals[index];
        for (const row of rows) {
          next.volume += row.volume; next.count++;
          for (let axis = 0; axis < 3; axis++) { next.momentum[axis] += row.momentum[axis]; next.weightedPosition[axis] += row.weightedPosition[axis]; }
        }
        next.lastTick = structuredClone(rows); return next;
      });
      this.ledger = committed;
      this.tick++;
    } catch (error) {
      this.flows.forEach((flow, index) => checkpoints[index] && flow.restoreTransactionState(checkpoints[index]!));
      this.failure = error instanceof Error ? error.message : String(error);
      this.running = false;
      throw Error(this.failure);
    } finally { this.lastStepMilliseconds = performance.now() - started; }
    return true;
  }
  snapshot(): TerrainComparisonSnapshot {
    const snapshots = this.flows.map((f, index) => ({ id: this.cases[index].id, snapshot: f.snapshot() }));
    return { snapshots, reading: { physicalTime: this.tick * TERRAIN_COMPARISON_DT, sourceOn: this.sourceOn,
      running: this.running, failure: this.failure, lastStepMilliseconds: this.lastStepMilliseconds,
      cases: snapshots.map(({ id, snapshot }, index) => {
        const r = snapshot.receipt, arrivedVolume = this.ledger[index].volume;
        return { id, emittedVolume: r.emittedVolume, storedVolume: r.totalOwnedVolume, arrivedVolume,
          closureError: r.emittedVolume - r.totalOwnedVolume - arrivedVolume, contactCount: r.contactCount,
          surfaceContactCounts: { ...r.surfaceContactCounts }, parcelCount: r.parcelCount };
      }), arrivals: structuredClone(this.ledger) } };
  }
}
