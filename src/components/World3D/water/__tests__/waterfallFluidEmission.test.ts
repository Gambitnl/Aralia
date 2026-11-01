/** These checks cover material conservation and motion. They do not accept
 * appearance: the native reconstructed surface still needs rendered review.
 */
import { describe, expect, it } from 'vitest';
import { buildFluidParticles, FluidSourceHistory, type FluidBirth } from '../waterfallFluidEmission';
const source = (q = 40): FluidBirth => ({ q, speed: q / 7, width: 10, depth: .7, top: 78, ageScale: 1 });
const build = (time: number, at: (birth: number) => FluidBirth = () => source()) => buildFluidParticles(time, 8, 4.2, at);

describe('flow-carried reconstructed waterfall samples', () => {
  it('partitions emitted liquid into airborne/landed budgets including sparse spray', () => {
    const result = build(20);
    expect(result.emittedVolume).toBeCloseTo(40 * 4.2, 9);
    expect(Math.abs(result.budgetError)).toBeLessThan(1e-9);
    expect(result.particles.some(p => p.spray)).toBe(true);
    expect(result.particles.every(p => p.liquidFraction > 0 && p.liquidFraction <= 1.01)).toBe(true);
  });
  it('moves the same emitted identity continuously and accelerates under gravity', () => {
    const first = build(20), next = build(20.2), later = build(20.4);
    const p = first.particles.find(p => !p.spray && p.age > 1.2 && p.age < 1.3)!;
    const q = next.particles.find(q => q.id === p.id)!, r = later.particles.find(r => r.id === p.id)!;
    expect(q.birth).toBe(p.birth); expect(q.volume).toBeCloseTo(p.volume, 8);
    expect(q.center[0]).toBeGreaterThan(p.center[0]);
    expect(p.center[1] - q.center[1]).toBeLessThan(q.center[1] - r.center[1]);
    expect(q.radii[0]).toBeGreaterThan(p.radii[0]);
    expect(q.radii[1]).toBeLessThan(p.radii[1]);
  });
  it('keeps released water after source stop, emits none later and drains by landing', () => {
    const history = new FluidSourceHistory(); history.record(19, source()); history.record(20, source(0));
    const stopped = build(20.2, time => history.at(time));
    expect(stopped.airborneVolume).toBeGreaterThan(0);
    expect(stopped.particles.every(p => p.birth < 20)).toBe(true);
    expect(build(25, time => history.at(time)).particles).toHaveLength(0);
  });
  it('lets a surge travel with its own launch instead of repainting old water', () => {
    const at = (birth: number) => source(birth >= 20 && birth < 20.5 ? 80 : 10);
    const first = build(20.4, at), second = build(21.4, at);
    const pulse = first.particles.find(p => !p.spray && p.birth > 20.1 && p.birth < 20.2)!;
    const carried = second.particles.find(p => p.id === pulse.id)!;
    expect(carried.birth).toBe(pulse.birth);
    expect(carried.center[0] - pulse.center[0]).toBeGreaterThan(10);
    const base = second.particles.find(p => !p.spray && p.birth < 19.9)!;
    expect(base.volume).toBeLessThan(carried.volume);
  });
  it('changes low-flow gathering and launch with the captured source opening', () => {
    const low = build(20, () => source(1)), high = build(20, () => source(80));
    const width = (result: typeof low) => {
      const samples = result.particles.filter(p => !p.spray && p.age > 2 && p.age < 2.1);
      return Math.max(...samples.map(p => p.center[2])) - Math.min(...samples.map(p => p.center[2]));
    };
    expect(width(low)).toBeLessThan(width(high) * .5);
    expect(low.particles.length).toBeLessThan(high.particles.length);
    expect(low.airborneVolume).toBeLessThan(high.airborneVolume);
  });
  it('reconstructs the same cloud at a repeated or backward proof time', () => {
    const reference = build(20); build(22);
    expect(build(20)).toEqual(reference);
    const history = new FluidSourceHistory(); history.record(19, source(10)); history.record(20, source(80));
    history.record(19.5, source(10));
    expect(history.at(20).q).toBe(10);
    history.reset(); history.record(20, source(0));
    expect(build(20, birth => history.at(birth)).particles).toHaveLength(0);
  });
  it('retains historical width/depth/speed when later source opening changes', () => {
    const history = new FluidSourceHistory(); history.record(19, source());
    history.record(20, { ...source(80), width: 20, speed: 80 / 14 });
    expect(history.at(19.8)).toEqual(source());
    expect(history.at(20.1).width).toBe(20);
    const result = build(20.2, birth => history.at(birth));
    expect(result.particles.every(p => [...p.center, ...p.tangent, ...p.radii, p.volume].every(Number.isFinite))).toBe(true);
    expect(Math.abs(result.budgetError)).toBeLessThan(1e-9);
  });
  it('rejects unsupported history rather than silently losing old liquid', () => {
    expect(() => buildFluidParticles(20, 8, 8, () => source())).toThrow('Invalid fluid history');
    expect(() => build(20, () => ({ ...source(), q: NaN }))).toThrow('Invalid fluid birth');
  });
});
