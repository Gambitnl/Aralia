/** Conservative film checks qualify bookkeeping and the bounded numerical
 * method only. They do not certify impact physics or liquid realism. */
import { describe, expect, it } from 'vitest';
import { getWaterfallContactSurfaces } from '../waterfallContactFlow';
import { WaterfallContactFilm, type FilmJunctionTransfer } from '../waterfallContactFilm';
import { solveWaterfallImpactJunction } from '../waterfallImpactJunction';
import { waterfallImpactLocus } from '../waterfallImpactLocus';

const point = (x: number, z: number): [number, number, number] => [x, 63.675 - .65 * x + .22 * z, z];
function junctionFilm(maximumSubsteps = 64) {
  const film = new WaterfallContactFilm(getWaterfallContactSurfaces()[0], 12, 16, maximumSubsteps);
  film.configureJunction({ locus: [point(.35, -5), point(.36, 0), point(.355, 5)], spanKnots: [-5 / 3, 5 / 3] });
  return film;
}
function transferFor(film: WaterfallContactFilm, duration: number): FilmJunctionTransfer {
  const segment = film.junctionSegments()[2], q = .015, gn = film.normalGravity;
  const result = solveWaterfallImpactJunction({ q, ve: 0, vt: 0, vn: -8, gn, H: 32, density: 1000, span: segment.length, duration });
  if (!result.ok) throw Error(result.reason);
  const port = (state: typeof result.plus, sign: number) => {
    const volume = state.q * segment.length * duration;
    const velocity = segment.normal.map(v => v * sign * state.s) as [number, number, number];
    return { volume, height: state.h, velocity, energy: 1000 * volume * (32 + 9.81 * (segment.start[1] + segment.end[1]) / 2), momentum: segment.normal.map(v => v * sign * 1000 * (state.q * state.s + .5 * gn * state.h ** 2) * segment.length * duration) as [number, number, number] };
  };
  const minus = port(result.minus, -1), plus = port(result.plus, 1);
  return { face: segment.face, incomingVolume: q * segment.length * duration, incomingEnergy: minus.energy + plus.energy, reaction: film.surface.normal.map(v => v * result.integrated.normalReaction) as [number, number, number], minus, plus };
}

describe('first ledge pressure-bearing film', () => {
  it('does no numerical work on a dry unsupplied ledge, then accepts its first arrival normally', () => {
    const waiting = junctionFilm(), fresh = junctionFilm(), initial = waiting.saveState();
    for (let i = 0; i < 120; i++) expect(waiting.advance(i / 120, 1 / 120)).toEqual([]);
    expect(waiting.saveState()).toEqual(initial);
    const transfer = transferFor(waiting, .001);
    waiting.advance(1, .001, [transfer]); fresh.advance(1, .001, [transfer]);
    expect(waiting.saveState()).toEqual(fresh.saveState());
    expect(waiting.volume).toBeGreaterThan(0);
  });
  it('still validates clocks and supplied ports when the ledge is dry', () => {
    const film = junctionFilm();
    expect(() => film.advance(NaN, .001)).toThrow('Invalid film clock');
    expect(() => film.advance(0, -1)).toThrow('Invalid film clock');
    const transfer = transferFor(film, .001); transfer.incomingVolume = 0;
    expect(() => film.advance(0, .001, [transfer])).toThrow('film-junction-invalid-transfer');
  });
  it('does not mistake a tiny positive inventory for dry terrain', () => {
    const film = new WaterfallContactFilm(getWaterfallContactSurfaces()[0]);
    const state = film.saveState(); state.volumes[80] = 1e-20;
    film.restoreState(state); film.advance(0, 1 / 120);
    expect(film.snapshot().receipt.substeps).toBeGreaterThan(0);
    expect(film.volume + film.snapshot().receipt.releasedVolume).toBeCloseTo(1e-20, 30);
  });
  it('reports scalar junction presence without exposing or copying numerical geometry', () => {
    const film = new WaterfallContactFilm(getWaterfallContactSurfaces()[0]);
    expect(film.hasJunctionGeometry).toBe(false);
    const configured = junctionFilm(); expect(configured.hasJunctionGeometry).toBe(true);
    const saved = configured.saveState(), before = structuredClone(saved), snapshot = configured.snapshot();
    saved.junctionGeometry!.locus[0][0] = NaN; saved.volumes[0] = NaN; saved.momenta[0][0] = NaN;
    snapshot.cells[0].corners[0][0] = NaN; snapshot.receipt.gravityImpulse[0] = NaN;
    expect(configured.hasJunctionGeometry).toBe(true); expect(configured.saveState()).toEqual(before);
  });
  it('restored Film releases preserve the native identity despite reordered surface properties', () => {
    const surface = getWaterfallContactSurfaces()[0], native = new WaterfallContactFilm(surface);
    const state = native.saveState(); state.volumes.fill(.001);
    const reordered = { normal: surface.normal, id: surface.id, vertices: surface.vertices };
    const restored = new WaterfallContactFilm(reordered), before = structuredClone({ reordered, state });
    restored.restoreState(state);
    const outflows = restored.advance(0, 1 / 600);
    expect(outflows.length).toBeGreaterThan(0);
    for (const outflow of outflows) expect(outflow.origin!.geometryIdentity).toBe(JSON.stringify(surface));
    expect({ reordered, state }).toEqual(before);
  });
  it('uses real spatial cell metrics for synthetic wave rates without advancing water', () => {
    const surface = getWaterfallContactSurfaces()[0], film = new WaterfallContactFilm(surface);
    const source = { q: 1.5, width: 10, depth: .7, speed: 1.5 / 7, top: 78, pool: 18 }, spanKnots = Array.from({ length: 7 }, (_, i) => (i / 6 - .5) * 10);
    film.configureJunction({ locus: waterfallImpactLocus(source, surface, 1 / 60, 20000, { rowCount: film.nz, spanKnots }), spanKnots });
    const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
    const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);
    const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const norm = (a: number[]) => Math.hypot(...a);
    const cells = film.snapshot().cells;
    const areas = cells.map(c => .5 * (norm(cross(sub(c.corners[1], c.corners[0]), sub(c.corners[2], c.corners[0]))) + norm(cross(sub(c.corners[2], c.corners[0]), sub(c.corners[3], c.corners[0])))));
    expect(cells).toHaveLength(13 * 22);
    expect(areas.every(a => a > 0 && Number.isFinite(a))).toBe(true);
    expect(areas.reduce((sum, a) => sum + a, 0)).toBeCloseTo(film.area * 12 * 16, 10);
    const state = film.saveState(), normalSpeed = dot([2, -1, 1], surface.normal), velocity = [2, -1, 1].map((v, i) => v - surface.normal[i] * normalSpeed);
    for (const cell of cells) {
      state.volumes[cell.id] = areas[cell.id] * (.02 + .005 * (cell.id % 3));
      state.momenta[cell.id] = velocity.map(v => 1000 * state.volumes[cell.id] * v) as [number, number, number];
    }
    film.restoreState(state); const before = film.saveState(), synthetic = film.snapshot().cells;
    const rates = film.inspectWaveRates();
    for (const cell of synthetic) {
      const i = cell.id % film.nx, j = Math.floor(cell.id / film.nx);
      const neighbors = [j > 0 ? cell.id - film.nx : -1, i < film.nx - 1 ? cell.id + 1 : -1, j < film.nz - 1 ? cell.id + film.nx : -1, i > 0 ? cell.id - 1 : -1];
      let independentRate = 0;
      for (let edge = 0; edge < 4; edge++) {
        const vector = sub(cell.corners[(edge + 1) % 4], cell.corners[edge]), raw = cross(surface.normal, vector), outward = raw.map(v => v / norm(raw));
        const signal = Math.max(...[cell.id, neighbors[edge]].filter(id => id >= 0).map(id => Math.abs(dot(synthetic[id].velocity, outward)) + 2 * Math.sqrt(film.normalGravity * synthetic[id].height)));
        independentRate += signal * norm(vector) / areas[cell.id];
      }
      expect(rates[cell.id]).toBeCloseTo(independentRate, 10);
    }
    const transfer = transferFor(film, .001), segment = film.junctionSegments().find(s => s.face === transfer.face)!, portRates = film.inspectWaveRates([transfer]);
    for (const [id, port] of [[segment.minusCell, transfer.minus], [segment.plusCell, transfer.plus]] as const) {
      const added = (norm(port.velocity) + 2 * Math.sqrt(film.normalGravity * port.height)) * segment.length / areas[id];
      expect(portRates[id] - rates[id]).toBeCloseTo(added, 10);
    }
    expect(film.saveState()).toEqual(before);
    console.info('synthetic spatial metrics', { nx: film.nx, nz: film.nz, minimumArea: Math.min(...areas), totalArea: areas.reduce((v, a) => v + a, 0), maximumWaveRate: Math.max(...rates), maximumWithSyntheticPort: Math.max(...portRates) });
  });
  it('retains exact piecewise strike geometry and positive quadrilateral cells', () => {
    const film = junctionFilm(), s = film.snapshot(), segments = film.junctionSegments();
    expect(s.nx).toBe(13); expect(s.cells.length).toBeLessThan(4096);
    expect(segments[0].start[0]).toBeCloseTo(.35, 14);
    expect(segments.at(-1)!.end[0]).toBeCloseTo(.355, 14);
    expect(segments.some(p => p.end[2] === 0)).toBe(true);
    expect(segments.every(p => p.minusCell !== p.plusCell && p.length > 0 && p.normal[0] > 0)).toBe(true);
    expect(s.cells.every(c => c.corners.every(p => p.every(Number.isFinite)))).toBe(true);
    const state = film.saveState(); state.volumes.fill(1); film.restoreState(state);
    const totalArea = film.snapshot().cells.reduce((sum, c) => sum + 1 / c.height, 0);
    expect(totalArea).toBeCloseTo(film.area * 12 * 16, 10);
  });
  it('transfers pressure flux into separate regions and reconnects when supply stops', () => {
    const film = junctionFilm(), duration = .001, transfer = transferFor(film, duration), segment = film.junctionSegments().find(p => p.face === transfer.face)!;
    film.advance(0, duration, [transfer]);
    const s = film.snapshot();
    expect(s.receipt.volume).toBeCloseTo(transfer.incomingVolume, 14);
    expect(s.cells[segment.minusCell].velocity[0]).toBeLessThan(0);
    expect(s.cells[segment.plusCell].velocity[0]).toBeGreaterThan(0);
    expect(s.receipt.normalEnergyLoss).toBe(0);
    expect(s.receipt.junctionIncomingEnergy).toBeCloseTo(transfer.incomingEnergy, 10);
    expect(s.receipt.junctionOutgoingEnergy).toBeCloseTo(transfer.incomingEnergy, 10);
    const energy = s.cells.reduce((sum, c) => sum + 1000 * c.volume * (.5 * c.velocity.reduce((v, x) => v + x * x, 0) + 9.81 * c.center[1] + .5 * s.receipt.normalGravity * c.height), 0);
    expect(s.receipt.numericalEnergyLossSigned).toBeCloseTo(transfer.incomingEnergy - energy, 10);
    for (let k = 0; k < 3; k++) expect(s.receipt.momentum[k]).toBeCloseTo(transfer.minus.momentum[k] + transfer.plus.momentum[k] + s.receipt.gravityImpulse[k] + s.receipt.supportImpulse[k], 12);
    const state = film.saveState(), clone = junctionFilm(); clone.restoreState(state);
    film.advance(duration, .002); clone.advance(duration, .002, []);
    expect(film.saveState()).toEqual(clone.saveState()); expect(film.volume).toBeGreaterThan(0);
  });
  it('rolls counters and inventory back on receiving backpressure', () => {
    const film = junctionFilm(), transfer = transferFor(film, .001), state = film.saveState();
    const segment = film.junctionSegments().find(p => p.face === transfer.face)!;
    state.volumes[segment.plusCell] = 1; film.restoreState(state);
    const saved = film.saveState();
    expect(() => film.advance(0, .001, [transfer])).toThrow('film-junction-backpressure');
    const after = film.saveState(); after.failure = saved.failure; expect(after).toEqual(saved);
  });
  it('restores refined geometry and rejects unbalanced ports', () => {
    const film = junctionFilm(), state = film.saveState(), fresh = new WaterfallContactFilm(getWaterfallContactSurfaces()[0]);
    fresh.restoreState(state); expect(fresh.snapshot()).toEqual(film.snapshot());
    const transfer = transferFor(film, .001); transfer.incomingVolume *= 2;
    expect(() => film.advance(0, .001, [transfer])).toThrow('film-junction-volume-balance'); expect(film.volume).toBe(0);
  });
  it('reconnects unsupplied strike faces for actual cross-boundary HLL transport', () => {
    const film = junctionFilm(), segment = film.junctionSegments()[2], state = film.saveState();
    state.volumes[segment.minusCell] = .001; film.restoreState(state);
    film.advance(0, .0001);
    expect(film.snapshot().cells[segment.plusCell].volume).toBeGreaterThan(0);
    expect(film.snapshot().receipt.junctionIncomingEnergy).toBe(0);
    expect(film.volume).toBeCloseTo(.001, 14);
  });
  it('rolls active port counters back after a later bounded CFL failure', () => {
    const film = junctionFilm(1), transfer = transferFor(film, .02), saved = film.saveState();
    expect(() => film.advance(0, .02, [transfer])).toThrow('film-cfl-capacity');
    // The failure reason is an expected result, not an omitted state field.
    expect(film.saveState()).toEqual({ ...saved, failure: 'film-cfl-capacity' });
  });
  it('rejects altered pressure-work energy rather than hiding it as numerical loss', () => {
    const film = junctionFilm(), transfer = transferFor(film, .001);
    transfer.minus.energy *= 2; transfer.incomingEnergy = transfer.minus.energy + transfer.plus.energy;
    expect(() => film.advance(0, .001, [transfer])).toThrow('film-junction-port-energy-mismatch');
    expect(film.snapshot().receipt.junctionIncomingEnergy).toBe(0);
    expect(film.snapshot().receipt.numericalEnergyLossSigned).toBe(0);
  });
  it('transports positive subnormal water without overflowing its mass reciprocal', () => {
    const film = new WaterfallContactFilm(getWaterfallContactSurfaces()[0]);
    const volume = 1e-312;
    film.capture([1, 63, 0], volume, [2, -8, 1]);
    expect(1 / (1000 * volume)).toBe(Infinity);
    const admitted = film.snapshot().cells.find(c => c.volume > 0)!;
    expect(admitted.velocity.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...admitted.velocity)).toBeGreaterThan(1);
    const out = film.advance(0, 1 / 60), snapshot = film.snapshot();
    expect(snapshot.cells.every(c => c.volume >= 0 && c.velocity.every(Number.isFinite))).toBe(true);
    expect(out.every(p => p.volume > 0 && p.velocity.every(Number.isFinite))).toBe(true);
    const accounted = snapshot.receipt.volume + out.reduce((v, p) => v + p.volume, 0);
    expect(Math.abs(accounted / volume - 1)).toBeLessThan(1e-9);
    expect(accounted).toBeGreaterThan(0);
    expect(snapshot.receipt.failure).toBeNull();
  });
  it('captures normal momentum once and separates tangential mixing loss', () => {
    const film = new WaterfallContactFilm(getWaterfallContactSurfaces()[0]);
    const first = film.capture([1, 63, 0], 1, [2, -8, 1]);
    expect(first.normalEnergyLoss).toBeGreaterThan(0);
    expect(first.mixingEnergyLoss).toBeCloseTo(0, 8);
    const next = film.capture([1, 63, 0], 1, [-2, -8, -1]);
    expect(next.mixingEnergyLoss).toBeGreaterThan(0);
    const s = film.snapshot();
    expect(s.receipt.volume).toBe(2);
    expect(s.receipt.capturedVolume).toBe(2);
    expect(s.nx).toBe(12); expect(s.nz).toBe(16);
    expect(s.cells.filter(c => c.volume > 0)).toHaveLength(1);
    expect(s.receipt.normalGravity).toBeGreaterThan(0);
    expect(Number.isFinite(s.receipt.depositionPotentialEnergyChange)).toBe(true);
    expect(() => film.capture([100, 63, 0], 1, [0, 0, 0])).toThrow('outside-surface');
    expect(film.volume).toBe(2);
  });
  it('spreads by pressure, releases actual edge flux and preserves volume and momentum', () => {
    const film = new WaterfallContactFilm(getWaterfallContactSurfaces()[0]);
    film.capture([1, 63, 0], .25, [0, 0, 0]);
    const initial = film.snapshot();
    let released = 0, momentum = [0, 0, 0];
    for (let i = 0; i < 600; i++) {
      const out = film.advance(i / 60, 1 / 60);
      for (const packet of out) { released += packet.volume; momentum = momentum.map((v, k) => v + packet.momentum[k]); expect(packet.intervalEnd).toBeGreaterThan(packet.intervalStart); }
      expect(film.snapshot().cells.every(c => c.volume >= 0 && [...c.velocity, c.height].every(Number.isFinite))).toBe(true);
    }
    const s = film.snapshot();
    expect(released).toBeGreaterThan(.24);
    expect(s.receipt.volume + released).toBeCloseTo(.25, 9);
    expect(s.receipt.maximumCourant).toBeLessThanOrEqual(.35000001);
    for (let k = 0; k < 3; k++) expect(s.receipt.momentum[k] + momentum[k]).toBeCloseTo(initial.receipt.momentum[k] + s.receipt.gravityImpulse[k] + s.receipt.supportImpulse[k], 7);
    expect(Number.isFinite(s.receipt.numericalEnergyLossSigned)).toBe(true);
  });
  it('rolls a bounded CFL failure back without resetting water', () => {
    const film = new WaterfallContactFilm(getWaterfallContactSurfaces()[0], 12, 16, 1);
    film.capture([1, 63, 0], 1, [20, -8, 1]);
    const state = film.saveState();
    expect(() => film.advance(0, 1)).toThrow('film-cfl-capacity');
    expect(film.snapshot().receipt.volume).toBeCloseTo(1, 10);
    expect(film.saveState().volumes).toEqual(state.volumes);
    expect(film.saveState().momenta).toEqual(state.momenta);
    expect(film.snapshot().receipt.failure).toBe('film-cfl-capacity');
    film.restoreState(state);
    expect(film.snapshot().receipt.failure).toBeNull();
  });
});
