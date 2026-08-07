/**
 * @file names-generator.test.ts — direct unit tests for the ported FMG
 * NamesGenerator. The pipeline goldens (fmgWorld.test.ts) exercise it
 * transitively; these tests pin its own contract: determinism under a
 * seeded Alea stream, valid output for every shipped name base, and the
 * getState suffix rules.
 *
 * The golden sequence below is a FROZEN persistence contract like the
 * pipeline goldens: burg/state/river names come from this draw order, so a
 * drift here renames content in every saved world.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Alea from 'alea';
import { NamesGenerator } from '../names-generator';
import { getNameBases } from '../name-bases';

const realRandom = Math.random;

function seedStream(seed: string): void {
  Math.random = Alea(seed) as unknown as () => number;
}

beforeEach(() => {
  seedStream('names-test-default');
});

afterEach(() => {
  Math.random = realRandom;
});

describe('NamesGenerator.getBase', () => {
  it('is deterministic for the same Alea seed', () => {
    seedStream('det-seed');
    const a = new NamesGenerator();
    const first = Array.from({ length: 20 }, () => a.getBase(0));

    seedStream('det-seed');
    const b = new NamesGenerator();
    const second = Array.from({ length: 20 }, () => b.getBase(0));

    expect(first).toEqual(second);
  });

  it('matches the golden sequence for seed names-golden-1 (FROZEN)', () => {
    seedStream('names-golden-1');
    const names = new NamesGenerator();
    const out = Array.from({ length: 8 }, (_, i) => names.getBase(i % 4));
    expect(out).toEqual([
      'Lostet',
      'Kiverhamney',
      'Madoncy',
      'Tesegio',
      'Hausen',
      'Marenbeck',
      'Correau',
      'Sango',
    ]);
  });

  it('produces a valid name from EVERY shipped name base', () => {
    // A broken base (bad syllable data) surfaces as "ERROR" or a 1-char name.
    const names = new NamesGenerator();
    const baseCount = getNameBases().length;
    expect(baseCount).toBeGreaterThan(30);

    for (let base = 0; base < baseCount; base++) {
      for (let i = 0; i < 10; i++) {
        const name = names.getBase(base);
        expect(name, `base ${base}`).not.toBe('ERROR');
        expect(name.length, `base ${base} name "${name}"`).toBeGreaterThanOrEqual(2);
        expect(name[0], `base ${base} name "${name}"`).toBe(name[0].toUpperCase());
      }
    }
  });

  it('falls back to base 0 for an unknown base index', () => {
    const names = new NamesGenerator();
    const name = names.getBase(9999);
    expect(name).not.toBe('ERROR');
    expect(name.length).toBeGreaterThanOrEqual(2);
  });

  it('respects the max length budget within syllable granularity', () => {
    const names = new NamesGenerator();
    for (let i = 0; i < 50; i++) {
      // max is a soft cap: one syllable (up to 5 chars) may land past it when
      // the word is still under min; the hard bound is max + syllable.
      const name = names.getBase(0, 4, 8);
      expect(name.length).toBeLessThanOrEqual(13);
    }
  });
});

describe('NamesGenerator.getBaseShort', () => {
  it('produces valid names', () => {
    const names = new NamesGenerator();
    for (let i = 0; i < 20; i++) {
      const name = names.getBaseShort(1);
      expect(name).not.toBe('ERROR');
      expect(name.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('NamesGenerator.getState', () => {
  it('is deterministic for the same Alea seed', () => {
    seedStream('state-seed');
    const a = new NamesGenerator();
    const first = Array.from({ length: 20 }, () => a.getState('Marenbeck', 0, 0));

    seedStream('state-seed');
    const b = new NamesGenerator();
    const second = Array.from({ length: 20 }, () => b.getState('Marenbeck', 0, 0));

    expect(first).toEqual(second);
  });

  it('collapses multiword names into one word', () => {
    const names = new NamesGenerator();
    for (let i = 0; i < 20; i++) {
      const state = names.getState('Two Words', 0, 0);
      expect(state).not.toContain(' ');
    }
  });

  it('ends Japanese (base 12) state names on a vowel or u', () => {
    const names = new NamesGenerator();
    for (let i = 0; i < 20; i++) {
      const state = names.getState('Kyot', 0, 12);
      expect('aeiouy').toContain(state.slice(-1).toLowerCase());
    }
  });

  it('returns fantasy-base (33..41) names unchanged', () => {
    const names = new NamesGenerator();
    for (let base = 33; base <= 41; base++) {
      expect(names.getState('Zargoth', 0, base)).toBe('Zargoth');
    }
  });

  it('strips -berg and -ton endings before suffixing', () => {
    const names = new NamesGenerator();
    for (let i = 0; i < 20; i++) {
      expect(names.getState('Hinterberg', 0, 0)).not.toContain('berg');
      expect(names.getState('Longmilton', 0, 0)).not.toContain('ton');
    }
  });
});
