/** One attempted Film tick's energy evidence, isolated from physical state.
 * Captures actual operator endpoints and additive transfers, then attributes
 * their energy after stopping. No corrected energy is returned to the solver.
 * Common horizontal endpoints include every face and source; rankings describe
 * this discrete update, not recoverable energy from removing an operator.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/10/2026, 22:37:31
 * Dependents: systems/world3d/river/waterfallContactFilm.ts, systems/world3d/river/waterfallContactFlow.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ContactVec3 } from './waterfallContactFlow';
import { layerKinetic, observeLayerKineticFactored, observeFilmEnergyIncrement, validateLayerColumn, type FilmLayerColumn } from './waterfallLayeredFilm';

const rho = 1000;
const dot = (a: ContactVec3, b: ContactVec3) => a.reduce((s, v, k) => s + v * b[k], 0);
export interface FilmEnergyGeometry { areas: number[]; bedPotential: number[]; gn: number }
export interface FilmEnergyIncrement {
  kind: 'central' | 'rusanov' | 'hydrostatic-pressure' | 'source-primitive' | 'source-pressure' | 'actual-face';
  cell: number; layer: number; volume: number; momentum: ContactVec3; face: number;
}
interface EnergyFrame {
  index: number; time: number; dt: number; before: FilmLayerColumn[];
  horizontal?: FilmLayerColumn[]; gravity?: FilmLayerColumn[];
  increments: FilmEnergyIncrement[]; faces: unknown[]; sources: unknown[]; outlets: unknown[];
  gravityIncrements: { cell: number; layer: number; momentum: ContactVec3 }[];
  vertical: { cell: number; before: FilmLayerColumn; remapped: FilmLayerColumn; diffused: FilmLayerColumn; remapLoss: number; temporalLoss: number; viscousLoss: number }[];
  incoming: number; outgoing: number;
  oldBeforeEnergy?: number; oldHorizontalEnergy?: number; oldGravityEnergy?: number;
}
interface SourceEvidence {
  face: number; cell: number; fraction: number; priorSourceColumn: FilmLayerColumn; primitive?: FilmLayerColumn; pressure?: FilmLayerColumn;
  sourceWork: number; advectiveEnergy: number; bed: number; cellBed: number;
  port: { volume: number; height: number; velocity: ContactVec3; energy: number };
  supplyingInterval: number[]; applicationInterval: number[];
}
export function filmEnergyWeights(before: FilmLayerColumn, after: FilmLayerColumn, area: number, bed: number, gn: number) {
  validateLayerColumn(before); validateLayerColumn(after);
  const velocity = (column: FilmLayerColumn, k: number): ContactVec3 => column.volumes[k] === 0 ? [0, 0, 0] : column.momenta[k].map(p => (p / column.volumes[k]) / rho) as ContactVec3;
  const total = [...before.volumes, ...after.volumes].reduce((s, v) => s + v, 0);
  return before.volumes.map((_, k) => {
    const u = velocity(before, k), v = velocity(after, k);
    return { a: -rho / 2 * dot(u, v) + rho * bed + rho * gn / (2 * area) * total,
      ubar: u.map((x, axis) => x / 2 + v[axis] / 2) as ContactVec3 };
  });
}
function energy(column: FilmLayerColumn, area: number, bed: number, gn: number, old = false) {
  const V = column.volumes.reduce((s, v) => s + v, 0);
  return (old ? layerKinetic(column) : observeLayerKineticFactored(column)) + rho * bed * V + rho * gn * V * (V / area) / 2;
}

export class FilmEnergyObserver {
  private geometry?: FilmEnergyGeometry;
  private frames: EnergyFrame[] = [];
  private current?: EnergyFrame;
  private used = false;
  private closed = false;
  private records = 0;
  private estimatedBytes = 0;
  private failures: string[] = [];
  private rejection: string | null = null;
  private clock: { startTime: number; duration: number } | null = null;
  // Caps bound one tick's raw evidence even if a future mesh grows. Overflow
  // is disclosed as incomplete; it never throws into or truncates physical work.
  readonly limits = { substeps: 64, cells: 512, records: 350000, estimatedRawBytes: 128 * 1024 * 1024 };
  private copy<T>(value: T): T {
    const size = (v: unknown): number => typeof v === 'number' ? 8 : typeof v === 'string' ? 16 + v.length * 2 : v && typeof v === 'object' ? 32 + Object.values(v).reduce<number>((s, x) => s + size(x), 0) : 8;
    this.estimatedBytes += size(value);
    if (this.estimatedBytes > this.limits.estimatedRawBytes) throw Error('observer-byte-capacity');
    return structuredClone(value);
  }
  private safe(work: () => void) { try { work(); } catch (error) { if (this.failures.length < 8) this.failures.push(error instanceof Error ? error.message : String(error)); this.current = undefined; } }
  beginTick(startTime: number, duration: number, geometry: FilmEnergyGeometry) {
    this.safe(() => { if (this.used) return; this.used = true; this.clock = { startTime, duration };
      if (geometry.areas.length > this.limits.cells) throw Error('observer-cell-capacity');
      this.geometry = this.copy(geometry);
    });
  }
  beginSubstep(index: number, elapsed: number, dt: number, columns: FilmLayerColumn[]) {
    this.safe(() => { this.current = undefined; if (this.closed || !this.geometry) return;
      if (this.frames.length >= this.limits.substeps) throw Error('observer-substep-capacity');
      this.current = { index, time: this.clock!.startTime + elapsed, dt, before: this.copy(columns), increments: [], gravityIncrements: [], faces: [], sources: [], outlets: [], vertical: [], incoming: 0, outgoing: 0 };
      this.frames.push(this.current);
    });
  }
  increment(value: FilmEnergyIncrement) { this.capture('increments', value); }
  sourceEndpoint(stage: 'primitive' | 'pressure', column: FilmLayerColumn) {
    this.safe(() => { if (!this.current) return; const source = this.current.sources[this.current.sources.length - 1] as SourceEvidence | undefined; if (source) source[stage] = this.copy(column); });
  }
  capture(kind: 'increments' | 'faces' | 'sources' | 'outlets', value: unknown) {
    this.safe(() => { if (!this.current) return; if (++this.records > this.limits.records) throw Error('observer-record-capacity');
      const values = this.current[kind] as unknown[]; values.push(this.copy(value));
    });
  }
  horizontal(columns: FilmLayerColumn[], incoming: number, outgoing: number) {
    this.safe(() => { if (this.current) { this.current.horizontal = this.copy(columns); this.current.incoming = incoming; this.current.outgoing = outgoing; } });
  }
  gravity(columns: FilmLayerColumn[]) { this.safe(() => { if (this.current) this.current.gravity = this.copy(columns); }); }
  oldStageEnergy(before: number, horizontal: number, gravity?: number) {
    this.safe(() => { if (this.current) { this.current.oldBeforeEnergy = before; this.current.oldHorizontalEnergy = horizontal; if (gravity !== undefined) this.current.oldGravityEnergy = gravity; } });
  }
  gravityIncrement(cell: number, layer: number, momentum: ContactVec3) { this.safe(() => { if (this.current) this.current.gravityIncrements.push(this.copy({ cell, layer, momentum })); }); }
  vertical(cell: number, before: FilmLayerColumn, remapped: FilmLayerColumn, diffused: FilmLayerColumn, remapLoss: number, temporalLoss: number, viscousLoss: number) {
    this.safe(() => { if (this.current) this.current.vertical.push(this.copy({ cell, before, remapped, diffused, remapLoss, temporalLoss, viscousLoss })); });
  }
  finish(rejection: string | null = null) { this.closed = true; this.current = undefined; this.rejection = rejection; }
  /** Save this envelope before deriving rankings. These detached raw operands
   * survive failed-stage rollback and do not depend on successful analysis. */
  rawEvidence() { return structuredClone({ clock: this.clock, geometry: this.geometry, raw: this.frames, closed: this.closed, failures: this.failures, rejection: this.rejection, limits: this.limits, records: this.records, estimatedRawBytes: this.estimatedBytes }); }
  report(supplement: { sourceEvents?: unknown; outletOwnership?: unknown } = {}) {
    const geometry = this.geometry;
    const derivationFailures: string[] = [];
    let storedChange = 0, chainChange = 0, actualTransferChange = 0, oldD_hg = 0, correctedD_hg = 0, gravityChange = 0, gravityChainChange = 0, remap = 0, correctedRemap = 0, backwardEuler = 0, reconstructedBackwardEuler = 0, physicalViscosity = 0;
    const endpointRemainders: number[] = [];
    const sourceDetails: object[] = [];
    const componentTotals = new Map<string, { kind: string; signed: number; absolute: number; grossEndpointAbsolute: number; kinetic: number; bedPotential: number; hydrostaticPotential: number }>();
    const faceTotals = new Map<number, { face: number; signed: number; absolute: number; grossEndpointAbsolute: number }>();
    const energyObservations: object[] = [];
    if (geometry) for (const frame of this.frames) {
      try {
      if (!frame.horizontal) continue;
      const totals = (columns: FilmLayerColumn[], old = false) => columns.reduce((sum, c, k) => sum + energy(c, geometry.areas[k], geometry.bedPotential[k], geometry.gn, old), 0);
      let chain = 0, actual = 0, sourceChain = 0;
      const paired = new Map<string, { kind: string; face: number; signed: number }>();
      for (const increment of frame.increments) {
        const contribution = observeFilmEnergyIncrement(frame.before[increment.cell], frame.horizontal[increment.cell], increment.layer, increment.volume, increment.momentum, geometry.areas[increment.cell], geometry.bedPotential[increment.cell], geometry.gn);
        if (increment.kind === 'actual-face') actual += contribution;
        else {
          chain += contribution; if (increment.kind.startsWith('source-')) sourceChain += contribution;
          const category = componentTotals.get(increment.kind) ?? { kind: increment.kind, signed: 0, absolute: 0, grossEndpointAbsolute: 0, kinetic: 0, bedPotential: 0, hydrostaticPotential: 0 };
          const kinetic = observeFilmEnergyIncrement(frame.before[increment.cell], frame.horizontal[increment.cell], increment.layer, increment.volume, increment.momentum, geometry.areas[increment.cell], 0, 0);
          const bedPotential = rho * geometry.bedPotential[increment.cell] * increment.volume;
          category.kinetic += kinetic; category.bedPotential += bedPotential; category.hydrostaticPotential += contribution - kinetic - bedPotential;
          category.signed += contribution; category.grossEndpointAbsolute += Math.abs(contribution); componentTotals.set(increment.kind, category);
          const face = faceTotals.get(increment.face) ?? { face: increment.face, signed: 0, absolute: 0, grossEndpointAbsolute: 0 };
          face.signed += contribution; face.grossEndpointAbsolute += Math.abs(contribution); faceTotals.set(increment.face, face);
          // Ordinary internal faces share one oriented transfer. Pair their
          // endpoints before ranking so canceling bed-energy traffic cannot
          // masquerade as a large defect. Source recipients stay local.
          const key = `${increment.face}/${increment.kind}/${increment.layer}/${increment.kind.startsWith('source-') ? increment.cell : 'shared'}`;
          const shared = paired.get(key) ?? { kind: increment.kind, face: increment.face, signed: 0 };
          shared.signed += contribution; paired.set(key, shared);
        }
      }
      for (const shared of paired.values()) {
        componentTotals.get(shared.kind)!.absolute += Math.abs(shared.signed);
        faceTotals.get(shared.face)!.absolute += Math.abs(shared.signed);
      }
      // Actual combined face transfers retain the solver's original rounding;
      // their difference from component sums is not assigned to a mechanism.
      actual += sourceChain;
      for (const value of frame.sources) {
        const source = value as SourceEvidence;
        const V = source.port.volume * source.fraction, beforeV = source.priorSourceColumn.volumes.reduce((s, v) => s + v, 0);
        sourceDetails.push({ substep: frame.index, face: source.face, cell: source.cell, volume: V, suppliedPrimitiveEnergy: source.advectiveEnergy, suppliedPressureWork: source.sourceWork,
          actualSequentialMixingLoss: source.primitive ? observeLayerKineticFactored(source.priorSourceColumn) + .5 * rho * V * dot(source.port.velocity, source.port.velocity) - observeLayerKineticFactored(source.primitive) : null,
          actualSequentialPressureKineticChange: source.primitive && source.pressure ? observeLayerKineticFactored(source.pressure) - observeLayerKineticFactored(source.primitive) : null,
          placementAndHydrostaticChange: rho * V * (source.cellBed - source.bed) + rho * geometry.gn * V * (2 * beforeV + V) / (2 * geometry.areas[source.cell]) - .5 * rho * V * geometry.gn * source.port.height,
          applicationInterval: source.applicationInterval, supplyingInterval: source.supplyingInterval,
          qualification: 'Source-order intermediate assembly evidence, not independent solver-stage attribution.' });
      }
      const change = totals(frame.horizontal) - totals(frame.before);
      storedChange += change; chainChange += chain; actualTransferChange += actual; endpointRemainders.push(change - chain);
      if (frame.gravity) {
        const changeG = totals(frame.gravity) - totals(frame.horizontal); gravityChange += changeG;
        for (const increment of frame.gravityIncrements) gravityChainChange += observeFilmEnergyIncrement(frame.horizontal[increment.cell], frame.gravity[increment.cell], increment.layer, 0, increment.momentum, geometry.areas[increment.cell], geometry.bedPotential[increment.cell], geometry.gn);
        correctedD_hg += totals(frame.before) + frame.incoming - frame.outgoing - totals(frame.gravity);
        const oldBefore = frame.oldBeforeEnergy ?? totals(frame.before, true), oldHorizontal = frame.oldHorizontalEnergy ?? totals(frame.horizontal, true), oldGravity = frame.oldGravityEnergy ?? totals(frame.gravity, true);
        oldD_hg += oldBefore + frame.incoming - oldHorizontal - frame.outgoing - (oldGravity - oldHorizontal);
        const corrected = [totals(frame.before), totals(frame.horizontal), totals(frame.gravity)], old = [oldBefore, oldHorizontal, oldGravity];
        energyObservations.push({ substep: frame.index, old, corrected, difference: corrected.map((v, k) => v - old[k]), allowance: 1e-10 * [...old, ...corrected].reduce((s, v) => s + Math.abs(v), 0) });
      }
      for (const v of frame.vertical) {
        remap += v.remapLoss; correctedRemap += observeLayerKineticFactored(v.before) - observeLayerKineticFactored(v.remapped);
        backwardEuler += v.temporalLoss; reconstructedBackwardEuler += observeLayerKineticFactored(v.remapped) - observeLayerKineticFactored(v.diffused) - v.viscousLoss;
        physicalViscosity += v.viscousLoss;
      }
      } catch (error) { if (derivationFailures.length < 8) derivationFailures.push(`substep${frame.index}:${error instanceof Error ? error.message : String(error)}`); }
    }
    const byComponent = [...componentTotals.values()].sort((a, b) => b.absolute - a.absolute);
    const rankedFaces = [...faceTotals.values()].sort((a, b) => b.absolute - a.absolute).slice(0, 20);
    if (![storedChange, chainChange, actualTransferChange, gravityChange, gravityChainChange, oldD_hg, correctedD_hg, remap, correctedRemap, backwardEuler, reconstructedBackwardEuler, physicalViscosity, ...byComponent.flatMap(c => [c.signed, c.absolute, c.kinetic, c.bedPotential, c.hydrostaticPotential])].every(Number.isFinite)) derivationFailures.push('nonfinite-observer-energy-range');
    return { complete: this.used && this.closed && this.frames.length > 0 && this.failures.length === 0 && derivationFailures.length === 0 && this.frames.every(f => !!f.horizontal && !!f.gravity && f.vertical.length === f.before.length), limits: this.limits, records: this.records, estimatedRawBytes: this.estimatedBytes, clock: this.clock, rejection: this.rejection, failures: [...this.failures, ...derivationFailures],
      components: byComponent, rankedFaces, sourceDetails, energyObservations, storedChange, chainChange, closureRemainder: storedChange - chainChange, endpointRemainders, componentRoundingRemainder: actualTransferChange - chainChange,
      gravityChange, gravityChainChange, gravityClosureRemainder: gravityChange - gravityChainChange, originalD_hg: oldD_hg, correctedD_hg, reconstructedD_hg: this.frames.reduce((s, f) => s + f.incoming - f.outgoing, 0) - chainChange - gravityChainChange, remap, correctedRemap, backwardEuler, reconstructedBackwardEuler, backwardEulerReconstructionRemainder: reconstructedBackwardEuler - backwardEuler, physicalViscosityExcluded: physicalViscosity,
      geometry, raw: this.frames, supplement, unavailable: [!supplement.sourceEvents && 'original-source-event-provenance', !supplement.outletOwnership && 'receiver-ownership-and-acknowledgment'].filter(Boolean),
      qualification: 'Actual finite-update attribution only; common horizontal weights. No counterfactual energy credits, gate changes, source chronology corrections or physical state writes.' };
  }
}
