/**
 * @file seaEncounter.test.ts — the per-day-at-sea "danger on the water" roll.
 */
import { describe, it, expect } from 'vitest';
import {
  rollSeaEncounter,
  SEA_ENCOUNTER_TABLE,
  type SeaEncounterRoll,
} from '../seaEncounter';

describe('rollSeaEncounter', () => {
  it('never rolls an encounter on danger = 0 (dead-calm safe water)', () => {
    for (let day = 1; day <= 50; day++) {
      const roll = rollSeaEncounter({ danger: 0, dayAtSea: day, voyageSig: 'v0' });
      expect(roll.encounter).toBe(false);
      expect(roll.chance).toBe(0);
      expect(roll.outcome).toBeNull();
    }
  });

  it('is deterministic: same inputs → same outcome', () => {
    const a = rollSeaEncounter({ danger: 0.5, dayAtSea: 3, voyageSig: 'abc' });
    const b = rollSeaEncounter({ danger: 0.5, dayAtSea: 3, voyageSig: 'abc' });
    expect(a).toEqual(b);
  });

  it('varies day to day for the same voyage (independent daily exposure)', () => {
    const results = new Set<string>();
    for (let day = 1; day <= 20; day++) {
      const r = rollSeaEncounter({ danger: 0.5, dayAtSea: day, voyageSig: 'trip' });
      results.add(`${r.encounter}:${r.outcome?.id ?? 'none'}`);
    }
    // Over 20 days we expect more than one distinct (encounter,outcome) shape.
    expect(results.size).toBeGreaterThan(1);
  });

  it('open-water danger yields more encounters than lane danger over many days', () => {
    const count = (danger: number) => {
      let n = 0;
      for (let day = 1; day <= 200; day++) {
        if (rollSeaEncounter({ danger, dayAtSea: day, voyageSig: 'route' }).encounter) n++;
      }
      return n;
    };
    expect(count(0.5)).toBeGreaterThan(count(0.12));
  });

  it('when an encounter fires it always carries a table outcome', () => {
    let fired = 0;
    for (let day = 1; day <= 300; day++) {
      const r = rollSeaEncounter({ danger: 0.5, dayAtSea: day, voyageSig: 'route' });
      if (r.encounter) {
        fired++;
        expect(r.outcome).not.toBeNull();
        expect(SEA_ENCOUNTER_TABLE.some((e) => e.id === r.outcome!.id)).toBe(true);
      }
    }
    expect(fired).toBeGreaterThan(0);
  });

  it('the table contains at least one hostile and one non-hostile outcome', () => {
    expect(SEA_ENCOUNTER_TABLE.some((e) => e.hostile)).toBe(true);
    expect(SEA_ENCOUNTER_TABLE.some((e) => !e.hostile)).toBe(true);
  });

  it('hostile outcomes carry combat monsters; non-hostile ones do not', () => {
    for (const e of SEA_ENCOUNTER_TABLE) {
      if (e.hostile) {
        expect(e.monsters && e.monsters.length).toBeTruthy();
      } else {
        expect(e.monsters ?? []).toHaveLength(0);
      }
    }
  });

  it('chance is clamped into [0,1]', () => {
    const r: SeaEncounterRoll = rollSeaEncounter({ danger: 5, dayAtSea: 1, voyageSig: 'x' });
    expect(r.chance).toBeGreaterThanOrEqual(0);
    expect(r.chance).toBeLessThanOrEqual(1);
  });
});
