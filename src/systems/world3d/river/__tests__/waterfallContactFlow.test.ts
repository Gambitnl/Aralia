/** Focused receipts for the coarse waterfall contact experiment. These prove
 * parcel bookkeeping and contact response, not continuous liquid realism. */
import { describe, expect, it, vi } from 'vitest';
import { getWaterfallContactSurfaces, sweepWaterfallContact, sweepWaterfallReleaseLocal, sweepWaterfallQuadratic, waterfallFlightDisplacement, waterfallDownwardRoot, waterfallSupportExitRoot, waterfallSupportedPosition, WaterfallContactFlow, type ContactSupport, type ContactSource, type ContactReleaseLocal, type ContactParcel, type ContactSurface, type ContactVec3 } from '../waterfallContactFlow';
import { WaterfallContactFilm, type FilmJunctionTransfer, type FilmOutflow } from '../waterfallContactFilm';
import { waterfallImpactLocus } from '../waterfallImpactLocus';
import { waterfallContactGeometryIdentity } from '../waterfallContactGeometry';

const source: ContactSource = { q: 10, width: 10, depth: .7, speed: 10 / 7, top: 78, pool: 18 };
const off = { ...source, q: 0 };
function catchUp(flow: WaterfallContactFlow, time: number, sample: (t: number) => ContactSource): void {
  while (flow.time < time - 1e-7) {
    const previous = flow.time;
    flow.advanceTo(time, sample);
    if (flow.time === previous) break;
  }
}

describe('waterfall finite contact flow', () => {
  it('compact rollback matches complete public checkpoint rollback after Film mutation and capacity failure', () => {
    const run = (publicCheckpoint: boolean, impactMode: 'absorb' | 'junction') => {
      const dt = 1 / 600, flow = new WaterfallContactFlow({ startTime: 0, dt, parcelsPerStep: 1, maxParcels: 1, impactMode });
      flow.advanceTo(dt, () => off);
      const seed = flow.saveState(); seed.filmState!.volumes.fill(.001);
      const packet = supportedPacket(dt);
      packet.motionRevision = 7;
      packet.sourceSection = { width: 10, depth: .7, speed: 10 / 7, top: 78 };
      packet.sourceRelease = { edge: 'source:0', start: [0, 78, -5], end: [0, 78, 5], intervalStart: 0, intervalEnd: dt, velocity: [1, 0, 0], birthTime: 0 };
      packet.sheetRelease = structuredClone(packet.sourceRelease);
      seed.snapshot.parcels = [packet]; seed.nextId = 17210; flow.restoreState(seed);
      // Public saveState is the pre-repair rollback oracle. No baseline source
      // imports disposable harness files or candidate rollback helpers.
      const rollback = publicCheckpoint ? vi.spyOn(flow as unknown as { saveRollbackState(): unknown }, 'saveRollbackState').mockImplementation(() => flow.saveState()) : null;
      const film = (flow as unknown as { film: WaterfallContactFilm }).film;
      const originalAdvance = film.advance.bind(film), beforeFilm = film.saveState(); let mutated = false;
      const advance = vi.spyOn(film, 'advance').mockImplementation((...args) => {
        const releases = originalAdvance(...args);
        mutated = film.saveState().substeps > beforeFilm.substeps && releases.length > 0;
        // The later Flow cap must restore even mutable supplying geometry,
        // together with Film arrays, outgoing queue, cursors and parcel metadata.
        film.surface.vertices[0][0] += .001; film.surface.normal[0] += .001;
        return releases;
      });
      const arrival = flow.advanceTo(2 * dt, () => off);
      expect(mutated).toBe(true); expect(flow.failureReason).toBe('parcel-capacity');
      expect(arrival.volume).toBe(0); expect(arrival.arrivals).toHaveLength(0); expect(flow.time).toBe(dt);
      const state = flow.saveState();
      // The only comparison exclusion is the established observed wall time;
      // expected failure, target time and every other public field stay present.
      state.snapshot.receipt.lastAdvanceMilliseconds = 0;
      advance.mockRestore(); rollback?.mockRestore(); return state;
    };
    for (const mode of ['absorb', 'junction'] as const) expect(run(false, mode)).toEqual(run(true, mode));
  });
  it('compact rollback retains pre-transaction missing-surface checks and support precedence', () => {
    for (const missing of ['support', 'release'] as const) {
      const flow = new WaterfallContactFlow({ startTime: 0, dt: 1 / 600, impactMode: 'junction' });
      const packet = supportedPacket(0);
      packet.releaseLocal = { surfaceId: 'absent-release', geometryIdentity: '', face: 0, edge: 'upstream', anchor: [0, .5], normal: [0, 1, 0], clearance: 0, displacement: [0, 0, 0], referenceTime: 0 };
      if (missing === 'support') packet.support!.surfaceId = 'absent-support'; else delete packet.support;
      (flow as unknown as { parcels: ContactParcel[] }).parcels = [packet];
      expect(() => flow.advanceTo(1 / 600, () => off)).toThrow(missing === 'support' ? 'support-missing-surface' : 'release-local-missing-surface');
      expect(flow.time).toBe(0); expect(flow.failureReason).toBeNull();
    }
  });
  it('advances without presentation snapshots while retaining isolated public checkpoints', () => {
    const flow = new WaterfallContactFlow({ startTime: 0, dt: 1 / 600, parcelsPerStep: 1, impactMode: 'junction' });
    const flowSnapshot = vi.spyOn(flow, 'snapshot'), filmSnapshot = vi.spyOn(WaterfallContactFilm.prototype, 'snapshot');
    flow.advanceTo(1 / 600, () => source);
    expect(flow.failureReason).toBeNull(); expect(flowSnapshot).not.toHaveBeenCalled(); expect(filmSnapshot).not.toHaveBeenCalled();
    flowSnapshot.mockRestore(); filmSnapshot.mockRestore();
    const expected = flow.saveState(), checkpoint = flow.saveState(), snapshot = flow.snapshot();
    checkpoint.snapshot.parcels[0].position[0] = NaN; checkpoint.snapshot.parcels[0].sourceRelease!.start[0] = NaN;
    checkpoint.snapshot.surfaces[0].vertices[0][0] = NaN; checkpoint.snapshot.surfaces[0].normal[0] = NaN;
    checkpoint.filmSurface!.vertices[0][0] = NaN; checkpoint.filmState!.volumes[0] = NaN;
    checkpoint.filmState!.junctionGeometry!.locus[0][0] = NaN; checkpoint.supportCounters!.impulse[0] = NaN;
    checkpoint.energyCounters.inputKinetic = NaN; checkpoint.snapshot.receipt.junctionRemap.incomingPositionMoment[0] = NaN;
    snapshot.parcels[0].velocity[0] = NaN; snapshot.film!.cells[0].corners[0][0] = NaN;
    expect(flow.saveState()).toEqual(expected);
  });
  it('preserves native identity across all surface property permutations without mutating input', () => {
    const surface = getWaterfallContactSurfaces()[0], nativeIdentity = JSON.stringify(surface);
    const permutations: ContactSurface[] = [
      { id: surface.id, vertices: surface.vertices, normal: surface.normal },
      { id: surface.id, normal: surface.normal, vertices: surface.vertices },
      { vertices: surface.vertices, id: surface.id, normal: surface.normal },
      { vertices: surface.vertices, normal: surface.normal, id: surface.id },
      { normal: surface.normal, id: surface.id, vertices: surface.vertices },
      { normal: surface.normal, vertices: surface.vertices, id: surface.id },
    ];
    for (const reordered of permutations) {
      const before = JSON.stringify(reordered);
      expect(waterfallContactGeometryIdentity(reordered)).toBe(nativeIdentity);
      expect(JSON.stringify(reordered)).toBe(before);
    }
  });
  it('restored reordered Film produces releases accepted by the next native Flow tick', () => {
    const dt = 1 / 600, flow = new WaterfallContactFlow({ startTime: 0, dt, impactMode: 'junction' });
    flow.advanceTo(dt, () => off);
    const seed = flow.saveState();
    // Synthetic water isolates checkpoint property ordering in three short
    // ticks; it is not a new prefix or a conservation/realism acceptance run.
    seed.filmState!.volumes.fill(.001); flow.restoreState(seed);
    const checkpoint = flow.saveState(), surface = checkpoint.filmSurface!;
    checkpoint.filmSurface = { id: surface.id, normal: surface.normal, vertices: surface.vertices };
    checkpoint.snapshot.surfaces = checkpoint.snapshot.surfaces.map(s => ({ id: s.id, normal: s.normal, vertices: s.vertices }));
    const before = structuredClone(checkpoint), inputOrder = JSON.stringify(checkpoint.filmSurface);
    flow.restoreState(checkpoint);
    expect(checkpoint).toEqual(before); expect(JSON.stringify(checkpoint.filmSurface)).toBe(inputOrder);
    expect(flow.saveState()).toEqual(checkpoint);
    flow.advanceTo(2 * dt, () => off);
    expect(flow.failureReason).toBeNull();
    const produced = flow.snapshot().parcels.filter(p => p.releaseLocal);
    expect(produced.length).toBeGreaterThan(0);
    for (const p of produced) expect(p.releaseLocal!.geometryIdentity).toBe(JSON.stringify(getWaterfallContactSurfaces()[0]));
    // This advances the actual Film-created parcels through Flow's local
    // geometry guard, reproducing the failure's producer-to-consumer boundary.
    flow.advanceTo(3 * dt, () => off);
    expect(flow.failureReason).toBeNull(); expect(flow.time).toBe(3 * dt);
    expect(checkpoint).toEqual(before); expect(JSON.stringify(checkpoint.filmSurface)).toBe(inputOrder);
  });
  it('release and support guards still reject genuinely changed geometry without changing input', () => {
    const surface = getWaterfallContactSurfaces()[0];
    const local: ContactReleaseLocal = { surfaceId: surface.id, geometryIdentity: JSON.stringify(surface), face: 0, edge: 'upstream', anchor: [0, .5], normal: [...surface.normal], clearance: 1e-15, displacement: [0, 0, 0], referenceTime: 0 };
    const support: ContactSupport = { surfaceId: surface.id, geometryIdentity: JSON.stringify(surface), coordinate: [.5, .5], velocity: [0, 0], referenceTime: 0 };
    const reordered: ContactSurface = { normal: surface.normal, vertices: surface.vertices, id: surface.id };
    expect(() => sweepWaterfallReleaseLocal(local, [0, 0, 0], reordered)).not.toThrow();
    expect(waterfallSupportedPosition(support, reordered)).toEqual(waterfallSupportedPosition(support, surface));
    const changes = [
      (s: ContactSurface) => { s.id += '-changed'; },
      (s: ContactSurface) => { s.vertices[0][0] += .001; },
      (s: ContactSurface) => { [s.vertices[0], s.vertices[1]] = [s.vertices[1], s.vertices[0]]; },
      (s: ContactSurface) => { s.normal[0] += .001; },
    ];
    for (const change of changes) {
      const changed = structuredClone(reordered); change(changed);
      const before = structuredClone({ changed, local, support });
      expect(() => sweepWaterfallReleaseLocal(local, [0, 0, 0], changed)).toThrow('release-local-stale-or-invalid');
      expect(() => waterfallSupportedPosition(support, changed)).toThrow('support-stale-or-invalid');
      expect({ changed, local, support }).toEqual(before);
    }
  });
  const supportedPacket = (time: number, coordinate: [number, number] = [.5, .5], velocity: [number, number] = [.03, 0]): ContactParcel => {
    const surface = getWaterfallContactSurfaces()[1];
    const support: ContactSupport = { surfaceId: surface.id, geometryIdentity: JSON.stringify(surface), coordinate, velocity, referenceTime: time };
    return { id: 17209, position: waterfallSupportedPosition(support, surface), velocity: [11 * velocity[0], -6.6 * velocity[0] - 4.8 * velocity[1], 24 * velocity[1]], volume: 8.227688217825403e-10, birth: time, contactCount: 1, contactEnergy: 0, support };
  };
  const injectPacket = (flow: WaterfallContactFlow, packet: ContactParcel): void => {
    const state = flow.saveState(), mass = 1000 * packet.volume;
    state.snapshot.parcels = [packet]; state.snapshot.receipt.emittedVolume = packet.volume;
    state.snapshot.receipt.emittedMomentum = packet.velocity.map(v => mass * v) as ContactVec3;
    state.energyCounters.inputKinetic = .5 * mass * packet.velocity.reduce((sum, v) => sum + v * v, 0);
    state.energyCounters.inputPotential = mass * 9.81 * packet.position[1];
    flow.restoreState(state);
  };
  it('supported saved parcel 17209 has one lower impact then finite-edge release and remaining flight', () => {
    const startTime = 8.333333333333334, dt = 1 / 60, flow = new WaterfallContactFlow({ startTime, dt, impactMode: 'junction' });
    const packet: ContactParcel = { id: 17209, position: [19.813144616627675, 42.760424821901736, -11.160141725088092], velocity: [11.074823077164941, -18.83003923088789, -5.306382866957524], volume: 8.227688217825403e-10, birth: 7.266666666666667, contactCount: 0, contactEnergy: 0 };
    injectPacket(flow, packet);
    const internal = flow as unknown as { advanceSupport: (...args: unknown[]) => { time: number; departure: boolean } };
    const support = vi.spyOn(internal, 'advanceSupport');
    flow.advanceTo(startTime + dt, () => off);
    expect(flow.failureReason).toBeNull(); expect(support).toHaveBeenCalledTimes(1);
    expect(support.mock.results[0].value.time).toBeCloseTo(.01032543907027075, 10);
    expect(support.mock.results[0].value.departure).toBe(true); support.mockRestore();
    const snapshot = flow.snapshot(), result = snapshot.parcels[0], receipt = snapshot.receipt;
    expect(result.id).toBe(packet.id); expect(result.volume).toBe(packet.volume); expect(result.birth).toBe(packet.birth);
    expect(result.contactCount).toBe(1); expect(result.support).toBeUndefined(); expect(result.position[0]).toBeGreaterThan(20);
    expect(result.releaseLocal!.clearance).toBe(0); expect(receipt.contactCount).toBe(1);
    expect(receipt.energy.lowerContactNormalEnergyLoss).toBeCloseTo(5.17e-5, 6);
    expect(receipt.support!.volume).toBe(0); expect(receipt.support!.theoreticalWork).toBe(0); expect(receipt.budgetError).toBe(0);
    expect(Math.abs(receipt.energy.unexplainedResidual)).toBeLessThan(1e-14);
    for (let i = 0; i < 3; i++) expect(receipt.totalOwnedMomentum[i]).toBeCloseTo(receipt.emittedMomentum[i] + receipt.gravityImpulse[i] + receipt.rockImpulse[i], 14);
  });
  it('supported persistent chart agrees across partitions and retains canonical large-epoch time', () => {
    const startTime = 1e9, whole = new WaterfallContactFlow({ startTime, dt: 1 / 60, impactMode: 'junction' }), split = new WaterfallContactFlow({ startTime, dt: 1 / 120, impactMode: 'junction' });
    injectPacket(whole, supportedPacket(startTime)); injectPacket(split, supportedPacket(startTime));
    whole.advanceTo(startTime + 1 / 60, () => off); split.advanceTo(startTime + 1 / 60, () => off);
    const a = whole.snapshot(), b = split.snapshot();
    expect(whole.failureReason).toBeNull(); expect(split.failureReason).toBeNull();
    expect(a.parcels[0].support!.referenceTime).toBe(whole.time); expect(b.parcels[0].support!.referenceTime).toBe(split.time);
    for (let i = 0; i < 3; i++) { expect(a.parcels[0].position[i]).toBeCloseTo(b.parcels[0].position[i], 12); expect(a.parcels[0].velocity[i]).toBeCloseTo(b.parcels[0].velocity[i], 12); expect(a.receipt.support!.impulse[i]).toBeCloseTo(b.receipt.support!.impulse[i], 18); }
    expect(a.receipt.airborneVolume).toBe(0); expect(a.receipt.support!.volume).toBe(a.receipt.totalOwnedVolume);
    expect(a.receipt.contactCount).toBe(0); expect(a.receipt.energy.lowerContactNormalEnergyLoss).toBe(0);
    expect(Math.abs(a.receipt.support!.numericalEnergyChangeSigned)).toBeLessThan(1e-17);
  });
  it('supported edge roots retain true departures, genuine returns and one same-quad corner release', () => {
    expect(waterfallSupportExitRoot(0, 0, -1)).toBe(0);
    expect(waterfallSupportExitRoot(1, -2, 2)).toBeNull();
    const dt = 1 / 60, flow = new WaterfallContactFlow({ startTime: 0, dt, impactMode: 'junction' }), packet = supportedPacket(0, [1, 1], [.03, .02]);
    injectPacket(flow, packet); flow.advanceTo(dt, () => off);
    expect(flow.failureReason).toBeNull(); const p = flow.snapshot().parcels[0];
    expect(p.support).toBeUndefined(); expect(p.releaseLocal!.clearance).toBe(0); expect(p.motionRevision).toBe(1);
    expect(flow.snapshot().receipt.contactCount).toBe(0); expect(flow.snapshot().receipt.support!.impulse).toEqual([0, 0, 0]);
    const surface = getWaterfallContactSurfaces()[1], local = structuredClone(p.releaseLocal!);
    expect(sweepWaterfallQuadratic(p.position, p.velocity, dt, surface, local)).toBeNull();
    // A later inward path re-enters the footprint; the supplying collider was
    // never disabled. This query is a point-path check, not sheet support proof.
    local.displacement = [-1, 1, -1];
    expect(sweepWaterfallQuadratic([20, 42, 12], [0, -100, 0], dt, surface, local)).not.toBeNull();
  });
  it('supported checkpoint preserves accounting and rejects stale geometry or epoch without mutation', () => {
    const dt = 1 / 60, flow = new WaterfallContactFlow({ startTime: 0, dt, impactMode: 'junction' });
    injectPacket(flow, supportedPacket(0)); flow.advanceTo(dt, () => off); const saved = flow.saveState();
    flow.advanceTo(2 * dt, () => off); const advanced = flow.snapshot();
    flow.restoreState(saved); flow.advanceTo(2 * dt, () => off);
    expect(flow.snapshot().parcels).toEqual(advanced.parcels); expect(flow.snapshot().receipt.support).toEqual(advanced.receipt.support);
    expect(flow.snapshot().receipt.energy).toEqual(advanced.receipt.energy);
    expect(Math.abs(advanced.receipt.energy.unexplainedResidual)).toBeLessThan(1e-14);
    for (let i = 0; i < 3; i++) expect(advanced.receipt.totalOwnedMomentum[i]).toBeCloseTo(advanced.receipt.emittedMomentum[i] + advanced.receipt.gravityImpulse[i] + advanced.receipt.rockImpulse[i], 15);
    for (const stale of ['geometry', 'epoch']) {
      const state = structuredClone(saved);
      if (stale === 'geometry') state.snapshot.parcels[0].support!.geometryIdentity += 'stale';
      else state.snapshot.parcels[0].support!.referenceTime += 1e-4;
      flow.restoreState(state); const before = flow.saveState(); flow.advanceTo(2 * dt, () => off);
      expect(flow.failureReason).toBe(stale === 'geometry' ? 'support-stale-or-invalid' : 'support-reference-time-mismatch');
      expect(flow.time).toBe(dt); expect(flow.snapshot().parcels).toEqual(before.snapshot.parcels);
      expect(flow.saveState().supportCounters).toEqual(before.supportCounters); expect(flow.saveState().energyCounters).toEqual(before.energyCounters);
    }
  });
  it('preserves synthetic actual arrival V vector P and E at spatial numerical port beds', () => {
    const dt = 1 / 60, native = { q: 1.5, width: 10, depth: .7, speed: 1.5 / 7, top: 78, pool: 18 };
    const surface = getWaterfallContactSurfaces()[0], film = new WaterfallContactFilm(surface);
    const spanKnots = Array.from({ length: 7 }, (_, i) => (i / 6 - .5) * native.width);
    film.configureJunction({ locus: waterfallImpactLocus(native, surface, dt, 20000, { rowCount: film.nz, spanKnots }), spanKnots });
    const flow = new WaterfallContactFlow({ startTime: 0, dt, parcelsPerStep: 6, impactMode: 'junction' });
    const internal = flow as unknown as { film: WaterfallContactFilm; surfaces: ContactSurface[]; collectJunctionImpact: (parcel: ContactParcel, position: ContactVec3, time: number, transfers: FilmJunctionTransfer[]) => void };
    internal.film = film; internal.surfaces = getWaterfallContactSurfaces();
    const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);
    let expectedV = 0, expectedEnergy = 0, mappingPotential = 0;
    const expectedMomentum: ContactVec3 = [0, 0, 0], outgoingMomentum: ContactVec3 = [0, 0, 0], reactions: ContactVec3 = [0, 0, 0];
    const transfers: FilmJunctionTransfer[] = [];
    for (let bin = 0; bin < 6; bin++) {
      const z0 = spanKnots[bin], z1 = spanKnots[bin + 1], z = (z0 + z1) / 2;
      const age = waterfallDownwardRoot(77.65 - 63.675 - .22 * z, .65 * native.speed, -9.81)!;
      const position: ContactVec3 = [native.speed * age, 77.65 - .5 * 9.81 * age * age, z], velocity: ContactVec3 = [native.speed, -9.81 * age, 0], volume = native.q * dt / 6;
      const parcel: ContactParcel = { id: bin, position, velocity, volume, birth: dt / 2, contactCount: 0, contactEnergy: 0, sourceRelease: { edge: `source:${bin}`, start: [0, 77.65, z0], end: [0, 77.65, z1], intervalStart: 0, intervalEnd: dt, velocity: [native.speed, 0, 0], birthTime: dt / 2 } };
      const first = transfers.length;
      internal.collectJunctionImpact(parcel, position, age + parcel.birth, transfers);
      expectedV += volume; expectedEnergy += 1000 * volume * (.5 * dot(velocity, velocity) + 9.81 * position[1]);
      for (let axis = 0; axis < 3; axis++) expectedMomentum[axis] += 1000 * volume * velocity[axis];
      for (const transfer of transfers.slice(first)) {
        const segment = film.junctionSegments().find(s => s.face === transfer.face)!, bedY = (segment.start[1] + segment.end[1]) / 2;
        mappingPotential += 1000 * transfer.incomingVolume * 9.81 * (bedY - position[1]);
        for (const port of [transfer.minus, transfer.plus]) {
          expect(port.energy).toBeCloseTo(1000 * port.volume * (.5 * dot(port.velocity, port.velocity) + 9.81 * bedY + film.normalGravity * port.height), 10);
          for (let axis = 0; axis < 3; axis++) outgoingMomentum[axis] += port.momentum[axis];
        }
        for (let axis = 0; axis < 3; axis++) reactions[axis] += transfer.reaction[axis];
      }
    }
    expect(transfers).toHaveLength(12);
    expect(transfers.reduce((v, t) => v + t.minus.volume + t.plus.volume, 0)).toBeCloseTo(expectedV, 14);
    expect(transfers.reduce((v, t) => v + t.minus.energy + t.plus.energy, 0)).toBeCloseTo(expectedEnergy, 9);
    for (let axis = 0; axis < 3; axis++) expect(outgoingMomentum[axis]).toBeCloseTo(expectedMomentum[axis] + reactions[axis], 10);
    const normalPart = dot(reactions, surface.normal);
    for (let axis = 0; axis < 3; axis++) expect(reactions[axis]).toBeCloseTo(normalPart * surface.normal[axis], 10);
    const remap = flow.snapshot().receipt.junctionRemap;
    expect(remap.mappingPotentialChange).toBeCloseTo(mappingPotential, 12);
    expect(remap.mappingPotentialChange).toBeCloseTo(remap.portBedPotential - remap.incomingPotential, 9);
    expect(remap.mappingPotentialChange).toBeGreaterThan(0);
    expect(flow.snapshot().receipt.energy.contactPositionPotentialChange).toBe(0);
    expect(flow.snapshot().receipt.energy.receiverProjectionPotentialChange).toBe(0);
    // An empty synthetic source-off tick tests the existing frozen geometry
    // branch without advancing a native release or migrating any old water.
    const state = flow.saveState();
    flow.restoreState(state); flow.advanceTo(dt, () => ({ ...native, q: 0, speed: 0 }));
    expect(flow.saveState().filmState!.junctionGeometry).toEqual(state.filmState!.junctionGeometry);
    expect(flow.snapshot().receipt.emittedVolume).toBe(0);
  });
  it('routes the first actual native impact through separate pressure ports and rolls back a rejected transfer', () => {
    const dt = 1 / 60, native = { q: 1.5, width: 10, depth: .7, speed: 1.5 / 7, top: 78, pool: 18 };
    const flow = new WaterfallContactFlow({ startTime: 0, dt, parcelsPerStep: 6, impactMode: 'junction' });
    catchUp(flow, 1.6, () => native);
    expect(flow.failureReason).toBeNull();
    const checkpoint = flow.saveState();
    const rejected = vi.spyOn(WaterfallContactFilm.prototype, 'advance').mockImplementationOnce(() => { throw Error('test-reject-impact'); });
    flow.advanceTo(1.6 + dt, () => native);
    expect(flow.failureReason).toBe('test-reject-impact');
    expect(flow.time).toBe(checkpoint.snapshot.receipt.time);
    expect(flow.snapshot().parcels).toEqual(checkpoint.snapshot.parcels);
    expect(flow.snapshot().receipt.energy).toEqual(checkpoint.snapshot.receipt.energy);
    rejected.mockRestore();
    catchUp(flow, 1.67, () => native);
    const r = flow.snapshot().receipt;
    expect(flow.failureReason).toBeNull();
    expect(r.contactCount).toBeGreaterThan(0);
    expect(r.energy.captureNormalEnergyLoss).toBe(0);
    expect(r.energy.junctionIncomingEnergy).toBeGreaterThan(0);
    expect(Math.abs(r.energy.junctionEnergyDiscrepancy)).toBeLessThan(1e-7);
    expect(Math.abs(r.energy.unexplainedResidual)).toBeLessThan(1e-6);
    expect(Math.abs(r.budgetError)).toBeLessThan(1e-10);
    for (let axis = 0; axis < 3; axis++) {
      expect(Math.abs(r.emittedMomentum[axis] + r.gravityImpulse[axis] + r.rockImpulse[axis] - r.totalOwnedMomentum[axis] - r.landedMomentum[axis])).toBeLessThan(1e-7);
    }
    expect(r.junctionRemap.qualification).toBe('source-bin-quadrature-unqualified');
    expect(r.junctionRemap.volume).toBeCloseTo(flow.snapshot().film!.receipt.capturedVolume, 12);
    expect(r.junctionRemap.maximumAdmissionTimingUncertainty).toBe(dt);
    expect(r.junctionRemap.incomingPotential).not.toBe(r.junctionRemap.portBedPotential);
    const admitted = flow.saveState();
    flow.advanceTo(flow.time + dt, () => ({ ...native, q: 0 }));
    flow.restoreState(admitted);
    expect(flow.snapshot().film).toEqual(admitted.snapshot.film);
    expect(flow.snapshot().receipt.energy).toEqual(admitted.snapshot.receipt.energy);
    expect(flow.snapshot().receipt.junctionRemap).toEqual(admitted.snapshot.receipt.junctionRemap);
  });
  const release = (clearance = 1e-15): ContactReleaseLocal => {
    const surface = getWaterfallContactSurfaces()[0];
    return { surfaceId: surface.id, geometryIdentity: JSON.stringify(surface), face: 0, edge: 'upstream', anchor: [0, .5], normal: [...surface.normal], clearance, displacement: [0, 0, 0], referenceTime: 0 };
  };
  for (const impactMode of ['absorb', 'junction'] as const) {
    it(`stamps all release birth clocks with the canonical next endpoint in ${impactMode}`, () => {
      const startTime = 1e9, dt = 1 / 60, flow = new WaterfallContactFlow({ startTime, dt, impactMode });
      const state = flow.saveState();
      // This is an arithmetic witness, not an advanced native simulation.
      const tick = Array.from({ length: 100 }, (_, i) => i).find(i => startTime + (i + 1) * dt !== (startTime + i * dt) + dt)!;
      expect(tick).toBeDefined(); state.snapshot.receipt.ticks = tick;
      flow.restoreState(state);
      const local = release(), nextTime = startTime + (tick + 1) * dt;
      const out: FilmOutflow = { origin: local, face: 0, edge: 'upstream', start: [-.5, 64, -1], end: [-.5, 64, 1], intervalStart: flow.time, intervalEnd: flow.time + dt, time: flow.time + dt, volume: 1e-6, momentum: [-.001, .001, 0], velocity: [-1, 1, 0], height: 1e-15 };
      (flow as unknown as { releaseFilm: (outflows: FilmOutflow[]) => void }).releaseFilm([out]);
      const parcel = flow.snapshot().parcels[0];
      expect(parcel.birth).toBe(nextTime); expect(parcel.releaseLocal!.referenceTime).toBe(nextTime);
      expect(parcel.sheetRelease!.birthTime).toBe(nextTime);
      expect(parcel.sheetRelease!.intervalStart).toBe(out.intervalStart); expect(parcel.sheetRelease!.intervalEnd).toBe(out.intervalEnd);
    });
    it(`commits source-off local packets to the canonical large-epoch clock in ${impactMode}`, () => {
      const startTime = 1e9, dt = 1 / 60;
      const flow = new WaterfallContactFlow({ startTime, dt, impactMode });
      flow.advanceTo(startTime + dt, () => off);
      const state = flow.saveState(), local = release(); local.referenceTime = flow.time;
      state.snapshot.parcels.push({ id: 99, position: [-.5, 64, 0], velocity: [-1, 1, 0], volume: 1e-6, birth: flow.time, contactCount: 0, contactEnergy: 0, releaseLocal: local });
      state.snapshot.receipt.emittedVolume = 1e-6;
      flow.restoreState(state);
      for (let tick = 2; tick <= 9; tick++) {
        const saved = flow.saveState(), result = flow.advanceTo(startTime + tick * dt, () => off), advanced = flow.snapshot();
        expect(flow.failureReason).toBeNull(); expect(flow.time).toBe(startTime + tick * dt);
        expect(advanced.parcels[0].releaseLocal!.referenceTime).toBe(flow.time);
        expect(advanced.parcels[0].releaseLocal!.displacement[0]).toBeCloseTo(-(tick - 1) * dt, 14);
        expect(advanced.parcels[0].velocity[1]).toBeCloseTo(1 - (tick - 1) * 9.81 * dt, 14);
        expect(result.volume).toBe(0); expect(advanced.receipt.emittedVolume).toBe(1e-6);
        flow.restoreState(saved); flow.advanceTo(startTime + tick * dt, () => off);
        expect(flow.snapshot().parcels).toEqual(advanced.parcels);
        expect(flow.snapshot().receipt.energy).toEqual(advanced.receipt.energy);
      }
    });
    it(`rejects a stale local epoch before mutation and rolls back in ${impactMode}`, () => {
      const startTime = 1e9, dt = 1 / 60, flow = new WaterfallContactFlow({ startTime, dt, impactMode });
      flow.advanceTo(startTime + dt, () => off);
      const state = flow.saveState(), local = release(); local.referenceTime = flow.time + 1e-4;
      state.snapshot.parcels.push({ id: 99, position: [-.5, 64, 0], velocity: [-1, 1, 0], volume: 1e-6, birth: flow.time, contactCount: 0, contactEnergy: 0, releaseLocal: local });
      state.snapshot.receipt.emittedVolume = 1e-6;
      flow.restoreState(state); const before = flow.saveState();
      const result = flow.advanceTo(startTime + 2 * dt, () => off);
      expect(flow.failureReason).toBe('release-local-reference-time-mismatch'); expect(result.volume).toBe(0);
      expect(flow.time).toBe(before.snapshot.receipt.time);
      expect(flow.snapshot().parcels).toEqual(before.snapshot.parcels);
      expect(flow.saveState().energyCounters).toEqual(before.energyCounters);
      expect(flow.saveState().filmState).toEqual(before.filmState);
    });
  }
  it('clears the retained 8.17 s edge witness with quadratic flight while the old full kick hits', () => {
    const surface = getWaterfallContactSurfaces()[0], dt = 1 / 60, local = release(4.030380250219343e-28);
    const velocity: [number, number, number] = [-.0710248724179577, -1.8864594596598603, -8.784661939688673];
    const kicked: [number, number, number] = [velocity[0], velocity[1] - 9.81 * dt, velocity[2]];
    expect(sweepWaterfallReleaseLocal(local, kicked.map(v => v * dt) as [number, number, number], surface)).not.toBeNull();
    expect(sweepWaterfallQuadratic([-.5, 64, 0], velocity, dt, surface, local)).toBeNull();
    for (let tick = 0; tick < 3; tick++) {
      expect(sweepWaterfallQuadratic([-.5, 64, 0], velocity, dt, surface, local)).toBeNull();
      const drift = waterfallFlightDisplacement(velocity, dt);
      local.displacement = local.displacement.map((v, i) => v + drift[i]) as [number, number, number];
      local.referenceTime += dt; velocity[1] -= 9.81 * dt;
    }
  });
  it('keeps quadratic touches and exact finite footprint with stable tiny roots', () => {
    const surface = getWaterfallContactSurfaces()[0], local = release(0);
    expect(sweepWaterfallQuadratic([-.5, 64, 0], [0, -1, 0], 1 / 60, surface, local)?.time).toBe(0);
    expect(sweepWaterfallQuadratic([-.5, 64, 0], [-1, -1, 0], 1 / 60, surface, release(1e-28))).toBeNull();
    expect(sweepWaterfallQuadratic([0, 64, 0], [0, -1, 0], 1 / 60, surface, release(1e-28))?.time).toBeGreaterThan(0);
    expect(sweepWaterfallQuadratic([-.5, 64, 0], [0, 1, 0], 1 / 60, surface, local)).toBeNull();
    expect(waterfallDownwardRoot(1e-28, -1, -9.81)).toBeCloseTo(1e-28, 40);
  });
  it('conserves uninterrupted junction ballistic energy and reaches the pool at its actual event velocity', () => {
    const dt = 1 / 60, flow = new WaterfallContactFlow({ startTime: 0, dt, parcelsPerStep: 6, impactMode: 'junction' });
    flow.advanceTo(dt, () => source);
    const first = flow.snapshot(), energy = first.receipt.energy;
    expect(first.receipt.airborneTrajectory).toBe('constant-gravity');
    expect(first.parcels[0].position[1]).toBeCloseTo(77.65 - .5 * 9.81 * (dt / 2) ** 2, 12);
    expect(Math.abs(energy.airborneIntegrationEnergyChangeSigned)).toBeLessThan(1e-8);
    const before = flow.saveState();
    flow.advanceTo(2 * dt, () => ({ ...source, q: 0 })); const advanced = flow.snapshot();
    expect(advanced.receipt.emittedVolume).toBe(first.receipt.emittedVolume);
    flow.restoreState(before); flow.advanceTo(2 * dt, () => ({ ...source, q: 0 }));
    expect(flow.snapshot().parcels).toEqual(advanced.parcels); expect(flow.snapshot().receipt.energy).toEqual(advanced.receipt.energy);
    const poolState = flow.saveState(), p = poolState.snapshot.parcels[0];
    p.position = [50, 18.001, 0]; p.velocity = [2, -1, 0];
    flow.restoreState(poolState);
    const arrived = flow.advanceTo(3 * dt, () => ({ ...source, q: 0 })).arrivals[0];
    const t = waterfallDownwardRoot(.001, -1, -9.81)!;
    expect(arrived.time).toBeCloseTo(2 * dt + t, 12); expect(arrived.position[0]).toBeCloseTo(50 + 2 * t, 12);
    expect(arrived.velocity[1]).toBeCloseTo(-1 - 9.81 * t, 12);
    expect(arrived.position[1]).toBe(18);
  });
  it('still stops and rolls back a genuine quadratic inward nonsource return', () => {
    const dt = 1 / 60, flow = new WaterfallContactFlow({ startTime: 0, dt, impactMode: 'junction' });
    flow.advanceTo(dt, () => off); const state = flow.saveState(), local = release(.1); local.referenceTime = dt;
    local.displacement = [1, 0, 0];
    state.snapshot.parcels.push({ id: 99, position: [.5, 64, 0], velocity: [0, -100, 0], volume: 1e-6, birth: dt, contactCount: 0, contactEnergy: 0, releaseLocal: local });
    state.snapshot.receipt.emittedVolume = 1e-6;
    flow.restoreState(state); const before = flow.saveState();
    const arrival = flow.advanceTo(2 * dt, () => off);
    expect(flow.failureReason).toBe('impact-junction-nonsource-arrival'); expect(arrival.volume).toBe(0); expect(flow.time).toBe(dt);
    expect(flow.snapshot().parcels).toEqual(before.snapshot.parcels); expect(flow.snapshot().receipt.energy).toEqual(before.snapshot.receipt.energy);
    // Only the junction diagnostic carries the parcel; any other kind is a wrong failure.
    const diagnostic = flow.snapshot().receipt.failureDiagnostic;
    if (!diagnostic || !('parcel' in diagnostic)) throw new Error('expected a junction arrival diagnostic');
    expect(diagnostic.parcel.velocity[1]).toBeLessThan(-100);
  });
  it('retains outgoing sub-ULP clearance and shallow multi-tick departure without a supplying-face exemption', () => {
    const surface = getWaterfallContactSurfaces()[0], local = release(), n = local.normal;
    const v: [number, number, number] = [-13.290764794106579, 7.311248010179562, -5.29204139086224];
    const inwardSpeed = -(v[0] * n[0] + v[1] * n[1] + v[2] * n[2]);
    // Independent small-operand sign agrees with the supplied Pro calculation.
    expect(local.clearance * (n[0] + v[0] * (n[0] ** 2 + n[1] ** 2 + n[2] ** 2) / inwardSpeed)).toBeLessThan(0);
    expect(sweepWaterfallReleaseLocal(local, v.map(x => x / 60) as [number, number, number], surface)).toBeNull();
    for (let tick = 0; tick < 3; tick++) {
      const drift: [number, number, number] = [-1e-5, 1e-5, 0];
      expect(sweepWaterfallReleaseLocal(local, drift, surface)).toBeNull();
      local.displacement = local.displacement.map((x, i) => x + drift[i]) as [number, number, number];
      local.referenceTime += 1 / 60;
    }
    expect(sweepWaterfallReleaseLocal(local, [-1, -1, 0], surface)).toBeNull();
  });
  it('detects a genuine inward return after departure using the evolved local state', () => {
    const surface = getWaterfallContactSurfaces()[0], local = release();
    expect(sweepWaterfallReleaseLocal(local, [-1, 1, 0], surface)).toBeNull();
    local.displacement = [-1, 1, 0]; local.referenceTime = 1;
    const hit = sweepWaterfallReleaseLocal(local, [3, -2.5, 0], surface)!;
    expect(hit.fraction).toBeGreaterThan(0); expect(hit.fraction).toBeLessThan(1);
    expect(hit.position[0]).toBeGreaterThan(-.5);
  });
  it('keeps exact outward touches free and retains zero-time inward edge contact', () => {
    const surface = getWaterfallContactSurfaces()[0], local = release(0);
    expect(sweepWaterfallReleaseLocal(local, [0, 0, 0], surface)).toBeNull();
    expect(sweepWaterfallReleaseLocal(local, [0, 1, 0], surface)).toBeNull();
    expect(sweepWaterfallReleaseLocal(local, [0, -1, 0], surface)?.fraction).toBe(0);
    // Existing endpoint convention waits until a subsequent inward crossing.
    const above = release(1); const n = above.normal;
    expect(sweepWaterfallReleaseLocal(above, n.map(x => -x) as [number, number, number], surface)).toBeNull();
  });
  it('deeply restores persistent release-local flight and processes a genuine contact once', () => {
    const dt = 1 / 60, flow = new WaterfallContactFlow({ startTime: 0, dt });
    flow.advanceTo(dt, () => off);
    const state = flow.saveState(), local = release(); local.referenceTime = dt;
    state.snapshot.parcels.push({ id: 99, position: [-.5, 64, 0], velocity: [-1, 1, 0], volume: 1e-6, birth: dt, contactCount: 0, contactEnergy: 0, releaseLocal: local });
    state.snapshot.receipt.emittedVolume = 1e-6;
    flow.restoreState(state); flow.advanceTo(2 * dt, () => off);
    expect(flow.failureReason).toBeNull();
    const saved = flow.saveState();
    expect(saved.snapshot.parcels[0].releaseLocal!.displacement[0]).toBeLessThan(0);
    flow.advanceTo(3 * dt, () => off); const moved = flow.snapshot();
    flow.restoreState(saved); flow.advanceTo(3 * dt, () => off);
    expect(flow.snapshot().parcels).toEqual(moved.parcels);
    expect(flow.snapshot().receipt.energy).toEqual(moved.receipt.energy);
    const inward = flow.saveState();
    inward.snapshot.parcels[0].releaseLocal!.displacement = [4.25, -2.7625, 0];
    inward.snapshot.parcels[0].position = [3.75, 61.2375, 0];
    inward.snapshot.parcels[0].velocity = [0, -1, 0];
    flow.restoreState(inward); flow.advanceTo(4 * dt, () => off);
    expect(flow.failureReason).toBeNull(); expect(flow.snapshot().receipt.contactCount).toBe(1);
    expect(flow.snapshot().parcels.find(p => p.id === 99)).toBeUndefined();
  });
  it('rejects the retained outside upstream release crossing while retaining actual edge and inside contacts', () => {
    const surface = getWaterfallContactSurfaces()[0], dt = 1 / 60;
    const start: [number, number, number] = [-.49999999997561834, 64.32006116075179, 1.4548234577839732];
    const v = [-13.288370125429132, 7.309545251397915, -5.2927060460500135];
    expect(sweepWaterfallContact(start, [start[0] + v[0] * dt, start[1] + v[1] * dt, start[2] + v[2] * dt], surface)).toBeNull();
    for (const x of [-.5, -.49]) {
      const y = 63.675 - .65 * x;
      expect(sweepWaterfallContact([x, y + 1, 0], [x, y - 1, 0], surface)?.position[0]).toBe(x);
    }
  });
  it('keeps the original subnormal inventory energy finite through one step and rollback', () => {
    const dt = 1 / 60, volume = 5.54901745363e-312;
    const flow = new WaterfallContactFlow({ startTime: 0, dt, parcelsPerStep: 6 });
    flow.advanceTo(dt, () => off);
    const state = flow.saveState(), film = new WaterfallContactFilm(state.filmSurface!);
    const velocity: [number, number, number] = [2, -8, 1];
    const capture = film.capture([1, 63, 0], volume, velocity);
    // Load the original failure's positive volume through the existing rollback
    // surface. Its finite velocity requires division rather than a reciprocal.
    expect(1 / (1000 * volume)).toBe(Infinity);
    const admitted = film.snapshot().cells.find(c => c.volume > 0)!;
    expect(admitted.velocity.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...admitted.velocity)).toBeGreaterThan(1);
    state.filmState = film.saveState(); state.snapshot.film = film.snapshot();
    state.snapshot.receipt.emittedVolume = volume;
    state.snapshot.receipt.contactEnergy = capture.normalEnergyLoss;
    state.energyCounters.inputKinetic = .5 * 1000 * volume * (2 ** 2 + 8 ** 2 + 1);
    state.energyCounters.inputPotential = 1000 * volume * 9.81 * 63;
    flow.restoreState(state);
    const before = flow.saveState();
    expect(Object.values(before.snapshot.receipt.energy).every(Number.isFinite)).toBe(true);
    const arrival = flow.advanceTo(2 * dt, () => off), advanced = flow.snapshot();
    expect(flow.failureReason).toBeNull();
    expect(advanced.receipt.ticks).toBe(before.snapshot.receipt.ticks + 1);
    expect(advanced.receipt.totalOwnedVolume).toBeGreaterThan(0);
    expect(Object.values(advanced.receipt.energy).every(Number.isFinite)).toBe(true);
    expect(advanced.film!.cells.every(c => c.volume >= 0 && c.velocity.every(Number.isFinite))).toBe(true);
    flow.restoreState(before);
    expect(flow.snapshot().receipt.energy).toEqual(before.snapshot.receipt.energy);
    expect(flow.snapshot().film).toEqual(before.snapshot.film);
    expect(flow.advanceTo(2 * dt, () => off)).toEqual(arrival);
    expect(flow.snapshot().receipt.energy).toEqual(advanced.receipt.energy);
    expect(flow.snapshot().parcels).toEqual(advanced.parcels);
  });

  it('measures actual midpoint birth and the known discrete ballistic energy change', () => {
    const dt = 1 / 60, flow = new WaterfallContactFlow({ startTime: 0, dt, parcelsPerStep: 6 });
    flow.advanceTo(dt, () => source);
    const energy = flow.snapshot().receipt.energy, mass = 1000 * source.q * dt;
    expect(energy.datumY).toBe(0);
    expect(energy.inputKinetic).toBeCloseTo(.5 * mass * source.speed ** 2, 10);
    expect(energy.inputPotential).toBeCloseTo(mass * 9.81 * (78 - .35), 8);
    expect(energy.gravityKickKineticChange).toBeCloseTo(.5 * mass * (9.81 * dt / 2) ** 2, 10);
    expect(energy.airborneTransportPotentialChange).toBeCloseTo(-mass * (9.81 * dt / 2) ** 2, 8);
    expect(energy.airborneIntegrationEnergyChangeSigned).toBeCloseTo(-.5 * mass * (9.81 * dt / 2) ** 2, 8);
    expect(Math.abs(energy.unexplainedResidual)).toBeLessThan(1e-8);
  });

  it('measures normal capture, deposition and receiver projection from actual transfer states', () => {
    const dt = 1 / 60, flow = new WaterfallContactFlow({ startTime: 0, dt, parcelsPerStep: 1 });
    flow.advanceTo(dt, () => source);
    const state = flow.saveState(), parcel = state.snapshot.parcels[0], mass = 1000 * parcel.volume;
    parcel.position = [1, 66, 0]; parcel.velocity = [0, -240, 0];
    flow.restoreState(state);
    flow.advanceTo(2 * dt, () => off);
    const energy = flow.snapshot().receipt.energy, normal = getWaterfallContactSurfaces()[0].normal;
    expect(energy.captureNormalEnergyLoss).toBeCloseTo(.5 * mass * ((-240 - 9.81 * dt) * normal[1]) ** 2, 7);
    expect(energy.captureMixingEnergyLoss).toBeCloseTo(0, 7);
    expect(energy.depositionPotentialEnergyChange).not.toBe(0);
    // Synthetic state replacement changes the starting inventory, so no claim
    // about its global residual is made. The transferred receiver state is exact.
    flow.restoreState(state);
    state.snapshot.parcels[0].position = [35, 18.001, 0];
    state.snapshot.parcels[0].velocity = [0, -1, 0];
    flow.restoreState(state);
    const result = flow.advanceTo(2 * dt, () => off), item = result.arrivals[0];
    const receiverEnergy = flow.snapshot().receipt.energy;
    expect(receiverEnergy.outgoingKinetic).toBeCloseTo(.5 * mass * item.velocity[1] ** 2, 10);
    expect(receiverEnergy.outgoingPotential).toBeCloseTo(mass * 9.81 * item.position[1], 8);
    expect(receiverEnergy.receiverProjectionPotentialChange).toBeGreaterThan(0);
  });

  it('preserves the native 40.233333 second source, subnormal drain and restart', () => {
    const shutoff = 40.23333333333333, restart = 71;
    const flow = new WaterfallContactFlow({ startTime: 0, dt: 1 / 60, parcelsPerStep: 6, maxParcels: 20000 });
    const sample = (time: number): ContactSource => {
      const q = time < shutoff || time >= restart ? 1.5 : 0;
      return { q, width: 10, depth: .7, speed: q / 7, top: 78, pool: 18 };
    };
    let emittedAtOff = 0;
    for (let second = 1; second <= 73; second++) {
      catchUp(flow, second, sample);
      const s = flow.snapshot(), r = s.receipt;
      expect(flow.failureReason).toBeNull();
      expect(flow.time).toBeCloseTo(second, 10);
      expect(Math.abs(r.budgetError)).toBeLessThan(1e-8);
      expect(s.parcels.every(p => [p.volume, ...p.position, ...p.velocity].every(Number.isFinite))).toBe(true);
      expect(s.film!.cells.every(c => c.volume >= 0 && c.velocity.every(Number.isFinite))).toBe(true);
      expect(Object.values(r.energy).every(Number.isFinite)).toBe(true);
      if (second === 41) emittedAtOff = r.emittedVolume;
      if (second > 41 && second <= restart) expect(r.emittedVolume).toBe(emittedAtOff);
      // Any surviving numerical tail remains owned, including subnormal cells.
      if (second === restart) expect(r.emittedVolume).toBeCloseTo(r.landedVolume + r.totalOwnedVolume, 8);
    }
    expect(flow.snapshot().receipt.emittedVolume).toBeCloseTo(60.35 + 3, 8);
    expect(flow.totalOwnedVolume).toBeGreaterThan(0);
    // 73 physical seconds with about 3600 parcels in flight: 146 s in CI run
    // 41535506704 and 164 s locally before the 2026-11-03 perf pass (identity
    // cache, per-component releaseLocalPosition), 139 s locally after it. The
    // rest is the per-tick rollback copy of every parcel, part of the tick's
    // all-or-nothing design. The limit leaves room for a loaded machine.
  }, 240000);
  it('gives six inlet bins complete physical width support with interval volume and midpoint transport', () => {
    const dt = 1 / 60, native = { ...source, q: 1.5, speed: 1.5 / 7 };
    const flow = new WaterfallContactFlow({ startTime: 0, dt, parcelsPerStep: 6 });
    flow.advanceTo(dt, () => native);
    const snapshot = flow.snapshot(), strips = snapshot.parcels;
    expect(strips).toHaveLength(6);
    expect(snapshot.receipt.emittedVolume).toBeCloseTo(native.q * dt, 12);
    for (let i = 0; i < strips.length; i++) {
      const p = strips[i], support = p.sourceRelease!;
      expect(support.edge).toBe(`source:${i}`);
      expect(support.start).toEqual([0, 78 - .35, (i / 6 - .5) * 10]);
      expect(support.end).toEqual([0, 78 - .35, ((i + 1) / 6 - .5) * 10]);
      expect(support.intervalStart).toBe(0); expect(support.intervalEnd).toBe(dt);
      expect(p.volume).toBeCloseTo(native.q * dt / 6, 12);
      expect(p.birth).toBe(dt / 2);
      expect(p.position[0]).toBeCloseTo(native.speed * dt / 2, 12);
      expect(p.position[1]).toBeCloseTo(78 - .35 - 9.81 * (dt / 2) ** 2, 12);
      // At the inlet the supplied speed/width/depth reconstruct precisely
      // this volume; downstream stretching changes area and hence thickness.
      const inletArea = (support.end[2] - support.start[2]) * native.speed * dt;
      expect(p.volume / inletArea).toBeCloseTo(native.depth, 12);
      if (i > 0) expect(support.start).toEqual(strips[i - 1].sourceRelease!.end);
    }
    strips[0].sourceRelease!.start[0] = NaN;
    expect(flow.snapshot().parcels[0].sourceRelease!.start[0]).toBe(0);
    flow.advanceTo(2 * dt, () => off);
    expect(flow.snapshot().receipt.emittedVolume).toBe(snapshot.receipt.emittedVolume);
    expect(flow.snapshot().parcels).toHaveLength(6);
  });
  it('admits no water while off and drains the existing tail exactly once', () => {
    const flow = new WaterfallContactFlow({ startTime: 0, dt: 1 / 60, parcelsPerStep: 8, maxParcels: 20000 });
    flow.advanceTo(1, () => source);
    expect(flow.snapshot().receipt.emittedVolume).toBeCloseTo(10, 9);
    const emitted = flow.snapshot().receipt.emittedVolume;
    let arrivalVolume = 0;
    for (let time = 2; time <= 30; time++) arrivalVolume += flow.advanceTo(time, () => off).volume;
    const r = flow.snapshot().receipt;
    expect(r.emittedVolume).toBe(emitted);
    // Conservative film transport can retain a numerical tail. Its owned
    // volume stays visible in the ledger; this assertion never deletes it.
    expect(r.totalOwnedVolume).toBeLessThan(1e-7);
    expect(r.landedVolume).toBeCloseTo(emitted, 9);
    expect(arrivalVolume).toBeCloseTo(emitted, 9);
    expect(flow.advanceTo(31, () => off).volume).toBeLessThan(1e-7);
    expect(Math.abs(r.budgetError)).toBeLessThan(1e-9);
  });

  it('uses swept finite faces and rejects backside crossings', () => {
    const face = getWaterfallContactSurfaces()[0];
    const hit = sweepWaterfallContact([5, 100, 0], [5, 0, 0], face);
    expect(hit).not.toBeNull();
    expect(hit!.position[1]).toBeCloseTo(60.425, 8);
    expect(sweepWaterfallContact([5, 0, 0], [5, 100, 0], face)).toBeNull();
    expect(sweepWaterfallContact([5, 100, 30], [5, 0, 30], face)).toBeNull();
  });

  it('redirects falling momentum at contacts without adding kinetic energy', () => {
    const flow = new WaterfallContactFlow({ startTime: 0, dt: 1 / 120, parcelsPerStep: 8 });
    catchUp(flow, 3, t => t < .1 ? source : off);
    const { parcels, film, receipt: r } = flow.snapshot();
    // First contact now transfers ownership into a stored film, rather than
    // leaving an independent sliding parcel. Its tangential motion is visible
    // in the same owner snapshot and its pressure-driven edge flux.
    expect(film!.receipt.capturedVolume).toBeGreaterThan(0);
    expect(film!.cells.some(p => p.volume > 0 && Math.abs(p.velocity[2]) > .1)).toBe(true);
    expect(r.contactEnergy).toBeGreaterThan(0);
    expect(r.rockImpulse[0]).toBeGreaterThan(0);
    // The rock gives up no energy: projection removes only inward normal speed.
    // Total output momentum includes external gravity and the rock reaction.
    for (let axis = 0; axis < 3; axis++) {
      expect(r.totalOwnedMomentum[axis] + r.landedMomentum[axis]).toBeCloseTo(r.emittedMomentum[axis] + r.gravityImpulse[axis] + r.rockImpulse[axis], 6);
    }
    const energy = parcels.reduce((sum, p) => sum + p.volume * 1000 * (.5 * p.velocity.reduce((v, x) => v + x * x, 0) + 9.81 * p.position[1]), 0)
      + film!.cells.reduce((sum, c) => sum + c.volume * 1000 * (.5 * c.velocity.reduce((v, x) => v + x * x, 0) + 9.81 * c.center[1] + .5 * film!.receipt.normalGravity * c.height), 0);
    const initialEnergy = r.emittedVolume * 1000 * (.5 * source.speed ** 2 + 9.81 * (78 - .35));
    expect(energy).toBeLessThanOrEqual(initialEnergy + 1e-5);
  });

  it('gives identical physical snapshots across display cadences', () => {
    const sample = (t: number) => t < 1 ? source : off;
    const fine = new WaterfallContactFlow({ startTime: 0, parcelsPerStep: 6 });
    const coarse = new WaterfallContactFlow({ startTime: 0, parcelsPerStep: 6 });
    for (let frame = 1; frame <= 180; frame++) fine.advanceTo(frame / 60, sample);
    for (let frame = 1; frame <= 9; frame++) coarse.advanceTo(frame / 3, sample);
    expect(fine.snapshot().parcels).toEqual(coarse.snapshot().parcels);
    expect(fine.snapshot().receipt.emittedVolume).toBe(coarse.snapshot().receipt.emittedVolume);
  });

  it('intercepts the native low-discharge sheet on all three ledges before landing', () => {
    const native = { ...source, q: 1.5, speed: 1.5 / (10 * .7) };
    const flow = new WaterfallContactFlow({ startTime: 0, dt: 1 / 60, parcelsPerStep: 6 });
    let arrived = 0;
    const positions: number[] = [];
    for (let time = 1; time <= 30; time++) {
      const batch = flow.advanceTo(time, t => t < 1 ? native : { ...native, q: 0 });
      arrived += batch.volume;
      for (const item of batch.arrivals) {
        positions.push(item.position[0]);
        expect(item.position[1]).toBe(18);
        expect(Math.abs(item.position[2])).toBeLessThan(40);
      }
    }
    const receipt = flow.snapshot().receipt;
    expect(receipt.surfaceContactCounts['contact-ledge-1']).toBeGreaterThan(0);
    expect(receipt.surfaceContactCounts['contact-ledge-2']).toBeGreaterThan(0);
    expect(receipt.surfaceContactCounts['contact-ledge-3']).toBeGreaterThan(0);
    expect(arrived).toBeCloseTo(1.5, 9);
    expect(receipt.totalOwnedVolume).toBeLessThan(1e-7);
    expect(positions.every(x => x > -20 && x < 100)).toBe(true);
  });

  it('bounds catchup and capacity without deleting water or replaying an old clock', () => {
    const flow = new WaterfallContactFlow({ startTime: 1000000, maxStepsPerAdvance: 3, maxParcels: 12, parcelsPerStep: 6 });
    flow.advanceTo(1000010, () => source);
    const r = flow.snapshot().receipt;
    expect(r.ticks).toBe(2);
    expect(r.parcelCount).toBe(12);
    expect(r.failure).toBe('parcel-capacity');
    expect(r.lagSeconds).toBeGreaterThan(9);
    expect(Math.abs(r.budgetError)).toBeLessThan(1e-12);
    flow.advanceTo(1000010, () => off);
    expect(flow.snapshot().receipt.lastAdvanceSteps).toBe(3);
    expect(flow.snapshot().receipt.emittedVolume).toBe(r.emittedVolume);
  });

  it('keeps finite state and independent snapshot parcel vectors', () => {
    const flow = new WaterfallContactFlow({ startTime: 0, parcelsPerStep: 6 });
    catchUp(flow, 7, t => t < 2 ? source : off);
    const snapshot = flow.snapshot();
    expect(snapshot.parcels.every(p => [...p.position, ...p.velocity, p.volume, p.contactEnergy].every(Number.isFinite))).toBe(true);
    expect(Math.abs(snapshot.receipt.budgetError)).toBeLessThan(1e-8);
    if (snapshot.parcels[0]) {
      snapshot.parcels[0].position[0] = NaN;
      expect(flow.snapshot().parcels[0].position[0]).not.toBeNaN();
    }
    snapshot.surfaces[0].vertices[0][0] = NaN;
    snapshot.surfaces[0].normal[0] = NaN;
    expect(flow.snapshot().surfaces[0].vertices[0][0]).not.toBeNaN();
    expect(flow.snapshot().surfaces[0].normal[0]).not.toBeNaN();
    expect(() => new WaterfallContactFlow({ startTime: NaN })).toThrow();
    flow.advanceTo(8, () => ({ ...source, q: NaN }));
    expect(flow.snapshot().receipt.failure).toBe('invalid-source');
  });

  it('rolls back together with a rejected receiver step without consuming arrivals', () => {
    const flow = new WaterfallContactFlow({ startTime: 0, parcelsPerStep: 6 });
    const empty = flow.saveState();
    flow.advanceTo(.5, () => source);
    const admitted = flow.snapshot().parcels;
    flow.restoreState(empty);
    flow.advanceTo(.5, () => source);
    expect(flow.snapshot().parcels).toEqual(admitted);
    let landed = false;
    for (let step = 31; step < 1200; step++) {
      const time = step / 60, state = flow.saveState();
      const first = flow.advanceTo(time, () => off);
      if (first.volume === 0) continue;
      const resulting = flow.snapshot();
      flow.restoreState(state);
      const replayed = flow.advanceTo(time, () => off);
      expect(replayed).toEqual(first);
      expect(flow.snapshot().parcels).toEqual(resulting.parcels);
      expect(flow.snapshot().surfaces).toEqual(resulting.surfaces);
      expect(flow.snapshot().receipt.landedVolume).toBe(resulting.receipt.landedVolume);
      expect(flow.snapshot().receipt.contactCount).toBe(resulting.receipt.contactCount);
      expect(flow.snapshot().receipt.energy).toEqual(resulting.receipt.energy);
      landed = true;
      break;
    }
    expect(landed).toBe(true);
    const wrongClock = new WaterfallContactFlow({ startTime: 10 });
    expect(() => wrongClock.restoreState(empty)).toThrow('clock mismatch');
  });

  it('does not return an arrival from a tick whose later film capture fails', () => {
    const flow = new WaterfallContactFlow({ startTime: 0, parcelsPerStep: 6 });
    flow.advanceTo(.1, () => source);
    const state = flow.saveState();
    state.snapshot.parcels[0].position = [35, 18.001, 0];
    state.snapshot.parcels[0].velocity = [0, -1, 0];
    state.snapshot.parcels[1].position = [.5, 66, 0];
    state.snapshot.parcels[1].velocity = [0, -2000, 0];
    flow.restoreState(state);
    const film = (flow as unknown as { film: WaterfallContactFilm }).film;
    const capture = vi.spyOn(film, 'capture').mockImplementation(() => { throw Error('forced-capture-failure'); });
    const arrival = flow.advanceTo(.1 + 1 / 120, () => off);
    expect(arrival.volume).toBe(0);
    expect(arrival.arrivals).toHaveLength(0);
    expect(flow.time).toBe(.1);
    expect(flow.snapshot().receipt.landedVolume).toBe(state.snapshot.receipt.landedVolume);
    expect(flow.failureReason).toBe('forced-capture-failure');
    capture.mockRestore();
  });

  it('keeps film storage and exact edge release in the one water owner', () => {
    const flow = new WaterfallContactFlow({ startTime: 0, dt: 1 / 60, parcelsPerStep: 6 });
    catchUp(flow, 5, () => ({ ...source, q: 1.5, speed: 1.5 / 7 }));
    const s = flow.snapshot(), r = s.receipt;
    expect(s.film!.receipt.volume).toBeGreaterThan(0);
    expect(s.film!.receipt.releasedVolume).toBeGreaterThan(0);
    expect(r.totalOwnedVolume).toBeCloseTo(r.airborneVolume + r.filmVolume, 10);
    expect(r.emittedVolume).toBeCloseTo(r.totalOwnedVolume + r.landedVolume, 8);
    const releases = s.parcels.filter(p => p.sheetRelease);
    expect(releases.length).toBeGreaterThan(0);
    expect(releases.every(p => p.sheetRelease!.intervalEnd > p.sheetRelease!.intervalStart)).toBe(true);
    const first = releases[0], actual = first.sheetRelease!.start[0];
    first.sheetRelease!.start[0] = NaN;
    expect(flow.snapshot().parcels.find(p => p.id === first.id)!.sheetRelease!.start[0]).toBe(actual);
    const state = flow.saveState();
    catchUp(flow, 6, () => off);
    flow.restoreState(state);
    expect(flow.snapshot().film).toEqual(state.snapshot.film);
    flow.advanceTo(6, () => ({ ...off, width: 11 }));
    expect(flow.failureReason).toBe('film-geometry-change-requires-fresh-run');
    expect(flow.snapshot().surfaces).toEqual(state.snapshot.surfaces);
  });
});
