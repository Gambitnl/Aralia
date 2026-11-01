/** Short synthetic proofs for the opt-in attached profile. These exercise real
 * Film/Flow advancement and ownership, not native-waterfall acceptance. */
import { describe, expect, it, vi } from 'vitest';
import { WaterfallContactFilm, type FilmJunctionPort, type FilmState } from '../waterfallContactFilm';
import { WaterfallContactFlow, type ContactSurface, type ContactVec3 } from '../waterfallContactFlow';
import { LayeredFilmStageFailure, validateLayerColumn, FOUR_LAYER_FILM_MODE, diffuseFilmLayers, filmLayerFaceFlux, layerKinetic, remapFilmLayers, type FilmLayerColumn } from '../waterfallLayeredFilm';
import * as layeredOperators from '../waterfallLayeredFilm';

const surface: ContactSurface = { id: 'flat', vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], normal: [0, 1, 0] };
const column = (volumes: number[], speeds: number[]): FilmLayerColumn => ({ volumes, momenta: volumes.map((v, k) => [1000 * v * speeds[k], 0, 0]) });
const sumP = (c: FilmLayerColumn) => c.momenta.reduce((sum, p) => sum + p[0], 0);
function seed(film: WaterfallContactFilm, cells: FilmLayerColumn[]): FilmState {
  const state = film.saveState(); state.layered!.columns = structuredClone(cells);
  state.volumes = cells.map(c => c.volumes.reduce((a, b) => a + b, 0));
  state.momenta = cells.map(c => c.momenta.reduce((sum, p) => sum.map((v, axis) => v + p[axis]) as ContactVec3, [0, 0, 0] as ContactVec3));
  state.capturedVolume = state.volumes.reduce((a, b) => a + b, 0); film.restoreState(state); return state;
}
const off = { q: 0, width: 10, depth: .7, speed: 1.5 / 7, top: 78, pool: 18 };
const makeFlow = (claim = true) => new WaterfallContactFlow({ startTime: 0, dt: .0001, impactMode: 'junction', filmMode: FOUR_LAYER_FILM_MODE,
  originalReleaseRouting: { ownerId: 'synthetic-terminal', capacity: 1000, select: rows => claim ? rows.map(r => r.id) : [] } });

describe('coupled four-layer attached Film', () => {
  it('rejected-stage diagnostics distinguish local invalid inventory and preserve nonfinite numbers in JSON', () => {
    const fixtures: (FilmLayerColumn & { classification: string })[] = [
      { volumes: [0, 0, 0, 0], momenta: [[1, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], classification: 'zero-volume-nonzero-momentum' },
      { volumes: [1, 0, 0, 0], momenta: [[NaN, Infinity, -Infinity], [0, 0, 0], [0, 0, 0], [0, 0, 0]], classification: 'nonfinite-momentum' },
      { volumes: [-1, 0, 0, 0], momenta: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], classification: 'negative-volume' }
    ];
    for (const fixture of fixtures) {
      let caught: unknown;
      try { validateLayerColumn(fixture, { stage: 'post-horizontal-source', cell: 7, operands: () => ({ signedZero: -0 }) }); } catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(LayeredFilmStageFailure);
      const diagnostic = JSON.parse(JSON.stringify((caught as LayeredFilmStageFailure).diagnostic));
      expect(diagnostic).toMatchObject({ stage: 'post-horizontal-source', cell: 7, layer: 0, classification: fixture.classification });
      expect(diagnostic.operands.signedZero).toBe('-0'); expect(diagnostic.complete).toBe(true);
      if (fixture.classification === 'nonfinite-momentum') expect(diagnostic.operands.momenta[0]).toEqual(['NaN', '+Infinity', '-Infinity']);
      fixture.momenta[0][0] = 99;
      expect((caught as LayeredFilmStageFailure).diagnostic.operands.momenta).not.toEqual(fixture.momenta);
    }
  });
  it('typed local viscosity rejection survives Film and Flow rollback with detached operands', () => {
    // The repaired native tail is valid. Inject a local failure at the solver
    // boundary to retain the separate rollback proof without requiring a new
    // physical failure or changing the accepted model.
    const tiny = column([.00025, .00025, .00025, .00025], [0, 0, 0, 0]);
    const reject = (input: FilmLayerColumn, area: number, dt: number, context = {}) => {
      const invalid = structuredClone(input); invalid.momenta[0][0] = NaN;
      throw new LayeredFilmStageFailure('layered-film-unsupported-momentum', 'nonfinite-momentum', invalid, 0, { ...context, stage: 'diffusion-scaled-output', operands: () => ({ beforeColumn: input, area, dt }) });
    };
    const spy = vi.spyOn(layeredOperators, 'diffuseFilmLayers').mockImplementationOnce(reject);
    const film = new WaterfallContactFilm(surface, 1, 1, 64, .35, FOUR_LAYER_FILM_MODE);
    const before = seed(film, [tiny]);
    expect(() => film.advance(0, .0001)).toThrow('unsupported-momentum');
    const failed = film.saveState(), diagnostic = failed.rejectedStage!;
    expect(diagnostic).toMatchObject({ kind: 'layered-film-rejected-stage', stage: 'diffusion-scaled-output', cell: 0, layer: 0, classification: 'nonfinite-momentum' });
    expect(diagnostic.complete).toBe(true);
    expect(diagnostic.operands).toHaveProperty('beforeColumn');
    expect(JSON.stringify(diagnostic).length).toBeLessThan(8000);
    delete failed.rejectedStage; failed.failure = before.failure; expect(failed).toEqual(before);
    const flow = makeFlow(); flow.advanceTo(.0001, () => off);
    const state = flow.saveState(); state.filmState!.layered!.columns[0] = structuredClone(tiny);
    state.filmState!.volumes[0] = tiny.volumes.reduce((a, b) => a + b, 0); state.filmState!.momenta[0] = [0, 0, 0];
    state.filmState!.capturedVolume = state.filmState!.volumes[0]; state.snapshot.receipt.emittedVolume = state.filmState!.volumes[0];
    flow.restoreState(state); const flowBefore = flow.saveState(); spy.mockImplementationOnce(reject); flow.advanceTo(.0002, () => off); spy.mockRestore();
    const after = flow.saveState();
    expect(after.filmState).toEqual(flowBefore.filmState);
    expect(after.snapshot.receipt.failureDiagnostic).toMatchObject({ kind: 'layered-film-rejected-stage', stage: 'diffusion-scaled-output', cell: 0 });
    expect(after.snapshot.receipt.time).toBe(flowBefore.snapshot.receipt.time);
    expect(after.snapshot.receipt.totalOwnedVolume).toBe(flowBefore.snapshot.receipt.totalOwnedVolume);
    expect(after.snapshot.parcels).toEqual(flowBefore.snapshot.parcels);
    const copy = flow.snapshot().receipt.failureDiagnostic!;
    if ('operands' in copy) copy.operands.C = ['changed'];
    expect(flow.snapshot().receipt.failureDiagnostic).toEqual(after.snapshot.receipt.failureDiagnostic);
  });
  it('captured native cell78 retains positive water and representable wall reaction and summed BE loss', () => {
    const c: FilmLayerColumn = { volumes: Array(4).fill(3e-322), momenta: Array.from({length:4}, () => [1.497e-321, -1.087e-321, -5.1e-322]) };
    const result = diffuseFilmLayers(c, 1.0022499500545057, .0011488982251755767);
    // Independent1100-digit exact-physical-V reconstruction by the reviewer.
    expect(result.column.volumes).toEqual(c.volumes);
    expect(result.column.momenta.every(p => p.every(v => v === 0))).toBe(true);
    expect(result.wallImpulse).toEqual([-1212,880,412].map(v => v * Number.MIN_VALUE));
    expect(result.temporalLoss).toBe(5 * Number.MIN_VALUE); expect(result.viscousLoss).toBe(0);
    expect(result.lossUnderflow.viscous!.mantissa).toBeGreaterThan(0); expect(result.lossUnderflow.viscous!.exponent).toBeLessThan(-1075);
    expect(result.momentumUnderflowComponents).toBe(12); expect(result.firstMomentumUnderflow!.momentumFactored.exponent).toBeLessThan(-1075);
    const film = new WaterfallContactFilm(surface, 1, 1, 64, .35, FOUR_LAYER_FILM_MODE);
    seed(film, [c]); film.advance(0, .0001);
    const saved = film.saveState(); expect(saved.layered!.ledger.momentumUnderflowComponents).toBeGreaterThan(0);
    expect(saved.layered!.ledger.firstLossUnderflow!.kind).toBe('viscous');
    const restored = new WaterfallContactFilm(surface, 1, 1, 64, .35, FOUR_LAYER_FILM_MODE); restored.restoreState(saved);
    expect(restored.saveState()).toEqual(saved);
    const oldCheckpoint = structuredClone(saved);
    delete oldCheckpoint.layered!.ledger.momentumUnderflowComponents; delete oldCheckpoint.layered!.ledger.firstMomentumUnderflow;
    delete oldCheckpoint.layered!.ledger.lossUnderflowComponents; delete oldCheckpoint.layered!.ledger.firstLossUnderflow;
    restored.restoreState(oldCheckpoint); expect(restored.saveState()).toEqual(oldCheckpoint);
  });
  it('unequal actual layers retain BE stress identities and dt0 is exact even at extreme range', () => {
    const c = column([.0001,.0002,.0003,.0004],[1,2,3,4]); const result = diffuseFilmLayers(c, 1, .01);
    expect(result.column.volumes).toEqual(c.volumes);
    expect(sumP(result.column) - sumP(c)).toBeCloseTo(result.wallImpulse[0],12);
    expect(layerKinetic(c)-layerKinetic(result.column)).toBeCloseTo(result.viscousLoss+result.temporalLoss,12);
    expect(diffuseFilmLayers(c, 1e300, 0).column).toEqual(c);
    const large: FilmLayerColumn = { volumes: Array(4).fill(1e100), momenta: Array.from({length:4},()=>[1e200,0,0]) };
    const scaled = diffuseFilmLayers(large,1e300,1);
    expect(scaled.column.momenta.map(p=>p[0]/1e-194)).toEqual(expect.arrayContaining([expect.closeTo(2,10),expect.closeTo(5,10),expect.closeTo(7,10),expect.closeTo(8,10)]));
    expect(scaled.temporalLoss / 1e297).toBeCloseTo(2,12); expect(scaled.viscousLoss / 1e-96).toBeCloseTo(2.2,12);
    expect(scaled.wallImpulse[0]/1e200).toBeCloseTo(-4,12); expect(scaled.momentumUnderflowComponents).toBe(0);
    const weak: FilmLayerColumn = { volumes: [1,1,1,1], momenta: Array.from({length:4},()=>[1e100,0,0]) };
    const weakResult = diffuseFilmLayers(weak,1,1e-200);
    expect(weakResult.column.momenta).toEqual(weak.momenta);
    expect(weakResult.temporalLoss/1e-215).toBeCloseTo(2,12);
  });
  it('implicit wall stress closes impulse and separates physical from BE losses', () => {
    const c = column([.00025, .00025, .00025, .00025], [1, 1, 1, 1]);
    const advanced = diffuseFilmLayers(c, 1, .01);
    expect(sumP(advanced.column) - sumP(c)).toBeCloseTo(advanced.wallImpulse[0], 12);
    expect(layerKinetic(c) - layerKinetic(advanced.column)).toBeCloseTo(advanced.viscousLoss + advanced.temporalLoss, 12);
    expect(advanced.viscousLoss).toBeGreaterThan(0); expect(advanced.temporalLoss).toBeGreaterThan(0); expect(advanced.wallWork).toBe(0);
    const speeds = advanced.column.momenta.map((p, k) => p[0] / (1000 * c.volumes[k]));
    expect(speeds[0]).toBeLessThan(speeds[3]); expect(speeds[3]).toBeLessThan(1);
    expect(diffuseFilmLayers(column([0, 0, 0, 0], [0, 0, 0, 0]), 1, .1).column).toEqual(column([0, 0, 0, 0], [0, 0, 0, 0]));
    expect(() => diffuseFilmLayers({ volumes: [0, 0, 0, 0], momenta: [[1, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] }, 1, .1)).toThrow('unsupported-momentum');
  });
  it('overlap remap conserves mass and momentum and accounts the profile mixing change', () => {
    const c = column([.1, .2, .3, .4], [1, -2, 3, 4]), remapped = remapFilmLayers(c);
    expect(remapped.column.volumes).toEqual([.25, .25, .25, .25]);
    expect(sumP(remapped.column)).toBeCloseTo(sumP(c), 12);
    expect(remapped.kineticLossSigned).toBeCloseTo(layerKinetic(c) - layerKinetic(remapped.column), 12);
    expect(remapped.kineticLossSigned).toBeGreaterThan(0);
  });
  it('all layer faces share total-depth pressure and the fastest neighboring profile wave', () => {
    const left = column([.25, .25, .25, .25], [0, 0, 0, 3]), right = column([.5, .5, .5, .5], [0, 0, 0, 8]);
    const flux = filmLayerFaceFlux(left, right, 1, 1, [1, 0, 0], 9.81, 0);
    expect(flux.signal).toBeCloseTo(8 + Math.sqrt(9.81 * 2), 12);
    expect(flux.layers.reduce((sum, row) => sum + row.pressure[0], 0)).toBeCloseTo(.25 * 1000 * 9.81 * (1 + 4), 12);
    const changed = filmLayerFaceFlux(column([.5, .5, .5, .5], [0, 0, 0, 3]), right, 1, 1, [1, 0, 0], 9.81, 0);
    expect(changed.layers[0].pressure[0]).toBeGreaterThan(flux.layers[0].pressure[0]);
  });
  it('actual Film advancement transports persistent profiles and retains versioned terminal transfers', () => {
    const film = new WaterfallContactFilm(surface, 2, 1, 64, .35, FOUR_LAYER_FILM_MODE);
    seed(film, [column([.000125, .000125, .000125, .000125], [1, 2, 3, 4]), column([0, 0, 0, 0], [0, 0, 0, 0])]);
    const before = film.snapshot(); expect(layerKinetic(before.layered!.columns[0])).toBeGreaterThan(sumP(before.layered!.columns[0]) ** 2 / (2000 * .0005));
    const out = film.advance(0, .0001), after = film.snapshot();
    expect(after.layered!.columns[1].volumes.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(after.receipt.volume + out.reduce((sum, row) => sum + row.volume, 0)).toBeCloseTo(before.receipt.volume, 14);
    expect(after.layered!.ledger.viscousLoss).toBeGreaterThan(0);
    const ledger = after.layered!.ledger;
    expect(ledger.completedSubsteps).toBe(after.receipt.substeps);
    expect(ledger.horizontalGravityLossPositive - ledger.horizontalGravityGainMagnitude).toBeCloseTo(ledger.transportLossSigned - ledger.gravityIntegrationChangeSigned, 12);
    expect(ledger.remapLossPositive - ledger.remapGainMagnitude).toBeCloseTo(ledger.remapLossSigned, 12);
    expect(ledger.horizontalGravityGainMagnitude).toBeLessThanOrEqual(ledger.horizontalGravityNumericalTolerance);
    expect(ledger.remapGainMagnitude).toBeLessThanOrEqual(ledger.remapNumericalTolerance);
    expect(out.length).toBeGreaterThan(0);
    for (const row of out) {
      expect(row.layered!.version).toBe(FOUR_LAYER_FILM_MODE);
      expect(row.layered!.layers.reduce((sum, l) => sum + l.volume, 0)).toBe(row.volume);
      row.momentum.forEach((v, axis) => expect(v - row.layered!.advectiveMomentum[axis] - row.layered!.pressureImpulse[axis] - row.layered!.numericalMomentumCorrection[axis]).toBeCloseTo(0, 12));
      expect(row.layered!.energyStatus).toBe('ENERGY_UNKNOWN');
    }
    const copy = film.snapshot(); copy.layered!.columns[0].momenta[0][0] = 999;
    expect(film.snapshot()).toEqual(after);
  });
  it('junction source primitive momentum and pressure work remain distinct and both exact source sums persist', () => {
    const film = new WaterfallContactFilm(surface, 1, 1, 64, .35, FOUR_LAYER_FILM_MODE);
    film.configureJunction({ locus: [[.5, 0, .25], [.5, 0, .75]] });
    const segment = film.junctionSegments()[0], duration = .0001, h = .01, speed = 1;
    const port = (sign: number): FilmJunctionPort => {
      const volume = h * speed * segment.length * duration, velocity: ContactVec3 = [sign * speed, 0, .3];
      return { volume, velocity, height: h, momentum: [1000 * volume * sign * speed + sign * .5 * 1000 * 9.81 * h * h * segment.length * duration, 0, 1000 * volume * .3], energy: 1000 * volume * (.5 * (speed * speed + .3 ** 2) + 9.81 * h) };
    };
    const minus = port(-1), plus = port(1);
    film.advance(0, duration, [{ face: segment.face, minus, plus, incomingVolume: minus.volume + plus.volume, incomingEnergy: minus.energy + plus.energy, reaction: [0, 0, 0] }]);
    const s = film.snapshot();
    expect(s.receipt.volume).toBeCloseTo(minus.volume + plus.volume, 15);
    expect(s.layered!.ledger.sourcePressureWork).toBeGreaterThan(0);
    expect(s.layered!.ledger.sourceAdvectiveEnergy + s.layered!.ledger.sourcePressureWork).toBeCloseTo(minus.energy + plus.energy, 15);
    expect(s.receipt.junctionIncomingEnergy).toBe(minus.energy + plus.energy);
    const momentumBefore = structuredClone(s.layered!.ledger);
    expect(momentumBefore.sourceAdvectiveMomentum[2]).toBeCloseTo(1000 * (minus.volume + plus.volume) * .3, 15);
    for (let axis = 0; axis < 3; axis++) expect(momentumBefore.sourceAdvectiveMomentum[axis] + momentumBefore.sourcePressureImpulse[axis]).toBeCloseTo(minus.momentum[axis] + plus.momentum[axis], 15);
    // This source has no arbitrary prescribed shear; no-slip creates it during the actual advance.
    expect(s.layered!.columns.some(c => c.momenta[0][0] !== c.momenta[3][0])).toBe(true);
  });
  it('mode validation and failed short Film advancement restore all persistent layer state', () => {
    const film = new WaterfallContactFilm(surface, 1, 1, 1, .35, FOUR_LAYER_FILM_MODE);
    const before = seed(film, [column([.00025, .00025, .00025, .00025], [1, 1, 1, 1])]);
    expect(() => film.advance(0, .02)).toThrow('film-cfl-capacity');
    const restored = film.saveState(); restored.failure = before.failure; expect(restored).toEqual(before);
    const legacy = new WaterfallContactFilm(surface, 1, 1); const legacyBefore = legacy.saveState();
    expect(() => legacy.restoreState(before)).toThrow('mode-mismatch'); expect(legacy.saveState()).toEqual(legacyBefore);
    const damaged = structuredClone(before); damaged.layered!.columns[0].momenta[0][0]++;
    const current = film.saveState(); expect(() => film.restoreState(damaged)).toThrow('total-mismatch'); expect(film.saveState()).toEqual(current);
    const nonsigma = structuredClone(before);
    nonsigma.layered!.columns[0].volumes[0] += .0001; nonsigma.layered!.columns[0].volumes[1] -= .0001;
    expect(() => film.restoreState(nonsigma)).toThrow('nonsigma-column'); expect(film.saveState()).toEqual(current);
  });
  it('screens each new substep gain against its own tolerance before prior losses or tolerance can mask it', () => {
    const film = new WaterfallContactFilm(surface, 1, 1, 64, .35, FOUR_LAYER_FILM_MODE);
    const before = seed(film, [column([.00025, .00025, .00025, .00025], [0, 0, 0, 0])]);
    before.layered!.ledger.horizontalGravityNumericalTolerance = 1000;
    before.layered!.ledger.horizontalGravityLossPositive = 1000; film.restoreState(before);
    // Inject an unexplained local energy gain at the measured energy seam. A
    // large historical loss or tolerance must not make this new tick acceptable.
    const spy = vi.spyOn(film as unknown as { energy(): number }, 'energy').mockReturnValueOnce(1).mockReturnValueOnce(1).mockReturnValueOnce(2);
    try { expect(() => film.advance(0, .0001)).toThrow('horizontal-gravity-energy-gain'); }
    finally { spy.mockRestore(); }
    const diagnostic = JSON.parse(film.saveState().failure!.slice('layered-film-horizontal-gravity-energy-gain:'.length));
    expect(diagnostic.beforeEnergy).toBe(1); expect(diagnostic.transportedEnergy).toBe(1); expect(diagnostic.afterGravityEnergy).toBe(2);
    expect(-diagnostic.horizontalGravityChangeSigned).toBeGreaterThan(diagnostic.numericalTolerance);
    expect(Number.isFinite(diagnostic.sourceInsertionPotentialChangeSigned)).toBe(true);
    const restored = film.saveState(); restored.failure = before.failure; expect(restored).toEqual(before);
  });
  it('real Flow owns every original layered record and public/compact checkpoints restore the advancing profile', () => {
    const flow = makeFlow(); flow.advanceTo(.0001, () => off);
    const state = flow.saveState(), columns = state.filmState!.layered!.columns;
    columns[0] = column([.00001, .00001, .00001, .00001], [-1, -1, -1, -1]);
    state.filmState!.volumes[0] = .00004; state.filmState!.momenta[0] = [-.04, 0, 0]; state.filmState!.capturedVolume = .00004; state.snapshot.receipt.emittedVolume = .00004;
    flow.restoreState(state); const before = flow.saveState(), compact = flow.saveTransactionState();
    flow.advanceTo(.0002, () => off);
    expect(flow.failureReason).toBeNull(); expect(flow.pendingOriginalFilmReleases.length).toBeGreaterThan(0);
    expect(flow.snapshot().parcels).toHaveLength(0); expect(flow.snapshot().receipt.energy.layeredEnergyStatus).toBe('ENERGY_UNKNOWN');
    const originals = flow.pendingOriginalFilmReleases;
    const pendingState = flow.saveState();
    for (const mutation of ['energy', 'version', 'exported'] as const) {
      const invalid = structuredClone(pendingState);
      if (mutation === 'energy') invalid.originalReleaseOwnership!.pending[0].outflow.layered!.energyFlux = NaN;
      else if (mutation === 'version') Object.assign(invalid.originalReleaseOwnership!.pending[0].outflow.layered!, { version: 'legacy' });
      else invalid.originalReleaseOwnership!.exportedLayeredEnergyDifference = Infinity;
      expect(() => flow.restoreState(invalid)).toThrow(); expect(flow.saveState()).toEqual(pendingState);
    }
    flow.acknowledgeOriginalFilmReleases(originals, { checkpoint: () => null, restore: () => {}, admit: records => expect(records).toEqual(originals) });
    expect(flow.pendingOriginalFilmReleases).toHaveLength(0);
    flow.restoreTransactionState(compact); expect(flow.saveState()).toEqual(before);
    flow.advanceTo(.0002, () => off); flow.restoreState(before); expect(flow.saveState()).toEqual(before);
    const legacy = new WaterfallContactFlow({ startTime: 0 }); const legacyBefore = legacy.saveState();
    expect(() => legacy.restoreState(before)).toThrow('Film mode mismatch'); expect(legacy.saveState()).toEqual(legacyBefore);
    const unclaimed = makeFlow(false); unclaimed.restoreState(before); unclaimed.advanceTo(.0002, () => off);
    expect(unclaimed.failureReason).toBe('layered-film-unclaimed-terminal-transfer');
    expect(unclaimed.saveState().filmState).toEqual(before.filmState);
    expect(unclaimed.pendingOriginalFilmReleases).toHaveLength(0); expect(unclaimed.snapshot().parcels).toHaveLength(0);
  });
  it('default single-layer records and short arithmetic stay identical to explicit legacy mode', () => {
    const legacy = new WaterfallContactFilm(surface, 1, 1), explicit = new WaterfallContactFilm(surface, 1, 1, 64, .35, 'single-layer');
    for (const f of [legacy, explicit]) { f.capture([.5, 0, .5], .0001, [1, 0, 0]); f.advance(0, .0001); }
    expect(legacy.saveState()).toEqual(explicit.saveState()); expect(legacy.snapshot()).toEqual(explicit.snapshot());
    expect('layered' in legacy.saveState()).toBe(false);
  });
});
