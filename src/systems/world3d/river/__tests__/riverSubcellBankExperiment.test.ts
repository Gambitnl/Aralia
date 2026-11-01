import { describe, expect, it } from 'vitest';
import { G } from '../riverSolver';
import { bankHll, commitBankTransaction, createBankState, prepareBankTransaction,
  type BankGeometry, type BankPreparation, type BankTransaction } from '../riverSubcellBankExperiment';

// Exact rectangular controls exercise the operator without claiming that an
// actual drawn bank is flat. A partial-wet cell has a known blocked half-area.
function geometry(bottoms = [0, 0], wetFractions = [1, 1]): BankGeometry {
  const cells = bottoms.map((b, id) => ({ id, areaM2: 1, measureVolume: (v: number) => {
    const a = wetFractions[id], h = v / a;
    return { etaM: b + h, representedVolumeM3: v, potentialIntegralM4: b * v + v * h / 2,
      depthSquaredIntegralM4: v * h, wetAreaM2: v === 0 ? 0 : a,
      volumeErrorM3: 0, potentialErrorM4: 0, basinResolved: true as const };
  } }));
  const owners = [[0, 1, 1, 0], [0, null, -1, 0], [0, null, 0, -1], [0, null, 0, 1],
    [1, null, 1, 0], [1, null, 0, -1], [1, null, 0, 1]] as const;
  return { geometryId: 'analytic-controls', method: 'Exact constant-bottom rectangular active footprint',
    sourceHashes: { analyticControl: 'unit-control-v1' }, singleValuedBed: true, cells,
    faces: owners.map(([left, right, nx, nz], id) => ({ id, left, right, nx, nz, lengthM: 1, normalSpacingM: 1,
      measureFace: (etaL: number, etaR: number) => {
        // Partial wet area is the lower z strip: x faces are partly wet,
        // the lower z face is wet, and the upper z face is blocked at b=100.
        const fraction = right === null && wetFractions[left] < 1 && nz !== 0
          ? (nz < 0 ? 1 : 0) : right === null ? wetFractions[left] : Math.min(wetFractions[left], wetFractions[right]);
        const r = right ?? left;
        const nodes = fraction > 0 ? [{ weightM: fraction, bedLeftM: bottoms[left], bedRightM: bottoms[r],
          depthLeftM: Math.max(etaL - bottoms[left], 0), depthRightM: Math.max(etaR - bottoms[r], 0) }] : [];
        if (fraction < 1) nodes.push({ weightM: 1 - fraction, bedLeftM: 100, bedRightM: 100, depthLeftM: 0, depthRightM: 0 });
        return { nodes, lengthErrorM: 0, depthErrorM: 0, fluxVolumeErrorM3S: 0, fluxMomentumErrorN: 0 };
      } })) };
}
function transaction(p: BankPreparation): BankTransaction {
  if (!p.ok) throw new Error(p.reason);
  return p.transaction;
}
const policy = (c: { diagnosticBoundS: number }) => c.diagnosticBoundS;
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
function ledgerMomentum(t: BankTransaction) {
  const p = [0, 0];
  for (const f of t.transfers) {
    p[0] += -f.hllPxKgMS + f.correctionLeft[0] + f.bedReactionLeft[0];
    p[1] += -f.hllPzKgMS + f.correctionLeft[1] + f.bedReactionLeft[1];
    if (f.right !== null) {
      p[0] += f.hllPxKgMS + f.correctionRight[0] + f.bedReactionRight[0];
      p[1] += f.hllPzKgMS + f.correctionRight[1] + f.bedReactionRight[1];
    }
  }
  return p;
}

describe('fixed bank source preparation only', () => {
  it('uses native-family HLL physical flux and tangent upwinding', () => {
    const f = bankHll(0.7, 0.4, -0.3, 0.7, 0.4, -0.3);
    expect(f.mass).toBeCloseTo(0.28, 14);
    expect(f.normal).toBeCloseTo(0.7 * 0.4 ** 2 + G * 0.7 ** 2 / 2, 14);
    expect(f.tangent).toBeCloseTo(-0.084, 14);
    expect(f.speed).toBeCloseTo(0.4 + Math.sqrt(G * 0.7), 14);
  });

  it.each([[1, 1], [0.5, 0.5]])('preserves flat and partial-wet equilibrium (%s,%s)', (a, b) => {
    const g = geometry([0, 0], [a, b]);
    const s = createBankState('equilibrium', g.geometryId, [a, b], [0, 0], [0, 0]);
    const t = transaction(prepareBankTransaction(g, s, 1000, 1, policy));
    expect(t.after.volumeM3).toEqual(s.volumeM3);
    t.after.pxKgMS.forEach(p => expect(p).toBeCloseTo(0, 12));
    t.after.pzKgMS.forEach(p => expect(p).toBeCloseTo(0, 12));
    expect(t.timestep.cells[0].wetAreaBoundS).toBeCloseTo(0.25 / (4 * Math.sqrt(G)), 14);
    expect(t.energyStatus).toBe('ENERGY_UNKNOWN');
    expect(t.kineticChangeJ).toBeCloseTo(0, 20);
  });

  it('balances the matched jump reaction exactly once at equal eta', () => {
    const g = geometry([0, 0.5]);
    const s = createBankState('jump', g.geometryId, [1, 0.5], [0, 0], [0, 0]);
    const t = transaction(prepareBankTransaction(g, s, 1000, 0.01, policy));
    expect(t.after.volumeM3).toEqual([1, 0.5]);
    expect(t.after.pxKgMS[0]).toBeCloseTo(0, 10);
    expect(t.after.pxKgMS[1]).toBeCloseTo(0, 10);
    const face = t.transfers[0];
    expect(face.correctionLeft[0]).toBeCloseTo(-1000 * G * (1 - 0.25) / 2 * t.dtS, 10);
    expect(face.bedReactionLeft[0]).toBeCloseTo(1000 * G / 2 * t.dtS, 10);
    expect(-face.hllPxKgMS + face.correctionLeft[0] + face.bedReactionLeft[0]).toBeCloseTo(0, 10);
  });

  it('floods a truly dry zero-P receiver without applying its zero own ratios', () => {
    const g = geometry(), s = createBankState('flood', g.geometryId, [1, 0], [0, 0], [0, 0]);
    const t = transaction(prepareBankTransaction(g, s, 1000, 0.01, policy));
    const q = 2 * Math.sqrt(G) / 3 * t.dtS;
    expect(t.after.volumeM3[1]).toBeCloseTo(q, 14);
    expect(sum(t.after.volumeM3)).toBe(1);
    expect(t.timestep.cells[1].wetAreaBoundS).toBe(Infinity);
    expect(t.timestep.cells[1].volumeResponseBoundS).toBe(Infinity);
    expect(t.after.pxKgMS[1] / (1000 * t.after.volumeM3[1])).toBeGreaterThan(0);
    expect(Number.isFinite(t.after.pxKgMS[1] / (1000 * t.after.volumeM3[1]))).toBe(true);
    const ledger = ledgerMomentum(t);
    expect(sum(t.after.pxKgMS) - sum(s.pxKgMS)).toBeCloseTo(ledger[0], 10);
    expect(sum(t.after.pzKgMS) - sum(s.pzKgMS)).toBeCloseTo(ledger[1], 10);
    expect(s.volumeM3).toEqual([1, 0]);
  });

  it('restricts high-velocity tiny inventory without a cutoff or repair', () => {
    const g = geometry(), v = 1e-12, rho = 1000, u = 1e6;
    const s = createBankState('tiny', g.geometryId, [v, 0], [rho * v * u, 0], [0, 0]);
    const t = transaction(prepareBankTransaction(g, s, rho, 1, policy));
    expect(t.dtS).toBeLessThan(1e-6);
    expect(t.after.volumeM3[0]).toBeGreaterThan(0);
    expect(t.after.volumeM3[0]).toBeLessThan(v);
    expect(t.after.volumeM3[1]).toBeGreaterThan(0);
    expect(sum(t.after.volumeM3)).toBeCloseTo(v, 25);
    expect(t.transfers[0].hllPxKgMS).toBeCloseTo(rho * v * u ** 2 * t.dtS, 8);
    expect(t.energyStatus).toBe('ENERGY_UNKNOWN');
  });

  it('rolls back an unsafe first proposal and rejects stale commits', () => {
    const g = geometry(), s = createBankState('identity', g.geometryId, [1, 0], [0, 0], [0, 0]);
    const failed = prepareBankTransaction(g, s, 1000, 1, () => 1);
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.state).toBe(s);
    expect(s.volumeM3).toEqual([1, 0]);
    const t = transaction(prepareBankTransaction(g, s, 1000, 0.01, policy));
    const after = commitBankTransaction(s, t);
    expect(after.revision).toBe(1);
    expect(after.stateId).toBe('identity:analytic-controls:1');
    expect(() => commitBankTransaction(after, t)).toThrow('Stale');
  });

  it('fails geometry bounds and post-update integral errors transactionally', () => {
    const g = geometry(), s = createBankState('bad', g.geometryId, [1, 0], [0, 0], [0, 0]);
    const duplicate = { ...g, faces: [...g.faces, g.faces[0]] };
    expect(prepareBankTransaction(duplicate, s, 1000, 0.01, policy).ok).toBe(false);
    const tooMany = { ...g, faces: g.faces.map((f, i) => i ? f : { ...f, measureFace: () => ({
      nodes: Array(33).fill({ weightM: 1 / 33, bedLeftM: 0, bedRightM: 0, depthLeftM: 1, depthRightM: 0 }),
      lengthErrorM: 0, depthErrorM: 0, fluxVolumeErrorM3S: 0, fluxMomentumErrorN: 0 }) }) };
    expect(prepareBankTransaction(tooMany, s, 1000, 0.01, policy).ok).toBe(false);
    const badAfter = { ...g, cells: g.cells.map((c, i) => i ? { ...c, measureVolume: (v: number) => {
      if (v > 0) throw new Error('Unresolved first receiving basin');
      return c.measureVolume(v);
    } } : c) };
    const fail = prepareBankTransaction(badAfter, s, 1000, 0.01, policy);
    expect(fail.ok).toBe(false);
    if (!fail.ok) { expect(fail.reason).toContain('Unresolved'); expect(fail.state).toBe(s); }
    expect(() => createBankState('bad', g.geometryId, [0, 1], [1, 0], [0, 0])).toThrow('inventory');
  });

  it('rejects malformed structural state and missing required geometry numbers', () => {
    const g = geometry(), s = createBankState('structural', g.geometryId, [0, 1], [0, 0], [0, 0]);
    for (const bad of [{ ...s, pxKgMS: [1, 0] }, { ...s, pzKgMS: [0] },
      { ...s, volumeM3: [NaN, 1] }, { ...s, stateId: 'invented' }, { ...s, revision: undefined }]) {
      const p = prepareBankTransaction(g, bad as unknown as typeof s, 1000, 0.01, policy);
      expect(p.ok).toBe(false);
      if (!p.ok) expect(p.state).toBe(bad);
    }
    const missing = { ...g, cells: g.cells.map(c => ({ ...c, measureVolume: (v: number) => {
      const m = c.measureVolume(v);
      return { ...m, potentialIntegralM4: undefined } as unknown as typeof m;
    } })) };
    const p = prepareBankTransaction(missing, s, 1000, 0.01, policy);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.reason).toBe('Unavailable geometry integral');
  });

  it('rejects sparse inventories and overflow in aggregated scaled certificates', () => {
    expect(() => createBankState('sparse', 'analytic-controls', Array(2), [0, 0], [0, 0])).toThrow('inventory');
    const g = geometry(), s = createBankState('overflow', g.geometryId, [1, 1], [0, 0], [0, 0]);
    const hugeError = { ...g, cells: g.cells.map(c => ({ ...c, measureVolume: (v: number) => ({
      ...c.measureVolume(v), potentialErrorM4: 1e305 }) })) };
    const p = prepareBankTransaction(hugeError, s, 1000, 0.01, policy);
    expect(p.ok).toBe(false);
    if (!p.ok) { expect(p.reason).toBe('Nonfinite aggregate uncertainty'); expect(p.state).toBe(s); }
  });

  it('rejects an uncovered cell even when its zero closure sum looks closed', () => {
    const g = geometry(), s = createBankState('uncovered', g.geometryId, [1, 1], [0, 0], [0, 0]);
    const onlyFirst = { ...g, faces: g.faces.filter(f => f.left === 0).map(f => ({ ...f, right: null })) };
    const p = prepareBankTransaction(onlyFirst, s, 1000, 0.01, policy);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.reason).toBe('Missing closed cell faces');
  });
});
