import { describe, it, expect } from 'vitest';
import { SKILLS_DATA } from '../index';

// agora-d1c7.7 (2026-09-13): every skill carries a two-sentence description.
describe('SKILLS_DATA descriptions', () => {
  it('all 18 skills have a description with at least two sentences', () => {
    const ids = Object.keys(SKILLS_DATA);
    expect(ids).toHaveLength(18);
    for (const id of ids) {
      const d = SKILLS_DATA[id].description ?? '';
      expect(d.length, id).toBeGreaterThan(60);
      expect(d.split('. ').length, id).toBeGreaterThanOrEqual(2);
      expect(d.endsWith('.'), id).toBe(true);
    }
  });
});
