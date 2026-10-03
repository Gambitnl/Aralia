/**
 * This file proves the Draconic Sorcery ancestry/resistance mapping and the
 * Draconic Resilience AC/HP formulas.
 */

import { describe, expect, it } from 'vitest';
import {
  applyDraconicAncestry,
  calculateDraconicResilienceAc,
  calculateDraconicResilienceHpBonus,
  draconicAncestryDamageType,
  isDraconicAncestry,
} from '../draconicSorceryUtils';

describe('ancestry and resistance', () => {
  it('maps each dragon ancestor to its canonical damage type', () => {
    expect(isDraconicAncestry('red')).toBe(true);
    expect(isDraconicAncestry('blue')).toBe(true);
    expect(isDraconicAncestry('chromatic')).toBe(false);
    expect(draconicAncestryDamageType('red')).toBe('fire');
    expect(draconicAncestryDamageType('black')).toBe('acid');
  });

  it('merges the ancestor resistance without duplicating and rejects unknown ancestors', () => {
    const applied = applyDraconicAncestry('red', ['cold']);
    expect(applied.rejected).toBeUndefined();
    expect(applied.resistances).toEqual(expect.arrayContaining(['cold', 'fire']));

    expect(applyDraconicAncestry('dragon_god', ['cold']).rejected).toBe(true);
  });
});

describe('Draconic Resilience', () => {
  it('adds one hit point per sorcerer level', () => {
    expect(calculateDraconicResilienceHpBonus(3)).toBe(3);
    expect(calculateDraconicResilienceHpBonus(0)).toBe(0);
  });

  it('computes unarmored AC as 10 + Dex mod + Cha mod', () => {
    expect(calculateDraconicResilienceAc(14, 16)).toBe(15); // 10 + 2 + 3
    expect(calculateDraconicResilienceAc(8, 8)).toBe(8); // 10 - 1 - 1
  });
});
