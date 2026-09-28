/**
 * @file src/utils/world/__tests__/secretGenerator.test.ts
 * Covers the deterministic secret ids introduced for agora-7687, which replaced
 * the uuidv4 / Math.random path and the single-draw `sec_<n>` id.
 */
import { describe, it, expect } from 'vitest';
import { generateSecret } from '../secretGenerator';

const SEED = 20260920;

describe('generateSecret (agora-7687)', () => {
  it('reproduces the same secret and the same id for the same options', () => {
    const options = { seed: SEED, subjectId: 'npc_marla', subjectName: 'Marla' };
    expect(generateSecret(options)).toEqual(generateSecret(options));
  });

  it('gives different subjects different ids on the same seed', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) {
      ids.add(generateSecret({ seed: SEED, subjectId: `npc_${i}` }).id);
    }
    expect(ids.size).toBe(200);
  });

  it('gives the same subject different ids on different seeds', () => {
    const a = generateSecret({ seed: SEED, subjectId: 'npc_marla' });
    const b = generateSecret({ seed: SEED + 1, subjectId: 'npc_marla' });
    expect(a.id).not.toBe(b.id);
  });

  it('stamps a stable sec_ id rather than a uuid', () => {
    const secret = generateSecret({ seed: SEED, subjectId: 'npc_marla' });
    expect(secret.id).toMatch(/^sec_[0-9a-z]{7,}$/);
    // uuidv4 shape, which this generator must no longer emit.
    expect(secret.id).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('works with seed 0, which the old optional-seed check treated as absent', () => {
    const first = generateSecret({ seed: 0, subjectId: 'npc_zero' });
    const second = generateSecret({ seed: 0, subjectId: 'npc_zero' });
    expect(first).toEqual(second);
    expect(first.id).toMatch(/^sec_/);
  });

  it('honours an explicit category and the requested value range', () => {
    for (let i = 0; i < 50; i++) {
      const secret = generateSecret({
        seed: SEED + i,
        subjectId: `npc_${i}`,
        category: 'magical',
        minValue: 3,
        maxValue: 6,
      });
      expect(secret.tags).toEqual(['magical']);
      expect(secret.value).toBeGreaterThanOrEqual(3);
      expect(secret.value).toBeLessThanOrEqual(6);
    }
  });

  it('names the subject in the content when a name is supplied', () => {
    const named = generateSecret({ seed: SEED, subjectId: 'npc_marla', subjectName: 'Marla' });
    const anonymous = generateSecret({ seed: SEED, subjectId: 'npc_marla' });
    expect(named.content.startsWith('Marla ')).toBe(true);
    expect(anonymous.content.startsWith('The subject ')).toBe(true);
    expect(named.subjectId).toBe('npc_marla');
    expect(named.knownBy).toEqual([]);
  });

  it('spreads across every category when none is requested', () => {
    const tags = new Set<string>();
    for (let i = 0; i < 300; i++) {
      tags.add(generateSecret({ seed: SEED + i * 17, subjectId: `npc_${i}` }).tags[0]);
    }
    expect(tags.size).toBeGreaterThan(1);
  });
});
