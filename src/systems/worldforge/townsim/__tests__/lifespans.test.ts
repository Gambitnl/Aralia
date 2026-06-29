import {
  lifespanForRace,
  dailyDeathProbability,
  childbearingWindow,
  DEFAULT_LIFESPAN,
} from '../lifespans';

describe('lifespans', () => {
  it('returns lore lifespans for known races and default for unknown', () => {
    expect(lifespanForRace('Elf').maxAge).toBeGreaterThan(500);
    expect(lifespanForRace('Human').maxAge).toBe(80);
    expect(lifespanForRace('Nonsense')).toEqual(DEFAULT_LIFESPAN);
  });

  it('death probability is tiny in youth and rises past old age', () => {
    const young = dailyDeathProbability(20, 'Human');
    const old = dailyDeathProbability(78, 'Human');
    const ancient = dailyDeathProbability(95, 'Human');
    expect(young).toBeLessThan(0.0001);
    expect(old).toBeGreaterThan(young);
    expect(ancient).toBeGreaterThan(old);
    expect(ancient).toBeLessThanOrEqual(1);
  });

  it('an elf at 78 is still in its prime (negligible death chance)', () => {
    expect(dailyDeathProbability(78, 'Elf')).toBeLessThan(0.0001);
  });

  it('childbearing window scales with race longevity', () => {
    const human = childbearingWindow('Human');
    const elf = childbearingWindow('Elf');
    expect(human.min).toBe(lifespanForRace('Human').comingOfAge);
    expect(elf.max).toBeGreaterThan(human.max);
  });
});
