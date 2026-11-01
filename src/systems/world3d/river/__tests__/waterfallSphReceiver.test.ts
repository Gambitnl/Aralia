/** Numerical receiver checks. These do not qualify its shoreline or rendered appearance. */
import {describe, expect, it} from 'vitest';
import {evaluateSphReceiver, WaterfallSphReceiverPulse, type SphReceiverParticle, type SphReceiverPlane} from '../waterfallSphReceiver';

const depth = .016173037246029705, speed = 8.152586848149591, gn = 6.598920109103825;
const plane: SphReceiverPlane = {normalGravity: gn, tangentGravity: Math.sqrt(9.81 ** 2 - gn ** 2), referenceDepth: depth, maximumSupportRadius: 8};
const spec = {...plane, port: {h: depth, s: speed, q: depth * speed, ve: 0}, width: 10, pulseLength: 1, spacing: .5};
function patch(): SphReceiverParticle[] {
  const p: SphReceiverParticle[] = [];
  for (let x = -1; x < 4; x++) for (let y = -4; y <= 4; y++) p.push({
    x: x * .2, y: y * .2, vx: 2 - .3 * x * .2, vy: -.2 * y * .2,
    mass: 1000 * depth * .2 ** 2, rho: 1000 * depth, h0: .24, resident: x >= 0});
  return p;
}
const storedEnergy = (p: SphReceiverParticle[], rho: number[]) => p.reduce((s, a, i) => s + (a.resident ? a.mass *
  (.5 * (a.vx ** 2 + a.vy ** 2) - plane.tangentGravity * a.x + .5 * gn * rho[i] / 1000) : 0), 0);

describe('experimental physical-plane receiver', () => {
  it('accounts for moving-buffer pressure storage and directed LF work', () => {
    const p = patch(), original = structuredClone(p), f = evaluateSphReceiver(p, plane, 1e-12);
    const expected = f.bufferForcePower + f.bufferPressureStoragePower + f.internalLFPower;
    const eps = 1e-5;
    const energies = [-1, 1].map(sign => {
      const moved = p.map((a, i) => ({...a, rho: f.rho[i], x: a.x + sign * eps * a.vx, y: a.y + sign * eps * a.vy,
        vx: a.vx + sign * eps * f.acceleration[i][0], vy: a.vy + sign * eps * f.acceleration[i][1]}));
      return storedEnergy(moved, evaluateSphReceiver(moved, plane, 1e-12).rho);
    });
    expect(Math.abs((energies[1] - energies[0]) / (2 * eps) - expected)).toBeLessThan(1e-6);
    // Independent Python/upstream-audited patch receipt, not an energy correction.
    expect(expected).toBeCloseTo(3.3489978896727637, 8);
    expect(Math.abs(f.bufferPressureStoragePower)).toBeGreaterThan(.01);
    expect(Math.hypot(...f.internalLFForce)).toBeGreaterThan(1e-8);
    expect(p).toEqual(original);
  });

  it('retains every supplied volume through source shutoff and continues downhill', () => {
    const run = new WaterfallSphReceiverPulse(spec);
    expect(run.snapshot().pairCount).toBe(0);
    for (let i = 0; i < run.totalSteps; i++) run.step();
    const end = run.snapshot(), residents = end.particles.filter(p => p.resident);
    expect(residents).toHaveLength(40);
    expect(end.residentVolume).toBeCloseTo(spec.width * depth, 14);
    expect(Math.abs(end.bufferVolume)).toBeLessThan(1e-14);
    expect(end.done).toBe(true);
    expect(Math.max(...residents.map(p => p.x))).toBeGreaterThan(3);
    expect(end.densityResidual).toBeLessThanOrEqual(1e-7);
    for (let row = 0; row < 2; row++) for (let col = 0; col < 10; col++) {
      const a = residents[row * 20 + col], b = residents[row * 20 + 19 - col];
      expect(a.x).toBeCloseTo(b.x, 12); expect(a.y).toBeCloseTo(-b.y, 12);
    }
    expect(run.step()).toEqual(end);
  });

  it('rejects support exhaustion atomically instead of clamping or deleting water', () => {
    const run = new WaterfallSphReceiverPulse({...spec, maximumSupportRadius: .1});
    for (let i = 0; i < 10; i++) run.step();
    const last = run.snapshot();
    expect(() => run.step()).toThrow('support capacity');
    expect(run.snapshot()).toEqual(last);
    expect(last.particles).toHaveLength(40);
  });

  it('bounds capacity and refuses inconsistent hydraulic ports', () => {
    expect(() => new WaterfallSphReceiverPulse({...spec, spacing: .0625})).toThrow('partition');
    expect(() => new WaterfallSphReceiverPulse({...spec, port: {...spec.port, q: 2}})).toThrow('inlet');
    expect(() => new WaterfallSphReceiverPulse({...spec, stepsPerRow: 21})).toThrow('inlet');
    expect(() => evaluateSphReceiver([{...patch()[0], resident: true}], plane)).toThrow();
  });
});
