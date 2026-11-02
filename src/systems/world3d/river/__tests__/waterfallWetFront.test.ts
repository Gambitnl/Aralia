import {describe, expect, it} from 'vitest';
import {WaterfallWetFront} from '../waterfallWetFront';

describe('coupled wet-to-dry edge', () => {
  const event = {origin: 0, bornAt: 0, depth: 1, velocity: 0, normalGravity: 9};
  it('matches the Ritter front, head and interior state with exact dry support', () => {
    const fan = new WaterfallWetFront(event);
    expect(fan.front(2)).toBe(12);
    expect(fan.state(-6, 2)).toEqual({depth: 1, velocity: 0});
    expect(fan.state(0, 2)).toEqual({depth: 4 / 9, velocity: 2});
    expect(fan.state(12, 2).depth).toBe(0);
    expect(fan.inventory(12, 100, 2)).toEqual({volume: 0, momentum: 0, energy: 0});
    expect(fan.transfer(12, 0, 2)).toEqual({volume: 0, momentum: 0, energy: 0});
    // A later observation advances the same event, rather than adding 2c again.
    expect(fan.front(3)).toBe(18);
  });
  it('has the analytic fan inventory without filling whole cells', () => {
    const fan = new WaterfallWetFront(event);
    const whole = fan.inventory(-3, 6, 1);
    expect(whole.volume).toBeCloseTo(3, 13);
    expect(whole.momentum).toBeCloseTo(4500, 10);
    expect(whole.energy).toBeCloseTo(13500, 9);
    const cells = Array.from({length: 12}, (_, i) => fan.inventory(-4 + i, -3 + i, 1));
    expect(cells[10].volume).toBe(0);
    expect(cells[11].volume).toBe(0);
    expect(cells[9].volume).toBeGreaterThan(0);
  });
  it.each([-8, 0, 7])('closes each cell against shared face transfer for velocity %s', velocity => {
    const fan = new WaterfallWetFront({...event, velocity});
    for (let i = -18; i < 30; i++) {
      const before = fan.inventory(i, i + 1, .2), after = fan.inventory(i, i + 1, .8);
      const incoming = fan.transfer(i, .2, .8), outgoing = fan.transfer(i + 1, .2, .8);
      for (const key of ['volume', 'momentum', 'energy'] as const) {
        expect(after[key] - before[key]).toBeCloseTo(incoming[key] - outgoing[key], 8);
      }
    }
  });
  it('agrees with independent time quadrature of local pressure and advective flux', () => {
    const fan = new WaterfallWetFront(event), face = 1, dt = .8 / 20000;
    const sum = {volume: 0, momentum: 0, energy: 0};
    for (let i = 0; i < 20000; i++) {
      const {depth: h, velocity: u} = fan.state(face, (i + .5) * dt);
      sum.volume += h * u * dt;
      sum.momentum += 1000 * (h * u * u + 4.5 * h * h) * dt;
      sum.energy += 1000 * (.5 * h * u * u + 9 * h * h) * u * dt;
    }
    const transfer = fan.transfer(face, 0, .8);
    expect(transfer.volume).toBeCloseTo(sum.volume, 8);
    expect(transfer.momentum).toBeCloseTo(sum.momentum, 5);
    expect(transfer.energy).toBeCloseTo(sum.energy, 5);
  });
  it('preserves time splitting across delayed front arrival', () => {
    const fan = new WaterfallWetFront({...event, bornAt: 5, origin: 10});
    expect(fan.transfer(11, 5, 5.1).volume).toBe(0);
    const total = fan.transfer(11, 5, 6), first = fan.transfer(11, 5, 5.3), second = fan.transfer(11, 5.3, 6);
    for (const key of ['volume', 'momentum', 'energy'] as const) expect(total[key]).toBeCloseTo(first[key] + second[key], 9);
  });
  it('rejects invalid states and reversed time without changing the event', () => {
    expect(() => new WaterfallWetFront({...event, depth: 0})).toThrow('invalid-event');
    const fan = new WaterfallWetFront(event);
    expect(() => fan.state(1, -1)).toThrow('invalid-time');
    expect(() => fan.transfer(1, 2, 1)).toThrow('invalid-transfer');
    expect(() => fan.inventory(1, 0, 1)).toThrow('invalid-interval');
    expect(event.depth).toBe(1);
  });
  it('retains tiny first-arrival flux without cancellation amplified by bed potential', () => {
    const fan = new WaterfallWetFront({origin: 8.3, bornAt: 2, depth: 1, velocity: 0, normalGravity: 9.81});
    const arrived = fan.transfer(10, 2 + 32 / 120, 2 + 33 / 120);
    // Independent 90-digit integration of the fan tip at the binary64 input
    // times. Earlier the always-wet anchor subtracted almost equal reservoirs,
    // losing about 1e-15 m3; elevation20m amplified that error into energy.
    const expectedVolume = 5.801489033019285e-7;
    const expectedEnergy = .12505872719138172;
    expect(Math.abs(arrived.volume - expectedVolume) / expectedVolume).toBeLessThan(1e-12);
    const energy = arrived.energy + 1000 * 9.81 * 20 * arrived.volume;
    expect(Math.abs(energy - expectedEnergy) / expectedEnergy).toBeLessThan(1e-12);
  });
  it('handles the representable times immediately before and after arrival without a dry-depth threshold', () => {
    const fan = new WaterfallWetFront(event), arrival = 1 / 6;
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, arrival); const bits = view.getBigUint64(0);
    view.setBigUint64(0, bits - BigInt(1)); const before = view.getFloat64(0);
    view.setBigUint64(0, bits + BigInt(1)); const after = view.getFloat64(0);
    expect(fan.transfer(1, 0, before).volume).toBe(0);
    expect(fan.transfer(1, 0, arrival).volume).toBe(0);
    expect(fan.transfer(1, arrival, after).volume).toBeGreaterThan(0);
    const whole = fan.transfer(1, 0, .8), left = fan.transfer(1, 0, .3), right = fan.transfer(1, .3, .8);
    for (const key of ['volume','momentum','energy'] as const) expect(whole[key]).toBeCloseTo(left[key]+right[key],9);
  });
  it('integrates a stationary front and a constant fan state at the origin', () => {
    const stationary = new WaterfallWetFront({...event, velocity: -6});
    const before = stationary.inventory(-1, 0, .5), after = stationary.inventory(-1, 0, 1);
    const transfer = stationary.transfer(-1, .5, 1);
    for (const key of ['volume','momentum','energy'] as const) expect(transfer[key]).toBeCloseTo(after[key]-before[key],9);
    const fan = new WaterfallWetFront(event), atOrigin = fan.transfer(0,0,1);
    expect(atOrigin.volume).toBeCloseTo(8/9,13);
    expect(atOrigin.momentum).toBeCloseTo(1000*(16/9+8/9),9);
  });
});
