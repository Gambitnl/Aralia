/** Receipts for actual terrain contact and isolated water ownership. These
 * small fixtures deliberately do not claim continuous-water realism. */
import { describe, expect, it, vi } from 'vitest';
import { WaterfallContactFlow, sweepWaterfallContact, type ContactSurface, type ContactFlowState, type ContactTransactionCheckpoint } from '../waterfallContactFlow';
import { WaterfallTerrainComparisonRun, GENERIC_TERRAIN_COMPARISON_CASES, TERRAIN_COMPARISON_CASES, TERRAIN_COMPARISON_DT, TERRAIN_COMPARISON_SOURCE } from '../waterfallTerrainComparisons';

const source = { ...TERRAIN_COMPARISON_SOURCE };
const stepped = () => GENERIC_TERRAIN_COMPARISON_CASES[0].buildSurfaces();
function flow(surfaces = stepped()) {
  return new WaterfallContactFlow({ startTime: 0, dt: TERRAIN_COMPARISON_DT, parcelsPerStep: 6, surfaces });
}
const ownedFlows = (run: WaterfallTerrainComparisonRun) => (run as unknown as { flows: WaterfallContactFlow[] }).flows;
/** Timing is observational; every other saved field remains part of exact parity. */
function withoutElapsed<T>(value: T): T {
  const copied = structuredClone(value);
  const strip = (row: unknown): void => {
    if (!row || typeof row !== 'object') return;
    for (const [key, child] of Object.entries(row)) {
      if (key === 'lastAdvanceMilliseconds' || key === 'lastStepMilliseconds') (row as Record<string, unknown>)[key] = 0;
      else strip(child);
    }
  };
  strip(copied); return copied;
}
describe('fixed comparison terrain', () => {
  it.each(TERRAIN_COMPARISON_CASES)('keeps $id rock collisions identical with compact terrain reads', terrain => {
    const surfaces = [...terrain.buildSurfaces(), ...(terrain.buildBanks?.() ?? [])];
    const fast = flow(surfaces), reference = flow(surfaces);
    // Use the existing object-based sweep as the independent implementation.
    // Both owners still have identical immutable geometry and water equations.
    (reference as unknown as { packedPlanes: null }).packedPlanes = null;
    fast.advanceTo(TERRAIN_COMPARISON_DT, () => source);
    reference.advanceTo(TERRAIN_COMPARISON_DT, () => source);
    const seed = fast.saveState();
    for (const surface of surfaces) {
      const state = structuredClone(seed), parcel = state.snapshot.parcels[0];
      const center = surface.vertices[0].map((value, axis) => value
        + (surface.vertices[1][axis] - value) * .5
        + (surface.vertices[3][axis] - value) * .5);
      // An already-owned parcel crosses each real face, including sloped banks.
      // Restoring before every crossing also checks reuse after a rollback.
      parcel.position = center.map((v, i) => v + surface.normal[i] * .01) as [number, number, number];
      parcel.velocity = surface.normal.map(v => -v * 10) as [number, number, number];
      parcel.sourceRelease = undefined; parcel.sourceSection = undefined;
      fast.restoreState(state); reference.restoreState(state);
      fast.advanceTo(2 * TERRAIN_COMPARISON_DT, () => ({ ...source, q: 0 }));
      reference.advanceTo(2 * TERRAIN_COMPARISON_DT, () => ({ ...source, q: 0 }));
      expect(withoutElapsed(fast.saveState())).toEqual(withoutElapsed(reference.saveState()));
      expect(fast.failureReason).toBeNull();
    }
  });
  it('puts solid sloped banks on both sides without bridging the seven separate lanes', () => {
    const slope = TERRAIN_COMPARISON_CASES.find(c=>c.id==='langfossen')!;
    const banks = slope.buildBanks!();
    const left = banks.find(s=>s.id==='langfossen-broad-slope-bank-left')!;
    const right = banks.find(s=>s.id==='langfossen-broad-slope-bank-right')!;
    expect(left.vertices).toEqual([[-.5,78,-16],[48,24.65,-16],[48,21.65,-13],[-.5,75,-13]]);
    expect(right.normal[2]).toBeLessThan(0); expect(left.normal[2]).toBeGreaterThan(0);
    for (const bank of [left,right]) {
      const center = bank.vertices.reduce<number[]>((sum,p)=>sum.map((v,i)=>v+p[i]/4),[0,0,0]);
      const above = center.map((v,i)=>v+bank.normal[i]) as [number,number,number];
      const below = center.map((v,i)=>v-bank.normal[i]) as [number,number,number];
      expect(sweepWaterfallContact(above,below,bank)?.fraction).toBeCloseTo(.5,12);
      expect(sweepWaterfallContact(below,above,bank)).toBeNull();
    }
    const sisters = TERRAIN_COMPARISON_CASES.find(c=>c.id==='seven-sisters')!;
    // Where a three-meter shoulder would cover another ribbon, keep the gap.
    for (const bank of sisters.buildBanks!()) for (const lane of sisters.buildSurfaces()) {
      const overlap = Math.min(bank.vertices[2][2],lane.vertices[2][2])-Math.max(bank.vertices[0][2],lane.vertices[0][2]);
      expect(overlap).toBeLessThanOrEqual(0);
    }
  });
  it.each([-1,1])('deflects an outward parcel off the %s bank without losing its water', side => {
    const profile = TERRAIN_COMPARISON_CASES.find(c=>c.id==='langfossen')!;
    const terrain = [...profile.buildSurfaces(),...profile.buildBanks!()];
    const bank = terrain.find(s=>s.id===`langfossen-broad-slope-bank-${side < 0 ? 'left' : 'right'}`)!;
    const run = new WaterfallContactFlow({startTime:0,dt:TERRAIN_COMPARISON_DT,parcelsPerStep:1,surfaces:terrain});
    run.advanceTo(TERRAIN_COMPARISON_DT,()=>source);
    const seed = run.saveState(), parcel = seed.snapshot.parcels[0];
    // A declared contact fixture starts one already-owned parcel beside the
    // bank. This tests collision/ownership, not source-to-bank travel or energy.
    const bedY = 75-1.1*(12+.5)+.5;
    parcel.position = [12+bank.normal[0]*.02,bedY+bank.normal[1]*.02,side*13.5+bank.normal[2]*.02];
    parcel.velocity = [0,0,side*2]; parcel.sourceRelease = undefined;
    parcel.sourceSection = undefined; run.restoreState(seed);
    const volume = run.totalOwnedVolume;
    run.advanceTo(13*TERRAIN_COMPARISON_DT,()=>({...source,q:0}));
    const result = run.snapshot(), moved = result.parcels[0];
    expect(run.failureReason).toBeNull(); expect(result.receipt.surfaceContactCounts[bank.id]).toBeGreaterThan(0);
    expect(result.receipt.landedVolume).toBe(0); expect(run.totalOwnedVolume).toBe(volume);
    expect(moved.velocity[2]*side).toBeLessThan(2);
    const normalDistance = moved.position.reduce((sum,v,i)=>sum+(v-bank.vertices[0][i])*bank.normal[i],0);
    expect(normalDistance).toBeGreaterThanOrEqual(-1e-10);
    expect(result.receipt.rockImpulse.every(Number.isFinite)).toBe(true);
    for (let axis=0;axis<3;axis++) {
      const momentumChange = volume*1000*(moved.velocity[axis]-parcel.velocity[axis]);
      const appliedImpulse = result.receipt.gravityImpulse[axis]-seed.snapshot.receipt.gravityImpulse[axis]
        +result.receipt.rockImpulse[axis]-seed.snapshot.receipt.rockImpulse[axis];
      expect(momentumChange).toBeCloseTo(appliedImpulse,10);
    }
  });
  it('defaults to all seven reference identities with independent visible contact geometry', () => {
    const run = new WaterfallTerrainComparisonRun();
    expect(TERRAIN_COMPARISON_CASES.map(c=>c.id)).toEqual(['storfossen','seven-sisters','steinsdalsfossen','latefossen','tvindefossen','stigfossen','langfossen']);
    expect(TERRAIN_COMPARISON_CASES.map(c=>c.clipAt)).toEqual(['0:22','1:15','1:27','2:13','2:47','3:34','4:23']);
    expect(new Set(TERRAIN_COMPARISON_CASES.map(c=>JSON.stringify(c.buildSurfaces()))).size).toBe(7);
    const initial=run.snapshot();expect(initial.snapshots.map(r=>r.id)).toEqual(TERRAIN_COMPARISON_CASES.map(c=>c.id));
    // The original pressure-bearing top remains first; the newly physical banks
    // are exactly the same optional faces consumed by the landscape renderer.
    initial.snapshots.forEach((row,i)=>expect(row.snapshot.surfaces).toEqual([
      ...TERRAIN_COMPARISON_CASES[i].buildSurfaces(), ...TERRAIN_COMPARISON_CASES[i].buildBanks!()]));
    expect(TERRAIN_COMPARISON_CASES[0].buildSurfaces()).toHaveLength(5);
    expect(TERRAIN_COMPARISON_CASES[1].buildSurfaces()).toHaveLength(7);
    expect(TERRAIN_COMPARISON_CASES[4].buildSurfaces()).toHaveLength(9);
    expect(TERRAIN_COMPARISON_CASES[5].buildSurfaces().filter(s=>s.id.startsWith('stigfossen-stage-'))).toHaveLength(6);
    const twins=TERRAIN_COMPARISON_CASES[3].buildSurfaces();expect(twins[0].normal[2]).toBeGreaterThan(0);expect(twins[1].normal[2]).toBeLessThan(0);
    run.setRunning(true);const wet=run.step();run.setSourceOn(false);const off=run.step();
    off.reading.cases.forEach((row,i)=>{expect(row.emittedVolume).toBeCloseTo(1.5*TERRAIN_COMPARISON_DT,12);expect(row.emittedVolume).toBe(wet.reading.cases[i].emittedVolume);expect(row.closureError).toBeCloseTo(0,12);});
  });
  it('copies input and snapshots, and preserves the entire terrain through source-off', () => {
    const terrain = stepped(), original = structuredClone(terrain), run = flow(terrain);
    terrain[0].vertices[0][1] += 100; terrain[1].normal[0] = 0;
    const displayed = run.snapshot(); displayed.surfaces[2].vertices[0][0] += 999;
    run.advanceTo(TERRAIN_COMPARISON_DT, () => source);
    run.advanceTo(2 * TERRAIN_COMPARISON_DT, () => ({ ...source, q: 0 }));
    expect(run.failureReason).toBeNull(); expect(run.snapshot().surfaces).toEqual(original);
    expect(run.snapshot().receipt.emittedVolume).toBeCloseTo(1.5 * TERRAIN_COMPARISON_DT, 12);
  });
  it('rejects a changed lower quad or film checkpoint before any mutation', () => {
    const run = flow(); run.advanceTo(TERRAIN_COMPARISON_DT, () => source);
    const original = run.saveState();
    for (const field of ['lower', 'film'] as const) {
      const bad = structuredClone(original);
      if (field === 'lower') bad.snapshot.surfaces[1].vertices[0][1] += 1;
      else bad.filmSurface!.normal[0] += .1;
      bad.snapshot.parcels[0].position[0] = 999;
      expect(() => run.restoreState(bad)).toThrow('terrain mismatch');
      expect(run.saveState()).toEqual(original);
    }
    run.restoreState(original); expect(run.saveState()).toEqual(original);
    const malformedFilm = structuredClone(original);
    malformedFilm.filmState!.originalNx++;
    malformedFilm.snapshot.parcels[0].position[0] = 999;
    malformedFilm.snapshot.receipt.ticks = 900;
    expect(() => run.restoreState(malformedFilm)).toThrow('film-state-grid-mismatch');
    expect(run.saveState()).toEqual(original);
  });
  it('validates upward normalized coplanar rectangle geometry and unique IDs', () => {
    const invalid: ((terrain: ContactSurface[]) => void)[] = [
      t => { t[0].normal[1] = -t[0].normal[1]; }, t => { t[0].normal[0] = NaN; },
      t => { t[0].normal[1] *= 2; }, t => { t[0].vertices[2][1] += 1; },
      t => { t[0].vertices[1][2] += .1; }, t => { t[0].vertices[1][0] = t[0].vertices[0][0]; },
      t => { t[1].id = t[0].id; },
    ];
    expect(() => flow([])).toThrow('invalid-contact-terrain');
    for (const change of invalid) { const t = stepped(); change(t); expect(() => flow(t)).toThrow('invalid-contact-terrain'); }
  });
  it('requires a fresh run for width or height changes while allowing discharge changes', () => {
    for (const change of [{ width: 11 }, { top: 79 }, { pool: 19 }]) {
      const run = flow(); run.advanceTo(TERRAIN_COMPARISON_DT, () => source);
      const owned = run.totalOwnedVolume;
      run.advanceTo(2 * TERRAIN_COMPARISON_DT, () => ({ ...source, ...change }));
      expect(run.failureReason).toBe('fixed-terrain-source-change-requires-fresh-run');
      expect(run.time).toBe(TERRAIN_COMPARISON_DT); expect(run.totalOwnedVolume).toBe(owned);
    }
  });
  it('has a real central gap in the lower ledge and a distinct catch shelf', () => {
    const t = GENERIC_TERRAIN_COMPARISON_CASES[2].buildSurfaces();
    const split = t.filter(s => s.id.startsWith('broken-'));
    expect(split).toHaveLength(2);
    expect(split.map(s => sweepWaterfallContact([14, 55, 0], [14, 40, 0], s))).toEqual([null, null]);
    expect(sweepWaterfallContact([14, 55, -4], [14, 40, -4], split[0])).not.toBeNull();
    expect(sweepWaterfallContact([14, 40, 0], [14, 30, 0], t.find(s => s.id === 'gap-catch')!)).not.toBeNull();
  });
});
describe('three independent contact experiments', () => {
  it('shares one fixed-tick rollback copy while preserving independent public state and restoration', () => {
    const f = new WaterfallContactFlow({ startTime: 0, dt: TERRAIN_COMPARISON_DT, surfaces: stepped(), maxStepsPerAdvance: 1 });
    const before = f.saveState();
    const copy = vi.spyOn(f as unknown as { saveRollbackState(): unknown }, 'saveRollbackState');
    const result = f.advanceTransactionalTick(TERRAIN_COMPARISON_DT, () => source);
    expect(result.failure).toBeNull(); expect(copy).toHaveBeenCalledTimes(1); copy.mockRestore();
    expect(f.time).toBe(TERRAIN_COMPARISON_DT);
    const publicState = f.saveState(); publicState.snapshot.parcels[0].volume = 999;
    expect(f.snapshot().parcels[0].volume).toBeLessThan(1);
    f.restoreTransactionState(result.checkpoint); expect(f.saveState()).toEqual(before);
  });
  it('restores invalid source state and clears the borrowed checkpoint before the next tick', () => {
    const f = new WaterfallContactFlow({ startTime: 0, dt: TERRAIN_COMPARISON_DT, surfaces: stepped(), maxStepsPerAdvance: 1 });
    const before = f.saveState();
    const result = f.advanceTransactionalTick(TERRAIN_COMPARISON_DT, () => ({ ...source, q: NaN }));
    expect(result.failure).toBe('invalid-source'); expect(f.saveState()).toEqual(before);
    expect(f.advanceTransactionalTick(TERRAIN_COMPARISON_DT, () => source).failure).toBeNull();
  });
  it('rejects nested transaction admission and restores water before accepting a later command', () => {
    const f = new WaterfallContactFlow({ startTime: 0, dt: TERRAIN_COMPARISON_DT, surfaces: stepped(), maxStepsPerAdvance: 1 });
    const before = f.saveState();
    expect(() => f.advanceTransactionalTick(TERRAIN_COMPARISON_DT, () => {
      f.advanceTransactionalTick(TERRAIN_COMPARISON_DT, () => source); return source;
    })).toThrow('nonreentrant');
    expect(f.saveState()).toEqual(before);
    expect(f.advanceTransactionalTick(TERRAIN_COMPARISON_DT, () => source).failure).toBeNull();
  });
  it('matches the legacy public-checkpoint wrapper for accepted water and arrival ledgers', () => {
    const compact = new WaterfallTerrainComparisonRun(GENERIC_TERRAIN_COMPARISON_CASES), legacy = new WaterfallTerrainComparisonRun(GENERIC_TERRAIN_COMPARISON_CASES);
    // Substitute only the old outer checkpoint calls. Both runs execute the same
    // comparison wrapper and native Flow/Film equations, including collector export.
    const saved = new Map<ContactTransactionCheckpoint, ContactFlowState>();
    for (const f of ownedFlows(legacy)) {
      vi.spyOn(f, 'saveTransactionState').mockImplementation(() => {
        const token = {} as ContactTransactionCheckpoint; saved.set(token, f.saveState()); return token;
      });
      vi.spyOn(f, 'restoreTransactionState').mockImplementation(token => f.restoreState(saved.get(token)!));
    }
    for (const run of [compact, legacy]) {
      run.setRunning(true); run.step();
      for (const f of ownedFlows(run)) {
        const seed = f.saveState();
        seed.snapshot.parcels = [{ id: 0, position: [25, 18.001, 0], velocity: [0, -1, 0], volume: .125, birth: 0, contactCount: 0, contactEnergy: 0 }];
        // Keep nonzero supported water in the saved Film arrays as well as an
        // airborne collector packet, exercising both owners and their impulses.
        seed.filmState!.volumes[0] = .0001;
        seed.filmState!.capturedVolume = .0001;
        seed.snapshot.receipt.emittedVolume = .1251; seed.nextId = 1; f.restoreState(seed);
      }
    }
    for (let tick = 0; tick < 6; tick++) {
      if (tick === 2) { compact.setSourceOn(false); legacy.setSourceOn(false); }
      if (tick === 4) { compact.setSourceOn(true); legacy.setSourceOn(true); }
      expect(withoutElapsed(compact.step())).toEqual(withoutElapsed(legacy.step()));
      expect(withoutElapsed(ownedFlows(compact).map(f => f.saveState()))).toEqual(withoutElapsed(ownedFlows(legacy).map(f => f.saveState())));
      saved.clear();
    }
    expect(compact.snapshot().reading.arrivals.every(row => row.count === 1)).toBe(true);
  });

  it('keeps compact tokens opaque and owner-bound while public checkpoints remain independent', () => {
    const f = flow(), other = flow();
    f.advanceTo(TERRAIN_COMPARISON_DT, () => source);
    const before = f.saveState(), token = f.saveTransactionState(), publicCopy = f.saveState();
    publicCopy.snapshot.parcels[0].position[0] = 999;
    publicCopy.snapshot.surfaces[0].vertices[0][1] = 999;
    publicCopy.filmState!.volumes[0] = 999;
    expect(f.saveState()).toEqual(before);
    const otherBefore = other.saveState();
    expect(() => other.restoreTransactionState(token)).toThrow('owner mismatch');
    expect(other.saveState()).toEqual(otherBefore);
    expect(() => f.restoreTransactionState({} as ContactTransactionCheckpoint)).toThrow('owner mismatch');
    expect(f.saveState()).toEqual(before);
    f.advanceTo(2 * TERRAIN_COMPARISON_DT, () => source);
    f.restoreTransactionState(token);
    expect(f.saveState()).toEqual(before);
    // A later tick must not mutate a retained compact checkpoint through aliases.
    f.advanceTo(2 * TERRAIN_COMPARISON_DT, () => source);
    f.restoreTransactionState(token);
    expect(f.saveState()).toEqual(before);
    // Restoring public data copies it into the owner, rather than retaining caller arrays.
    const publicRestore = structuredClone(before); f.restoreState(publicRestore);
    publicRestore.snapshot.parcels[0].position[0] = 999;
    expect(f.saveState()).toEqual(before);
  });
  it('admits equal water but terrain changes actual first-hit times and contact histories', () => {
    const rows = [flow(), flow(GENERIC_TERRAIN_COMPARISON_CASES[1].buildSurfaces())];
    const first: (number | null)[] = [null, null];
    for (let tick = 1; tick <= 216; tick++) {
      rows.forEach((run, i) => {
        run.advanceTo(tick * TERRAIN_COMPARISON_DT, () => source);
        expect(run.failureReason).toBeNull();
        if (first[i] === null && run.snapshot().receipt.contactCount > 0) first[i] = run.time;
      });
    }
    const receipts = rows.map(r => r.snapshot().receipt);
    expect(first[0]).not.toBeNull(); expect(first[1]).not.toBeNull(); expect(first[1]!).toBeLessThan(first[0]!);
    expect(receipts[0].emittedVolume).toBe(receipts[1].emittedVolume);
    expect(receipts[0].surfaceContactCounts).not.toEqual(receipts[1].surfaceContactCounts);
    receipts.forEach(r => expect(r.budgetError).toBeCloseTo(0, 10));
  });
  it('pauses without admission and source-off advances already owned historical water', () => {
    const run = new WaterfallTerrainComparisonRun(GENERIC_TERRAIN_COMPARISON_CASES);
    expect(run.step().reading.physicalTime).toBe(0); run.setRunning(true);
    const admitted = run.step(); run.setSourceOn(false);
    const moved = run.step();
    expect(moved.reading.physicalTime).toBe(2 * TERRAIN_COMPARISON_DT);
    moved.reading.cases.forEach((r, i) => expect(r.emittedVolume).toBe(admitted.reading.cases[i].emittedVolume));
    expect(moved.snapshots[0].snapshot.parcels[0].position).not.toEqual(admitted.snapshots[0].snapshot.parcels[0].position);
    run.setRunning(false); expect(run.step()).toEqual(run.snapshot());
  });
  it('rolls back all cases on a later failure and keeps the first failure until explicit reset', () => {
    const run = new WaterfallTerrainComparisonRun(GENERIC_TERRAIN_COMPARISON_CASES); run.setRunning(true); run.step();
    const before = run.snapshot(), statesBefore = ownedFlows(run).map(f => f.saveState()), original = WaterfallContactFlow.prototype.advanceTo; let calls = 0;
    const spy = vi.spyOn(WaterfallContactFlow.prototype, 'advanceTo').mockImplementation(function (this: WaterfallContactFlow, ...args) {
      calls++;
      const result = original.apply(this, args);
      if (calls === 3) {
        expect(ownedFlows(run).every((f, i) => f.time > statesBefore[i].snapshot.receipt.ticks * TERRAIN_COMPARISON_DT)).toBe(true);
        throw Error('injected-third-case-failure');
      }
      return result;
    });
    expect(() => run.step()).toThrow('injected-third-case-failure'); spy.mockRestore();
    expect(run.snapshot().snapshots).toEqual(before.snapshots);
    expect(ownedFlows(run).map(f => f.saveState())).toEqual(statesBefore);
    expect(run.snapshot().reading.arrivals).toEqual(before.reading.arrivals);
    expect(run.snapshot().reading.physicalTime).toBe(before.reading.physicalTime);
    expect(run.snapshot().reading.running).toBe(false);
    expect(() => run.step()).toThrow('injected-third-case-failure');
    const reset = run.reset(); expect(reset.reading.physicalTime).toBe(0); expect(reset.reading.failure).toBeNull();
  });
  it('does not share source mass or mutable snapshots with the main waterfall', () => {
    const main = new WaterfallContactFlow({ startTime: 0 }), before = main.saveState();
    const run = new WaterfallTerrainComparisonRun(GENERIC_TERRAIN_COMPARISON_CASES); run.setRunning(true);
    const record = run.step();
    record.snapshots[0].snapshot.parcels[0].volume = 999;
    record.snapshots[0].snapshot.surfaces[0].vertices[0][1] = 999;
    expect(main.saveState()).toEqual(before);
    run.snapshot().reading.cases.forEach(r => { expect(r.emittedVolume).toBeCloseTo(1.5 / 120, 12); expect(r.closureError).toBeCloseTo(0, 12); });
    expect(run.snapshot().snapshots[0].snapshot.parcels[0].volume).toBeLessThan(1);
  });
  it('retains collector totals while bounding arrival rows to the last tick', () => {
    const run = new WaterfallTerrainComparisonRun(GENERIC_TERRAIN_COMPARISON_CASES);
    // A known owned packet near the collector isolates export accounting in
    // two ticks, without substituting a second fluid method or a long run.
    const flows = (run as unknown as { flows: WaterfallContactFlow[] }).flows;
    for (const f of flows) {
      const seed = f.saveState();
      seed.snapshot.parcels = [{ id: 0, position: [25, 18.001, 0], velocity: [0, -1, 0], volume: .125, birth: 0, contactCount: 0, contactEnergy: 0 }];
      seed.snapshot.receipt.emittedVolume = .125; seed.nextId = 1; f.restoreState(seed);
    }
    run.setSourceOn(false); run.setRunning(true);
    const exported = run.step();
    exported.reading.arrivals.forEach((ledger, i) => {
      expect(ledger.volume).toBeCloseTo(.125, 12); expect(ledger.count).toBe(1); expect(ledger.lastTick).toHaveLength(1);
      expect(ledger.volume).toBe(exported.snapshots[i].snapshot.receipt.landedVolume);
      expect(exported.reading.cases[i].closureError).toBeCloseTo(0, 12);
    });
    run.step().reading.arrivals.forEach(ledger => { expect(ledger.volume).toBeCloseTo(.125, 12); expect(ledger.count).toBe(1); expect(ledger.lastTick).toHaveLength(0); });
  });
});
