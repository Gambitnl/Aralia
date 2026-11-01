/**
 * Checks the ideal impact law against physical balances and limiting cases.
 * These tests qualify scalar mathematics only, not rock geometry or native film
 * transport, which must preserve the two streams and measure their own work.
 */
import { describe, expect, it } from 'vitest';
import { solveWaterfallImpactJunction, type WaterfallImpactJunctionInput } from '../waterfallImpactJunction';

const wet: WaterfallImpactJunctionInput = { q: 0.2, ve: 2, vt: 0, vn: -6, gn: 9.81, H: 18, density: 1000, span: 3, duration: 0.1 };

function solved(input: WaterfallImpactJunctionInput) {
  const result = solveWaterfallImpactJunction(input);
  if (!result.ok) throw new Error(`Unexpected rejected impact: ${result.reason}: ${result.message}`);
  return result;
}

describe('two-port inviscid waterfall impact', () => {
  it('splits normal incidence equally, preserving energy while redirecting normal impulse', () => {
    const r = solved(wet);
    expect(r.plus.q).toBeCloseTo(wet.q / 2, 13);
    expect(r.minus.q).toBeCloseTo(r.plus.q, 13);
    expect(r.plus.h).toBeCloseTo(r.minus.h, 13);
    expect(r.plus.s).toBeGreaterThan(5.9);
    expect(r.flux.normalReaction).toBeCloseTo(1200, 10);
    expect(r.integrated.normalReaction).toBeCloseTo(360, 10);
    for (const b of [r.flux.mass, r.flux.tangentialMomentum, r.flux.spanwiseMomentum, r.flux.mechanicalEnergy]) {
      expect(Math.abs(b.residual)).toBeLessThan(1e-9);
    }
    expect(r.integrated.mass.incoming).toBeCloseTo(60, 10);
    expect(r.integrated.mechanicalEnergy.incoming).toBeCloseTo(1200, 10);
    // Finite-depth pressure work means particle kinetic transport alone is not
    // the mechanical-energy ledger, despite the frictionless stationary wall.
    expect(r.flux.particleKineticEnergy.residual).toBeLessThan(0);
  });

  it('conserves oblique momentum including pressure traction, with mirror symmetry', () => {
    const input = { ...wet, vt: 3, vn: -4, H: 12.5 };
    const r = solved(input), mirror = solved({ ...input, vt: -input.vt });
    expect(r.plus.q).toBeGreaterThan(r.minus.q);
    expect(r.plus.q).toBeCloseTo(mirror.minus.q, 12);
    expect(r.plus.h).toBeCloseTo(mirror.minus.h, 12);
    const density = input.density ?? 1;
    const outgoingAdvectiveMomentum = density * (r.plus.q * r.plus.s - r.minus.q * r.minus.s);
    const pressureTraction = 0.5 * density * input.gn * (r.plus.h ** 2 - r.minus.h ** 2);
    expect(outgoingAdvectiveMomentum + pressureTraction).toBeCloseTo(density * input.q * input.vt, 9);
    expect(Math.abs(outgoingAdvectiveMomentum - density * input.q * input.vt)).toBeGreaterThan(0.1);
    for (const p of [r.plus, r.minus]) {
      expect(p.q).toBeCloseTo(p.h * p.s, 12);
      expect(p.s ** 2).toBeGreaterThan(input.gn * p.h);
      expect(0.5 * p.s ** 2 + input.gn * p.h).toBeCloseTo(input.H, 12);
      expect(p.ve).toBe(input.ve);
    }
  });

  it('approaches the analytic ideal-jet split as hydrostatic depth vanishes', () => {
    const input = { ...wet, q: 1e-8, vt: 3, vn: -4, H: 12.5 };
    const r = solved(input);
    // In the negligible-depth limit the incident 3-4-5 triangle gives speeds
    // of 5 m/s and fractions (1±3/5)/2, independently of the depth solve.
    expect(r.plus.s).toBeCloseTo(5, 8);
    expect(r.minus.s).toBeCloseTo(5, 8);
    expect(r.plus.q / input.q).toBeCloseTo(0.8, 8);
    expect(r.minus.q / input.q).toBeCloseTo(0.2, 8);
  });

  it('keeps actual incoming potential and normal velocity distinct from energy head', () => {
    const input = { ...wet, H: 20, ve: 3, vt: 1, vn: -2 };
    const r = solved(input);
    expect(r.incomingPotentialRelativeToBed).toBe(17.5);
    expect(r.flux.normalReaction).toBe(400);
    expect(r.flux.mechanicalEnergy.incoming).toBe(4900);
    expect(r.flux.particleKineticEnergy.incoming).toBe(1400);
    expect(r.flux.mechanicalEnergy.residual).toBeCloseTo(0, 9);
    const changedVn = solved({ ...input, vn: -3 });
    expect(changedVn.plus.q).toBe(r.plus.q);
    expect(changedVn.flux.normalReaction).toBe(600);
    expect(changedVn.incomingPotentialRelativeToBed).toBe(15);
  });

  it('accepts nearcritical shallow ports but rejects critical or overcapacity head', () => {
    const H = 3, gn = 2, criticalQ = Math.sqrt(2);
    const near = solved({ ...wet, H, gn, q: 2 * criticalQ * (1 - 1e-7) });
    expect(near.plus.h).toBeLessThan(near.criticalDepth);
    expect(near.plus.s ** 2).toBeGreaterThan(gn * near.plus.h);
    expect(solveWaterfallImpactJunction({ ...wet, H, gn, q: 2 * criticalQ })).toMatchObject({ ok: false, reason: 'critical-port' });
    expect(solveWaterfallImpactJunction({ ...wet, H, gn, q: 2 * criticalQ * 1.01 })).toMatchObject({ ok: false, reason: 'capacity-exceeded' });
  });

  it('rejects momentum incompatible with the supplied head, without a head-loss fallback', () => {
    expect(solveWaterfallImpactJunction({ ...wet, vt: 20 })).toMatchObject({ ok: false, reason: 'no-momentum-bracket' });
  });

  it('represents zero arriving water without a fictitious wall force or stream volume', () => {
    const r = solved({ ...wet, q: 0, H: 0, vt: 0, vn: 0 });
    expect(r.plus).toEqual({ q: 0, h: 0, s: 0, ve: wet.ve });
    expect(r.minus).toEqual(r.plus);
    expect(r.flux.mass.incoming).toBe(0);
    expect(r.flux.mechanicalEnergy.outgoing).toBe(0);
    expect(r.flux.normalReaction).toBe(0);
  });

  it.each([
    { q: -1 }, { q: NaN }, { ve: Infinity }, { vt: NaN }, { vn: 0 },
    { vn: 1 }, { gn: 0 }, { H: 0 }, { H: -1 }, { density: 0 }, { span: 0 }, { duration: -1 },
  ])('rejects invalid wet input %j visibly', invalid => {
    expect(solveWaterfallImpactJunction({ ...wet, ...invalid })).toMatchObject({ ok: false, reason: 'invalid-input' });
  });

  it('reports nonrepresentable arithmetic instead of returning nonfinite balances', () => {
    expect(solveWaterfallImpactJunction({ ...wet, ve: Number.MAX_VALUE })).toMatchObject({ ok: false, reason: 'numerical-failure' });
  });
});
