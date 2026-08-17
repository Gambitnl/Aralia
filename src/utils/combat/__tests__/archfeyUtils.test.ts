/**
 * This file proves the Archfey Patron Fey Presence area-of-effect save
 * transaction (Wisdom save → Charmed/Frightened, once per short rest).
 */

import { describe, expect, it } from 'vitest';
import type { CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter, createMockCombatState } from '../../core';
import {
  calculateFeyPresenceSaveDc,
  FEY_PRESENCE_FEATURE_ID,
  isFeyPresenceOutcome,
  resolveFeyPresence,
} from '../archfeyUtils';

function createWarlock(charisma = 16, uses = 1): CombatCharacter {
  return createMockCombatCharacter({
    id: 'warlock',
    name: 'Warlock',
    team: 'player',
    level: 3,
    position: { x: 0, y: 0 },
    stats: {
      strength: 8, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma,
      baseInitiative: 2, speed: 30, cr: '1/4',
    },
    limitedUses: {
      fey_presence: { name: 'Fey Presence', current: uses, max: 1, resetOn: 'short_rest' },
    },
    abilities: [{
      id: FEY_PRESENCE_FEATURE_ID, name: 'Fey Presence',
      description: 'Force a Wisdom save or Charm/Frighten creatures in a 10-foot cube.',
      type: 'utility', cost: { type: 'action' }, targeting: 'area', range: 2, effects: [],
    }],
  });
}

describe('Fey Presence', () => {
  it('computes the spell save DC and validates outcomes', () => {
    expect(calculateFeyPresenceSaveDc(createWarlock())).toBe(13); // 8 + PB(2) + Cha(3)
    expect(isFeyPresenceOutcome('charmed')).toBe(true);
    expect(isFeyPresenceOutcome('frightened')).toBe(true);
    expect(isFeyPresenceOutcome('stunned')).toBe(false);
  });

  it('charms creatures in the cube that fail their save and spends the use', () => {
    const warlock = createWarlock();
    const goblin = createMockCombatCharacter({ id: 'goblin', name: 'Goblin', team: 'enemy', position: { x: 1, y: 0 } });
    const far = createMockCombatCharacter({ id: 'far', name: 'Far', team: 'enemy', position: { x: 6, y: 0 } });
    const state = createMockCombatState({ characters: [warlock, goblin, far] });

    const result = resolveFeyPresence(state, {
      warlockId: 'warlock', outcome: 'charmed', rng: () => 0.01, // low → fails save
    });
    expect(result.resolved).toBe(true);
    expect(result.outcome).toBe('charmed');
    expect(result.targets).toHaveLength(1);
    expect(result.targets?.[0].targetId).toBe('goblin');
    expect(result.targets?.[0].affected).toBe(true);
    expect(result.remainingUses).toBe(0);
    expect(result.state.characters.find(c => c.id === 'goblin')?.conditions?.some(c => c.name === 'Charmed')).toBe(true);

    // Second activation fails (use spent).
    expect(resolveFeyPresence(result.state, { warlockId: 'warlock', outcome: 'charmed' }).failure)
      .toBe('no_uses');
  });

  it('does not affect a target that succeeds its save, and rejects bad inputs', () => {
    const warlock = createWarlock();
    const goblin = createMockCombatCharacter({ id: 'goblin', name: 'Goblin', team: 'enemy', position: { x: 1, y: 0 } });
    const state = createMockCombatState({ characters: [warlock, goblin] });

    const saved = resolveFeyPresence(state, {
      warlockId: 'warlock', outcome: 'frightened', rng: () => 0.99, // high → passes
    });
    expect(saved.targets?.[0].affected).toBe(false);
    expect(saved.state.characters.find(c => c.id === 'goblin')?.conditions?.some(c => c.name === 'Frightened')).toBe(false);

    expect(resolveFeyPresence(state, { warlockId: 'warlock', outcome: 'stunned' }).failure)
      .toBe('unknown_outcome');
  });
});
