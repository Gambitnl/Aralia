import { describe, expect, it } from 'vitest';
import { threatToMonsters } from '../deEscalationToCombat';
import type { SituationThreat } from '../types';

const threat: SituationThreat = {
  hostile: true,
  enemies: [
    { name: 'Bandit', quantity: 2, cr: '1/8' },
    { name: 'Bandit Captain', quantity: 1, cr: '2' },
  ],
  deEscalationDC: 15,
  tension: 'toll-collectors itching to rob you',
};

describe('threatToMonsters', () => {
  it('maps each threat enemy to a Monster with name, quantity, cr, description', () => {
    const monsters = threatToMonsters(threat);
    expect(monsters).toEqual([
      { name: 'Bandit', quantity: 2, cr: '1/8', description: 'Bandit · CR 1/8' },
      { name: 'Bandit Captain', quantity: 1, cr: '2', description: 'Bandit Captain · CR 2' },
    ]);
  });

  it('drops enemies with empty name or non-positive quantity', () => {
    const monsters = threatToMonsters({
      ...threat,
      enemies: [
        { name: '', quantity: 3, cr: '1' },
        { name: 'Wolf', quantity: 0, cr: '1/4' },
        { name: 'Wolf', quantity: 1, cr: '1/4' },
      ],
    });
    expect(monsters).toEqual([{ name: 'Wolf', quantity: 1, cr: '1/4', description: 'Wolf · CR 1/4' }]);
  });
});
