import { describe, it, expect } from 'vitest';
import { averageDamage, calculateFirepower, describeFirepower } from '../firepower';
import type { ShipWeapon } from '../../../types/naval';

// agora-d1c7.10 (2026-09-13): Firepower = sum of average damage per hit.
const weapon = (over: Partial<ShipWeapon>): ShipWeapon => ({
  id: 'w', name: 'Ballista', type: 'Ballista', damage: '3d10', range: { normal: 120, long: 480 }, position: 'Fore', ...over,
});

describe('averageDamage', () => {
  it('reads dice, implicit one die, flat bonuses, plain numbers, and garbage', () => {
    expect(averageDamage('3d10')).toBe(16.5);
    expect(averageDamage('d6')).toBe(3.5);
    expect(averageDamage('2d8+2')).toBe(11);
    expect(averageDamage('2d8 - 1')).toBe(8);
    expect(averageDamage('7')).toBe(7);
    expect(averageDamage('lots')).toBe(0);
    expect(averageDamage('')).toBe(0);
  });
});

describe('calculateFirepower', () => {
  it('sums a two-weapon ship and lists each line', () => {
    const rating = calculateFirepower({ weapons: [weapon({ id: 'a' }), weapon({ id: 'b', name: 'Cannon', type: 'Cannon', damage: '8d10', position: 'Port' })] });
    expect(rating.total).toBe(60.5);
    expect(rating.lines).toHaveLength(2);
    expect(describeFirepower(rating)).toEqual(['Fore Ballista 3d10 (16.5)', 'Port Cannon 8d10 (44)']);
  });

  it('an unarmed ship rates zero', () => {
    expect(calculateFirepower({ weapons: [] }).total).toBe(0);
  });
});
