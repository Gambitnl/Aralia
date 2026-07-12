/**
 * This file protects the battle map's quick Attack selection policy.
 *
 * The map shortcut must never arm whatever happens to be first in the ability
 * array. These tests prove that it selects an available direct Action attack,
 * preserves authored loadout order, and disables honestly when no valid attack
 * exists. BattleMap renders the returned attack; ability execution remains
 * covered by the combat hooks and command tests.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Ability } from '../../../types/combat';
import { selectQuickAttack } from '../quickAttack';

// Build the smallest complete attack fixture needed by the selection policy.
// Each test overrides only the rule it is trying to exercise.
const makeAbility = (overrides: Partial<Ability>): Ability => ({
  id: 'unarmed-strike',
  name: 'Unarmed Strike',
  description: 'Make a direct melee attack.',
  type: 'attack',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 1,
  effects: [],
  ...overrides,
});

describe('selectQuickAttack', () => {
  it('skips utility and spell entries that appear before the first direct attack', () => {
    const dash = makeAbility({
      id: 'dash',
      name: 'Dash',
      type: 'movement',
      targeting: 'self',
    });
    const fireBolt = makeAbility({
      id: 'fire-bolt',
      name: 'Fire Bolt',
      type: 'spell',
    });
    const longsword = makeAbility({ id: 'longsword', name: 'Longsword' });

    expect(selectQuickAttack([dash, fireBolt, longsword], () => true)).toBe(longsword);
  });

  it('skips cooldown, depleted, and unaffordable attacks', () => {
    const coolingDown = makeAbility({ id: 'bow', currentCooldown: 2 });
    const depleted = makeAbility({ id: 'charge', maxUses: 1, usesRemaining: 0 });
    const expensive = makeAbility({ id: 'heavy-swing', cost: { type: 'action', quantity: 2 } });
    const ready = makeAbility({ id: 'dagger', name: 'Dagger' });
    const canAfford = vi.fn((cost: Ability['cost']) => cost.quantity !== 2);

    expect(selectQuickAttack([coolingDown, depleted, expensive, ready], canAfford)).toBe(ready);
  });

  it('preserves authored loadout order when several attacks are ready', () => {
    const rapier = makeAbility({ id: 'rapier', name: 'Rapier' });
    const shortbow = makeAbility({ id: 'shortbow', name: 'Shortbow', range: 16 });

    expect(selectQuickAttack([rapier, shortbow], () => true)).toBe(rapier);
  });

  it('returns no shortcut for bonus, area, or non-attack actions', () => {
    const offhand = makeAbility({ id: 'offhand', cost: { type: 'bonus' } });
    const whirlwind = makeAbility({ id: 'whirlwind', targeting: 'area' });
    const disengage = makeAbility({ id: 'disengage', type: 'utility', targeting: 'self' });

    expect(selectQuickAttack([offhand, whirlwind, disengage], () => true)).toBeNull();
  });
});
